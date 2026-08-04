"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, Clock3, LockKeyhole, Search, SlidersHorizontal, UsersRound } from "lucide-react";
import type { ClientListItem } from "../lib/clients";
import { authorizedFetch } from "../lib/dashboard-fetch";
import { caseStatusLabels, getCaseStatusLabel } from "../lib/status-labels";
import { DashboardHeader } from "./DashboardShell";

type CaseRow = { id: string; case_number: string; status: string; objective: string | null; submitted_at: string | null; updated_at: string; assigned_consultant_id?: string | null; locked_by_other?: boolean; locked_by_name?: string | null; diagnostic_clients: { full_name: string; email_display: string } | null; diagnostic_ai_assessments?: Array<{ structured_result: { overallScore?: number; readinessLevel?: string; technicalAlerts?: string[] } }> };
type Summary = { counts: Record<string, number>; recent: CaseRow[]; averageHours: number | null; reviewSlaHours: number };

export function OverviewClient() {
  const [data, setData] = useState<Summary | null>(null); const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => authorizedFetch<Summary>("/api/dashboard/summary").then((summary) => { if (active) { setData(summary); setError(false); } }).catch(() => { if (active) setError(true); });
    load();
    const interval = window.setInterval(load, 30_000);
    window.addEventListener("focus", load);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", load); };
  }, []);
  return <>
    <DashboardHeader eyebrow="Segunda-feira · central de análise" title="Bom trabalho, consultora." description="Prioridades organizadas para começar pelos casos que mais precisam de atenção." action={<Link className="outline-action" href="/dashboard/diagnosticos">Ver todos os diagnósticos <ArrowUpRight /></Link>} />
    {error ? <DashboardError /> : !data ? <DashboardLoading /> : <>
      <section className="metric-grid">
        <Metric number={data.counts.new_cases ?? 0} label="Aguardando análise" detail="Recebidos" accent />
        <Metric number={data.counts.in_review ?? 0} label="Em revisão" detail="Em andamento" warning />
        <Metric number={data.counts.ready_to_send ?? 0} label="Prontos para envio" detail="Revisão concluída" />
        <Metric number={data.counts.delivered ?? 0} label="Diagnósticos enviados" detail="Entregues" success />
      </section>
      <section className="dashboard-columns">
        <div className="priority-list"><header><div><p className="eyebrow">Fila prioritária</p><h2>Casos para revisar agora</h2></div><Link href="/dashboard/diagnosticos">Lista completa</Link></header>{data.recent.length ? data.recent.map((item) => <CaseLine key={item.id} item={item} />) : <div className="empty-row">Nenhum caso aguardando revisão.</div>}</div>
        <aside className="service-time"><Clock3 /><p className="eyebrow">Tempo de resposta</p><strong>{data.averageHours === null ? "—" : `${data.averageHours}h`}</strong><span>Média entre envio e primeira revisão</span><div><b style={{ width: data.averageHours ? `${Math.min(100, data.averageHours / data.reviewSlaHours * 100)}%` : "0%" }} /></div><small>Meta interna · até {data.reviewSlaHours}h</small></aside>
      </section>
    </>}
  </>;
}

function Metric({ number, label, detail, accent, warning, success }: { number: number; label: string; detail: string; accent?: boolean; warning?: boolean; success?: boolean }) { return <article className={`metric ${accent ? "accent" : warning ? "warning" : success ? "success" : ""}`}><span>{detail}</span><strong>{String(number).padStart(2, "0")}</strong><h2>{label}</h2></article>; }

function CaseLine({ item }: { item: CaseRow }) {
  const result = item.diagnostic_ai_assessments?.[0]?.structured_result;
  const content = <><div className="case-avatar">{item.diagnostic_clients?.full_name?.split(" ").map((part) => part[0]).slice(0,2).join("")}</div><div className="case-person"><strong>{item.diagnostic_clients?.full_name}</strong><small>{item.case_number} · {item.objective ?? "Objetivo não informado"}</small>{item.locked_by_other && <small className="case-lock-label"><LockKeyhole /> Em revisão por {item.locked_by_name ?? "outra consultora"}</small>}</div><span className={`status-pill status-${item.status}`}>{getCaseStatusLabel(item.status)}</span>{item.locked_by_other ? <span className="case-lock-icon" title={`Em revisão por ${item.locked_by_name ?? "outra consultora"}`}><LockKeyhole /></span> : result?.technicalAlerts?.length ? <span className="alert-count"><AlertTriangle />{result.technicalAlerts.length}</span> : <span className="score">{result?.overallScore ?? "—"}<small>/100</small></span>}{item.locked_by_other ? <LockKeyhole className="row-arrow" /> : <ArrowUpRight className="row-arrow" />}</>;
  return item.locked_by_other
    ? <div className="case-line case-line--locked" aria-disabled="true">{content}</div>
    : <Link className="case-line" href={`/dashboard/diagnosticos/${item.id}`}>{content}</Link>;
}

