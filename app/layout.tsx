import type { Metadata } from "next";
import { headers } from "next/headers";
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif, Spectral } from "next/font/google";
import "./globals.css";

const display = Instrument_Serif({ variable: "--font-display", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const body = Spectral({ variable: "--font-body", subsets: ["latin"], weight: ["300", "400", "500"], style: ["normal", "italic"] });
const sans = IBM_Plex_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

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
  return <html lang="pt-BR"><body className={`${display.variable} ${body.variable} ${sans.variable} ${mono.variable}`}>{children}</body></html>;
}
