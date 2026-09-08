# Nota Fiscal Eletrônica (NF-e/NFC-e) — arquitetura e plano de integração

Última atualização: 2026-09-08.

## Estado atual

Nenhuma integração real de emissão de nota fiscal foi contratada ou configurada. O que
existe nesta rodada é a **arquitetura completa e testada** para receber qualquer
provedor assim que uma decisão for tomada, sem exigir nova migration nem redesenho de
rotas para o fluxo básico de emitir/consultar/cancelar. Foi um pedido explícito do
cliente: "deixe o sistema pronto pra aceitar qualquer API que eu decida depois — não
vamos configurar nenhuma API por enquanto".

Com o provedor padrão (`NONE`), o sistema aceita normalmente uma solicitação de emissão
(não trava nem quebra o fluxo do pedido) mas a nota fica com status **"Aguardando
provedor"** — nenhuma chamada de rede é feita, nenhuma nota real é gerada. Existe também
um provedor `MOCK` (simulação interna) só para testar o fluxo ponta a ponta em
desenvolvimento/homologação — nunca deve ser usado com clientes reais, pois a chave de
acesso gerada não é válida perante a SEFAZ.

## Por que essa divisão (schema / provedor / rotas)

```
drizzle/schema.fiscal.ts     → 3 tabelas: fiscal_settings, invoices, invoice_events
drizzle/0032_fiscal_invoices.sql → migration aditiva correspondente

server/fiscal/types.ts               → contrato NfeProvider (emit/cancel/getStatus)
server/fiscal/providers/none.provider.ts → provedor padrão (não emite nada de verdade)
server/fiscal/providers/mock.provider.ts → simulação para testes/homologação interna
server/fiscal/registry.ts            → resolve o provedor configurado pelo nome salvo

server/db.fiscal.ts        → orquestra emissão/cancelamento com trava de concorrência
server/fiscal.router.ts    → rotas tRPC (fiscal.settings.*, fiscal.invoices.*)

client/src/pages/NotasFiscais.tsx     → tela de emissão/cancelamento por pedido
client/src/pages/Configuracoes.tsx    → aba "Nota Fiscal" (provedor, ambiente, emitente)
```

Nenhuma parte do sistema fala diretamente com uma API de NF-e — tudo passa pela
interface `NfeProvider`. Trocar de provedor (ou configurar o primeiro de verdade) é
uma mudança isolada em `server/fiscal/`, sem tocar em `db.fiscal.ts`, no router, nem na
interface.

## Modelo de dados (resumo)

- **`permupay_fiscal_settings`** — linha única (id fixo = 1, mesmo padrão de
  `permupay_payment_settings`): provedor ativo, ambiente (homologação/produção), dados
  do emitente (razão social, CNPJ, IE, regime tributário, cidade/UF).
- **`permupay_invoices`** — uma linha por pedido faturável. Referencia
  **exatamente um** de `permupay_orders` (pedido de varejo → NFC-e) ou
  `permupay_b2b_orders` (pedido B2B → NF-e), garantido por CHECK no banco. Ciclo de
  vida: `DRAFT → PENDING_PROVIDER/PROCESSING → AUTHORIZED | REJECTED | ERROR`;
  `REJECTED`/`ERROR` podem ser retentados na mesma linha; só depois de `CANCELLED`
  (nota autorizada e depois cancelada) uma nova linha pode ser aberta para o mesmo
  pedido — reflete o ciclo de vida real de uma NF-e, em que uma nota cancelada exige
  número/série novos.
- **`permupay_invoice_events`** — auditoria: cada tentativa de emissão, cancelamento ou
  consulta grava um evento com a resposta do provedor (mensagem + payload).

## Concorrência

Duas solicitações de emissão simultâneas para o **mesmo pedido** não podem gerar duas
notas. A proteção usada é mais simples que a do módulo B2B (que precisou de
`SERIALIZABLE` + retry porque o conflito acontecia entre duas linhas novas sendo
inseridas ao mesmo tempo): aqui, a emissão trava a **linha do pedido de origem**
(`SELECT ... FOR UPDATE` em `permupay_orders`/`permupay_b2b_orders`, que já existe)
antes de checar/criar a nota. A segunda chamada concorrente bloqueia até a primeira
commitar e, ao continuar, já enxerga a nota recém-criada — testado em
`server/fiscal.integration.test.ts` com duas emissões disparadas em paralelo de
verdade contra PostgreSQL.

