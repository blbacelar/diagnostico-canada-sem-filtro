import type { Metadata } from "next";
import { SimulatorSalesLanding } from "../../components/SimulatorSalesLanding";

export const metadata: Metadata = {
  title: "Simulador de Projeto Canadá | Canadá Sem Filtro",
  description: "Entenda seus pontos fortes, pontos de atenção, prioridades e próximos passos antes das grandes decisões do seu Projeto Canadá.",
};

export default function SimulatorSalesPage() {
  return <SimulatorSalesLanding />;
}
