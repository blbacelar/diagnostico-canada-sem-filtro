import { Check, LockKeyhole, Tag } from "lucide-react";
import { simulatorSalesConfig } from "../lib/simulator-sales";
import { BrandMark } from "./BrandMark";
import { CheckoutLink, SimulatorPageTracking } from "./SimulatorSalesTracking";

export function SimulatorSalesLanding() {
  return (
    <main className="simulator-sales-page">
      <SimulatorPageTracking />
      <aside className="simulator-offer-bar" aria-label="Condição atual do Simulador Canadá Sem Filtro">
        <span><Tag aria-hidden="true" /> Condição atual: de {simulatorSalesConfig.listPrice} por <strong>{simulatorSalesConfig.currentPrice}</strong></span>
        <span className="simulator-price-inline">À vista ou {simulatorSalesConfig.installmentPrice}</span>
      </aside>

      <header className="simulator-sales-header">
        <BrandMark />
        <nav aria-label="Navegação principal"><a href="#problema">Por que começar por você</a><a href="#para-quem-e">Para quem é</a><a href="#oferta">O que você recebe</a></nav>
        <CheckoutLink placement="header" className="sales-header-cta">Quero entender meu Projeto Canadá</CheckoutLink>
      </header>

      <section className="simulator-hero" aria-labelledby="simulator-title">
        <div className="simulator-hero__copy">
          <p className="eyebrow"><span /> Simulador de Projeto Canadá</p>
          <h1 id="simulator-title">Existem vários caminhos para <em>imigrar para o Canadá.</em></h1>
          <h2 className="simulator-hero__subhead">Mas antes de decidir por onde seguir, você precisa entender <strong>o que já tem a seu favor, o que ainda precisa desenvolver e o que deve priorizar agora.</strong></h2>
          <div className="simulator-hero__actions"><CheckoutLink placement="hero">Quero entender meu Projeto Canadá</CheckoutLink><span className="simulator-hero-price"><span>Por apenas</span> <strong>{simulatorSalesConfig.currentPrice}</strong></span></div>
        </div>

        <aside className="simulator-offer-card" aria-label="Oferta do Simulador Canadá Sem Filtro">
          <p className="eyebrow"><span /> Orientação personalizada</p>
          <p>Com o <strong>Simulador de Projeto Canadá</strong>, uma das nossas consultoras revisa as informações que você enviou e te entrega uma orientação personalizada com:</p>
          <ul className="simulator-checklist" aria-label="O que você recebe no Simulador de Projeto Canadá">
            <li><Check aria-hidden="true" /> Seus pontos fortes</li>
            <li><Check aria-hidden="true" /> Seus pontos de atenção</li>
            <li><Check aria-hidden="true" /> O que precisa ser desenvolvido</li>
            <li><Check aria-hidden="true" /> Seus <strong>3 próximos passos</strong></li>
            <li><Check aria-hidden="true" /> Um plano de preparação para <strong>3, 6 e 12 meses</strong></li>
          </ul>
          <div className="simulator-price"><span>Por apenas</span><strong>{simulatorSalesConfig.currentPrice}</strong><small>À vista ou {simulatorSalesConfig.installmentPrice}</small></div>
          <CheckoutLink placement="offer-card">Quero entender meu Projeto Canadá</CheckoutLink>
        </aside>

        <p className="simulator-hero-disclaimer"><LockKeyhole aria-hidden="true" /> Ferramenta educativa e de planejamento. Não realiza análise de elegibilidade, não garante aprovação e não substitui uma consultoria de imigração.</p>
      </section>

      <section id="problema" className="simulator-section simulator-problem" aria-labelledby="problem-title">
        <div className="simulator-section-heading">
          <p className="eyebrow"><span /> Antes das grandes decisões</p>
          <h2 id="problem-title">Escolher o caminho antes de entender o seu contexto pode custar caro.</h2>
        </div>
        <div className="simulator-problem__copy">
          <p>Imagine investir milhares de dólares em um college, escolher uma província ou direcionar meses de preparação para uma estratégia...</p>
          <p>E descobrir depois que sua <strong>formação, experiência profissional, idiomas ou outros atributos</strong> deveriam ter sido considerados — ou desenvolvidos — antes dessa decisão.</p>
          <blockquote>O problema não é a falta de caminhos. É tentar escolher um sem saber de onde você está partindo.</blockquote>
          <p>O Simulador ajuda você a organizar essas informações e entender <strong>o que precisa ser priorizado antes das grandes decisões do seu Projeto Canadá.</strong></p>
        </div>
      </section>

      <section id="para-quem-e" className="simulator-section simulator-audience" aria-labelledby="audience-title">
        <div className="simulator-section-heading"><p className="eyebrow"><span /> Para quem é</p><h2 id="audience-title">O Simulador foi criado para você que:</h2></div>
        <ul className="simulator-audience-list">
          <li><Check aria-hidden="true" /><span>Quer imigrar para o Canadá, mas está <strong>perdido entre tantas possibilidades.</strong></span></li>
          <li><Check aria-hidden="true" /><span>Já pesquisou programas, províncias, college ou trabalho, mas ainda não sabe <strong>o que priorizar.</strong></span></li>
          <li><Check aria-hidden="true" /><span>Consome muita informação sobre imigração, mas sente falta de algo que organize tudo isso <strong>a partir do seu próprio contexto.</strong></span></li>
          <li><Check aria-hidden="true" /><span>Sabe que precisa se preparar, mas não sabe se deveria começar pelo <strong>idioma, carreira, formação, finanças ou outro ponto.</strong></span></li>
        </ul>

        <div className="simulator-how-compact">
          <div>
            <p className="eyebrow"><span /> Como funciona</p>
            <h3>Você responde às perguntas.</h3>
            <p>Uma das nossas consultoras <strong>revisa as informações que você enviou e te entrega uma orientação personalizada.</strong></p>
          </div>
          <ul className="simulator-checklist" aria-label="O que você entende com a orientação personalizada">
            <li><Check aria-hidden="true" /> <strong>O que já joga a seu favor</strong></li>
            <li><Check aria-hidden="true" /> <strong>O que precisa de atenção</strong></li>
            <li><Check aria-hidden="true" /> <strong>O que desenvolver primeiro</strong></li>
            <li><Check aria-hidden="true" /> <strong>Seus 3 próximos passos</strong></li>
            <li><Check aria-hidden="true" /> <strong>O que trabalhar nos próximos 3, 6 e 12 meses</strong></li>
          </ul>
        </div>

        <div className="simulator-transformation">
          <p>Para sair do:</p>
          <blockquote>“Eu quero ir para o Canadá, mas não sei por onde começar.”</blockquote>
          <span>para:</span>
          <h3>“Agora eu sei o que preciso fazer primeiro.”</h3>
        </div>
      </section>

      <section id="oferta" className="simulator-section simulator-final-offer" aria-labelledby="offer-title">
        <div className="simulator-final-offer__copy">
          <p className="eyebrow"><span /> Simulador de Projeto Canadá</p>
          <h2 id="offer-title">Antes de investir em um caminho, entenda o seu ponto de partida.</h2>
          <p>Uma orientação personalizada para ajudar você a entender <strong>onde está hoje e o que precisa desenvolver para avançar no seu Projeto Canadá.</strong></p>
          <p className="simulator-final-offer__closing">Existem vários caminhos para o Canadá. <strong>Mas o seu projeto precisa começar por você.</strong></p>
        </div>
        <aside className="simulator-offer-card" aria-label="Resumo da oferta do Simulador de Projeto Canadá">
          <p className="eyebrow"><span /> Você recebe</p>
          <ul className="simulator-checklist">
            <li><Check aria-hidden="true" /> Seus pontos fortes e pontos de atenção</li>
            <li><Check aria-hidden="true" /> Prioridades de desenvolvimento</li>
            <li><Check aria-hidden="true" /> Seus 3 próximos passos</li>
            <li><Check aria-hidden="true" /> Plano de preparação para 3, 6 e 12 meses</li>
          </ul>
          <div className="simulator-price"><strong>{simulatorSalesConfig.currentPrice}</strong><small>À vista ou {simulatorSalesConfig.installmentPrice}</small></div>
          <p><strong>Clareza agora, antes de decisões que podem envolver meses de preparação e milhares de reais.</strong></p>
          <CheckoutLink placement="final">Quero descobrir meus próximos passos</CheckoutLink>
        </aside>
      </section>

      <section className="simulator-legal"><h2>Importante</h2><p>O Simulador possui finalidade educativa e informativa. A orientação é baseada nas informações fornecidas pelo participante e tem como objetivo apoiar a preparação e o planejamento do Projeto Canadá. Não constitui aconselhamento jurídico ou migratório, não determina elegibilidade, não garante aprovação e não substitui uma consulta profissional individualizada.</p></section>
      <footer className="simulator-sales-footer"><BrandMark compact /><span>© 2026 Canadá Sem Filtro</span></footer>
    </main>
  );
}