## Como plugar um provedor real (Focus NFe, PlugNotas, eNotas, NFe.io, ou SEFAZ direta)

1. Contratar/decidir o provedor e obter credenciais de API (ou, para integração
   direta com a SEFAZ, um certificado digital A1/A2 válido em nome da empresa
   emitente).
2. Criar `server/fiscal/providers/<nome>.provider.ts` implementando a interface
   `NfeProvider` (`server/fiscal/types.ts`):
   - `emit(input)` — recebe emitente, destinatário, itens e total já normalizados;
     deve retornar `{ status, series?, number?, accessKey?, xmlUrl?, danfeUrl?, message }`.
   - `cancel(input)` — recebe a chave de acesso/referência salva na emissão.
   - `getStatus(input)` — consulta o status atual (útil quando a emissão é assíncrona).
3. Registrar a instância em `server/fiscal/registry.ts` (mapa `PROVIDERS`), usando o
   mesmo identificador já previsto no CHECK do banco (`FOCUS_NFE`, `PLUGNOTAS`,
   `ENOTAS`, `NFEIO` ou `CUSTOM`).
4. Guardar a API key/token do provedor em variável de ambiente (nunca em texto no
   banco — `permupay_fiscal_settings` só guarda um booleano
   `api_credentials_configured`, nunca a credencial em si) e ler essa variável dentro
   do novo provedor.
5. Selecionar o provedor em Configurações → Nota Fiscal. Nenhuma outra mudança de
   código é necessária — `db.fiscal.ts` e `fiscal.router.ts` já resolvem o provedor
   dinamicamente a partir da configuração salva.

## Lacunas conhecidas para quando um provedor real for escolhido

- **CPF/CNPJ do comprador em pedidos de varejo**: o pedido de varejo
  (`permupay_orders`) hoje só coleta nome e contato do comprador, não CPF/CNPJ. Muitos
  provedores/estados aceitam NFC-e sem CPF do consumidor (nota "sem identificação",
  válida abaixo de um determinado valor conforme a legislação estadual), mas se o
  provedor escolhido exigir o documento, será necessário um campo novo no cadastro do
  pedido (migration aditiva simples — fora do escopo desta rodada).
- **CFOP/NCM por item**: hoje só existe um NCM por produto (`permupay_products.ncm`,
  já existente) e um CFOP/NCM padrão em `fiscal_settings` — nenhuma regra de CFOP por
  operação (venda dentro do estado vs. fora, por exemplo) foi implementada, porque
  depende de decisões fiscais que só fazem sentido quando o provedor/regime real for
  definido.
- **DANFE/XML**: os campos `xml_url`/`danfe_url` existem na tabela mas nenhum provedor
  real os preenche ainda — cada provedor tem seu próprio formato de retorno
  (geralmente uma URL para download), então o mapeamento exato só pode ser feito ao
  integrar o provedor escolhido.
- **Nenhuma automação de emissão**: hoje a emissão é sempre uma ação manual da equipe
  (botão "Emitir" na tela Notas Fiscais). Emitir automaticamente ao confirmar
  pagamento, por exemplo, é uma decisão de produto a ser tomada junto com a escolha do
  provedor (não implementado nesta rodada).

## O que foi verificado nesta rodada

`pnpm check` (tsc limpo), `pnpm test` com PostgreSQL 16 real (14 testes novos: 6 de
autorização no router sem banco, 8 de integração com banco real cobrindo emissão,
idempotência, concorrência, cancelamento/reemissão e NF-e B2B vs. NFC-e varejo — suíte
completa sobe de 85 para **99 testes, todos passando**), `pnpm build` e subida real do
servidor de produção (`node dist/index.js`) com `GET /healthz` retornando 200.
