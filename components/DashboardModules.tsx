"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Bot, BookOpen, Braces, CheckCircle2, Clock3, Database, ExternalLink, Mail, RotateCcw, Save, Search, Settings, ShieldCheck, UserRound } from "lucide-react";
import { authorizedFetch, authorizedRequest, DashboardRequestError } from "../lib/dashboard-fetch";
import { operationalSettingsUpdateSchema, type OperationalSettingsUpdate } from "../lib/operational-config";
import { getCaseStatusLabel } from "../lib/status-labels";
import { DashboardError, DashboardLoading } from "./DashboardData";
import { DashboardHeader } from "./DashboardShell";
import { Input } from "./ui/input";

type ContentItem = { id: string; title: string; description: string; url: string | null; tags: string[]; active: boolean; created_at: string; updated_at: string };
type TemplateItem = { id: string; template_key: string; name: string; subject: string; body: string; active: boolean; version: number; created_at: string; updated_at: string };
type AuditItem = { id: string; case_id: string | null; case_number: string | null; actor_type: string; action: string; created_at: string };
type AuditEvent = AuditItem & { metadata?: Record<string, unknown> };
type AuditGroup = { id: string; detail_audit_id: string; case_id: string | null; case_number: string | null; latest_action: string; latest_actor_type: string; latest_created_at: string; event_count: number };
type AuditDetail = {
  audit: AuditItem & { metadata?: Record<string, unknown> };
  events: AuditEvent[];
  case: { id: string; case_number: string; status: string; objective: string | null; submitted_at: string | null; updated_at: string } | null;
  client: { id: string; name: string; email: string; phone: string | null; document: string | null; country: string | null; zip_code: string | null; city: string | null; state: string | null; address: string | null; district: string | null; number: string | null; complement: string | null; status_journey: string | null; created_at: string; updated_at: string } | null;
  purchases: Array<{ id: string; transaction_code: string | null; product_name: string | null; price_gross: number | null; price_net: number | null; status_hotmart: string | null; purchase_date: string | null; created_at: string | null }>;
};
type SettingsData = {
  account: { display_name: string; email: string; role: string };
  editable: boolean;
  operation: { policy_version: string; methodology_version: string; prompt_version: string; model: string; form_link_days: number; report_link_days: number; review_sla_hours: number; revision: number; updated_at: string; app_url: string };
  integrations: Array<{ key: string; label: string; provider: string; configured: boolean; detail: string }>;
  counts: { active_templates: number; active_content: number; open_cases: number };
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function useDashboardResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    authorizedFetch<T>(path, controller.signal)
      .then((result) => { setData(result); setError(false); })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) setError(true);
      });
    return () => controller.abort();
  }, [path]);
  return { data, setData, error };
}

export function ContentLibraryClient() {
  const { data, error } = useDashboardResource<{ items: ContentItem[] }>("/api/dashboard/content");
  const [search, setSearch] = useState("");
  const items = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return (data?.items ?? []).filter((item) => !term || [item.title, item.description, ...item.tags].some((value) => value.toLocaleLowerCase("pt-BR").includes(term)));
  }, [data, search]);

  return <>
    <DashboardHeader eyebrow="Biblioteca editorial" title="Conteúdos recomendados" description="Referências reais cadastradas para apoiar análises e próximos passos dos clientes." />
    <ModuleToolbar search={search} onSearch={setSearch} placeholder="Buscar por título, descrição ou tag" count={items.length} label="conteúdos" />
    {error ? <DashboardError /> : !data ? <DashboardLoading /> : items.length ? <section className="content-library-grid">
      {items.map((item) => <article className="content-resource-card" key={item.id}>
        <header><BookOpen /><span className={item.active ? "record-status active" : "record-status"}>{item.active ? "Ativo" : "Inativo"}</span></header>
        <h2>{item.title}</h2><p>{item.description || "Sem descrição cadastrada."}</p>
        <div className="record-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <footer><time dateTime={item.updated_at}>Atualizado em {dateFormatter.format(new Date(item.updated_at))}</time>{item.url && <a href={item.url} target="_blank" rel="noreferrer">Abrir conteúdo <ExternalLink /></a>}</footer>
      </article>)}
    </section> : <ModuleEmpty icon={<BookOpen />} text={search ? "Nenhum conteúdo corresponde à busca." : "Nenhum conteúdo foi cadastrado ainda."} />}
  </>;
}

