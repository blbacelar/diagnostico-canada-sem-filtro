export const caseStatusLabels: Record<string, string> = {
  client_draft: "Rascunho do cliente",
  submitted: "Formulário enviado",
  ai_processing: "Processando análise",
  awaiting_triage: "Aguardando triagem",
  in_review: "Em análise",
  awaiting_client: "Aguardando cliente",
  ready_for_approval: "Pronto para aprovação",
  approved: "Aprovado",
  sending: "Enviando",
  sent: "Enviado",
  processing_error: "Erro no processamento",
  archived: "Arquivado",
};

const reviewStatusLabels: Record<string, string> = {
  draft: "Rascunho",
  ready_for_approval: "Pronto para aprovação",
  approved: "Aprovado",
  superseded: "Substituído",
};

const deliveryMessages: Record<string, string> = {
  queued: "Entrega adicionada à fila de envio.",
  sending: "Entrega em andamento.",
  sent: "Entrega enviada. O histórico foi atualizado.",
  failed: "Não foi possível enviar a entrega.",
};

export function getCaseStatusLabel(status: string) {
  return caseStatusLabels[status] ?? "Status indisponível";
}

export function getReviewStatusLabel(status: string) {
  return reviewStatusLabels[status] ?? "Status indisponível";
}

export function getDeliveryStatusMessage(status: string) {
  return deliveryMessages[status] ?? "O estado da entrega não pôde ser confirmado.";
}
