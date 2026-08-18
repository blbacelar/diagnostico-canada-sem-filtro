"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, Clock3, LockKeyhole, Search, UsersRound } from "lucide-react";
import type { ClientListItem } from "../lib/clients";
import { authorizedFetch } from "../lib/dashboard-fetch";
import { caseStatusLabels, getCaseStatusLabel } from "../lib/status-labels";
import { DashboardHeader, useDashboardConsultant } from "./DashboardShell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type CaseRow = { id: string; case_number: string; status: string; objective: string | null; submitted_at: string | null; updated_at: string; assigned_consultant_id?: string | null; locked_by_other?: boolean; locked_by_name?: string | null; diagnostic_clients: { full_name: string; email_display: string } | null; diagnostic_ai_assessments?: Array<{ structured_result: { overallScore?: number; readinessLevel?: string; technicalAlerts?: string[] } }> };
type Summary = { counts: Record<string, number>; recent: CaseRow[]; averageHours: number | null; reviewSlaHours: number };
type CaseListResponse = {
  items: CaseRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export function OverviewClient() {
  const consultant = useDashboardConsultant();
  const displayName = consultant?.display_name.trim();
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
    <DashboardHeader eyebrow="Segunda-feira · central de análise" title={displayName ? `Bom trabalho, ${displayName}.` : "Bom trabalho."} description="Prioridades organizadas para começar pelos casos que mais precisam de atenção." action={<Link className="outline-action" href="/dashboard/diagnosticos">Ver todos os simuladores <ArrowUpRight /></Link>} />
    {error ? <DashboardError /> : !data ? <DashboardLoading /> : <>
      <section className="metric-grid">
        <Metric number={data.counts.new_cases ?? 0} label="Aguardando análise" detail="Recebidos" accent />
        <Metric number={data.counts.in_review ?? 0} label="Em revisão" detail="Em andamento" warning />
        <Metric number={data.counts.ready_to_send ?? 0} label="Prontos para envio" detail="Revisão concluída" />
        <Metric number={data.counts.delivered ?? 0} label="Simuladores enviados" detail="Entregues" success />
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
  const score = result?.overallScore;
  const technicalAlerts = result?.technicalAlerts ?? [];
  const alertsCount = technicalAlerts.length;
  const content = <><div className="case-avatar">{item.diagnostic_clients?.full_name?.split(" ").map((part) => part[0]).slice(0,2).join("")}</div><div className="case-person"><strong>{item.diagnostic_clients?.full_name}</strong><small>{item.case_number}</small>{item.locked_by_other && <small className="case-lock-label"><LockKeyhole /> Em revisão por {item.locked_by_name ?? "outra consultora"}</small>}</div><div className="case-objective">{item.objective ?? "Objetivo não informado"}</div><span className={`status-pill status-${item.status}`}>{getCaseStatusLabel(item.status)}</span><span className="score">{score ?? "—"}<small>{typeof score === "number" ? "/100" : ""}</small></span>{alertsCount > 0 ? <span className="alert-count alert-count--with-popover"><AlertTriangle />{alertsCount}<span className="alert-popover" role="tooltip"><strong>Alertas técnicos</strong><ul>{technicalAlerts.map((alert, index) => <li key={`${item.id}-alert-${index}`}>{alert}</li>)}</ul></span></span> : <span className="alert-count alert-count--empty">—</span>}{item.locked_by_other ? <LockKeyhole className="row-arrow" /> : <ArrowUpRight className="row-arrow" />}</>;
  return item.locked_by_other
    ? <div className="case-line case-line--locked" aria-disabled="true">{content}</div>
    : <Link className="case-line" href={`/dashboard/diagnosticos/${item.id}`}>{content}</Link>;
}

export function DiagnosticsListClient() {
  const PAGE_SIZE = 10;
  const router = useRouter();
  const [items, setItems] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  useEffect(() => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    query.set("page", String(page));
    query.set("pageSize", String(PAGE_SIZE));

    const timer = setTimeout(() => {
      setLoading(true);
      authorizedFetch<CaseListResponse>(`/api/dashboard/cases?${query}`)
        .then((data) => {
          setItems(data.items);
          setPagination(data.pagination);
          setError(false);
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [page, search, status]);

  function goToPreviousPage() {
    setPage((current) => Math.max(1, current - 1));
  }

  function goToNextPage() {
    setPage((current) => Math.min(pagination.totalPages, current + 1));
  }

  function openCase(caseId: string) {
    router.push(`/dashboard/diagnosticos/${caseId}`);
  }

  return <>
    <DashboardHeader eyebrow="Operações" title="Simuladores" description="Acompanhe o funil completo do simulador, revisões ativas e prontas para entrega." />
    <div className="list-toolbar"><label className="list-toolbar__search"><Search /><input aria-label="Buscar simuladores" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar por nome, e-mail ou código" /></label><label className="list-toolbar__select"><Select value={status || "all"} onValueChange={(value) => { setStatus(value === "all" ? "" : value); setPage(1); }}><SelectTrigger className="list-toolbar__select-trigger"><SelectValue placeholder="Todos os status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(caseStatusLabels).map(([value,label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select></label></div>
    {error ? <DashboardError /> : loading ? <DashboardLoading /> : <div className="diagnostic-table"><div className="diagnostic-table__scroll"><Table className="diagnostic-table__table"><TableHeader><TableRow><TableHead className="w-[320px]">Cliente / simulador</TableHead><TableHead>Objetivo</TableHead><TableHead>Status</TableHead><TableHead>Preparo</TableHead><TableHead>Alertas</TableHead><TableHead className="w-[18px]" /></TableRow></TableHeader><TableBody>{items.length ? items.map((item) => <DiagnosticTableRow key={item.id} item={item} onOpen={openCase} />) : <TableRow><TableCell colSpan={6}><div className="empty-row">Nenhum simulador encontrado.</div></TableCell></TableRow>}</TableBody></Table><footer className="table-pagination"><button type="button" onClick={goToPreviousPage} disabled={!pagination.hasPreviousPage}>Anterior</button><span>Página {pagination.page} de {pagination.totalPages} · {pagination.total} itens</span><button type="button" onClick={goToNextPage} disabled={!pagination.hasNextPage}>Próxima</button></footer></div></div>}
  </>;
}

function DiagnosticTableRow({ item, onOpen }: { item: CaseRow; onOpen: (caseId: string) => void }) {
  const result = item.diagnostic_ai_assessments?.[0]?.structured_result;
  const score = result?.overallScore;
  const technicalAlerts = result?.technicalAlerts ?? [];
  const alertsCount = technicalAlerts.length;

  return <TableRow className={item.locked_by_other ? "bg-[rgba(23,34,43,.035)]" : "cursor-pointer"} aria-disabled={item.locked_by_other ? "true" : undefined} onClick={() => !item.locked_by_other && onOpen(item.id)}>
    <TableCell className="whitespace-nowrap">
      <div className="flex items-center gap-3">
        <div className="case-avatar">{item.diagnostic_clients?.full_name?.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
        <div className="min-w-0">
          <strong className="block truncate text-[12px] font-semibold">{item.diagnostic_clients?.full_name}</strong>
          <small className="block truncate text-[10px] uppercase tracking-[.08em]">{item.case_number}</small>
          {item.locked_by_other && <small className="case-lock-label"><LockKeyhole /> Em revisão por {item.locked_by_name ?? "outra consultora"}</small>}
        </div>
      </div>
    </TableCell>
    <TableCell className="whitespace-nowrap text-[12px] uppercase tracking-[.08em]">{item.objective ?? "Objetivo não informado"}</TableCell>
    <TableCell><span className={`status-pill status-${item.status}`}>{getCaseStatusLabel(item.status)}</span></TableCell>
    <TableCell><span className="score">{score ?? "—"}<small>{typeof score === "number" ? "/100" : ""}</small></span></TableCell>
    <TableCell>
      {alertsCount > 0 ? <span className="alert-count alert-count--with-popover"><AlertTriangle />{alertsCount}<span className="alert-popover" role="tooltip"><strong>Alertas técnicos</strong><ul>{technicalAlerts.map((alert, index) => <li key={`${item.id}-alert-${index}`}>{alert}</li>)}</ul></span></span> : <span className="alert-count alert-count--empty">—</span>}
    </TableCell>
    <TableCell className="text-right">{item.locked_by_other ? <LockKeyhole className="row-arrow" /> : <ArrowUpRight className="row-arrow" />}</TableCell>
  </TableRow>;
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
    <DashboardHeader eyebrow="Relacionamento" title="Clientes" description="Consulte cada pessoa, seus simuladores e a atividade mais recente em um único lugar." />
    <div className="clients-toolbar">
      <label><Search /><input aria-label="Buscar clientes" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou e-mail" /></label>
      {!loading && !error && <p><UsersRound /><strong>{items.length}</strong> {items.length === 1 ? "cliente encontrado" : "clientes encontrados"}</p>}
    </div>
    {error ? <DashboardError /> : loading ? <DashboardLoading /> : <div className="clients-table">
      <div className="clients-table-head"><span>Cliente</span><span>Simuladores</span><span>Caso mais recente</span><span>Status</span><span>Compra</span><span>Última atividade</span><span /></div>
      {items.length ? items.map((item) => <ClientLine key={item.id} item={item} />) : <div className="empty-row">{search ? "Nenhum cliente corresponde à busca." : "Nenhum cliente cadastrado ainda."}</div>}
    </div>}
  </>;
}

function ClientLine({ item }: { item: ClientListItem }) {
  const content = <>
    <div className="client-identity"><div className="case-avatar">{item.full_name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("")}</div><div><strong>{item.full_name}</strong><small>{item.email_display}</small></div></div>
    <span className="client-case-count"><strong>{item.case_count}</strong><small>{item.case_count === 1 ? "simulador" : "simuladores"}</small></span>
    <div className="client-latest-case"><strong>{item.latest_case?.case_number ?? "Sem simulador"}</strong><small>{item.latest_case?.objective ?? "Objetivo não informado"}</small></div>
    {item.latest_case ? <span className={`status-pill status-${item.latest_case.status}`}>{getCaseStatusLabel(item.latest_case.status)}</span> : <span className="status-pill">Sem caso</span>}
    <span className="client-purchase">{item.purchase_date ? <time dateTime={item.purchase_date}>{dateFormatter.format(new Date(item.purchase_date))}</time> : "—"}</span>
    <time dateTime={item.last_activity_at}>{dateFormatter.format(new Date(item.last_activity_at))}</time>
    <ArrowUpRight className="row-arrow" />
  </>;

  return item.latest_case
    ? <Link className="client-line" href={`/dashboard/diagnosticos/${item.latest_case.id}`}>{content}</Link>
    : <div className="client-line client-line--static">{content}</div>;
}

export function DashboardLoading() { return <div className="dashboard-loading"><span /><span /><span /></div>; }
export function DashboardError({ title = "Não foi possível carregar os dados", detail = "Confirme a conexão e tente atualizar a página." }: { title?: string; detail?: string } = {}) { return <div className="dashboard-error"><AlertTriangle /><h2>{title}</h2><p>{detail}</p></div>; }