export function EmailTemplatesClient() {
  const { data, error } = useDashboardResource<{ items: TemplateItem[] }>("/api/dashboard/templates");
  return <>
    <DashboardHeader eyebrow="Comunicação" title="Modelos de e-mail" description="Assuntos, mensagens e variáveis que estão cadastrados para as comunicações do diagnóstico." />
    {error ? <DashboardError /> : !data ? <DashboardLoading /> : data.items.length ? <section className="template-list">
      {data.items.map((item) => <article className="template-card" key={item.id}>
        <header><div><p className="eyebrow"><Mail /> {item.template_key}</p><h2>{item.name}</h2></div><div><span className={item.active ? "record-status active" : "record-status"}>{item.active ? "Ativo" : "Inativo"}</span><small>Versão {item.version}</small></div></header>
        <div className="template-subject"><span>Assunto</span><strong>{item.subject}</strong></div>
        <pre>{item.body}</pre>
        <footer><Braces /><span>Variáveis dinâmicas preservadas no envio</span><time dateTime={item.updated_at}>Atualizado em {dateFormatter.format(new Date(item.updated_at))}</time></footer>
      </article>)}
    </section> : <ModuleEmpty icon={<Mail />} text="Nenhum modelo de e-mail foi cadastrado ainda." />}
  </>;
}

const auditLabels: Record<string, string> = {
  "diagnostic.started": "Diagnóstico iniciado",
  "diagnostic.claimed": "Diagnóstico assumido para revisão",
  "diagnostic.released": "Diagnóstico liberado para outra consultora",
  "form_link.renewed": "Link do formulário renovado",
  "answers.saved": "Respostas salvas",
  "diagnostic.submitted": "Diagnóstico enviado",
  "ai_assessment.completed": "Análise estruturada concluída",
  "ai_assessment.failed": "Falha na análise estruturada",
  "diagnostic.viewed": "Diagnóstico visualizado",
  "diagnostic.delivery": "Diagnóstico entregue",
  "information.requested": "Informação solicitada",
  "review.saved": "Parecer salvo",
  "review.approved": "Parecer aprovado",
  "review.reassessment_requested": "Nova análise solicitada",
  "settings.updated": "Parâmetros operacionais atualizados",
};
const actorLabels: Record<string, string> = { client: "Cliente", consultant: "Consultora", system: "Sistema" };
const purchaseStatusLabels: Record<string, string> = {
  APPROVED: "Compra aprovada",
  COMPLETE: "Compra completa",
  PURCHASE_APPROVED: "Compra aprovada",
  PURCHASE_COMPLETE: "Compra completa",
  PURCHASE_CANCELED: "Compra cancelada",
  PURCHASE_CANCELLED: "Compra cancelada",
  PURCHASE_REFUNDED: "Compra reembolsada",
  REFUNDED: "Reembolsada",
  CHARGEBACK: "Chargeback",
  MANUAL_ENTRY: "Entrada manual",
};
const journeyLabels: Record<string, string> = {
  lead: "Lead",
  compra: "Compra",
  diagnostico_enviado: "Diagnóstico enviado",
  acompanhamento: "Acompanhamento",
  consulta_marcada: "Consulta marcada",
  consulta_concluida: "Consulta concluída",
  cancelamento: "Cancelamento",
  reembolso: "Reembolso",
};

function getAuditLabel(action: string) {
  return auditLabels[action] ?? action.split(".").map((part) => part.replaceAll("_", " ")).join(" · ");
}

function getActorLabel(actorType: string) {
  return actorLabels[actorType] ?? actorType;
}

function getPurchaseStatusLabel(status: string | null) {
  return status ? purchaseStatusLabels[status] ?? status.replaceAll("_", " ") : "Status indisponível";
}

