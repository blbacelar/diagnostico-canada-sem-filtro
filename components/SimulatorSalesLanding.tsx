"use client";

import { useEffect } from "react";
import Image from "next/image";
import { ArrowRight, Check, CircleHelp, ClipboardCheck, FileText, LockKeyhole, Mail, ShieldCheck, Tag, UserRoundCheck, X } from "lucide-react";
import { simulatorDeliveryReleaseText, simulatorSalesConfig } from "../lib/simulator-sales";
import { BrandMark } from "./BrandMark";

type CtaPlacement = "header" | "hero" | "offer-card" | "report" | "final";
type FunnelPayload = Record<string, string> & { event: string };

const testimonials = [
  { file: "relato-investimento-realidade.webp", alt: "Captura de tela de um relato de cliente sobre outro conteúdo do Canadá Sem Filtro." },
  { file: "relato-decisao-familia.webp", alt: "Captura de tela de um relato de cliente sobre outro conteúdo do Canadá Sem Filtro." },
  { file: "relato-planejamento-etapas.webp", alt: "Captura de tela de um relato de cliente sobre outro conteúdo do Canadá Sem Filtro." },
] as const;

function currentUtm() {
  if (typeof window === "undefined") return {};
  const allowedKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(allowedKeys.flatMap((key) => {
    const value = params.get(key)?.trim();
    return value ? [[key, value.slice(0, 120)]] : [];
  }));
}

function sendFunnelEvent(event: string, detail: Record<string, string> = {}) {
  if (typeof window === "undefined") return;
  const payload: FunnelPayload = {
    event,
    product: "simulador_canada_sem_filtro",
    page_path: window.location.pathname,
    device_type: window.matchMedia("(max-width: 640px)").matches ? "mobile" : "desktop",
    ...currentUtm(),
    ...detail,
  };
  const trackingWindow = window as Window & { dataLayer?: FunnelPayload[] };
  trackingWindow.dataLayer?.push(payload);
  window.dispatchEvent(new CustomEvent("simulator:analytics", { detail: payload }));
}

function useSimulatorFunnelTracking() {
  useEffect(() => {
    sendFunnelEvent("simulator_page_view");
  }, []);
}

function CheckoutLink({ placement, className = "sales-primary-button", children }: { placement: CtaPlacement; className?: string; children: React.ReactNode }) {
  return (
    <a className={className} data-cta-placement={placement} href={simulatorSalesConfig.checkoutUrl} target="_blank" rel="noreferrer" onClick={() => sendFunnelEvent("simulator_checkout_started", { cta_placement: placement })}>
      {children}<ArrowRight aria-hidden="true" />
    </a>
  );
}

