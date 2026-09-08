# Relatório de implantação — Ideal Prime

Última atualização: 2026-09-08. Ver também a seção "Remoção da marca 'Quase Zero'" e a seção "Evolução comercial — Fase 1 e Fase 2" mais abaixo, referentes a rodadas seguintes no mesmo dia.

## Estado do código

O B2B foi implementado de forma aditiva sobre a base PermuPay Vendas: contas empresariais, membership, tabela de preços versionada, catálogo empresarial isolado, cotação, pedido multitem idempotente e transacional, reserva de estoque, backoffice de importação CSV/XLSX. A implementação **já existente** (antes desta rodada) era funcionalmente mais completa do que os arquivos `schema.b2b.ts`/`b2b.router.ts` sugeririam a um leitor rápido — mas continha bugs concretos de autorização e concorrência, confirmados por execução real contra PostgreSQL 16 (não apenas por leitura de código). Ver `docs/ideal-prime/AUDITORIA_PERMUPAY_IDEAL_PRIME.md` para o detalhamento de cada achado.

## O que foi concluído nesta rodada

1. **Auditoria comportamental completa** comparando `permupay-vendas-main` e `idealprime-main` (não apenas diff de arquivo — leitura linha a linha dos módulos críticos, migrations aplicadas de fato contra Postgres real, bugs de concorrência reproduzidos com scripts contra o banco).
2. **Correção de 5 achados bloqueadores**: vazamento de pedidos entre empresas via `trpc.b2b.order` (B1); importação sem checagem de permissão (B2); `createOrderFromQuote` não atômico permitindo conversão dupla de uma cotação sob concorrência — reproduzido de fato antes da correção (B3); reservas de estoque B2B que nunca expiravam (B4); `drizzle/schema.b2b.ts` incompleto com risco de `DROP TABLE` em geração futura de migration (B5).
3. **Correção de 2 achados altos**: ausência de fluxo para a equipe vincular um segundo comprador a uma empresa já aprovada (A2 — nova mutation `b2b.admin.inviteMember`); máquina de estados do pedido sem validação de transição a partir do estado atual (A3).
4. **Correção de 1 achado médio**: `/portal` sem redirecionamento para usuário deslogado (M1).
5. **Migration aditiva nova**: `drizzle/0031_b2b_hardening.sql` — `CHECK` de formato de CNPJ no banco, `CHECK` de quantidade positiva em reservas B2B (faltava), índice de paginação de pedidos por empresa. Nenhum `DROP`/`TRUNCATE`.
6. **23 testes automatizados novos**: `server/b2b.router.test.ts` (7, autorização no router, sem precisar de banco) e `server/b2b.integration.test.ts` (16, contra PostgreSQL 16 real — idempotência, isolamento entre empresas, concorrência de última unidade, concorrência de conversão de cotação, atomicidade multitem, expiração de reserva, importação idempotente, não publicação automática). Suíte completa: **85 testes, todos passando**; a suíte de integração é pulada automaticamente (não falha) quando `DATABASE_URL` não está definida.
7. **Verificações executadas de fato nesta sessão** (não apenas assumidas): `pnpm install --frozen-lockfile`, `pnpm migrate:verify`, `pnpm check` (`tsc --noEmit`), `pnpm test` (com e sem banco disponível), `pnpm build`, `pnpm db:migrate` contra PostgreSQL 16 real (31 migrations aplicadas do zero com sucesso, e reaplicadas sem efeito na segunda execução), build de produção iniciado de fato com `node dist/index.js` e `GET /healthz` retornando 200.
8. Limite de linhas por importação (5000) adicionado como proteção contra abuso, que faltava.

## O que depende de configuração externa (não testável neste repositório isoladamente)

- Backup/restore reais do PostgreSQL de produção (procedimento documentado, não automatizado neste repo).
- Comportamento em container Docker real (Dockerfile/compose revisados e corretos por inspeção; não foi possível subir via `docker compose up` neste ambiente de auditoria por falta de daemon Docker acessível — o servidor foi validado rodando diretamente com Node contra Postgres real, o que exercita o mesmo código de produção).
- Verificação visual desktop/mobile das telas (não há renderização de navegador disponível neste ambiente de auditoria).
- `scripts/create-admin.mjs` é interativo por design (evita senha em variável de ambiente/log); não foi possível automatizá-lo via stdin não-interativo neste sandbox específico (limitação do `readline/promises` do Node com stdin não-TTY observada neste ambiente, não um defeito do script). A query SQL que ele executa foi validada diretamente contra o banco de teste com sucesso.