function moneyFormatter(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function groupAuditItems(items: AuditItem[]) {
  const groups = new Map<string, AuditGroup>();
  for (const item of items) {
    const groupId = item.case_id ? `case:${item.case_id}` : `event:${item.id}`;
    const existing = groups.get(groupId);
    if (existing) {
      existing.event_count += 1;
      continue;
    }
    groups.set(groupId, {
      id: groupId,
      detail_audit_id: item.id,
      case_id: item.case_id,
      case_number: item.case_number,
      latest_action: item.action,
      latest_actor_type: item.actor_type,
      latest_created_at: item.created_at,
      event_count: 1,
    });
  }
  return [...groups.values()];
}

export function AuditLogClient() {
  const { data, error } = useDashboardResource<{ items: AuditItem[] }>("/api/dashboard/audit");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "error">("idle");
  const groups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return groupAuditItems(data?.items ?? []).filter((group) => !term || [
      group.case_number ?? "Evento geral",
      getAuditLabel(group.latest_action),
      getActorLabel(group.latest_actor_type),
      `${group.event_count} eventos`,
    ].some((value) => value.toLocaleLowerCase("pt-BR").includes(term)));
  }, [data, search]);

  async function openDetail(group: AuditGroup) {
    setSelectedId(group.id);
    setDetail(null);
    setDetailState("loading");
    try {
      const result = await authorizedFetch<AuditDetail>(`/api/dashboard/audit/${group.detail_audit_id}`);
      setDetail(result);
      setDetailState("idle");
    } catch {
      setDetailState("error");
    }
  }

  return <>
    <DashboardHeader eyebrow="Rastreabilidade" title="Auditoria" description="Registro cronológico e somente leitura das ações executadas no sistema." />
    <ModuleToolbar search={search} onSearch={setSearch} placeholder="Buscar por caso, último evento ou responsável" count={groups.length} label="casos auditados" />
    {error ? <DashboardError /> : !data ? <DashboardLoading /> : groups.length ? <section className="audit-log-list">
      {groups.map((group) => <Fragment key={group.id}>
        <article className={selectedId === group.id ? "audit-log-row selected" : "audit-log-row"}>
          <button type="button" onClick={() => void openDetail(group)} aria-expanded={selectedId === group.id} aria-label={`Abrir detalhes: ${group.case_number ?? getAuditLabel(group.latest_action)}`}>
            <span className={`audit-actor audit-actor--${group.latest_actor_type}`}>{group.latest_actor_type === "system" ? <Settings /> : group.latest_actor_type === "consultant" ? <ShieldCheck /> : <UserRound />}</span>
            <div><strong>{group.case_number ?? "Evento geral"}</strong><small>{group.event_count} {group.event_count === 1 ? "evento registrado" : "eventos registrados"}</small></div>
            <span className={group.case_number ? "audit-case-number" : "audit-no-case"}>{getAuditLabel(group.latest_action)}</span>
            <time dateTime={group.latest_created_at}>{dateTimeFormatter.format(new Date(group.latest_created_at))}</time>
          </button>
        </article>
        {selectedId === group.id && <AuditDetailPanel detail={detail} state={detailState} onClose={() => { setSelectedId(null); setDetail(null); setDetailState("idle"); }} />}
      </Fragment>)}
    </section> : <ModuleEmpty icon={<ShieldCheck />} text={search ? "Nenhum evento corresponde à busca." : "Nenhum evento de auditoria foi registrado ainda."} />}
  </>;
}

