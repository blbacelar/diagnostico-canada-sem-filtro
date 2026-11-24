# Mentoria: identificação e entrega do Simulador

## Objetivo

Identificar clientes da Mentoria pela compra aprovada na Hotmart e fazer com que o Simulador desses clientes seja liberado para envio somente depois que uma consulta one-on-one for marcada.

## Contexto confirmado

- A tabela `purchases` é a fonte comercial central e recebe o produto **Portal da Mentoria Canadá Sem Filtro** (`product_id` `9028579`).
- O portal já autentica alunos da Mentoria, mas a entrega do Simulador ainda depende somente da janela padrão após as respostas.
- Ainda não há evento de agenda/Calendly persistido neste projeto. A primeira versão precisa de uma marcação explícita feita pela equipe, sem inferir agendamento por texto ou data.

## Abordagens consideradas

1. Tratar a Mentoria como compra comum e conservar a regra de sete dias: descartada, pois não atende ao fluxo comercial definido.
2. Manter uma lista manual de e-mails da Mentoria: descartada, pois duplicaria a Hotmart e ficaria desatualizada.
3. Derivar a condição da compra aprovada no `purchases` e registrar no caso o momento em que a consulta foi marcada: escolhida. Mantém a Hotmart como origem do produto e deixa o futuro webhook do Calendly atualizar o mesmo campo.

## Design aprovado para implementação

- Reconhecer compra da Mentoria por `product_id = 9028579`, com fallback pelo nome normalizado do produto, apenas para eventos de compra aprovados.
- Considerar a compra da Mentoria como acesso válido ao Simulador.
- Adicionar `mentorship_consultation_scheduled_at` em `diagnostic_cases`; `null` significa que ainda não há consulta marcada.
- A regra de entrega do caso será calculada, não duplicada:
  - compra comum: regra atual de sete dias úteis após o envio das respostas;
  - Mentoria sem consulta: entrega bloqueada;
  - Mentoria com consulta marcada: entrega liberada para o envio automático/manual.
- Exibir na lista e no detalhe o selo de Mentoria e a situação da consulta.
- Em “Preparar entrega”, mostrar o botão acessível “Marcar consulta one-on-one”. A ação grava o momento, é auditada e atualiza a tela. Não envia o relatório por si só.
- O cron já existente continuará sendo o responsável por enviar o PDF e o link quando o parecer estiver aprovado; passará a respeitar a nova regra.

## Fora do escopo nesta entrega

- Criar ou alterar eventos no Calendly.
- Inferir consulta marcada pelo histórico de WhatsApp, e-mail ou nomes de produtos.
- Enviar o relatório antes de parecer aprovado.

## Verificação

- Testes de compra: Mentoria aprovada libera acesso ao formulário; compra não aprovada não libera.
- Testes de regra de entrega: Mentoria sem consulta bloqueia; após marcação libera; clientes comuns continuam usando sete dias úteis.
- Testes de rota: a marcação exige conta de consultora e deixa trilha de auditoria.
- Lint, verificação de tipos, testes unitários relevantes e build.