export function DiagnosticsListClient() {
  const [items, setItems] = useState<CaseRow[]>([]); const [loading, setLoading] = useState(true); const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [error, setError] = useState(false);
  useEffect(() => { const query = new URLSearchParams(); if (search) query.set("search", search); if (status) query.set("status", status); const timer = setTimeout(() => authorizedFetch<{items:CaseRow[]}>(`/api/dashboard/cases?${query}`).then((data) => { setItems(data.items); setError(false); }).catch(() => setError(true)).finally(() => setLoading(false)), 250); return () => clearTimeout(timer); }, [search, status]);
  return <>
    <DashboardHeader eyebrow="Casos" title="Diagnósticos" description="Busque, filtre e acompanhe cada etapa da análise profissional." />
    <div className="list-toolbar"><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou número" /></label><label><SlidersHorizontal /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os status</option>{Object.entries(caseStatusLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
    {error ? <DashboardError /> : loading ? <DashboardLoading /> : <div className="diagnostic-table"><div className="table-head"><span>Cliente / diagnóstico</span><span>Objetivo</span><span>Preparo</span><span>Status</span><span>Atualização</span><span /></div>{items.length ? items.map((item) => <CaseLine key={item.id} item={item} />) : <div className="empty-row">Nenhum diagnóstico encontrado.</div>}</div>}
  </>;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function ClientsListClient() {
  const [items, setItems] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      authorizedFetch<{ items: ClientListItem[] }>(`/api/dashboard/clients?${query}`, controller.signal)
        .then((data) => { setItems(data.items); setError(false); })
        .catch((fetchError: unknown) => {
          if (!(fetchError instanceof DOMException && fetchError.name === "AbortError")) setError(true);
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search]);

  return <>
    <DashboardHeader eyebrow="Relacionamento" title="Clientes" description="Consulte cada pessoa, seus diagnósticos e a atividade mais recente em um único lugar." />
    <div className="clients-toolbar">
      <label><Search /><input aria-label="Buscar clientes" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou e-mail" /></label>
      {!loading && !error && <p><UsersRound /><strong>{items.length}</strong> {items.length === 1 ? "cliente encontrado" : "clientes encontrados"}</p>}
    </div>
    {error ? <DashboardError /> : loading ? <DashboardLoading /> : <div className="clients-table">
      <div className="clients-table-head"><span>Cliente</span><span>Diagnósticos</span><span>Caso mais recente</span><span>Status</span><span>Última atividade</span><span /></div>
      {items.length ? items.map((item) => <ClientLine key={item.id} item={item} />) : <div className="empty-row">{search ? "Nenhum cliente corresponde à busca." : "Nenhum cliente cadastrado ainda."}</div>}
    </div>}
  </>;
}

function ClientLine({ item }: { item: ClientListItem }) {
  const content = <>
    <div className="client-identity"><div className="case-avatar">{item.full_name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("")}</div><div><strong>{item.full_name}</strong><small>{item.email_display}</small></div></div>
    <span className="client-case-count"><strong>{item.case_count}</strong><small>{item.case_count === 1 ? "diagnóstico" : "diagnósticos"}</small></span>
    <div className="client-latest-case"><strong>{item.latest_case?.case_number ?? "Sem diagnóstico"}</strong><small>{item.latest_case?.objective ?? "Objetivo não informado"}</small></div>
    {item.latest_case ? <span className={`status-pill status-${item.latest_case.status}`}>{getCaseStatusLabel(item.latest_case.status)}</span> : <span className="status-pill">Sem caso</span>}
    <time dateTime={item.last_activity_at}>{dateFormatter.format(new Date(item.last_activity_at))}</time>
    <ArrowUpRight className="row-arrow" />
  </>;

  return item.latest_case
    ? <Link className="client-line" href={`/dashboard/diagnosticos/${item.latest_case.id}`}>{content}</Link>
    : <div className="client-line client-line--static">{content}</div>;
}

export function DashboardLoading() { return <div className="dashboard-loading"><span /><span /><span /></div>; }
export function DashboardError({ title = "Não foi possível carregar os dados", detail = "Confirme a conexão e tente atualizar a página." }: { title?: string; detail?: string } = {}) { return <div className="dashboard-error"><AlertTriangle /><h2>{title}</h2><p>{detail}</p></div>; }
