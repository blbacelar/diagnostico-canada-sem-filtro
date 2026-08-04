import type { ReportData } from "../lib/report";
import { PrintButton } from "./PrintButton";

export function ReportDocument({
  report,
  preview = false,
}: {
  report: ReportData;
  preview?: boolean;
}) {
  const ai = report.assessment;
  const review = report.review;
  const printPdfUrl = preview ? `/api/diagnostics/${report.caseId}/report` : undefined;

  return (
    <div className={`report-wrap ${preview ? "report-wrap--preview" : ""}`}>
      <div className="report-toolbar no-print">
        <span>Pré-visualização A4</span>
        <PrintButton pdfUrl={printPdfUrl} />
      </div>

      <article className="report-paper report-cover">
        <header>
          <strong>Canadá</strong>
          <em>sem filtro</em>
          <small>Diagnóstico profissional</small>
        </header>
        <div>
          <p>Relatório individual</p>
          <h1>
            Seu projeto <em>Canadá.</em>
          </h1>
          <h2>{report.clientName}</h2>
        </div>
        <footer>
          <span>{report.caseNumber}</span>
          <span>{new Date(report.generatedAt).toLocaleDateString("pt-BR")}</span>
        </footer>
      </article>

      <article className="report-paper">
        <ReportHeading number="01" title="Antes de começar" />
        <p className="report-lede">
          Este diagnóstico organiza informações e oferece uma leitura educacional do seu
          momento. Ele não garante visto, permissão, residência permanente ou aprovação e não
          substitui aconselhamento jurídico ou análise individual de elegibilidade.
        </p>
        <aside className="report-callout">
          Toda decisão migratória, questão de inadmissibilidade, recusa, histórico criminal ou
          médico e escolha de programa deve ser validada por profissional habilitado.
        </aside>

        <ReportHeading number="02" title="Resumo do perfil" />
        <p>{ai.executiveSummary}</p>

        <div className="report-score">
          <strong>{ai.overallScore}</strong>
          <span>/ 100</span>
          <div>
            <small>Nível de preparo</small>
            <b>{ai.readinessLevel}</b>
            <p>{ai.scoreExplanation}</p>
          </div>
        </div>

        <ReportPageFooter report={report} version={review.version} />
      </article>

      <article className="report-paper report-paper--risks">
        <ReportHeading number="03" title="Pontos fortes" />
        <ReportList items={ai.strengths} />

        <ReportHeading number="04" title="Riscos e alertas" />
        <ReportList items={[...ai.risks, ...ai.technicalAlerts]} tone="warning" />

        <ReportPageFooter report={report} version={review.version} />
      </article>

      <article className="report-paper">
        <ReportHeading number="05" title="Prioridades" />
        <div className="report-priorities">
          <ReportPeriod title="3 meses" items={ai.priorities.threeMonths} />
          <ReportPeriod title="6 meses" items={ai.priorities.sixMonths} />
          <ReportPeriod title="12 meses" items={ai.priorities.twelveMonths} />
        </div>

        <ReportHeading number="06" title="Parecer personalizado" />
        <ReportText title="Caminho mais coerente" text={review.coherent_path} />
        <ReportText
          title="Premissas que precisam ser revistas"
          text={review.assumptions_to_review}
        />
        <ReportText title="Erros que podem estar próximos" text={review.likely_mistakes} />

        <ReportPageFooter report={report} version={review.version} />
      </article>

      <article className="report-paper">
        <ReportHeading number="06" title="Parecer personalizado" />
        <ReportText title="Foco imediato" text={review.immediate_focus} />
        <ReportText title="Estudar no Canadá como estratégia" text={review.study_strategy} />

        <ReportHeading number="07" title="Próximos passos" />
        <ol className="report-next">
          {review.next_steps.map((item, index) => (
            <li key={`${index}-${item}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
            </li>
          ))}
        </ol>

        <ReportHeading number="08" title="Validação profissional" />
        <p>{review.validation_risks}</p>

        {review.additional_notes && (
          <>
            <ReportHeading number="09" title="Observações adicionais" />
            <p>{review.additional_notes}</p>
          </>
        )}

        <ReportPageFooter report={report} version={review.version} />
      </article>
    </div>
  );
}

function ReportPageFooter({ report, version }: { report: ReportData; version: number }) {
  return (
    <footer className="report-footer">
      <span>{report.caseNumber}</span>
      <span>Versão {version}</span>
      <span>{new Date(report.generatedAt).toLocaleDateString("pt-BR")}</span>
    </footer>
  );
}

function ReportHeading({ number, title }: { number: string; title: string }) {
  return (
    <header className="report-heading">
      <span>{number}</span>
      <h2>{title}</h2>
    </header>
  );
}

function ReportList({ items, tone = "" }: { items: string[]; tone?: string }) {
  return (
    <ul className={`report-list ${tone}`}>
      {items.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function ReportPeriod({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <b>{title}</b>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function ReportText({ title, text }: { title: string; text: string }) {
  return (
    <section className="report-text">
      <h3>{title}</h3>
      <p>{text}</p>
    </section>
  );
}
