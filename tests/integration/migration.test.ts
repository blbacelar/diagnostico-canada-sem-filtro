import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql=readFileSync(new URL("../../supabase/migrations/20260803201924_diagnostic_initial_schema.sql",import.meta.url),"utf8").toLowerCase();
const submissionLockSql=readFileSync(new URL("../../supabase/migrations/20260803233112_prevent_duplicate_diagnostic_submissions.sql",import.meta.url),"utf8").toLowerCase();
const ownershipSql=readFileSync(new URL("../../supabase/migrations/20260804034250_enforce_diagnostic_case_ownership.sql",import.meta.url),"utf8").toLowerCase();
describe("migration compartilhada",()=>{
  it("não executa operações nas tabelas do Diário de Bordo",()=>{expect(sql).not.toMatch(/(alter|drop|truncate|delete\s+from)\s+table?\s*(public\.)?journals/);expect(sql).not.toMatch(/(alter|drop|truncate|delete\s+from)\s+table?\s*(public\.)?allowed_emails/);});
  it("habilita RLS e remove acesso anon",()=>{expect(sql).toContain("enable row level security");expect(sql).toContain("revoke all on public.%i from anon");});
  it("protege snapshots e auditoria contra alteração",()=>{expect(sql).toContain("diagnostic_submissions_immutable");expect(sql).toContain("diagnostic_audit_logs_immutable");});
  it("mantém funções privilegiadas fora do schema public",()=>{expect(sql).toContain("diagnostic_private.diagnostic_is_consultant");expect(sql).not.toContain("public.diagnostic_is_consultant");});
  it("garante somente um envio imutável por diagnóstico",()=>{expect(submissionLockSql).toMatch(/create unique index[\s\S]*diagnostic_submissions\s*\(case_id\)/);});
  it("impede acesso direto aos dados reservados por outra consultora",()=>{expect(ownershipSql).toContain("diagnostic_private.diagnostic_can_access_case");expect(ownershipSql).toContain("assigned_consultant_id = (select auth.uid())");expect(ownershipSql).toContain("diagnostic_reviews_consultant_update");});
});
