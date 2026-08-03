import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "../../components/BrandMark";
import { LoginForm } from "../../components/LoginForm";
export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false, follow: false } };
export default function RecoveryPage() { return <main className="login-page login-page--recovery"><div className="login-visual"><BrandMark /><div><p className="eyebrow">Recuperação segura</p><h1>Volte ao seu <em>espaço de análise.</em></h1></div></div><section className="login-panel"><div><p className="eyebrow">Acesso</p><h2>Recuperar senha</h2><p>Enviaremos as instruções para a conta profissional cadastrada.</p><LoginForm recovery /><Link href="/login">Voltar ao login</Link></div></section></main>; }
