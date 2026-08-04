import { ArrowDown } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { LandingClient } from "../components/LandingClient";
import { getOperationalConfigWithFallback } from "../lib/operational-config.server";

export default async function HomePage() {
  const config = await getOperationalConfigWithFallback();
  return (
    <main className="public-page">
      <header className="public-header"><BrandMark /><a href="#como-funciona" className="header-link">Como funciona <ArrowDown aria-hidden="true" /></a></header>
      <LandingClient policyVersion={config.policyVersion} />
      <section id="como-funciona" className="how-it-works">
        <p className="eyebrow"><span /> O que acontece depois</p>
        <div className="process-grid">
          <article><b>01</b><h3>Você conta seu contexto</h3><p>Preencha no seu ritmo. Suas respostas são salvas e ficam protegidas pelo link pessoal.</p></article>
          <article><b>02</b><h3>A equipe organiza a leitura</h3><p>A tecnologia estrutura os dados e sinaliza pontos que merecem atenção — sem decidir por você.</p></article>
          <article><b>03</b><h3>Uma consultora revisa</h3><p>O parecer final só é entregue depois de análise humana, com limites e próximos passos claros.</p></article>
        </div>
        <p className="legal-note">Este diagnóstico tem finalidade educacional e de planejamento. Não promete elegibilidade, aprovação migratória ou aconselhamento jurídico definitivo.</p>
      </section>
      <footer className="public-footer"><BrandMark compact /><p>© 2026 Canadá Sem Filtro</p><a href="/login">Área das consultoras</a></footer>
    </main>
  );
}
