# Mentoria: entrega condicionada à consulta — plano

> A usuária aprovou a abordagem: identificar a Mentoria pela compra Hotmart e liberar a entrega após a marcação da consulta one-on-one.

## Arquivos envolvidos

- `supabase/migrations/`: campo de marcação da consulta, índice e permissões.
- `lib/purchase-window.ts`: identificação tipada do produto Mentoria e perfil de compra.
- `lib/delivery-window.ts`: regra de entrega para Mentoria e cliente comum.
- `lib/case-lock.ts`, `app/api/dashboard/cases/**`: leitura e atualização segura do estado de consulta.
- `app/api/diagnostics/start/route.ts`, `app/api/cron/final-deliveries/route.ts`, `app/api/diagnostics/send/route.ts`: acesso e entrega usando a mesma regra.
- `components/DashboardData.tsx`, `components/DiagnosticDetail.tsx`, `components/DeliveryComposer.tsx`, `app/globals.css`: selo/estado e ação da equipe.
- `tests/unit/`: cobertura da compra, regra e interface.

## Etapas

1. Criar uma migração aditiva com `mentorship_consultation_scheduled_at` em `diagnostic_cases`, índice parcial para casos aprovados aguardando consulta e comentário de uso futuro pelo Calendly.
2. Centralizar em `purchase-window` a identificação de compra aprovada da Mentoria pelo ID `9028579` e fallback por nome normalizado; incluir esse produto na autorização do Simulador.
3. Estender a janela de entrega com um modo discriminado: clientes comuns mantêm os sete dias úteis; Mentoria permanece bloqueada sem consulta e se libera após a data registrada.
4. Atualizar as rotas de detalhe, lista, envio manual e cron para buscar/usar o mesmo perfil e o mesmo campo de consulta. Criar uma rota autenticada para a equipe marcar a consulta e registrar auditoria/histórico.
5. Exibir “Mentoria” e o estado da consulta na lista/detalhe. Em “Preparar entrega”, oferecer uma ação clara para marcar a consulta, mantendo o botão de envio desabilitado até então.
6. Criar testes de regressão para autorização da Mentoria, regra de envio e marcação da consulta; rodar testes, lint, tipos, build e validar a interface.

## Foco de revisão

- Uma compra cancelada, expirada ou reembolsada nunca deve marcar o cliente como Mentoria.
- A marcação de consulta não pode enviar relatório por conta própria; o parecer aprovado continua obrigatório.
- Um caso comum não pode ter sua data de entrega alterada pela nova lógica.
- Uma chamada duplicada à marcação precisa ser idempotente.
- Apenas consultoras autenticadas podem marcar a consulta.
