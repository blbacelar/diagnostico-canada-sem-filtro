"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, ChevronRight, CircleGauge, LayoutList, LogOut, Mail, Settings, ShieldCheck, Users } from "lucide-react";
import { getBrowserSupabase } from "../lib/supabase";
import { BrandMark } from "./BrandMark";

const nav = [
  { href: "/dashboard", label: "Visão geral", icon: CircleGauge },
  { href: "/dashboard/diagnosticos", label: "Diagnósticos", icon: LayoutList },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users },
  { href: "/dashboard/conteudos", label: "Conteúdos", icon: BookOpen },
  { href: "/dashboard/modelos", label: "Modelos de e-mail", icon: Mail },
  { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
  { href: "/dashboard/auditoria", label: "Auditoria", icon: ShieldCheck },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const [consultant, setConsultant] = useState<{ display_name: string; role: string } | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let mounted = true;
    async function verify() {
      const supabase = getBrowserSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.replace("/login"); return; }
      const { data } = await supabase.from("diagnostic_consultants").select("display_name, role, active").eq("user_id", sessionData.session.user.id).eq("active", true).maybeSingle();
      if (!data) { await supabase.auth.signOut(); router.replace("/login?denied=1"); return; }
      if (mounted) { setConsultant(data); setChecking(false); }
    }
    verify(); return () => { mounted = false; };
  }, [router]);
  async function signOut() { await getBrowserSupabase().auth.signOut(); router.replace("/login"); }
  if (checking) return <div className="dashboard-check"><span /><p>Confirmando acesso profissional…</p></div>;
  return <div className="dashboard-shell">
    <aside className="dashboard-sidebar">
      <BrandMark />
      <nav aria-label="Navegação do dashboard">{nav.map((item) => { const Icon = item.icon; const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)); return <Link href={item.href} className={active ? "active" : ""} key={item.href}><Icon /><span>{item.label}</span>{active && <ChevronRight className="nav-arrow" />}</Link>; })}</nav>
      <div className="consultant-card"><span>{consultant?.display_name?.slice(0,1) ?? "C"}</span><div><strong>{consultant?.display_name}</strong><small>{consultant?.role === "admin" ? "Administradora" : "Consultora"}</small></div><button type="button" onClick={signOut} aria-label="Sair"><LogOut /></button></div>
    </aside>
    <main className="dashboard-main">{children}</main>
  </div>;
}

export function DashboardHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <header className="dashboard-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>;
}