## O que está fora do escopo desta entrega (pendência priorizada, não implementada)

Sete migrations/módulos inteiros do PermuPay que nunca foram portados ao Ideal Prime (o repositório se bifurcou antes deles existirem — ver achado A1 da auditoria):

- Promissórias (`shared/promissoryNoteEngine.ts`, `server/db.promissoryNotes.ts`, migration `0030_promissory_notes`, página `Promissorias.tsx`).
- KYC/crédito de clientes (migration `0029_customers_kyc_credit`).
- Segurança de clientes (migration `0031_customer_security`).
- Métodos de pagamento por produto (migration `0032_product_payment_methods`).
- Histórico/comunicações de clientes (migration `0033_customer_history_and_communications`).
- Expansão de métodos em configurações de pagamento (migration `0034_payment_settings_methods`).
- Produtos em destaque/hero (migration `0035_products_featured_hero`).
- CRM de clientes / venda direta / autenticação de cliente / documentos e recibos em PDF (`Clientes.tsx`, `ClienteDetalhe.tsx`, `NovaVenda.tsx`, `server/_core/customerAuth.ts`, `server/_core/documentRoutes.ts`, `server/pdf.documents.ts`).

Cada um desses merece a mesma profundidade de auditoria comportamental feita aqui para o B2B antes de ser portado — copiar arquivo por arquivo sem essa auditoria é exatamente o que a tarefa original pediu para não fazer. Recomenda-se tratá-los como entregas subsequentes, um módulo por vez.

Também permanecem fora do escopo, por serem limitações intencionais do produto (não relacionadas à auditoria): gateway de pagamento individual por empresa, ERP, estorno bancário automático, múltiplos depósitos e notificações automáticas por e-mail/WhatsApp. Pagamento nesta versão é confirmação manual pela equipe. Nenhum desses itens deve ser apresentado como concluído.

A emissão de NF-e **saiu** dessa lista nesta rodada: a arquitetura (banco, rotas, tela)
está pronta para receber qualquer provedor — ver seção "Nota Fiscal Eletrônica" mais
abaixo e `docs/ideal-prime/NFE_INTEGRACAO.md`. Nenhum provedor real está configurado
ainda; isso continua dependendo de uma decisão comercial do cliente (qual provedor,
certificado digital, ambiente de homologação).

## Controles implementados (visão geral, atualizada)

RBAC equipe/comprador validado no servidor (não só na interface) e agora coberto por teste automatizado no nível do router tRPC; conta empresarial e membership com unicidade e CNPJ validado também no banco; tabela de preços versionada em centavos, com snapshot imutável em cada pedido; catálogo empresarial isolado por tabela vigente, sem custo/margem no payload; pedido multitem idempotente e atômico, com lock de concorrência testado sob carga simulada real; reservas de estoque com expiração automática (novo); máquina de estados do pedido com transições validadas (novo); conversão de cotação em pedido atômica sob concorrência, com retry automático em conflito de serialização (novo); importação auditável, idempotente por hash e com limite de linhas (novo); upload administrativo autenticado e agora também exigindo permissão B2B específica (corrigido); documentos privados; porta fixa; healthcheck com banco real verificado nesta sessão; volume Ideal Prime dedicado.

## Bloqueadores remanescentes para produção

Nenhum dos 5 achados bloqueadores identificados nesta auditoria permanece em aberto — todos foram corrigidos e cobertos por teste nesta rodada. **Não há bloqueador conhecido para o fluxo B2B em si** ao final desta entrega. A ressalva é a lacuna de paridade com o PermuPay (achado A1, sete módulos legados não portados) — não bloqueia o B2B, mas deve ser resolvida antes de se declarar paridade completa com o PermuPay Vendas.

## Remoção da marca "Quase Zero" (2026-09-08, segunda rodada)

A pedido do cliente: "Quase Zero" é uma aplicação/marca à parte (vitrine para produtos usados/seminovos que não devem ser vendidos como novos) e não deve aparecer com esse nome/formato dentro do Ideal Prime. Como ainda não foi decidido um nome definitivo para esse canal, a decisão foi **ocultar** em vez de renomear.

