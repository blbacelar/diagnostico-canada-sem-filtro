import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), upsert: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ getAdminSupabase: () => ({ from: mocks.from }) }));
vi.mock('../../lib/api', () => ({
  ApiError: class extends Error { status = 400; }, enforceRateLimit: async () => {}, writeAudit: async () => {},
  json: (value: unknown) => Response.json(value), parseJson: async (request: Request) => request.json(), requestIp: () => 'test', handleApiError: () => new Response(null, { status: 500 }),
}));
vi.mock('../../lib/central-client', () => ({ getCentralClientByEmail: async () => ({ id: 'client-1', email: 'aluno@example.invalid', name: 'Existente' }), upsertCentralClient: mocks.upsert }));
vi.mock('../../lib/purchase-window', () => ({ hasPurchasedAccessForEmail: async () => true }));
vi.mock('../../lib/operational-config.server', () => ({ getOperationalConfig: async () => ({ formLinkDays: 7 }) }));
vi.mock('../../lib/email', () => ({ sendContinuationEmail: async () => ({ data: { id: 'test' }, error: null }) }));
vi.mock('../../lib/tokens', () => ({ createFormToken: () => 'fake-token', hashFormToken: () => 'fake-hash' }));
vi.mock('../../lib/cases', () => ({ newCaseNumber: () => 'TEST' }));
import { POST } from '../../app/api/diagnostics/start/route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockImplementation((table: string) => {
    const query = { select: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query, maybeSingle: async () => ({ data: { id: 'case-1', case_number: 'TEST', status: 'client_draft' }, error: null }), insert: async () => ({ error: null }), update: mocks.update };
    if (table === 'diagnostic_cases') return query;
    return { insert: query.insert, update: mocks.update };
  });
});

it('exige abertura do link por e-mail e preserva cadastro e links existentes', async () => {
  const response = await POST(new Request('http://localhost/api/diagnostics/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fullName: 'Outro nome', email: 'aluno@example.invalid', policyVersion: 'v1' }) }));
  expect(response.status).toBe(200);
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});
