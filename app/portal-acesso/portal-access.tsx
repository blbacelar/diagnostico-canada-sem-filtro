'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { beginPortalAuthorization, completePortalAuthorization } from '../../lib/portal-oauth';

type Case = { id: string; case_number: string };

export default function PortalAccess() {
  const [status, setStatus] = useState('Preparando seu acesso...');
  const [cases, setCases] = useState<Case[]>([]);
  const [needsProof, setNeedsProof] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const token = useRef('');
  const started = useRef(false);

  async function api(method: 'GET' | 'POST', body?: object) {
    return fetch('/api/diagnostics/portal-session', { method, headers: { Authorization: `Bearer ${token.current}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }

  async function openCase(caseId: string) {
    setPending(true);
    try {
      const response = await api('POST', { caseId });
      if (!response.ok) throw new Error();
      window.location.assign('/formulario');
    } catch { setPending(false); setStatus('Não foi possível abrir o diagnóstico. Tente novamente.'); }
  }

  async function loadCases() {
    const response = await api('GET');
    if (response.status === 403) {
      const error = await response.json() as { code?: string };
      if (error.code === 'LINK_REQUIRED') { setNeedsProof(true); setStatus('Abra seu link pessoal do diagnóstico em outra aba deste navegador. Depois volte aqui e confirme sua conta.'); return; }
      setStatus('Seu acesso ao diagnóstico ainda precisa ser confirmado.'); return;
    }
    if (!response.ok) throw new Error('Não foi possível localizar seu diagnóstico. Tente novamente.');
    const data = await response.json() as { cases: Case[] };
    if (data.cases.length === 1) { await openCase(data.cases[0].id); return; }
    setCases(data.cases);
    setStatus(data.cases.length ? 'Escolha o diagnóstico que deseja continuar.' : 'Não há formulário disponível para continuar nesta conta.');
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('code') && !params.has('error')) {
      void beginPortalAuthorization().catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Não foi possível iniciar o acesso.'));
      return;
    }
    window.history.replaceState({}, '', '/portal-acesso');
    if (params.has('error')) { void Promise.resolve().then(() => setStatus('O acesso não foi autorizado.')); return; }
    void completePortalAuthorization(params).then(async (accessToken) => { token.current = accessToken; await loadCases(); }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Não foi possível concluir o acesso.'));
  // A transação só pode ser consumida uma vez por página.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function linkAccount() {
    setPending(true);
    try {
      const response = await fetch('/api/diagnostics/portal-link', { method: 'POST', headers: { Authorization: `Bearer ${token.current}` } });
      if (!response.ok) {
        const error = await response.json() as { code?: string };
        setStatus(error.code === 'LINK_VERIFICATION_UNAVAILABLE' ? 'A confirmação segura do acesso ainda não está disponível. Entre em contato com a equipe.' : 'Não foi possível confirmar o acesso. Entre em contato com a equipe.');
        return;
      }
      setCodeSent(true);
      setStatus('Enviamos um código para o e-mail cadastrado. Informe-o abaixo.');
    } catch { setStatus('Não foi possível confirmar o acesso. Tente novamente.'); }
    finally { setPending(false); }
  }

  async function verifyCode() {
    setPending(true);
    try {
      const response = await fetch('/api/diagnostics/portal-link', { method: 'PUT', headers: { Authorization: `Bearer ${token.current}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.trim() }) });
      if (!response.ok) { setStatus('Código inválido, expirado ou vínculo em conflito. Confira e tente novamente.'); return; }
      setNeedsProof(false); setCodeSent(false); setCode('');
      await loadCases();
    } catch { setStatus('Não foi possível confirmar o acesso. Tente novamente.'); }
    finally { setPending(false); }
  }

  return <main className="module-empty"><h1>Seu diagnóstico</h1><p role="status">{status}</p>{needsProof && !codeSent && <button className="primary-button" type="button" disabled={pending} onClick={() => void linkAccount()}>Enviar código de confirmação</button>}{needsProof && codeSent && <form onSubmit={event => { event.preventDefault(); void verifyCode(); }}><label htmlFor="link-code">Código recebido por e-mail</label><input id="link-code" value={code} onChange={event => setCode(event.target.value)} autoComplete="one-time-code" required /><button className="primary-button" type="submit" disabled={pending}>Confirmar código</button></form>}{cases.map(item => <button className="primary-button" type="button" key={item.id} disabled={pending} onClick={() => void openCase(item.id)}>Continuar {item.case_number}</button>)}<p><Link href="/">Voltar ao diagnóstico</Link></p></main>;
}