O que foi feito:

- **Rota pública `/quase-zero` desativada** (`client/src/App.tsx`) — import e `<Route>` comentados, não removidos, para facilitar reativação futura com outro nome.
- **Página `client/src/pages/QuaseZero.tsx` removida** — continha toda a marca visual (logo, textos "Quase Zero"); como ficou órfã (nenhuma rota a referenciava mais), manter o arquivo só preservaria a marca no repositório sem propósito.
- **Endpoint público `trpc.marketplace.quaseZeroProducts` desativado** (`server/routers.ts`) — comentado, não removido; era o único consumidor restante de `dbBatches.getQuaseZeroProducts()` após a página ser desligada, e por ser público ficaria acessível via chamada direta à API mesmo sem link nenhum no site.
- **Menu do admin** (`client/src/components/DashboardLayout.tsx`): removido item de navegação duplicado que apontava para "Quase Zero" (na prática apontava para a mesma rota `/produtos`).
- **Tela de produtos** (`client/src/pages/Products.tsx`): removida a aba de filtro "Quase Zero" e todo o código que só existia para ela (tipo, contagem, filtro, mensagem de lista vazia); os dois links de compartilhamento de produto (individual e exportação para Excel) que apontavam condicionalmente para `/quase-zero` agora sempre apontam para `/vitrine`; os dois badges visíveis ("Quase Zero" e "Shop + Quase Zero") foram renomeados para "Canal alternativo" e "Ideal Prime + canal alternativo".
- **Formulário de produto** (`client/src/pages/ProductForm.tsx`): rótulos do seletor "Canal de venda" trocados de "Quase Zero" para "Canal alternativo (oculto)" / "Ideal Prime + canal alternativo (oculto)"; tooltip não cita mais o nome da marca.

O que foi mantido intencionalmente (é dado de negócio, não branding, e remover quebraria produtos já cadastrados com esse canal):

- A coluna `products.salesChannel` e o valor `QUASE_ZERO` no banco/schema (`drizzle/schema.ts`, `server/db.ts`) — produtos já classificados nesse canal continuam existindo e continuam automaticamente excluídos da vitrine pública principal (`Marketplace.tsx` já filtra `salesChannel !== "QUASE_ZERO"`, comportamento anterior a esta mudança).
- A função `getQuaseZeroProducts()` em `server/db.batches.ts` — não é mais chamada por nenhuma rota (o único endpoint que a expunha foi desativado), fica apenas disponível para reaproveitamento se/quando um nome definitivo for escolhido.

Verificação após a remoção (nesta sessão, com PostgreSQL 16 real): `pnpm check` limpo, `pnpm test` com **85/85 testes passando** (mesma suíte da rodada de auditoria B2B, sem regressão), `pnpm build` concluído com sucesso. Conferido por grep no bundle final (`dist/public/assets/*.js`, `dist/index.html`, `dist/index.js`): nenhuma ocorrência de "Quase Zero" nem de `/quase-zero` no HTML/JS servido ao navegador — as únicas ocorrências restantes no bundle do servidor são comentários de código (nunca enviados ao cliente).

Pendência explícita: quando houver um nome definitivo para esse canal, a reativação é direta — descomentar a rota em `App.tsx` e o endpoint em `routers.ts`, recriar a página de vitrine com o novo nome/visual, e atualizar os rótulos do seletor em `ProductForm.tsx`.

**Correção pontual (mesmo dia)**: a remoção inicial do endpoint `marketplace.quaseZeroProducts` havia quebrado o build de produção (`tsc`) porque o deploy do cliente manteve `client/src/pages/QuaseZero.tsx` (a decisão final foi manter esse arquivo em vez de apagá-lo — só precisa continuar fora do menu/rotas, sem quebrar o build). Correção: `QuaseZero.tsx` voltou a usar o endpoint público já existente `marketplace.products` (o mesmo do restante do site, sem nenhum nome "Quase Zero" na API) com o filtro heurístico `isQuaseZeroProduct` que já estava definido no próprio arquivo — nenhuma rota nova, nenhum endpoint reaberto. A página continua sem nenhuma rota/menu apontando pra ela. Reverificado nesta sessão: `pnpm check`, `pnpm migrate:verify`, `pnpm test` (99/99) e `pnpm build`, todos limpos.

