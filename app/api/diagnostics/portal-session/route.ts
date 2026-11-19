import { z } from 'zod';
import { ApiError, enforceRateLimit, handleApiError, json, parseJson } from '../../../../lib/api';
import { getAdminSupabase, getSupabaseForAccessToken } from '../../../../lib/supabase';
import { getCentralClientByEmail, getCentralClientById } from '../../../../lib/central-client';
import { hasPurchasedAccessForEmail } from '../../../../lib/purchase-window';
import { getOperationalConfig } from '../../../../lib/operational-config.server';
import { createFormToken, hashFormToken, tokenCookie } from '../../../../lib/tokens';
import { portalAccessCookie, verifiedPortalStudent } from '../../../../lib/portal-student';
import { newCaseNumber } from '../../../../lib/cases';

const requestSchema = z.union([
  z.object({ caseId: z.string().uuid() }).strict(),
  z.object({ consent: z.literal(true) }).strict(),
]);
const activeStatuses = ['client_draft','submitted','ai_processing','awaiting_triage','in_review','awaiting_client','ready_for_approval','approved','sending'];

async function context(request: Request) {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const student = token ? await verifiedPortalStudent(token) : null;
  const admin = getAdminSupabase();
  if (student) {
    const client = await getCentralClientByEmail(admin, student.email);
    if (!client) throw new ApiError(403, 'Não encontramos seu cadastro. Entre em contato com a equipe.', 'CLIENT_NOT_FOUND');
    return { admin, client, student, token, canStart: true };
  }
  // Preserve o fluxo anterior para usuários do diagnóstico já vinculados.
  if (!token) throw new ApiError(401, 'Faça login para continuar.', 'AUTH_REQUIRED');
  const { data: identity, error: authError } = await getSupabaseForAccessToken(token).auth.getUser(token);
  if (authError || !identity.user) throw new ApiError(401, 'Sua sessão expirou.', 'AUTH_REQUIRED');
  const { data: link, error: linkError } = await admin.from('csf_diagnostic_user_links').select('client_id').eq('auth_user_id', identity.user.id).maybeSingle();
  if (linkError) throw linkError;
  if (!link) throw new ApiError(403, 'Seu acesso ao diagnóstico ainda precisa ser confirmado.', 'LINK_REQUIRED');
  const client = await getCentralClientById(admin, link.client_id);
  if (!client?.email || !(await hasPurchasedAccessForEmail(admin, client.email))) throw new ApiError(403, 'Seu acesso ao diagnóstico ainda precisa ser confirmado.', 'ACCESS_REQUIRED');
  return { admin, client, student: { id: identity.user.id, email: client.email }, token, canStart: false };
}

export async function GET(request: Request) {
  try {
    const { admin, client, canStart } = await context(request);
    const { data, error } = await admin.from('diagnostic_cases').select('id,case_number,status').eq('client_id', client.id).in('status', activeStatuses).is('archived_at', null);
    if (error) throw error;
    const drafts = (data ?? []).filter(item => item.status === 'client_draft');
    const { data: consents, error: consentError } = drafts.length
      ? await admin.from('diagnostic_consents').select('case_id').in('case_id', drafts.map(item => item.id)).eq('consent_type', 'diagnostic_processing').eq('granted', true)
      : { data: [], error: null };
    if (consentError) throw consentError;
    const cases = drafts.filter(item => (consents ?? []).some(consent => consent.case_id === item.id)).map(({ id, case_number }) => ({ id, case_number }));
    return json({ cases, pending: !canStart || (data ?? []).some(item => item.status !== 'client_draft') });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'portal_simulator', 20, 15);
    const { admin, client, student, token: portalToken, canStart } = await context(request);
    const input = await parseJson(request, requestSchema, 1024);
    const config = await getOperationalConfig(admin);
    let caseId: string;
    if ('caseId' in input) {
      const { data, error } = await admin.from('diagnostic_cases').select('id,status,archived_at').eq('id', input.caseId).eq('client_id', client.id).maybeSingle();
      if (error) throw error;
      if (!data || data.archived_at || data.status !== 'client_draft') throw new ApiError(404, 'Formulário não encontrado.', 'CASE_UNAVAILABLE');
      const { data: consent, error: consentError } = await admin.from('diagnostic_consents').select('id').eq('case_id', data.id).eq('consent_type', 'diagnostic_processing').eq('granted', true).limit(1).maybeSingle();
      if (consentError) throw consentError;
      if (!consent) throw new ApiError(403, 'Confirme o tratamento de dados para continuar.', 'CONSENT_REQUIRED');
      caseId = data.id;
    } else {
      if (!canStart) throw new ApiError(403, 'Entre pelo portal para iniciar o simulador.', 'ACCESS_REQUIRED');
      const { data: active, error: activeError } = await admin.from('diagnostic_cases').select('id,status').eq('client_id', client.id).in('status', activeStatuses).is('archived_at', null).limit(1).maybeSingle();
      if (activeError) throw activeError;
      if (active && active.status !== 'client_draft') throw new ApiError(409, 'Seu simulador já está em andamento com a equipe.', 'CASE_IN_PROGRESS');
      if (active) caseId = active.id;
      else {
        const { data, error } = await admin.from('diagnostic_cases').insert({ case_number: newCaseNumber(), client_id: client.id, status: 'client_draft', source_metadata: { source: 'portal_mentoria', portal_user_id: student.id } }).select('id').single();
        if (error?.code === '23505') {
          const { data: concurrent, error: concurrentError } = await admin.from('diagnostic_cases').select('id,status').eq('client_id', client.id).in('status', activeStatuses).is('archived_at', null).limit(1).maybeSingle();
          if (concurrentError) throw concurrentError;
          if (!concurrent || concurrent.status !== 'client_draft') throw new ApiError(409, 'Seu simulador já está em andamento com a equipe.', 'CASE_IN_PROGRESS');
          caseId = concurrent.id;
        } else {
          if (error) throw error;
          caseId = data.id;
        }
      }
      const { error: consentError } = await admin.from('diagnostic_consents').insert({ case_id: caseId, consent_type: 'diagnostic_processing', policy_version: config.policyVersion, granted: true, source: 'portal' });
      if (consentError) throw consentError;
    }
    const formToken = createFormToken();
    const { error: tokenError } = await admin.from('diagnostic_access_tokens').insert({ case_id: caseId, token_hash: hashFormToken(formToken), expires_at: new Date(Date.now() + config.formLinkDays * 86400000).toISOString() });
    if (tokenError) throw tokenError;
    const response = json({ ok: true });
    response.headers.append('Set-Cookie', tokenCookie(formToken));
    response.headers.append('Set-Cookie', portalAccessCookie(portalToken));
    return response;
  } catch (error) { return handleApiError(error); }
}
