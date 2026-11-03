export const simulatorSalesConfig = {
  checkoutUrl: "https://pay.hotmart.com/U107038059P?off=hyxqfyga",
  listPrice: "R$ 147",
  currentPrice: "R$ 97",
  installmentPrice: "12x R$ 10,03",
  completionEstimate: "25–35 minutos",
  reviewEstimate: "até 7 dias úteis",
  deliveryReleaseDays: 7,
  deliveryReleaseBusinessDays: 7,
} as const;

export const simulatorDeliveryReleaseText = `${simulatorSalesConfig.reviewEstimate} após o envio das respostas`;
