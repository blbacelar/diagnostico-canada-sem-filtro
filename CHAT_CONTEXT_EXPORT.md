# Contexto exportado — Diagnóstico Canadá Sem Filtro

Data da exportação: 2026-08-10  
Repositório: `blbacelar/diagnostico-canada-sem-filtro`  
Thread Codex: `019fc942-d765-7982-bd1b-044599d8bcdd`

> Esta é uma exportação consolidada do contexto disponível no thread. Ela preserva requisitos, decisões, correções, validações e estado do projeto. O transcript bruto completo não é exposto pela API desta sessão. Segredos e valores de `.env.local` foram omitidos.

## Objetivo do produto

Aplicação full stack “Canadá sem filtro — Diagnóstico profissional” para:

- coletar um diagnóstico estruturado de clientes;
- validar e persistir respostas com Supabase;
- processar uma análise automática;
- permitir revisão profissional por consultoras;
- aprovar, preparar e enviar a entrega por e-mail/PDF;
- oferecer dashboard operacional com clientes, diagnósticos, configurações, auditoria e modelos de e-mail;
- hospedar exclusivamente no Vercel, não no ChatGPT Sites.

## Requisitos solicitados pelo usuário

1. Criar a aplicação a partir do prompt anexado “Diagnóstico Canadá Sem Filtro”.
2. Commitar e enviar tudo para `https://github.com/blbacelar/diagnostico-canada-sem-filtro.git`.
3. Corrigir o erro de build do Vercel quando `.next` não era encontrado.
4. Corrigir o erro `Cannot read properties of null (reading 'reset')` ao iniciar o diagnóstico.
5. Configurar o Resend usando a chave `RESEND_API_KEY` do `.env.local` e a chave administrativa do Supabase no servidor.
6. Validar e confirmar e-mails iguais no formulário, com testes de QA para cenários possíveis.
7. Usar somente Vercel para deploy.
8. Testar o Resend com envio real quando solicitado.
9. Melhorar a UI do formulário:
   - campo de idade menor;
   - campos relacionados alinhados semanticamente;
   - estado civil ao lado de idade;
   - nacionalidade ao lado do país de residência;
   - filhos como checkbox;
   - quantidade e idades dos filhos organizadas;
   - componentes shadcn/ui e selects sem aparência HTML crua;
   - select com opção selecionada legível;
   - valores monetários formatados em moeda;
   - campos numéricos aceitando apenas números;
   - texto livre validado como texto;
   - validações com Zod e mensagens visíveis na UI.
10. Impedir reenvio de um diagnóstico já submetido pelo cliente.
11. Criar acesso ao dashboard, recuperação de senha e fluxo completo de reset.
12. Remover mensagens internas desnecessárias sobre contas em `diagnostic_consultants`.
13. Substituir placeholders dos módulos do dashboard por dados reais.
14. Tornar parâmetros de Configurações editáveis.
15. Garantir PT-BR consistente, inclusive substituir “Entrega sent” por texto em português.
16. Corrigir impressão/PDF:
   - quebras de página adequadas;
   - botão “Imprimir” abrindo o menu de impressão;
   - exportação PDF pelo diálogo de impressão.
17. Corrigir contadores do dashboard para refletir o funil real de diagnósticos.
18. Enviar notificação por e-mail aos usuários ativos do dashboard quando o cliente concluir um diagnóstico.
19. Bloquear um diagnóstico para a consultora que iniciou a revisão; outra consultora não pode abrir o caso.
20. Mostrar o nome do usuário logado no cabeçalho do dashboard.
21. Diagnósticos enviados devem abrir o conteúdo existente, não iniciar outro diagnóstico.
22. Criar “Novo diagnóstico” como fluxo separado, editável e pré-preenchido quando necessário.
23. Tornar o cabeçalho do editor de parecer sticky para manter os botões visíveis durante a rolagem.
24. Preservar rascunhos do parecer ao voltar para o caso e reabrir “Continuar parecer”.
25. Fazer “Pronto para aprovação” salvar e redirecionar para “Preparar entrega”.
26. Remover o painel lateral “Rascunho automático” do editor e alinhar o editor à largura padrão do dashboard.

## Correções e decisões importantes

### Formulário e validação

- O formulário usa Zod para validar payloads.
- E-mails são normalizados e comparados antes do envio.
- Valores monetários têm máscara/formatação em BRL.
- Campos numéricos e texto livre têm regras distintas.
- Erros de validação aparecem próximos aos campos e em estados de erro acessíveis.

### E-mail e Resend

