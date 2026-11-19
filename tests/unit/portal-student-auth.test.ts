import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ getSupabaseForAccessToken: () => ({ auth: { getUser: m.getUser }, rpc: m.rpc }) }));
import { verifiedPortalStudent } from '../../lib/portal-student';

describe('autorização do aluno da mentoria', () => {
  beforeEach(() => { vi.clearAllMocks(); m.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'Aluno@Example.test' } }, error: null }); m.rpc.mockResolvedValue({ data: true, error: null }); });
  it('usa identidade validada e autorização atual do portal', async () => {
    expect(await verifiedPortalStudent('token')).toEqual({ id: 'user-1', email: 'aluno@example.test' });
    expect(m.rpc).toHaveBeenCalledWith('csf_portal_mentoria_autorizada');
  });
  it('nega identidade inválida e acesso não autorizado ou indisponível', async () => {
    m.rpc.mockResolvedValueOnce({ data: false, error: null }).mockResolvedValueOnce({ data: null, error: new Error('unavailable') });
    expect(await verifiedPortalStudent('token')).toBeNull();
    expect(await verifiedPortalStudent('token')).toBeNull();
    m.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('invalid') });
    expect(await verifiedPortalStudent('token')).toBeNull();
  });
});
