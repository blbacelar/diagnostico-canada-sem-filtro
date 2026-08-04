"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="secondary-button report-print-button"><Printer aria-hidden="true" /> Imprimir</button>;
}
