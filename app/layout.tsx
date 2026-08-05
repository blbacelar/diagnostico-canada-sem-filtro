import type { Metadata } from "next";
import { headers } from "next/headers";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/spectral/300.css";
import "@fontsource/spectral/300-italic.css";
import "@fontsource/spectral/400.css";
import "@fontsource/spectral/400-italic.css";
import "@fontsource/spectral/500.css";
import "@fontsource/spectral/500-italic.css";
import "@fontsource/ibm-plex-sans/300.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    metadataBase: new URL(origin),
    title: { default: "Diagnóstico Canadá Sem Filtro", template: "%s · Canadá Sem Filtro" },
    description: "Diagnóstico profissional para estudar, trabalhar, empreender ou construir um projeto de vida no Canadá.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title: "Diagnóstico Canadá Sem Filtro", description: "Uma leitura honesta. Um plano responsável.", url: origin, siteName: "Canadá Sem Filtro", locale: "pt_BR", type: "website", images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "Vamos entender o seu projeto Canadá" }] },
    twitter: { card: "summary_large_image", title: "Diagnóstico Canadá Sem Filtro", description: "Uma leitura honesta. Um plano responsável.", images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body suppressHydrationWarning>{children}</body></html>;
}
