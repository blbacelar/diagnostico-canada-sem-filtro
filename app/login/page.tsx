import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "../../components/BrandMark";
import { LoginForm } from "../../components/LoginForm";

export const metadata: Metadata = { title: "Acesso das consultoras", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const params = await searchParams;
  return <main className="login-page"><div className="login-visual"><BrandMark /><div><p className="eyebrow">Área interna</p><h1>Leitura profissional, <em>decisão humana.</em></h1><p>Um espaço reservado às consultoras autorizadas para organizar contexto, revisar alertas e entregar um parecer responsável.</p></div><small>Canadá Sem Filtro · Uso restrito e auditado</small></div><section className="login-panel"><div><p className="eyebrow">Bem-vinda</p><h2>Acesse o dashboard</h2><p>Entre com a conta profissional cadastrada pela administração.</p><LoginForm passwordReset={params.reset === "success"} /><Link href="/recuperar-senha">Esqueci minha senha</Link></div></section></main>;
}
