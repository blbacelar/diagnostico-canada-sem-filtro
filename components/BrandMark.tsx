import Link from "next/link";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand-mark ${compact ? "brand-mark--compact" : ""}`}
      aria-label="Canadá Sem Filtro — página inicial"
    >
      <span className="brand-mark__flag" aria-hidden="true">
        ✦
      </span>
      <span>
        <strong>Canadá</strong>
        <em>sem filtro</em>
      </span>
      {!compact && <small>Diagnóstico profissional</small>}
    </Link>
  );
}
