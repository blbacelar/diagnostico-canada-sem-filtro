import type { Metadata } from "next";
import { SimulatorSalesLanding } from "../../components/SimulatorSalesLanding";

export const metadata: Metadata = {
  title: "Simulador Canadá Sem Filtro | Organize seu plano Canadá",
  description: "Organize família, idioma, profissão, recursos e objetivos antes de investir tempo e dinheiro no seu plano Canadá.",
};

export default function SimulatorSalesPage() {
  return <SimulatorSalesLanding />;
}
