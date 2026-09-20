"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Check, CircleHelp, Clock3, FileText, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { BrandMark } from "./BrandMark";

const checkoutUrl = "https://pay.hotmart.com/U107038059P?off=hyxqfyga";

const testimonials = [
  "relato-investimento-realidade.webp",
  "relato-decisao-familia.webp",
  "relato-planejamento-etapas.webp",
];

function getSecondsUntilMidnightInSaoPaulo(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).reduce<Record<string, number>>((result, part) => {
    if (part.type !== "literal") result[part.type] = Number(part.value);
    return result;
  }, {});
  const localNowAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offset = localNowAsUtc - now.getTime();
  const nextMidnight = Date.UTC(parts.year, parts.month - 1, parts.day + 1) - offset;
  return Math.max(0, Math.floor((nextMidnight - now.getTime()) / 1000));
}

function DailyOfferCountdown() {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setSeconds(getSecondsUntilMidnightInSaoPaulo(new Date()));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const formatted = seconds === null
    ? "--:--:--"
    : [Math.floor(seconds / 3_600), Math.floor((seconds % 3_600) / 60), seconds % 60]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");

  return (
    <div className="simulator-offer-bar" role="status">
      <span><Sparkles aria-hidden="true" /> Oferta especial de hoje: de R$ 147 por R$ 97</span>
      <span className="simulator-countdown"><Clock3 aria-hidden="true" /> Termina em <strong>{formatted}</strong></span>
    </div>
  );
}

function CheckoutLink({ className = "sales-primary-button", children }: { className?: string; children: React.ReactNode }) {
  return <a className={className} href={checkoutUrl} target="_blank" rel="noreferrer">{children}<ArrowRight aria-hidden="true" /></a>;
}

