import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ student: vi.fn(), client: vi.fn(), admin: vi.fn(), config: vi.fn(), rate: vi.fn() }));
vi.mock('../../lib/portal-student', () => ({ verifiedPortalStudent: m.student, portalAccessCookie: () => 'portal=fixture; HttpOnly; Secure' }));
vi.mock('../../lib/supabase', () => ({ getAdminSupabase: m.admin, getSupabaseForAccessToken: () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) }));
vi.mock('../../lib/central-client', () => ({ getCentralClientByEmail: m.client }));
vi.mock('../../lib/operational-config.server', () => ({ getOperationalConfig: m.config }));
vi.mock('../../lib/api', async importOriginal => ({ ...(await importOriginal<typeof import('../../lib/api')>()), enforceRateLimit: m.rate }));
import { GET, POST } from '../../app/api/diagnostics/portal-session/route';

const request = (body?: unknown) => new Request('https://diagnostico.example/api/diagnostics/portal-session', { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
const caseId = '11111111-1111-4111-8111-111111111111';

describe('simulador pelo portal', () => {
  let inserted: Array<{ table: string; value: unknown }>;
  beforeEach(() => {
    vi.clearAllMocks(); inserted = [];
    m.student.mockResolvedValue({ id: 'user-1', email: 'student@example.test' });
    m.client.mockResolvedValue({ id: 'client-1', email: 'student@example.test' });
    m.config.mockResolvedValue({ policyVersion: 'test', formLinkDays: 14 });
    m.rate.mockResolvedValue(undefined);
    m.admin.mockReturnValue({ from: (table: string) => {
      let inserting = false;
      const query = {
        select: () => query, eq: () => query, in: () => query, is: () => query, limit: () => query,
        insert: (value: unknown) => { inserting = true; inserted.push({ table, value }); return query; },
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: inserting ? { id: caseId } : null, error: null }),
        then: (resolve: (value: unknown) => unknown) => resolve({ data: inserting ? null : [], error: null }),
      };
      return query;
    } });
  });
  it('permite primeiro acesso sem exigir vínculo antigo', async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cases: [], pending: false });
    expect(inserted).toHaveLength(0);
  });
  it('inicia novo rascunho somente após consentimento', async () => {
    const response = await POST(request({ consent: true }));
    expect(response.status).toBe(200);
    expect(inserted.map(item => item.table)).toEqual(['diagnostic_cases', 'diagnostic_consents', 'diagnostic_access_tokens']);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  });
  it('recusa conta não autorizada e não cria dados', async () => {
    m.student.mockResolvedValue(null);
    expect((await POST(request({ consent: true }))).status).toBe(401);
    expect(inserted).toHaveLength(0);
  });
  it('não permite abrir caso de outro cliente', async () => {
    expect((await POST(request({ caseId }))).status).toBe(404);
    expect(inserted).toHaveLength(0);
  });
});
