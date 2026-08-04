import type { Metadata } from "next";
import { FormApp } from "../../components/FormApp";

export const metadata: Metadata = { title: "Meu diagnóstico", robots: { index: false, follow: false } };

export default async function FormPage({ searchParams }: { searchParams: Promise<{ token?: string; origem?: string }> }) {
  const { token, origem } = await searchParams;
  return <FormApp initialToken={token} dashboardReturn={origem === "dashboard"} />;
}
