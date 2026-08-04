"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bot, BookOpen, Braces, CheckCircle2, Clock3, Database, ExternalLink, Mail, Search, Settings, ShieldCheck, UserRound } from "lucide-react";
import { authorizedFetch } from "../lib/dashboard-fetch";
import { DashboardError, DashboardLoading } from "./DashboardData";
import { DashboardHeader } from "./DashboardShell";

type ContentItem = { id: string; title: string; description: string; url: string | null; tags: string[]; active: boolean; created_at: string; updated_at: string };
type TemplateItem = { id: string; template_key: string; name: string; subject: string; body: string; active: boolean; version: number; created_at: string; updated_at: string };
type AuditItem = { id: string; case_id: string | null; case_number: string | null; actor_type: string; action: string; created_at: string };
type SettingsData = {
  account: { display_name: string; email: string; role: string };
  operation: { policy_version: string; methodology_version: string; model: string; form_link_days: number; report_link_days: number; review_sla_hours: number; app_url: string };
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
  return { data, error };
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
};
const actorLabels: Record<string, string> = { client: "Cliente", consultant: "Consultora", system: "Sistema" };

export function AuditLogClient() {
  const { data, error } = useDashboardResource<{ items: AuditItem[] }>("/api/dashboard/audit");
  const [search, setSearch] = useState("");
  const items = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return (data?.items ?? []).filter((item) => !term || [auditLabels[item.action] ?? item.action, item.case_number ?? "", actorLabels[item.actor_type] ?? item.actor_type].some((value) => value.toLocaleLowerCase("pt-BR").includes(term)));
  }, [data, search]);

  return <>
    <DashboardHeader eyebrow="Rastreabilidade" title="Auditoria" description="Registro cronológico e somente leitura das ações executadas no sistema." />
    <ModuleToolbar search={search} onSearch={setSearch} placeholder="Buscar por ação, caso ou responsável" count={items.length} label="eventos" />
    {error ? <DashboardError /> : !data ? <DashboardLoading /> : items.length ? <section className="audit-log-list">
      {items.map((item) => <article key={item.id}>
        <span className={`audit-actor audit-actor--${item.actor_type}`}>{item.actor_type === "system" ? <Settings /> : item.actor_type === "consultant" ? <ShieldCheck /> : <UserRound />}</span>
        <div><strong>{auditLabels[item.action] ?? item.action.replaceAll(".", " · ")}</strong><small>{actorLabels[item.actor_type] ?? item.actor_type}</small></div>
        {item.case_id && item.case_number ? <Link href={`/dashboard/diagnosticos/${item.case_id}`}>{item.case_number}</Link> : <span className="audit-no-case">Evento geral</span>}
        <time dateTime={item.created_at}>{dateTimeFormatter.format(new Date(item.created_at))}</time>
      </article>)}
    </section> : <ModuleEmpty icon={<ShieldCheck />} text={search ? "Nenhum evento corresponde à busca." : "Nenhum evento de auditoria foi registrado ainda."} />}
  </>;
}

export function SettingsClient() {
  const { data, error } = useDashboardResource<SettingsData>("/api/dashboard/settings");
  return <>
    <DashboardHeader eyebrow="Operação" title="Configurações" description="Estado real da conta, integrações e parâmetros usados pelo diagnóstico." />
    {error ? <DashboardError /> : !data ? <DashboardLoading /> : <div className="settings-layout">
      <section className="settings-account"><header><UserRound /><div><p className="eyebrow">Conta profissional</p><h2>{data.account.display_name}</h2></div></header><dl><SettingRow label="E-mail" value={data.account.email} /><SettingRow label="Permissão" value={data.account.role === "admin" ? "Administradora" : "Consultora"} /><SettingRow label="Endereço da aplicação" value={data.operation.app_url} /></dl></section>
      <section className="settings-counts"><article><strong>{data.counts.open_cases}</strong><span>Casos ativos</span></article><article><strong>{data.counts.active_content}</strong><span>Conteúdos ativos</span></article><article><strong>{data.counts.active_templates}</strong><span>Modelos ativos</span></article></section>
      <section className="settings-integrations"><header><p className="eyebrow">Integrações</p><h2>Serviços conectados</h2></header><div>{data.integrations.map((integration) => <article key={integration.key}>{integration.key === "database" ? <Database /> : integration.key === "email" ? <Mail /> : <Bot />}<div><strong>{integration.label}</strong><span>{integration.provider} · {integration.detail}</span></div><small className={integration.configured ? "configured" : ""}><CheckCircle2 />{integration.configured ? "Configurado" : "Pendente"}</small></article>)}</div></section>
      <section className="settings-operation"><header><Clock3 /><div><p className="eyebrow">Parâmetros ativos</p><h2>Regras operacionais</h2></div></header><dl><SettingRow label="Política de consentimento" value={data.operation.policy_version} /><SettingRow label="Metodologia" value={data.operation.methodology_version} /><SettingRow label="Modelo de análise" value={data.operation.model} /><SettingRow label="Validade do formulário" value={`${data.operation.form_link_days} dias`} /><SettingRow label="Validade do relatório" value={`${data.operation.report_link_days} dias`} /><SettingRow label="Meta de primeira revisão" value={`${data.operation.review_sla_hours} horas`} /></dl></section>
    </div>}
  </>;
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