function AuditDetailPanel({ detail, state, onClose }: { detail: AuditDetail | null; state: "idle" | "loading" | "error"; onClose: () => void }) {
  return <section className="audit-detail-panel" aria-live="polite">
    <header>
      <div><p className="eyebrow">Detalhes do caso auditado</p><h2>{detail?.case ? `Caso ${detail.case.case_number}` : detail ? getAuditLabel(detail.audit.action) : state === "loading" ? "Carregando detalhes" : "Detalhes indisponíveis"}</h2></div>
      <button type="button" onClick={onClose}>Fechar</button>
    </header>
    {state === "loading" ? <p className="audit-detail-message">Buscando dados do cliente e histórico de transações…</p> : state === "error" ? <p className="audit-detail-message">Não foi possível carregar os detalhes deste evento.</p> : detail ? <>
      <div className="audit-detail-grid">
        <section>
          <p className="eyebrow">Cliente</p>
          {detail.client ? <dl>
            <DetailRow label="Nome" value={detail.client.name} />
            <DetailRow label="E-mail" value={detail.client.email} />
            <DetailRow label="Telefone" value={detail.client.phone ?? "—"} />
            <DetailRow label="Documento" value={detail.client.document ?? "—"} />
            <DetailRow label="Cidade" value={[detail.client.city, detail.client.state, detail.client.country].filter(Boolean).join(" · ") || "—"} />
            <DetailRow label="Endereço" value={[detail.client.address, detail.client.number, detail.client.district, detail.client.complement, detail.client.zip_code].filter(Boolean).join(", ") || "—"} />
            <DetailRow label="Jornada" value={detail.client.status_journey ? journeyLabels[detail.client.status_journey] ?? detail.client.status_journey : "—"} />
          </dl> : <p className="audit-detail-message">Este evento não possui cliente vinculado.</p>}
        </section>
        <section>
          <p className="eyebrow">Caso</p>
          {detail.case ? <dl>
            <DetailRow label="Número" value={detail.case.case_number} />
            <DetailRow label="Status" value={getCaseStatusLabel(detail.case.status)} />
            <DetailRow label="Objetivo" value={detail.case.objective ?? "Não informado"} />
            <DetailRow label="Enviado em" value={detail.case.submitted_at ? dateTimeFormatter.format(new Date(detail.case.submitted_at)) : "—"} />
            <DetailRow label="Atualizado em" value={dateTimeFormatter.format(new Date(detail.case.updated_at))} />
            <div><dt>Acesso</dt><dd><Link href={`/dashboard/diagnosticos/${detail.case.id}`}>Abrir diagnóstico <ExternalLink /></Link></dd></div>
          </dl> : <p className="audit-detail-message">Evento geral sem caso de diagnóstico.</p>}
        </section>
      </div>
      <section className="audit-transactions">
        <header><p className="eyebrow">Histórico de auditoria</p><h3>Passos registrados neste caso</h3></header>
        {detail.events.length ? <table>
          <thead><tr><th>Data</th><th>Evento</th><th>Responsável</th></tr></thead>
          <tbody>{detail.events.map((event) => <tr key={event.id}>
            <td>{dateTimeFormatter.format(new Date(event.created_at))}</td>
            <td>{getAuditLabel(event.action)}</td>
            <td>{getActorLabel(event.actor_type)}</td>
          </tr>)}</tbody>
        </table> : <p className="audit-detail-message">Nenhum passo de auditoria encontrado para este caso.</p>}
      </section>
      <section className="audit-transactions">
        <header><p className="eyebrow">Histórico de transações</p><h3>Compras vinculadas ao cliente</h3></header>
        {detail.purchases.length ? <table>
          <thead><tr><th>Data da compra</th><th>Transação</th><th>Produto</th><th>Status</th><th>Valor bruto</th><th>Valor líquido</th></tr></thead>
          <tbody>{detail.purchases.map((purchase) => <tr key={purchase.id}>
            <td>{purchase.purchase_date ? dateTimeFormatter.format(new Date(purchase.purchase_date)) : "—"}</td>
            <td>{purchase.transaction_code ?? "—"}</td>
            <td>{purchase.product_name ?? "—"}</td>
            <td>{getPurchaseStatusLabel(purchase.status_hotmart)}</td>
            <td>{moneyFormatter(purchase.price_gross)}</td>
            <td>{moneyFormatter(purchase.price_net)}</td>
          </tr>)}</tbody>
        </table> : <p className="audit-detail-message">Nenhuma transação encontrada para este cliente.</p>}
      </section>
    </> : null}
  </section>;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

export function SettingsClient() {
  const { data, setData, error } = useDashboardResource<SettingsData>("/api/dashboard/settings");
  const [draftOverride, setDraftOverride] = useState<SettingsDraft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  const draft = data ? draftOverride ?? draftFromOperation(data.operation) : null;
  const dirty = Boolean(data && draftOverride && JSON.stringify(draftOverride) !== JSON.stringify(draftFromOperation(data.operation)));

  function updateDraft(key: keyof SettingsDraft, value: string | number) {
    setDraftOverride((current) => data ? { ...(current ?? draftFromOperation(data.operation)), [key]: value } : current);
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setSaveState("idle");
    setSaveMessage("");
  }

  function resetDraft() {
    if (!data) return;
    setDraftOverride(null);
    setFieldErrors({});
    setSaveState("idle");
    setSaveMessage("");
  }

  async function saveSettings() {
    if (!draft || !data?.editable || saveState === "saving") return;
    const validation = operationalSettingsUpdateSchema.safeParse(draft);
    if (!validation.success) {
      setFieldErrors(Object.fromEntries(validation.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      setSaveState("error");
      setSaveMessage("Confira os parâmetros destacados.");
      return;
    }
    setSaveState("saving");
    setSaveMessage("");
    try {
      const result = await authorizedRequest<{ operation: Omit<SettingsData["operation"], "app_url"> }>("/api/dashboard/settings", {
        method: "PATCH",
        body: JSON.stringify(validation.data),
      });
      const operation = { ...result.operation, app_url: data.operation.app_url };
      setData((current) => current ? { ...current, operation } : current);
      setDraftOverride(null);
      setFieldErrors({});
      setSaveState("saved");
      setSaveMessage("Parâmetros atualizados. As novas operações já usarão estes valores.");
    } catch (requestError) {
      setSaveState("error");
      setSaveMessage(requestError instanceof DashboardRequestError ? requestError.message : "Não foi possível salvar as configurações.");
    }
  }

  return <>
    <DashboardHeader eyebrow="Operação" title="Configurações" description="Gerencie a conta, integrações e parâmetros usados nas próximas operações do diagnóstico." />
    {error ? <DashboardError /> : !data ? <DashboardLoading /> : <div className="settings-layout">
      <section className="settings-account"><header><UserRound /><div><p className="eyebrow">Conta profissional</p><h2>{data.account.display_name}</h2></div></header><dl><SettingRow label="E-mail" value={data.account.email} /><SettingRow label="Permissão" value={data.account.role === "admin" ? "Administradora" : "Consultora"} /><SettingRow label="Endereço da aplicação" value={data.operation.app_url} /></dl></section>
      <section className="settings-counts"><article><strong>{data.counts.open_cases}</strong><span>Casos ativos</span></article><article><strong>{data.counts.active_content}</strong><span>Conteúdos ativos</span></article><article><strong>{data.counts.active_templates}</strong><span>Modelos ativos</span></article></section>
      <section className="settings-integrations"><header><p className="eyebrow">Integrações</p><h2>Serviços conectados</h2></header><div>{data.integrations.map((integration) => <article key={integration.key}>{integration.key === "database" ? <Database /> : integration.key === "email" ? <Mail /> : <Bot />}<div><strong>{integration.label}</strong><span>{integration.provider} · {integration.detail}</span></div><small className={integration.configured ? "configured" : ""}><CheckCircle2 />{integration.configured ? "Configurado" : "Pendente"}</small></article>)}</div></section>
      <section className="settings-operation">
        <header><Clock3 /><div><p className="eyebrow">Parâmetros ativos</p><h2>Regras operacionais</h2></div>{data.editable && <div className="settings-operation-actions"><button className="secondary-button" type="button" disabled={!dirty || saveState === "saving"} onClick={resetDraft}><RotateCcw /> Restaurar</button><button className="primary-button" type="button" disabled={!dirty || saveState === "saving"} onClick={saveSettings}><Save /> {saveState === "saving" ? "Salvando…" : "Salvar alterações"}</button></div>}</header>
        {draft && <div className="settings-operation-form">
          <OperationField label="Política de consentimento" hint="Versão registrada com novos consentimentos" name="policy_version" value={draft.policy_version} error={fieldErrors.policy_version} disabled={!data.editable} onChange={updateDraft} />
          <OperationField label="Metodologia" hint="Versão usada nas próximas análises" name="methodology_version" value={draft.methodology_version} error={fieldErrors.methodology_version} disabled={!data.editable} onChange={updateDraft} />
          <OperationField label="Prompt" hint="Versão do prompt estruturado" name="prompt_version" value={draft.prompt_version} error={fieldErrors.prompt_version} disabled={!data.editable} onChange={updateDraft} />
          <OperationField className="settings-operation-field--wide" label="Modelo de análise" hint="Identificador OpenRouter no formato provedor/modelo" name="model" value={draft.model} error={fieldErrors.model} disabled={!data.editable} onChange={updateDraft} />
          <OperationField label="Validade do formulário" hint="De 1 a 90 dias" name="form_link_days" type="number" value={draft.form_link_days} error={fieldErrors.form_link_days} disabled={!data.editable} onChange={updateDraft} />
          <OperationField label="Validade do relatório" hint="De 1 a 365 dias" name="report_link_days" type="number" value={draft.report_link_days} error={fieldErrors.report_link_days} disabled={!data.editable} onChange={updateDraft} />
          <OperationField label="Meta de primeira revisão" hint="De 1 a 720 horas" name="review_sla_hours" type="number" value={draft.review_sla_hours} error={fieldErrors.review_sla_hours} disabled={!data.editable} onChange={updateDraft} />
        </div>}
        {!data.editable && <p className="settings-readonly"><ShieldCheck /> Somente administradoras podem alterar parâmetros globais.</p>}
        {saveMessage && <p className={`settings-save-message settings-save-message--${saveState}`} role={saveState === "error" ? "alert" : "status"}>{saveMessage}</p>}
        <footer>Revisão {data.operation.revision} · atualizada em {dateTimeFormatter.format(new Date(data.operation.updated_at))}</footer>
      </section>
    </div>}
  </>;
}

type SettingsDraft = Omit<OperationalSettingsUpdate, "form_link_days" | "report_link_days" | "review_sla_hours"> & {
  form_link_days: number | "";
  report_link_days: number | "";
  review_sla_hours: number | "";
};

function draftFromOperation(operation: SettingsData["operation"]): SettingsDraft {
  return {
    policy_version: operation.policy_version,
    methodology_version: operation.methodology_version,
    prompt_version: operation.prompt_version,
    model: operation.model,
    form_link_days: operation.form_link_days,
    report_link_days: operation.report_link_days,
    review_sla_hours: operation.review_sla_hours,
    revision: operation.revision,
  };
}

function OperationField({ className, label, hint, name, type = "text", value, error, disabled, onChange }: { className?: string; label: string; hint: string; name: keyof SettingsDraft; type?: "text" | "number"; value: string | number; error?: string; disabled: boolean; onChange: (key: keyof SettingsDraft, value: string | number) => void }) {
  const errorId = `${name}-error`;
  return <label className={className}><span>{label}</span><small>{hint}</small><Input name={name} type={type} min={type === "number" ? 1 : undefined} step={type === "number" ? 1 : undefined} value={value} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(name, type === "number" ? (event.target.value === "" ? "" : Number(event.target.value)) : event.target.value)} />{error && <em id={errorId} role="alert">{error}</em>}</label>;
}

function ModuleToolbar({ search, onSearch, placeholder, count, label }: { search: string; onSearch: (value: string) => void; placeholder: string; count: number; label: string }) {
  return <div className="module-toolbar"><label><Search /><input aria-label={`Buscar ${label}`} value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} /></label><p><strong>{count}</strong> {label}</p></div>;
}

function ModuleEmpty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <section className="module-empty module-empty--honest">{icon}<h2>Sem registros</h2><p>{text}</p></section>;
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
