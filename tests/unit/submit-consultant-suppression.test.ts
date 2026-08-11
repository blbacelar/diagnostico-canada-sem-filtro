import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireFormCase,
  getOperationalConfig,
  sendSubmissionConfirmation,
  notifyDashboardUsersOfSubmission,
  processAssessment,
} = vi.hoisted(() => ({
  requireFormCase: vi.fn(),
  getOperationalConfig: vi.fn(),
  sendSubmissionConfirmation: vi.fn(),
  notifyDashboardUsersOfSubmission: vi.fn(),
  processAssessment: vi.fn(),
}));

vi.mock("../../lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/api")>(),
  requireFormCase,
  enforceRateLimit: vi.fn(),
}));
vi.mock("../../lib/operational-config.server", () => ({ getOperationalConfig }));
vi.mock("../../lib/email", () => ({ sendSubmissionConfirmation }));
vi.mock("../../lib/dashboard-notifications", () => ({ notifyDashboardUsersOfSubmission }));
vi.mock("../../lib/cases", () => ({ processAssessment }));

import { POST } from "../../app/api/diagnostics/submit/route";

const caseId = "00000000-0000-4000-8000-000000000001";

const validAnswers = {
  age: 35,
  marital_status: "Solteiro(a)",
  nationality: "Brasileira",
  has_second_nationality: "Não",
  country_of_residence: "Brasil",
  has_children: false,
  main_objective: "Imigrar permanentemente",
  education_level: "Graduação",
  education_field: "Engenharia",
  has_second_education: "Não",
  graduation_year: 2015,
  education_outside_canada: "Sim",
  current_profession: "Engenheiro",
  experience_years: 10,
  interest_in_other_area: "Não",
  leadership_experience: "Sim",
  regulated_profession: "Não",
  canadian_work_experience: "Não",
  english_level: "Avançado",
  english_test: "IELTS",
  english_test_details: "7.5 overall",
  french_level: "Nenhum",
  french_test: "Não",
  french_investment: "Não",
  available_funds: 100000,
  funds_currency: "CAD",
  funds_scope: "Sim",
  sell_assets: "Não",
  financial_support: "Não",
  canadian_authorization: "Não",
  lived_in_canada: "Não",
  has_refusal: "Não",
  overstay: "Não",
  family_in_canada: "Nenhum",
  admissibility_issue: "Não",
  life_priorities: ["Residência permanente"],
  city_size: "Média",
  outside_major_cities: "Sim",
  location_preference: "Sem preferência",
  family_must_haves: "Nenhum",
  project_timeline: "De 6 a 12 meses",
  willing_to_delay: "Sim",
  career_change: "Não",
  smaller_regions: "Sim",
  biggest_challenge: "Idioma",
  difficulty_factors: ["Idioma"],
  main_question: "Qual o melhor programa?",
};

beforeEach(() => {
  vi.clearAllMocks();
  getOperationalConfig.mockResolvedValue({ methodologyVersion: "1.0", promptVersion: "1.0", model: "openai/gpt-5.4" });
  processAssessment.mockResolvedValue(undefined);
});

describe("submissão gerenciada por consultor", () => {
  it("não dispara e-mail para o cliente nem notificação para consultores quando submetido pelo consultor", async () => {
    const answersRows = Object.entries(validAnswers).map(([question_key, answer]) => ({ question_key, answer }));

    const queryMock = {
      select: vi.fn(() => queryMock),
      eq: vi.fn(() => queryMock),
      is: vi.fn(() => queryMock),
      order: vi.fn(() => queryMock),
      limit: vi.fn(() => queryMock),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn(() => queryMock),
      upsert: vi.fn(() => queryMock),
      single: vi.fn().mockResolvedValue({ data: { id: "sub-1", version: 1, name: "Cliente Teste", email: "cliente@example.com", phone: null }, error: null }),
      update: vi.fn(() => queryMock),
    };

    const answersQuery = {
      select: vi.fn(() => answersQuery),
      eq: vi.fn().mockResolvedValue({ data: answersRows, error: null }),
    };

    const from = vi.fn((table: string) => (table === "diagnostic_answers" ? answersQuery : queryMock));

    requireFormCase.mockResolvedValue({
      admin: { from },
      token: "token-consultor",
      caseRow: {
        id: caseId,
        case_number: "DCF-001",
        status: "client_draft",
        client_id: "client-1",
        source_metadata: { consultant_managed: true, created_by_consultant_id: "consultant-1" },
      },
    });

    const validUuid = "00000000-0000-4000-8000-000000000099";
    const response = await POST(new Request("http://localhost/api/diagnostics/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": validUuid },
      body: JSON.stringify({ consent: true, legalDisclaimerAccepted: true, policyVersion: "1.0", idempotencyKey: validUuid }),
    }));

    expect(response.status).toBe(202);
    expect(sendSubmissionConfirmation).not.toHaveBeenCalled();
    expect(notifyDashboardUsersOfSubmission).not.toHaveBeenCalled();
  });
});
