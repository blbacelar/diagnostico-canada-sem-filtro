type DashboardAssessment = {
  version: number;
  structured_result?: { technicalAlerts?: string[] } | null;
};

export type DashboardSummaryCase = {
  status: string;
  diagnostic_ai_assessments?: DashboardAssessment[] | null;
};

export const dashboardStatusGroups = {
  new_cases: ["submitted", "ai_processing", "awaiting_triage", "processing_error"],
  in_review: ["in_review", "awaiting_client", "ready_for_approval"],
  ready_to_send: ["approved", "sending"],
  delivered: ["sent"],
} as const;

const activeStatuses: ReadonlySet<string> = new Set<string>([
  ...dashboardStatusGroups.new_cases,
  ...dashboardStatusGroups.in_review,
  ...dashboardStatusGroups.ready_to_send,
]);

export function buildDashboardSummary<T extends DashboardSummaryCase>(cases: T[]) {
  const counts: Record<string, number> = {};
  for (const item of cases) counts[item.status] = (counts[item.status] ?? 0) + 1;

  for (const [group, statuses] of Object.entries(dashboardStatusGroups)) {
    counts[group] = cases.filter((item) => (statuses as readonly string[]).includes(item.status)).length;
  }

  counts.technical_attention = cases.filter((item) => {
    if (!activeStatuses.has(item.status)) return false;
    const latest = [...(item.diagnostic_ai_assessments ?? [])].sort((left, right) => right.version - left.version)[0];
    return (latest?.structured_result?.technicalAlerts?.length ?? 0) > 0;
  }).length;

  const recent = cases.filter((item) => (dashboardStatusGroups.new_cases as readonly string[]).includes(item.status));
  return { counts, recent };
}