export function SimulatorSalesLanding() {
  useSimulatorFunnelTracking();

  return (
    <main className="simulator-sales-page">
      <aside className="simulator-offer-bar" aria-label="Condição atual do Simulador Canadá Sem Filtro">
        <span><Tag aria-hidden="true" /> Condição atual: de {simulatorSalesConfig.listPrice} por {simulatorSalesConfig.currentPrice}</span>
        <span className="simulator-price-inline">À vista ou {simulatorSalesConfig.installmentPrice}</span>
      </aside>

      <header className="simulator-sales-header">
        <BrandMark />
        <nav aria-label="Navegação principal"><a href="#para-quem-e">Para quem é</a><a href="#como-funciona">Como funciona</a><a href="#o-que-recebe">O que você recebe</a><a href="#limites">Limites</a></nav>
        <CheckoutLink placement="header" className="sales-header-cta">Quero entender meu ponto de partida</CheckoutLink>
      </header>

      <section className="simulator-hero" aria-labelledby="simulator-title">
        <div className="simulator-hero__copy">
          <p className="eyebrow"><span /> Simulador Canadá Sem Filtro</p>
          <h1 id="simulator-title">Antes de investir no seu projeto Canadá, descubra o que precisa ser <em>organizado no seu caso.</em></h1>
          <p className="simulator-hero__lede">O Simulador organiza informações sobre família, idioma, profissão, recursos e objetivos em uma leitura personalizada, revisada por uma consultora, para você entender o que merece atenção antes do próximo investimento.</p>
          <ul className="simulator-checklist simulator-checklist--hero" aria-label="O que você encontra no simulador">
            <li><Check aria-hidden="true" /> Mais de 60 perguntas sobre o seu contexto</li><li><Check aria-hidden="true" /> Relatório personalizado</li><li><Check aria-hidden="true" /> Pontos fortes e pontos de atenção</li><li><Check aria-hidden="true" /> Prioridades para os próximos meses</li><li><Check aria-hidden="true" /> Revisão humana antes da entrega</li>
          </ul>
          <div className="simulator-hero__actions"><CheckoutLink placement="hero">Quero entender meu ponto de partida</CheckoutLink><span className="simulator-hero-price">Por {simulatorSalesConfig.currentPrice} · {simulatorSalesConfig.installmentPrice}</span></div>
          <p className="simulator-fine-print"><LockKeyhole aria-hidden="true" /> Compra segura pela Hotmart · acesso individual por e-mail</p>
        </div>

        <aside className="simulator-offer-card" aria-label="Oferta do Simulador Canadá Sem Filtro">
          <p className="eyebrow"><span /> Condição atual</p><h2>Clareza antes do próximo investimento.</h2>
          <div className="simulator-price"><span>De <s>{simulatorSalesConfig.listPrice}</s></span><strong>{simulatorSalesConfig.currentPrice}</strong><small>À vista ou {simulatorSalesConfig.installmentPrice}</small></div>
          <div className="simulator-offer-card__rule" /><p>Você responde sobre a sua realidade. O material organiza contexto, pontos de atenção e perguntas que merecem aprofundamento.</p>
          <CheckoutLink placement="offer-card">Quero entender meu ponto de partida</CheckoutLink><small>Conteúdo educativo e informativo, com acesso individual.</small>
        </aside>
      </section>

      <section id="para-quem-e" className="simulator-section simulator-audience" aria-labelledby="audience-title">
        <div className="simulator-section-heading"><p className="eyebrow"><span /> Antes de pesquisar mais</p><h2 id="audience-title">Este Simulador é para você que…</h2></div>
        <ul className="simulator-audience-list">
          <li><CircleHelp aria-hidden="true" /><span>pensa em morar no Canadá, mas ainda não sabe por onde começar;</span></li>
          <li><CircleHelp aria-hidden="true" /><span>encontrou muitos programas e informações, mas não consegue organizar o que faz sentido analisar primeiro;</span></li>
          <li><CircleHelp aria-hidden="true" /><span>precisa considerar cônjuge, filhos, profissão, idioma e recursos na mesma decisão;</span></li>
          <li><CircleHelp aria-hidden="true" /><span>quer identificar pontos que precisam ser desenvolvidos antes de investir;</span></li>
          <li><CircleHelp aria-hidden="true" /><span>deseja chegar a uma futura consulta profissional com perguntas mais claras.</span></li>
        </ul>
      </section>

      <section id="como-funciona" className="simulator-section simulator-how" aria-labelledby="how-title">
        <div className="simulator-section-heading"><p className="eyebrow"><span /> Do checkout ao relatório</p><h2 id="how-title">Você conta o seu contexto. Recebe uma leitura para organizar o caminho.</h2><p>O processo foi desenhado para reunir o que hoje está solto e devolver uma leitura responsável, sem transformar sua história em uma promessa pronta.</p></div>
        <div className="simulator-steps">
          <article><b>01</b><Mail aria-hidden="true" /><h3>Receba seu acesso</h3><p>Depois da confirmação da compra pela Hotmart, o acesso individual é enviado para o seu e-mail.</p></article>
          <article><b>02</b><ClipboardCheck aria-hidden="true" /><h3>Responda no seu ritmo</h3><p>O preenchimento leva em média {simulatorSalesConfig.completionEstimate}. Você pode salvar e continuar depois.</p></article>
          <article><b>03</b><UserRoundCheck aria-hidden="true" /><h3>Receba o relatório</h3><p>Após o envio, uma consultora revisa o material. A revisão tem prazo estimado de {simulatorSalesConfig.reviewEstimate}.</p></article>
        </div>
        <div className="simulator-delivery-note"><ShieldCheck aria-hidden="true" /><p>O relatório é entregue por e-mail. A plataforma libera a entrega {simulatorDeliveryReleaseText}.</p></div>
      </section>

      <section className="simulator-section simulator-preview-section" aria-labelledby="questions-title">
        <div className="simulator-preview-copy"><p className="eyebrow"><span /> Por onde começa</p><h2 id="questions-title">Perguntas que ajudam a olhar para o projeto inteiro.</h2><p>Você responde sobre família, formação, experiência profissional, idiomas, recursos e objetivos. A intenção não é indicar um programa: é organizar o contexto que precisa ser considerado antes de tomar decisões.</p><div className="simulator-preview-points"><span><CircleHelp aria-hidden="true" /> Mais de 60 perguntas organizadas</span><span><Mail aria-hidden="true" /> Link pessoal para preencher com calma</span></div></div>
        <figure className="simulator-demo-video-frame"><video autoPlay muted loop playsInline controls preload="metadata" poster="/videos/simulador-preenchimento-poster.jpg" aria-label="Demonstração do preenchimento do Simulador Canadá Sem Filtro"><source src="/videos/simulador-preenchimento.mp4" type="video/mp4" />Seu navegador não suporta a reprodução deste vídeo.</video><figcaption>Demonstração ilustrativa: preencha no seu ritmo e salve para continuar depois.</figcaption></figure>
      </section>

      <section id="o-que-recebe" className="simulator-section simulator-report-section" aria-labelledby="report-title">
        <figure className="simulator-report-preview" aria-labelledby="report-preview-caption"><div className="report-preview__brand"><BrandMark compact /></div><p>DEMONSTRAÇÃO ILUSTRATIVA</p><h3>Seu momento, com mais contexto.</h3><div className="report-preview__summary"><strong>68<small>/100</small></strong><span><small>NÍVEL DE PREPARO</small><b>Intermediário</b><p>Exemplo de leitura com base nas informações preenchidas, sem conclusão sobre elegibilidade.</p></span></div><div className="report-preview__blocks"><div><b>+</b><span><strong>Pontos fortes</strong><small>O que já sustenta o seu plano</small></span></div><div><b>!</b><span><strong>Pontos de atenção</strong><small>O que pede validação e preparo</small></span></div><div><b>→</b><span><strong>Prioridades para 3, 6 e 12 meses</strong><small>O que pode ser desenvolvido com mais clareza</small></span></div></div><figcaption id="report-preview-caption">Imagem demonstrativa; não representa o relatório de uma pessoa real.</figcaption></figure>
        <div className="simulator-report-copy"><p className="eyebrow"><span /> O que chega para você</p><h2 id="report-title">Um relatório para substituir achismos por perguntas melhores.</h2><p>Você recebe uma devolutiva educativa com contexto familiar e profissional, nível de preparo, forças, alertas e prioridades. Ela aponta o que merece validação — sem confirmar elegibilidade, programas ou resultados.</p><ul className="simulator-checklist"><li><FileText aria-hidden="true" /> Resumo personalizado do cenário informado</li><li><FileText aria-hidden="true" /> Pontos fortes, pontos de atenção e informações que precisam de validação</li><li><FileText aria-hidden="true" /> Prioridades para os próximos 3, 6 e 12 meses</li></ul><CheckoutLink placement="report">Quero receber minha leitura</CheckoutLink></div>
      </section>

      <section id="limites" className="simulator-limits" aria-labelledby="limits-title">
        <div className="simulator-section-heading"><p className="eyebrow"><span /> Transparência desde o início</p><h2 id="limits-title">O que o Simulador não promete</h2><p>Organizar o contexto é diferente de decidir o futuro por você. Estes limites ajudam a usar o material com responsabilidade.</p></div>
        <ul className="simulator-limits-list"><li><X aria-hidden="true" /> não confirma se você é elegível para um programa;</li><li><X aria-hidden="true" /> não escolhe uma estratégia migratória por você;</li><li><X aria-hidden="true" /> não substitui uma consulta profissional individual;</li><li><X aria-hidden="true" /> não garante visto, residência permanente, emprego ou aprovação;</li><li><X aria-hidden="true" /> não oferece respostas prontas sem considerar o contexto informado.</li></ul>
      </section>

      <section className="simulator-testimonials" aria-labelledby="testimonial-title">
        <div className="simulator-section-heading"><p className="eyebrow"><span /> Relatos sobre outros conteúdos</p><h2 id="testimonial-title">Pessoas que buscaram mais contexto antes de decidir.</h2><p>Os relatos abaixo são de clientes do Canadá Sem Filtro sobre outros conteúdos da marca. Eles não são depoimentos específicos do Simulador.</p></div>
        <div className="testimonial-screenshots" tabIndex={0} aria-label="Relatos sobre outros conteúdos do Canadá Sem Filtro">{testimonials.map((testimonial) => <figure key={testimonial.file}><Image src={`https://www.canadasemfiltro.ca/public/images/testimonials/${testimonial.file}`} alt={testimonial.alt} width={720} height={662} loading="eager" unoptimized /><figcaption>Relato sobre outro conteúdo do Canadá Sem Filtro</figcaption></figure>)}</div>
      </section>

      <section className="simulator-section simulator-faq" aria-labelledby="faq-title">
        <div className="simulator-section-heading"><p className="eyebrow"><span /> Antes de começar</p><h2 id="faq-title">Dúvidas frequentes</h2></div>
        <div className="simulator-faq-list">
          <details open><summary>O Simulador Canadá Sem Filtro é uma consulta de imigração?<span>+</span></summary><p>Não. É um conteúdo educativo e informativo criado para organizar seu contexto e suas perguntas. Não analisa elegibilidade, não garante aprovação e não substitui uma consulta profissional individual.</p></details>
          <details><summary>Quanto tempo leva para responder?<span>+</span></summary><p>O preenchimento leva, em média, {simulatorSalesConfig.completionEstimate}. Você pode salvar as respostas e continuar depois usando o seu link pessoal.</p></details>
          <details><summary>Em quanto tempo receberei meu relatório?<span>+</span></summary><p>Depois que você envia as respostas, o prazo estimado para a revisão é de {simulatorSalesConfig.reviewEstimate}. A entrega por e-mail é liberada {simulatorDeliveryReleaseText}.</p></details>
          <details><summary>Uma consultora realmente revisa o material?<span>+</span></summary><p>Sim. O material passa por revisão profissional antes da entrega. Essa revisão não transforma o Simulador em consulta de imigração nem em análise individual de elegibilidade.</p></details>
          <details><summary>O Simulador indica um programa de imigração?<span>+</span></summary><p>Não. Ele organiza informações do seu contexto e aponta temas que merecem atenção, validação ou desenvolvimento. A escolha de uma estratégia migratória exige análise profissional individual.</p></details>
          <details><summary>Para quem o Simulador não é recomendado?<span>+</span></summary><p>Ele não é indicado para quem procura confirmação de elegibilidade, recomendação de visto, promessa de aprovação ou uma estratégia migratória individual pronta.</p></details>
          <details><summary>Posso contratar uma consulta profissional depois?<span>+</span></summary><p>Sim. O Simulador pode ajudar você a chegar a uma futura consulta com mais clareza sobre sua história, objetivos e dúvidas prioritárias.</p></details>
        </div>
      </section>

      <section className="simulator-final-cta"><div><p className="eyebrow"><span /> Seu próximo passo</p><h2>Organize seu contexto antes de fazer o próximo investimento.</h2><p>O Simulador Canadá Sem Filtro está na condição atual de {simulatorSalesConfig.currentPrice}.</p></div><CheckoutLink placement="final">Quero entender meu ponto de partida</CheckoutLink></section>
      <section className="simulator-legal"><h2>Importante</h2><p>O Simulador Canadá Sem Filtro tem finalidade exclusivamente educativa e informativa. Não é consulta de imigração, não constitui aconselhamento jurídico e não garante elegibilidade, visto, residência permanente, emprego ou aprovação em programas.</p></section>
      <footer className="simulator-sales-footer"><BrandMark compact /><span>© 2026 Canadá Sem Filtro</span></footer>
    </main>
  );
}