export function SimulatorSalesLanding() {
  return (
    <main className="simulator-sales-page">
      <DailyOfferCountdown />
      <header className="simulator-sales-header">
        <BrandMark />
        <nav aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#o-que-recebe">O que você recebe</a>
        </nav>
        <CheckoutLink className="sales-header-cta">Quero por R$ 97</CheckoutLink>
      </header>

      <section className="simulator-hero" aria-labelledby="simulator-title">
        <div className="simulator-hero__copy">
          <p className="eyebrow"><span /> Simulador Canadá Sem Filtro</p>
          <h1>Antes de decidir <em>para onde ir,</em> entenda o seu ponto de partida.</h1>
          <p className="simulator-hero__lede">Uma leitura educativa e personalizada para organizar seu momento, enxergar os pontos que pedem atenção e saber o que desenvolver primeiro no seu projeto Canadá.</p>
          <ul className="simulator-checklist" aria-label="O que o simulador oferece">
            <li><Check aria-hidden="true" /> Leitura estruturada do seu perfil e contexto familiar</li>
            <li><Check aria-hidden="true" /> Pontos de atenção e próximos passos prioritários</li>
            <li><Check aria-hidden="true" /> Relatório pessoal, claro e seguro no seu e-mail</li>
          </ul>
          <div className="simulator-hero__actions">
            <CheckoutLink>Quero meu simulador por R$ 97</CheckoutLink>
            <a className="sales-text-link" href="#como-funciona">Veja como funciona <ArrowRight aria-hidden="true" /></a>
          </div>
          <p className="simulator-fine-print"><LockKeyhole aria-hidden="true" /> Compra segura pela Hotmart · acesso individual por e-mail</p>
        </div>

        <aside className="simulator-offer-card" aria-label="Oferta do Simulador Canadá Sem Filtro">
          <p className="eyebrow"><span /> Condição de hoje</p>
          <h2>Clareza antes do próximo investimento.</h2>
          <div className="simulator-price"><span>De <s>R$ 147</s></span><strong>R$ 97</strong><small>À vista ou 12x R$10.03</small></div>
          <div className="simulator-offer-card__rule" />
          <p>Você responde sobre sua realidade. Nós devolvemos uma leitura organizada para você parar de caminhar no escuro.</p>
          <CheckoutLink>Garantir minha condição</CheckoutLink>
          <small>Oferta renovada diariamente à meia-noite (horário de Brasília).</small>
        </aside>
      </section>

      <section id="como-funciona" className="simulator-section simulator-how" aria-labelledby="how-title">
        <div className="simulator-section-heading">
          <p className="eyebrow"><span /> Não é mais um quiz</p>
          <h2 id="how-title">Você conta o seu contexto. Recebe uma leitura para organizar o caminho.</h2>
          <p>O simulador transforma respostas que hoje estão soltas em uma visão inicial, responsável e prática do que merece sua atenção.</p>
        </div>
        <div className="simulator-steps">
          <article><b>01</b><h3>Responda no seu ritmo</h3><p>Perfil, família, idiomas, formação, trabalho, recursos e objetivos. Você pode salvar e continuar depois.</p></article>
          <article><b>02</b><h3>Seu contexto ganha estrutura</h3><p>As respostas são organizadas em uma análise educativa, com linguagem clara e sem promessas prontas.</p></article>
          <article><b>03</b><h3>Receba o seu relatório</h3><p>Uma consultora revisa o material antes da entrega, com pontos de atenção e próximos desenvolvimentos.</p></article>
        </div>
      </section>

      <section className="simulator-section simulator-preview-section" aria-labelledby="questions-title">
        <div className="simulator-preview-copy">
          <p className="eyebrow"><span /> Por onde começa</p>
          <h2 id="questions-title">Perguntas que ajudam a olhar para o projeto inteiro.</h2>
          <p>Não é só sobre um visto. É sobre a sua realidade: tempo, família, profissão, idioma, dinheiro e as escolhas que precisam fazer sentido juntos.</p>
          <div className="simulator-preview-points"><span><CircleHelp aria-hidden="true" /> Mais de 60 perguntas organizadas</span><span><Mail aria-hidden="true" /> Link pessoal para preencher com calma</span></div>
        </div>
        <figure className="simulator-demo-video-frame">
          <video
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
            poster="/videos/simulador-preenchimento-poster.jpg"
            aria-label="Demonstração do preenchimento do Simulador Canadá Sem Filtro"
          >
            <source src="/videos/simulador-preenchimento.mp4" type="video/mp4" />
            Seu navegador não suporta a reprodução deste vídeo.
          </video>
          <figcaption>Demonstração ilustrativa: preencha no seu ritmo e salve para continuar depois.</figcaption>
        </figure>
      </section>

      <section id="o-que-recebe" className="simulator-section simulator-report-section" aria-labelledby="report-title">
        <div className="simulator-report-preview" aria-label="Exemplo visual do relatório entregue">
          <div className="report-preview__brand"><BrandMark compact /></div>
          <p>SEU SIMULADOR ESTÁ PRONTO</p>
          <h3>Seu momento, com mais contexto.</h3>
          <div className="report-preview__summary"><strong>68<small>/100</small></strong><span><small>NÍVEL DE PREPARO</small><b>Intermediário</b><p>Há uma base promissora de preparação, com pontos importantes a estruturar antes do próximo passo.</p></span></div>
          <div className="report-preview__blocks"><div><b>+</b><span><strong>Pontos fortes</strong><small>O que já sustenta o seu plano</small></span></div><div><b>!</b><span><strong>Pontos de atenção</strong><small>O que pede validação e preparo</small></span></div><div><b>→</b><span><strong>Próximos passos</strong><small>Prioridades para 3, 6 e 12 meses</small></span></div></div>
        </div>
        <div className="simulator-report-copy">
          <p className="eyebrow"><span /> O que chega para você</p>
          <h2 id="report-title">Um relatório para substituir achismos por perguntas melhores.</h2>
          <p>Você recebe uma devolutiva educativa com o seu nível de preparo, contexto familiar, forças, alertas e uma sequência de prioridades para avançar com mais clareza.</p>
          <ul className="simulator-checklist"><li><FileText aria-hidden="true" /> Resumo personalizado do cenário informado</li><li><FileText aria-hidden="true" /> Pontos fortes, riscos e informações que precisam de validação</li><li><FileText aria-hidden="true" /> Plano de desenvolvimento para os próximos meses</li></ul>
          <CheckoutLink>Quero receber a minha leitura</CheckoutLink>
        </div>
      </section>

      <section className="simulator-testimonials" aria-labelledby="testimonial-title">
        <div className="simulator-section-heading">
          <p className="eyebrow"><span /> Pessoas reais, decisões mais conscientes</p>
          <h2 id="testimonial-title">Quando o contexto aparece, o plano muda de lugar.</h2>
          <p>Relatos de clientes do Canadá Sem Filtro sobre o conteúdo completo e a importância de planejar com mais informação.</p>
        </div>
        <div className="testimonial-screenshots">
          {testimonials.map((file, index) => <figure key={file}><Image src={`https://www.canadasemfiltro.ca/public/images/testimonials/${file}`} alt={`Relato real de cliente do Canadá Sem Filtro, ${index + 1}`} width={720} height={662} unoptimized /><figcaption>Relato de cliente do Canadá Sem Filtro</figcaption></figure>)}
        </div>
      </section>

      <section className="simulator-section simulator-faq" aria-labelledby="faq-title">
        <div className="simulator-section-heading"><p className="eyebrow"><span /> Antes de começar</p><h2 id="faq-title">Dúvidas frequentes</h2></div>
        <div className="simulator-faq-list">
          <details open><summary>O Simulador Canadá Sem Filtro é uma consulta de imigração?<span>+</span></summary><p>Não. É um conteúdo educativo, criado para organizar seu contexto e suas perguntas. Ele não analisa elegibilidade, não garante aprovação e não substitui uma consulta profissional individual.</p></details>
          <details><summary>Vou saber se posso imigrar para o Canadá?<span>+</span></summary><p>Você receberá uma leitura do momento informado, dos pontos que merecem atenção e do que precisa ser desenvolvido. Decisões sobre elegibilidade ou estratégia migratória exigem análise profissional individual.</p></details>
          <details><summary>Como recebo o Simulador?<span>+</span></summary><p>Após a confirmação da compra, você receberá acesso pessoal por e-mail para responder no seu ritmo. Depois do preenchimento e da revisão, a devolutiva é entregue no seu e-mail.</p></details>
          <details><summary>Posso pedir uma consultoria depois?<span>+</span></summary><p>Sim. O simulador ajuda você a chegar a uma consulta profissional com mais clareza sobre sua história, objetivos e dúvidas prioritárias.</p></details>
        </div>
      </section>

      <section className="simulator-final-cta">
        <div><p className="eyebrow"><span /> Seu próximo passo</p><h2>Comece com uma leitura do seu momento, não com mais um palpite.</h2><p>Hoje, o Simulador Canadá Sem Filtro está por R$ 97.</p></div>
        <CheckoutLink>Quero meu simulador agora</CheckoutLink>
      </section>
      <section className="simulator-legal"><h2>Importante</h2><p>O Simulador Canadá Sem Filtro tem finalidade exclusivamente educativa e informativa. Não é consulta de imigração, não constitui aconselhamento jurídico e não garante elegibilidade, visto, residência permanente, emprego ou aprovação em programas.</p></section>
      <footer className="simulator-sales-footer"><BrandMark compact /><span>© 2026 Canadá Sem Filtro</span></footer>
    </main>
  );
}
