# Estratégia de QA

## Jornada crítica: início do simulador

O formulário público é uma fronteira de integridade e privacidade: um e-mail digitado incorretamente pode entregar o link pessoal à pessoa errada. A validação ocorre em duas camadas independentes:

1. O navegador bloqueia dados inválidos antes de qualquer requisição e apresenta erros associados aos campos.
2. A API valida novamente o payload com Zod antes de acessar banco ou provedor de e-mail.

Comparações de e-mail removem espaços externos e ignoram diferenças de maiúsculas/minúsculas. Nenhuma outra diferença é tratada como equivalente.

## Matriz automatizada

| Risco | Cenários | Camada |
| --- | --- | --- |
| Link enviado ao endereço errado | igualdade, divergência, caixa e espaços, formatos inválidos, limite de 254 caracteres | unitário + browser |
| Dados incompletos | nome ausente/curto/longo, e-mail ausente, confirmação ausente, consentimento ausente | unitário + browser |
| Bypass do navegador | payload adulterado com divergência, formato inválido, consentimento falso e honeypot | integração da API |
| Submissão duplicada | duas submissões enquanto a primeira requisição está pendente | browser |
| Falha operacional | falha de rede, mensagem estável, botão reabilitado para nova tentativa | browser |
| Privacidade | resposta pública neutra sem enumeração ou detalhes internos | integração da API |
| Retomada | somente e-mail obrigatório, normalização e endpoint correto | unitário + browser |
| Acessibilidade | labels, foco no primeiro erro, `aria-invalid`, descrição do erro, teclado e axe | browser |
| Responsividade | ação principal em desktop e viewport móvel | browser |

Os testes de navegador interceptam somente a fronteira de e-mail/API para não enviar mensagens reais nem gravar dados de produção. A validação do backend é exercitada separadamente nos testes de integração.

## Comandos e gates

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e:smoke
npm run test:e2e:regression
npm run build:vercel
```

- `@smoke`: Chrome desktop, rápido e bloqueante para mudanças.
- `@critical`: integridade, acesso ou privacidade.
- `@regression`: Chrome desktop e viewport móvel.
- `@a11y`: baseline automatizada de acessibilidade.

Falhas de navegador retêm trace na primeira repetição, screenshot e vídeo somente quando há falha. Relatórios não devem conter segredos nem dados pessoais reais.

## Riscos fora da automação local

- Entrega real de e-mail depende da verificação DNS do domínio no Resend e deve ser validada em ambiente controlado, nunca pela suíte automática.
- Firefox e WebKit devem ser adicionados ao ciclo noturno quando houver uma política formal de navegadores suportados.
- Testes que gravam no Supabase exigem um projeto dedicado de QA, identificadores únicos e limpeza exata; a suíte atual não executa mutações no banco de produção.
