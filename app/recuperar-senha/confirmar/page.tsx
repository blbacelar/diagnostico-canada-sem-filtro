import type { Metadata } from "next";
import { BrandMark } from "../../../components/BrandMark";
import { PasswordResetForm } from "../../../components/PasswordResetForm";

export const metadata: Metadata = { title: "Criar nova senha", robots: { index: false, follow: false } };

export default function ConfirmPasswordResetPage() {
  return <main className="login-page login-page--recovery"><div className="login-visual"><BrandMark /><div><p className="eyebrow">Recuperação segura</p><h1>Crie uma nova <em>senha.</em></h1><p>Use uma senha exclusiva para proteger o acesso aos diagnósticos.</p></div><small>Canadá Sem Filtro · Link pessoal e temporário</small></div><section className="login-panel"><div><p className="eyebrow">Nova senha</p><h2>Proteja sua conta</h2><PasswordResetForm /></div></section></main>;
}