- A chave do Resend fica somente no servidor.
- Notificações do dashboard são enviadas individualmente para não expor destinatários.
- O envio usa idempotência por caso/usuário.
- Sucessos e falhas são registrados em `diagnostic_email_deliveries`.
- Falha de um e-mail não impede a conclusão do diagnóstico nem os demais envios.

### Ciclo de vida do diagnóstico

- Casos enviados são imutáveis.
- “Novo diagnóstico” cria uma nova versão/caso editável.
- Pareceres aprovados/enviados não podem ser alterados.
- Casos ativos são reservados atomicamente para a primeira consultora que iniciar a revisão.
- Outra consultora recebe bloqueio de acesso, inclusive por URL direta.

### Parecer profissional

- O editor salva rascunhos automaticamente.
- Rascunhos incompletos podem ser salvos; os três próximos passos só são obrigatórios para enviar à aprovação.
- Dados retornados pelo banco em `snake_case` são convertidos para o estado `camelCase` do editor.
- O botão “Voltar ao caso” aguarda o salvamento do rascunho antes de navegar.
- “Pronto para aprovação” salva, mostra feedback e navega para:
  `/dashboard/diagnosticos/{id}/email`
- O painel de referências automáticas foi removido.
- O editor usa uma única coluna e respeita o espaçamento padrão do dashboard.
- O cabeçalho continua sticky, com retorno, estado de salvamento e ações.

### Dashboard

- Indicadores separados para recebidos, em revisão, prontos para envio e entregues.
- Atualização ao retornar à aba e em intervalo periódico.
- Cabeçalho usa o nome da conta autenticada.
- Clientes, diagnósticos, configurações, auditoria e modelos consultam dados reais.

### Segurança Supabase

- Chave `SUPABASE_SERVICE_ROLE_KEY` não é exposta ao navegador.
- Tabelas sensíveis têm RLS e políticas de acesso por consultora responsável.
- A autorização não depende de `user_metadata` editável.
- A migration de ownership foi aplicada ao projeto Supabase real.

## Principais áreas do código

- `components/FormApp.tsx` — formulário público e validações de interação.
- `components/ReviewEditor.tsx` — edição, autosave, aprovação e navegação do parecer.
- `components/DiagnosticDetail.tsx` — detalhe do caso e ações do ciclo de vida.
- `components/DashboardData.tsx` — visão geral e métricas.
- `app/api/diagnostics/reviews/route.ts` — leitura e persistência do parecer.
- `app/api/diagnostics/submit/route.ts` — submissão do cliente e notificações.
- `app/api/dashboard/cases/[id]/reassessment/route.ts` — novo diagnóstico/reavaliação.
- `lib/case-lock.ts` — reserva atômica de casos.
- `lib/case-lifecycle.ts` — estados imutáveis.
- `lib/schemas.ts` — schemas Zod.
- `lib/dashboard-summary.ts` — regras dos indicadores.
- `app/globals.css` — design system e layout responsivo.
- `supabase/migrations/` — schema, RLS e ownership.
- `tests/unit/` — testes unitários de UI, schemas e regras.
- `tests/integration/` — testes de migrations e integração.

## Histórico de commits relevantes

- `4754590` — corrige o funil e os contadores do dashboard.
- `d9c0e99` — adiciona notificação por e-mail aos usuários ativos.
- `b51e500` — adiciona ownership/lock de casos e políticas RLS.
- `c405fb9` — fixa o cabeçalho do editor durante a rolagem.
- `07855e0` — persiste e restaura rascunhos do parecer.
- `efc981b` — remove painel lateral e redireciona aprovação para preparar entrega.
- `c773659` — alinha espaçamento do editor ao dashboard.

## Estado atual

- Branch: `main`
- Último commit: `c773659 Match review editor spacing with dashboard`
- Repositório remoto: `origin/main`
- Produção: [diagnostico-canada-sem-filtro.vercel.app](https://diagnostico-canada-sem-filtro.vercel.app)
- Último deploy verificado: Ready
- Última suíte validada: 141 testes, lint, typecheck e build aprovados
- Deploys devem continuar somente no Vercel.

## Variáveis de ambiente esperadas

Os nomes esperados são:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `OPEN_ROUTER_API_KEY`

Os valores não fazem parte desta exportação por segurança.

## Observações para continuidade

- Antes de alterar Next.js, consultar os guias em `node_modules/next/dist/docs/`, conforme `AGENTS.md`.
- Para qualquer alteração Supabase, seguir `/.agents/skills/supabase/SKILL.md` e validar no banco real quando aplicável.
- Não usar ChatGPT Sites para deploy.
- O CLI global do Vercel está desatualizado; recomenda-se `npm i -g vercel@latest`.
