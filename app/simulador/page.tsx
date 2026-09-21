import type { Metadata } from "next";
import { SimulatorSalesLanding } from "../../components/SimulatorSalesLanding";

export const metadata: Metadata = {
  title: "Simulador Canadá Sem Filtro | Organize seu ponto de partida",
  description: "Organize família, idioma, profissão, recursos e objetivos antes do próximo investimento no seu projeto Canadá.",
};

export default function SimulatorSalesPage() {
  return <SimulatorSalesLanding />;
}
