import { Resend } from "resend";

function emailClient() {
  const key = process.env.RESEND_API_KEY ?? process.env.EMAIL_PROVIDER_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY ou EMAIL_PROVIDER_API_KEY não configurada.");
  return new Resend(key);
}

function fromAddress() {
  return process.env.EMAIL_FROM ?? "Simulador Canadá Sem Filtro <diagnostico@canadasemfiltro.ca>";
}

const shell = (title: string, body: string) => `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#edf3f5;color:#17222b;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid #cfdee3;background:#f6fafb"><tr><td style="padding:28px 36px;background:#b71c3d;color:#fff"><div style="font:700 11px monospace;letter-spacing:.16em;text-transform:uppercase">Canadá sem filtro</div><div style="font:italic 26px Georgia,serif;margin-top:8px">Simulador profissional</div></td></tr><tr><td style="padding:40px 36px"><h1 style="font:400 34px Georgia,serif;margin:0 0 18px">${title}</h1>${body}<p style="margin:32px 0 0;padding-top:20px;border-top:1px solid #cfdee3;color:#586c7a;font:12px/1.6 monospace">Conteúdo educacional e de planejamento. Não substitui aconselhamento jurídico ou análise individual de elegibilidade.</p></td></tr></table></td></tr></table></body></html>`;

export async function sendContinuationEmail(input: { to: string; fullName: string; caseNumber: string; token: string }) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const continuationUrl = `${appUrl}/formulario?token=${encodeURIComponent(input.token)}`;
  const html = shell(
    "Seu simulador está pronto para continuar",
    `<p style="font:17px/1.7 Georgia,serif">Olá, ${escapeHtml(input.fullName)}.</p><p style="font:17px/1.7 Georgia,serif">Criamos o simulador <strong>${escapeHtml(input.caseNumber)}</strong>. Use o botão abaixo para preencher ou retomar suas respostas com segurança.</p><p style="margin:28px 0"><a href="${continuationUrl}" style="display:inline-block;padding:15px 26px;border-radius:999px;background:#b71c3d;color:#fff;text-decoration:none;font:700 12px monospace;letter-spacing:.1em;text-transform:uppercase">Continuar simulador</a></p><p style="font:14px/1.6 Arial,sans-serif;color:#586c7a">O link é pessoal, expira e não deve ser compartilhado.</p>`,
  );
  return emailClient().emails.send({ from: fromAddress(), to: input.to, subject: "Seu link pessoal — Simulador Canadá Sem Filtro", html });
}

export async function sendPasswordRecoveryEmail(input: { to: string; resetUrl: string }) {
  const safeResetUrl = escapeHtml(input.resetUrl);
  return emailClient().emails.send({
    from: fromAddress(),
    to: input.to,
    subject: "Redefina sua senha — Simulador Canadá Sem Filtro",
    html: shell(
      "Crie uma nova senha",
      `<p style="font:17px/1.7 Georgia,serif">Recebemos uma solicitação para redefinir a senha da sua conta.</p><p style="margin:28px 0"><a href="${safeResetUrl}" style="display:inline-block;padding:15px 26px;border-radius:999px;background:#b71c3d;color:#fff;text-decoration:none;font:700 12px monospace;letter-spacing:.1em;text-transform:uppercase">Criar nova senha</a></p><p style="font:14px/1.6 Arial,sans-serif;color:#586c7a">Este link é pessoal, tem uso único e expira. Se você não solicitou a alteração, ignore este e-mail e sua senha continuará a mesma.</p>`,
    ),
  });
}

export async function sendSubmissionConfirmation(input: { to: string; fullName: string; caseNumber: string }) {
  return emailClient().emails.send({
    from: fromAddress(),
    to: input.to,
    subject: `Recebemos o simulador ${input.caseNumber}`,
    html: shell("Recebemos suas respostas", `<p style="font:17px/1.7 Georgia,serif">Olá, ${escapeHtml(input.fullName)}. O simulador <strong>${escapeHtml(input.caseNumber)}</strong> foi enviado para análise. Uma consultora revisará o material antes de qualquer entrega.</p>`),
  });
}

export async function sendDashboardSubmissionNotification(input: {
  to: string;
  displayName: string;
  clientName: string;
  caseId: string;
  caseNumber: string;
  idempotencyKey: string;
}) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const caseUrl = new URL(`/dashboard/diagnosticos/${encodeURIComponent(input.caseId)}`, appUrl).toString();
  return emailClient().emails.send({
    from: fromAddress(),
    to: input.to,
    subject: `Novo simulador recebido — ${input.caseNumber}`,
    html: shell(
      "Novo simulador recebido",
      `<p style="font:17px/1.7 Georgia,serif">Olá, ${escapeHtml(input.displayName)}.</p><p style="font:17px/1.7 Georgia,serif"><strong>${escapeHtml(input.clientName)}</strong> concluiu o simulador <strong>${escapeHtml(input.caseNumber)}</strong>. As respostas já estão disponíveis para análise no dashboard.</p><p style="margin:28px 0"><a href="${escapeHtml(caseUrl)}" style="display:inline-block;padding:15px 26px;border-radius:999px;background:#b71c3d;color:#fff;text-decoration:none;font:700 12px monospace;letter-spacing:.1em;text-transform:uppercase">Abrir no dashboard</a></p>`,
    ),
  }, { idempotencyKey: input.idempotencyKey });
}

export async function sendFinalDiagnostic(input: { to: string; subject: string; body: string; reportUrl: string }) {
  return emailClient().emails.send({
    from: fromAddress(),
    to: input.to,
    subject: input.subject,
    html: shell("O resultado do seu simulador está pronto", `<div style="font:17px/1.7 Georgia,serif;white-space:pre-line">${escapeHtml(input.body)}</div><p style="margin:28px 0"><a href="${input.reportUrl}" style="display:inline-block;padding:15px 26px;border-radius:999px;background:#b71c3d;color:#fff;text-decoration:none;font:700 12px monospace;letter-spacing:.1em;text-transform:uppercase">Abrir resultado final</a></p>`),
  });
}

export async function sendFinalDiagnosticWithPdf(input: { to: string; subject: string; body: string; reportUrl: string; pdf?: Uint8Array; caseNumber: string }) {
  return emailClient().emails.send({
    from: fromAddress(), to: input.to, subject: input.subject,
    html: shell("O resultado do seu simulador está pronto", `<div style="font:17px/1.7 Georgia,serif;white-space:pre-line">${escapeHtml(input.body)}</div><p style="margin:28px 0"><a href="${input.reportUrl}" style="display:inline-block;padding:15px 26px;border-radius:999px;background:#b71c3d;color:#fff;text-decoration:none;font:700 12px monospace;letter-spacing:.1em;text-transform:uppercase">Abrir resultado final</a></p>`),
    attachments: input.pdf ? [{ filename: `${input.caseNumber}.pdf`, content: Buffer.from(input.pdf) }] : undefined,
  });
}

export async function sendInformationRequest(input: { to: string; fullName: string; subject: string; message: string }) {
  return emailClient().emails.send({ from: fromAddress(), to: input.to, subject: input.subject, html: shell("Precisamos de uma informação", `<p style="font:17px/1.7 Georgia,serif">Olá, ${escapeHtml(input.fullName)}.</p><div style="font:17px/1.7 Georgia,serif;white-space:pre-line">${escapeHtml(input.message)}</div><p style="font:14px/1.6 Arial,sans-serif;color:#586c7a">Responda a este e-mail. A equipe registrará a informação de forma separada, preservando suas respostas originais.</p>`) });
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}