## Nota Fiscal Eletrônica — arquitetura de preparação (2026-09-08, terceira rodada)

A pedido do cliente: deixar o sistema **pronto para receber qualquer API de emissão de
NF-e** que venha a ser escolhida, sem configurar nenhum provedor real por enquanto
("não vamos configurar nenhuma API por enquanto... só quero que as rotas, o sistema já
esteja pronto pra aceitar"). Detalhamento completo da arquitetura, do modelo de dados e
do passo a passo para plugar um provedor real em `docs/ideal-prime/NFE_INTEGRACAO.md`.

O que foi feito:

- **Migration aditiva `drizzle/0032_fiscal_invoices.sql`** — três tabelas novas:
  `permupay_fiscal_settings` (provedor/ambiente/dados do emitente, linha única),
  `permupay_invoices` (uma nota por pedido, referenciando `permupay_orders` OU
  `permupay_b2b_orders` via CHECK, nunca os dois) e `permupay_invoice_events`
  (auditoria de cada tentativa). Nenhum `DROP`/`TRUNCATE`; aplicada e verificada com
  `pnpm migrate:verify` e `pnpm db:migrate` contra PostgreSQL 16 real nesta sessão.
- **Camada de provedor plugável** (`server/fiscal/types.ts`, `server/fiscal/registry.ts`,
  `server/fiscal/providers/{none,mock}.provider.ts`) — interface `NfeProvider` com
  `emit`/`cancel`/`getStatus`; hoje só existem o provedor `NONE` (não emite nada de
  verdade, só registra a solicitação) e `MOCK` (simula emissão para testes). Plugar
  Focus NFe, PlugNotas, eNotas, NFe.io ou integração direta com a SEFAZ é isolado a um
  novo arquivo em `server/fiscal/providers/` + uma linha no registro — nenhuma mudança
  em `db.fiscal.ts`, no router ou na tela.
- **`server/db.fiscal.ts`** — orquestra emissão/cancelamento com a mesma disciplina de
  concorrência do módulo B2B: trava a linha do PEDIDO de origem (`FOR UPDATE`) antes de
  criar/reaproveitar a nota, tornando duas emissões concorrentes do mesmo pedido
  seguras por padrão (testado com chamadas paralelas de verdade contra o banco).
  Reemissão de nota `AUTHORIZED` é idempotente; `REJECTED`/`ERROR` são retentados na
  mesma linha; só após `CANCELLED` uma nova linha pode ser aberta para o mesmo pedido.
- **Rotas tRPC `fiscal.*`** (`server/fiscal.router.ts`, montadas em `server/routers.ts`):
  `fiscal.settings.get/update/knownProviders` e
  `fiscal.invoices.list/forOrder/events/eligibleRetailOrders/eligibleB2BOrders/emit/cancel/refreshStatus`.
  Nova permissão `fiscal.invoices` (`shared/permissions.ts`) — nenhum comprador B2B a
  possui por padrão (emitir nota é operação interna da equipe); alterar as
  configurações fiscais exige admin, não só a permissão de configurações.
- **Tela `client/src/pages/NotasFiscais.tsx`** (rota `/notas-fiscais`, item "Notas
  Fiscais" no menu Financeiro) — lista pedidos Ideal Prime (NFC-e) e B2B (NF-e) com o
  status da nota e ação de emitir/cancelar; avisa claramente quando nenhum provedor
  está configurado.
- **Aba "Nota Fiscal" em Configurações** (`client/src/pages/Configuracoes.tsx`, só
  admin) — seleção de provedor (com os ainda não implementados marcados "em breve"),
  ambiente (homologação/produção) e dados do emitente (razão social, CNPJ, IE,
  cidade/UF).

Lacunas conhecidas, documentadas em `NFE_INTEGRACAO.md` (não bloqueiam a preparação,
mas precisam de decisão quando um provedor real for escolhido): pedidos de varejo não
coletam CPF/CNPJ do comprador hoje; não há regra de CFOP por operação; os campos de
XML/DANFE existem no banco mas nenhum provedor real os preenche ainda.

Verificação nesta sessão: `pnpm check` limpo, `pnpm migrate:verify` e `pnpm db:migrate`
contra PostgreSQL 16 real, `pnpm test` com **14 testes novos** (6 de autorização no
router sem banco, 8 de integração contra banco real — emissão, idempotência,
concorrência real com chamadas paralelas, cancelamento/reemissão, NF-e B2B vs. NFC-e
varejo) — suíte completa **99/99 testes passando**, sem regressão nos 85 anteriores;
`pnpm build` concluído com sucesso; servidor de produção (`node dist/index.js`) subiu
de fato com `GET /healthz` retornando 200.

## Evolução comercial — Fase 1 e Fase 2 (rodada seguinte, mesmo dia)

Pedido do cliente: evolução comercial ampla (12 fases) cobrindo modelo de cliente
PF/PJ, importação inteligente de planilha, "Solicitações de Produtos" e renomeação de
navegação — sob a restrição explícita e reiterada de **não regredir nenhuma
funcionalidade existente** ("não regrida nada nas atualize o sistema").

**Fase 1 — Auditoria (concluída)**: comparação real, arquivo a arquivo, entre
`idealprime-main` e `permupay-vendas-main` — resultado completo em
`docs/ideal-prime/AUDITORIA_EVOLUCAO_COMERCIAL.md`. Achado principal: o fork do Ideal
Prime, ao adicionar o módulo B2B, **removeu sem documentar** um módulo de gestão de
clientes pessoa física que já existia e funcionava no PermuPay Vendas (`Clientes.tsx`,
`ClienteDetalhe.tsx`, `NovaVenda.tsx`, campos de CPF/RG/crédito em
`permupay_customers`, login próprio do cliente). Isso explica e fundamenta o pedido da
Fase 4 (modelo PF/PJ) — não é uma feature nova do zero, é a reconstrução adaptada de
algo que já existiu. O verificado como já compartilhado e estável entre as duas bases
(FIFO/lotes, vendedores, motor de precificação, wishlist) está listado no documento
como linha de base a não tocar.

**Fase 2 — Renomeação de navegação/rótulos (concluída)**: aplicada só a texto exibido
ao usuário (menu, títulos de página, cartões, mensagens, comentários de código
correlatos) — nenhuma rota, endpoint, nome de tabela/coluna ou permission key foi
alterado, para não introduzir risco de regressão:

- Menu "B2B Ideal Prime" → item "Operação B2B" virou **"Relacionamento Comercial"**
  (`DashboardLayout.tsx`, e o rótulo correspondente em `shared/permissions.ts`).
- Página `/b2b-admin` (`B2BAdmin.tsx`): título "Operação B2B" → **"Gestão Comercial"**;
  "Tabelas de preço" → **"Tabelas Comerciais"**; "Cotações empresariais" →
  **"Cotações Comerciais"**; "Últimas importações" → **"Importações de Catálogo"**.
- Menu "Vendas" → item "Desejos" virou **"Solicitações"**; página administrativa
  (`WishlistAdmin.tsx`) "Lista de Desejos" → **"Gestão de Solicitações"**; página
  pública (`WishlistPublic.tsx`, `/desejos`) "Lista de Desejos" → **"Solicitações de
  Produtos"**; mesmo texto também atualizado no rodapé de `ProductPage.tsx`, no
  cartão de indicador do `Dashboard.tsx` e na descrição de `CategoriasAdmin.tsx`.

Não foram encontrados no código atual os textos literais "Cliente B2B" e "Business
Portal" citados no pedido original — são termos conceituais das Fases 4/5 (ainda não
implementadas) e serão aplicados no texto real assim que essas telas existirem.

Verificação: `pnpm check` limpo, `pnpm migrate:verify` (32 migrations OK), `pnpm test`
contra PostgreSQL 16 real — **99/99 testes passando, nenhuma regressão** — e `pnpm
build` concluído com sucesso.

**Fases 3 a 12 (pendentes)**: importação inteligente de planilha, modelo de cliente
PF/PJ com migration aditiva, pedidos PF/PJ, "Solicitações de Produtos" com ciclo de
status, navegação cruzada, indicadores de dashboard, ajustes visuais, testes novos e
verificação final — são o trabalho de maior porte e risco desta rodada (schema novo,
migrations, testes de concorrência) e serão feitos em sequência, cada fase validada
(`check`/`test`/`build`) antes de avançar para a próxima, exatamente para sustentar a
exigência de não regressão.
