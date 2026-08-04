"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { getBrowserSupabase } from "../lib/supabase";
import { Button } from "./ui/button";

export function PrintButton({ pdfUrl }: { pdfUrl?: string }) {
  const [loading, setLoading] = useState(false);

  async function openProtectedPdf(url: string) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write("<p style=\"font-family: sans-serif; padding: 24px;\">Gerando PDF...</p>");
    printWindow.document.close();

    setLoading(true);
    try {
      const { data } = await getBrowserSupabase().auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Sessão não encontrada.");

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.includes("application/pdf")) {
        throw new Error(`Falha ao gerar PDF (${response.status}).`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      printWindow.location.href = blobUrl;
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (error) {
      printWindow.document.body.innerHTML = "<p style=\"font-family: sans-serif; padding: 24px;\">Não foi possível abrir o PDF. Atualize o login e tente novamente.</p>";
      window.alert("Não foi possível abrir o PDF. Atualize o login e tente novamente.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function handleClick() {
    if (pdfUrl) {
      void openProtectedPdf(pdfUrl);
      return;
    }
    window.print();
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className="secondary-button report-print-button"
    >
      <Printer aria-hidden="true" /> {loading ? "Gerando PDF..." : "Imprimir"}
    </Button>
  );
}
