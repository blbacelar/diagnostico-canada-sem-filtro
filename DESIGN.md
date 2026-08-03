# Design system — Diagnóstico Canadá Sem Filtro

## Direção

Editorial, acolhedor e preciso. A interface herda a linguagem do Diário de Bordo: papel azul-gelo, tipografia serifada expressiva, metadados monoespaçados e uso contido do vinho canadense. O dashboard é desktop-first; o formulário é mobile-first.

## Tokens

| Token | Valor | Uso |
| --- | --- | --- |
| `--paper` | `#edf3f5` | Fundo principal |
| `--paper-shade` | `#e3ecef` | Superfícies secundárias |
| `--paper-light` | `#f6fafb` | Campos e relatórios |
| `--paper-edge` | `#cfdee3` | Bordas |
| `--ink` | `#17222b` | Texto principal |
| `--ink-soft` | `#3e5160` | Texto secundário |
| `--ink-mute` | `#586c7a` | Metadados |
| `--accent` | `#b71c3d` | Ações e ênfase |
| `--accent-soft` | `#d45f79` | Destaque suave |
| `--success` | `#2f6655` | Sucesso |
| `--warning` | `#916c2a` | Atenção |

## Tipografia

- Display: Instrument Serif, 400, títulos de 40–104px.
- Leitura: Spectral, 400, textos editoriais de 17–22px.
- Interface: IBM Plex Sans, 400–600, controles e navegação.
- Metadados: IBM Plex Mono, 500, caixa alta, tracking entre `0.10em` e `0.18em`.

As fontes são carregadas por `next/font/google`, evitando flash de tipografia e mantendo os fallbacks definidos em CSS.

## Escala e espaço

Base de 4px. Valores recorrentes: 8, 12, 16, 24, 32, 48, 64 e 96px. Conteúdo público limitado a 1180px; texto de leitura a 720px. Bordas usam 1px e raios de 2, 10, 18 ou 999px.

## Breakpoints

- Mobile: até 639px.
- Tablet: 640–959px.
- Desktop: 960–1279px.
- Wide: 1280px ou mais.

## Componentes

- `BrandMark`: wordmark textual acessível.
- `PrimaryButton`: cápsula vinho, rótulo em mono/caixa alta.
- `EditorialField`: campo claro, altura mínima de 52px, foco vinho.
- `StatusPill`: estado compacto sem depender apenas da cor.
- `ProgressRail`: progresso numérico e visual com `aria-valuenow`.
- `DashboardShell`: navegação lateral fixa no desktop e faixa rolável no mobile.
- `ReportPaper`: página A4 imprimível, sem notas internas.

## Acessibilidade

Contraste mínimo WCAG AA, foco visível de 2px, áreas de toque de 44px, labels explícitas, mensagens com `role=status/alert`, navegação por teclado e suporte a `prefers-reduced-motion`.
