# Diagnóstico Canadá Sem Filtro

Aplicação web de coleta, análise estruturada e revisão profissional para pessoas interessadas em estudar, trabalhar, empreender ou construir um projeto de vida no Canadá.

O sistema foi desenhado para o mesmo projeto Supabase do Diário de Bordo, com isolamento por prefixo `diagnostic_`, RLS em todas as novas tabelas, nenhuma alteração em `journals` ou `allowed_emails` e autorização própria em `diagnostic_consultants`.

## O que está implementado

- Link público permanente para Hotmart, identificação e consentimento versionado.
- Prevenção de enumeração de e-mails, honeypot e rate limiting no backend.
- Token pessoal aleatório; somente o hash com HMAC é armazenado.
- Formulário mobile-first com 11 seções, condicionais, autosave, retomada e revisão.
- Snapshot imutável no envio e bloqueio das respostas originais.
- Análise estruturada pelo Vercel AI SDK + OpenRouter, validada por Zod e versionada.
- Login Supabase Auth e autorização por `diagnostic_consultants`.
- Dashboard, busca, fila prioritária, alertas, caso detalhado e respostas somente leitura.
- Parecer humano estruturado com autosave, versões, aprovação e histórico.
- Solicitação de informação adicional e entrega final por Resend.
- Relatório editorial A4, link seguro de 30 dias e PDF anexável.
- Auditoria append-only, status history, retries idempotentes e dados fictícios de demonstração.
- Testes unitários, integração, E2E, migration RLS, lint, typecheck e build.

## Stack

React 19, TypeScript, App Router compilado com Vite/Vinext, Vercel Functions em Node.js/Fluid Compute, Supabase Auth/Postgres/Storage, AI SDK, OpenRouter, Zod, Resend e pdf-lib.

## Configuração local

1. Instale dependências com `npm install`.
2. Copie `.env.example` para `.env.local` e preencha somente no ambiente local.
3. Use `npm run dev` e abra `http://localhost:3000`.

Segredos nunca usam prefixo `VITE_`. A URL e a chave publicável/anon do Supabase são as únicas variáveis autorizadas no navegador.

## Banco compartilhado — revisão obrigatória

A migration final está em:

`supabase/migrations/20260803201924_diagnostic_initial_schema.sql`

Ela é aditiva e contém somente objetos `diagnostic_`, o schema privado `diagnostic_private` e o bucket privado `diagnostic_reports`.

**Não aplique a migration sem revisão humana.** O briefing exige confirmar o SQL antes de qualquer alteração no projeto Supabase compartilhado. Nenhuma migration foi aplicada automaticamente por este projeto.

Sequência recomendada após aprovação:

```bash
npx supabase link --project-ref jtkebfgfmugbqglwaatn
npx supabase db push --dry-run
npx supabase db push
npx supabase test db
```

Depois, rode os advisors no Supabase Dashboard ou com a versão atual da CLI e corrija qualquer alerta de segurança ou performance antes do deploy.

### Autorizar as duas consultoras

Crie as duas contas no Supabase Auth. Em seguida, insira os respectivos UUIDs; não reutilize `allowed_emails` e não use `user_metadata` para autorização:

```sql
insert into public.diagnostic_consultants
  (user_id, role, active, display_name, notification_email)
values
  ('UUID_DA_CONSULTORA_1', 'admin', true, 'Nome da consultora 1', 'email1@dominio.ca'),
  ('UUID_DA_CONSULTORA_2', 'consultant', true, 'Nome da consultora 2', 'email2@dominio.ca');
```

## E-mail transacional

O provedor descoberto no Vercel Marketplace é Resend. O projeto já está ligado à Vercel e os termos do produto foram aceitos. A instalação abriu uma etapa adicional no navegador para concluir a configuração do domínio `canadasemfiltro.ca` e dos registros DNS.

Após concluir essa etapa:

```bash
vercel env pull --yes
```

Use `diagnostico@canadasemfiltro.ca` somente depois que o domínio estiver verificado. O código aceita `RESEND_API_KEY` fornecida pela integração e mantém `EMAIL_PROVIDER_API_KEY` como alias de compatibilidade.

## IA

Configure `OPEN_ROUTER_API_KEY` no backend. O modelo padrão é `openai/gpt-5.6-terra`, consultado na lista atual do OpenRouter e substituível por `OPEN_ROUTER_MODEL`.

A análise:

- produz objeto validado, nunca apenas texto livre;
- não recebe nome ou e-mail no prompt;
- não registra prompt completo nem chain-of-thought;
- não afirma elegibilidade, não escolhe programa conclusivamente e não promete aprovação;
- cria alertas técnicos para recusas, inadmissibilidade, questões médicas/criminais e permanência irregular;
- permanece interna até a revisão humana.

## Endpoints principais

| Endpoint | Proteção | Finalidade |
| --- | --- | --- |
| `POST /api/diagnostics/start` | rate limit + validação | Criar ou renovar diagnóstico ativo |
| `POST /api/diagnostics/resume-link` | resposta neutra | Reenviar link pessoal |
| `GET /api/diagnostics/form-session` | token pessoal | Abrir sessão do formulário |
| `PUT /api/diagnostics/answers` | token + escopo | Autosave |
| `POST /api/diagnostics/submit` | token + idempotência | Snapshot e pipeline da IA |
| `POST /api/diagnostics/process-ai` | consultora ou cron | Retry versionado da IA |
| `POST /api/diagnostics/request-information` | consultora ativa | Solicitar complemento |
| `POST /api/diagnostics/approve` | consultora ativa | Aprovar parecer |
| `POST /api/diagnostics/send` | parecer aprovado | Enviar link/PDF |
| `GET /api/diagnostics/:id/report` | consultora ativa | PDF protegido |

## Privacidade e retenção

- Dados financeiros e migratórios sensíveis não aparecem em URL, analytics ou logs.
- Tokens expiram, são revogáveis e nunca são armazenados em texto puro.
- Snapshots, versões e auditoria não aceitam update/delete.
- Exportação deve usar o relatório aprovado e o snapshot do caso.
- Exclusões por solicitação devem passar pela administradora, com verificação da identidade, registro da base legal e política de retenção antes da execução. Como snapshots e auditoria são imutáveis, a política deve definir anonimização versus exclusão antes do lançamento.
- O exemplo de demonstração usa exclusivamente `example.invalid`.

## Validação

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e:smoke
npm run test:e2e:regression
npm run build:vercel
npx @vercel/config compile vercel.ts
```

O E2E cobre Chrome desktop e iPhone, validação acessível do formulário, prevenção de submissões duplicadas, recuperação de falhas, teclado e auditoria básica com axe. A matriz de riscos, camadas e gates está em [docs/QA.md](./docs/QA.md). Para a primeira execução local, instale o navegador do Playwright se solicitado: `npx playwright install chromium`.

## Deploy na Vercel

O arquivo `vercel.ts` mantém Functions Node.js com até 300 segundos, 2 GB de memória, cache `no-store` nas APIs e cabeçalhos de segurança. Não use runtime Edge para a IA ou PDF.

1. Revise/aplique a migration.
2. Conclua a integração Resend e verifique o domínio.
3. Configure todas as variáveis de `.env.example` na Vercel.
4. Defina `APP_URL` com o domínio definitivo.
5. Execute `vercel deploy` e valide o fluxo com uma conta de teste autorizada.

## Design

Tokens, tipografia, espaçamento, breakpoints, componentes e critérios de acessibilidade estão documentados em [DESIGN.md](./DESIGN.md).
