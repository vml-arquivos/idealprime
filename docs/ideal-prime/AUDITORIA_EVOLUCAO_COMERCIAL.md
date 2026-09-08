# Auditoria — Evolução comercial, clientes PF/PJ e entrada inteligente de produtos

Última atualização: 2026-09-08.

Este documento é o resultado da Fase 1 (obrigatória, executada antes de qualquer
alteração de código) do pedido "Evolução comercial, clientes PF/PJ e entrada
inteligente de produtos no Ideal Prime". Toda afirmação abaixo vem de comparação
real de código entre os dois repositórios (`idealprime-main` = estado atual em
produção; `permupay-vendas-main` = base original da qual o Ideal Prime foi
derivado), não de suposição a partir de nomes de arquivo ou documentação anterior.

Verificação de origem: o arquivo `permupayvendasmain_7.zip` enviado nesta rodada
é **byte-idêntico** (mesmo MD5) ao `permupayvendasmain_6.zip` já usado na Fase 1
original — não há conteúdo novo para extrair; a comparação abaixo usa a mesma
árvore já extraída em rodadas anteriores.

## 1. Resumo executivo

O Ideal Prime foi derivado do PermuPay Vendas **adicionando** um módulo B2B
completo (empresas, tabelas comerciais, cotações, portal do comprador
empresarial) e, na mesma operação, **removendo** um módulo que já existia e
funcionava no PermuPay Vendas: gestão de clientes finais pessoa física com CPF,
análise de crédito, login próprio do cliente e vendas a prazo por nota
promissória. Não foi uma decisão documentada como intencional em nenhum
artefato do repositório — não há menção a essa remoção em nenhum dos relatórios
(`RELATORIO_IMPLANTACAO_IDEAL_PRIME.md`, `docs/ideal-prime/*`) já existentes.

Isso explica diretamente por que o pedido atual (Fase 4) pede um "modelo de
cliente PF/PJ com ficha de cliente completa": a parte PF já existia no
PermuPay e precisa ser reconstruída/adaptada; a parte PJ (empresa) já existe no
Ideal Prime hoje sob o nome "Cliente Empresarial" / `businesses` (módulo B2B).

## 2. Inventário comparado, arquivo a arquivo

Legenda: `=` conteúdo idêntico ou diferença trivial (<10 linhas, cosmética);
`~` mesma funcionalidade-base com evolução real; `+` existe só no Ideal Prime;
`−` existe só no PermuPay Vendas (candidato a lacuna/regressão).

| Arquivo | idealprime-main | permupay-vendas-main | Situação |
|---|---|---|---|
| `client/src/App.tsx` | 323 linhas | 337 linhas | ~ (173 linhas de diff: idealprime trocou rotas de Clientes/NovaVenda por rotas B2B/Quase-Zero/Fiscal) |
| `client/src/components/DashboardLayout.tsx` | 409 linhas | 399 linhas | ~ (96 linhas de diff: menu "Clientes"/"Nova Venda" trocado por "Operação B2B"/"Notas Fiscais") |
| `client/src/pages/Dashboard.tsx` | 360 linhas | 624 linhas | ~ (280 linhas de diff: cartões e filtro por cliente/promissória removidos; cartões B2B adicionados) |
| `client/src/pages/Products.tsx` | 705 linhas | 716 linhas | ~ (125 linhas: campo/aba B2B adicionado, filtro Quase-Zero removido nesta mesma rodada) |
| `client/src/pages/ProductForm.tsx` | 1579 linhas | 1740 linhas | ~ (306 linhas: campos de habilitação B2B/tabela comercial adicionados) |
| `client/src/pages/BatchPricing.tsx` | 2372 linhas | 2376 linhas | = (8 linhas, cosmético) |
| `client/src/pages/Estoque.tsx` | 159 linhas | 159 linhas | = (idêntico) |
| `client/src/pages/Pedidos.tsx` | 773 linhas | 545 linhas | ~ (317 linhas: Ideal Prime cresceu para tratar pedidos B2B; referências a fluxo de assinatura de nota/promissória do lado PermuPay não foram portadas) |
| `client/src/pages/Vendedores.tsx` | 991 linhas | 991 linhas | = (22 linhas, cosmético) |
| `client/src/pages/WishlistAdmin.tsx` | 506 linhas | 506 linhas | = (idêntico) |
| `client/src/pages/WishlistPublic.tsx` | 697 linhas | 695 linhas | = (39 linhas, cosmético) |
| `client/src/pages/Clientes.tsx` | **não existe** | 1014 linhas | **−** (gestão de clientes PF removida) |
| `client/src/pages/ClienteDetalhe.tsx` | **não existe** | 888 linhas | **−** (ficha de cliente PF removida) |
| `client/src/pages/NovaVenda.tsx` | **não existe** | 473 linhas | **−** (venda direta vinculada a cliente cadastrado removida) |
| `client/src/pages/Promissorias.tsx` | **não existe** | 263 linhas | **−** (emissão/gestão de nota promissória removida) |
| `client/src/pages/B2BAdmin.tsx` | 33 linhas | não existe | **+** (novo — administração B2B) |
| `client/src/pages/BusinessPortal.tsx` | 106 linhas | não existe | **+** (novo — portal do comprador empresarial) |
| `client/src/pages/BusinessSignup.tsx` | 16 linhas | não existe | **+** (novo — cadastro de empresa) |
| `client/src/pages/NotasFiscais.tsx` | novo (Fase anterior desta sessão) | não existe | **+** (novo — emissão de NF-e/NFC-e, arquitetura sem provedor real) |
| `server/routers.ts` | 1697 linhas | 2312 linhas | ~ (789 linhas: `customerAuth`/`promissoryNotes` presentes só no PermuPay; `b2b`/`fiscal` presentes só no Ideal Prime) |
| `server/db.orders.ts` | 819 linhas | 1294 linhas | ~ (556 linhas: lógica de parcelamento/promissória do PermuPay não portada; lógica de pedido B2B é exclusiva do Ideal Prime) |
| `server/db.customers.ts` | 137 linhas | 601 linhas | **−** (versão do Ideal Prime só resolve cliente por contato para carrinho/pedido; toda gestão de cadastro, crédito, autenticação do cliente foi removida) |
| `server/db.batches.ts` | 1369 linhas | 1393 linhas | = (28 linhas, cosmético — lógica de FIFO/lote é a mesma) |
| `server/db.b2b.ts` | 446 linhas | não existe | **+** (novo) |
| `server/b2b.router.ts` | 73 linhas | não existe | **+** (novo) |
| `server/db.promissoryNotes.ts` | não existe | 303 linhas | **−** |
| `drizzle/schema.ts` | 545 linhas | 572 linhas | ~ (44 linhas, ajustes de relações) |
| `drizzle/schema.customers.ts` | 30 linhas | 107 linhas | **−** (ver detalhe abaixo — campos de CPF, crédito e login do cliente removidos da tabela) |
| `drizzle/schema.orders.ts` | 95 linhas | 105 linhas | = (11 linhas) |
| `drizzle/schema.b2b.ts` | 251 linhas | não existe | **+** (novo) |
| `drizzle/schema.fiscal.ts` | novo (Fase anterior desta sessão) | não existe | **+** (novo) |
| `drizzle/schema.promissoryNotes.ts` | não existe | 79 linhas | **−** |
| `shared/permissions.ts` | 55 linhas | não existe | **+** (novo — sistema de permissões granular, criado só para o B2B) |
| `shared/promissoryNoteEngine.ts` | não existe | 97 linhas | **−** |
| `shared/reservationExpiry.ts` | não existe | 30 linhas | **−** (no Ideal Prime a expiração de reserva B2B foi implementada dentro de `db.b2b.ts`, não como módulo compartilhado — funcionalidade equivalente existe, só não é a mesma exportação) |

## 3. Detalhe do achado principal: `permupay_customers`

Colunas existentes no PermuPay Vendas e **ausentes** no Ideal Prime hoje:

- `cpf`, `rg`, `birth_date`, `document_front_url`, `document_back_url`, `proof_address_url` — documentação para crediário/análise de crédito.
- `credit_status` (`NAO_ANALISADO`/`APROVADO`/`REPROVADO`), `credit_notes`, `credit_limit`, `reviewed_by`, `reviewed_at` — fluxo de análise de crédito.
- `password_hash`, `last_signed_in` — login do próprio cliente (área "Minha Conta" com sessão própria, roteador `customerAuth` em `server/routers.ts`).

Nenhuma dessas colunas foi apagada por uma migration explícita no Ideal Prime —
elas simplesmente nunca existiram nele; o schema e a tabela já nasceram
reduzidos quando o fork foi criado. Isso é relevante para a Fase 10 (migrations
aditivas): reintroduzir esses campos é uma migration nova e aditiva sobre uma
tabela que já existe, não uma correção de dado.

## 4. Funcionalidades que devem ser preservadas sem alteração (linha de base)

Confirmado por diff que os seguintes módulos são **idênticos ou quase idênticos**
entre os dois repositórios, ou seja, já são estáveis e não fazem parte do
problema — qualquer alteração nas Fases 2–9 deve deixá-los intactos e cobertos
pelos mesmos testes já existentes:

- FIFO/lotes de estoque (`server/db.batches.ts`, `BatchPricing.tsx`, `Estoque.tsx`).
- Vendedores/comissão (`Vendedores.tsx`).
- Lista de desejos pública e administrativa (`WishlistPublic.tsx`, `WishlistAdmin.tsx`) — hoje é a base sobre a qual a Fase 6 ("Solicitações de Produtos") deve evoluir, não substituir.
- Motor de precificação (`shared/pricingCalculator.ts`, `shared/pricing.batch.ts`) — idêntico nos dois repositórios.

## 5. Como isso muda o escopo das fases seguintes

- **Fase 4 (PF/PJ)**: a parte PJ já existe (tabela `permupay_businesses` do
  módulo B2B, com `businessId` em pedidos). A parte PF precisa reintroduzir os
  campos de `permupay_customers` listados na seção 3, adaptando (não copiando
  literalmente) o fluxo de crédito/promissória do PermuPay para o contexto do
  Ideal Prime — o pedido do cliente não pede de volta o fluxo de nota
  promissória em si (não mencionado no prompt desta rodada), então essa parte
  específica (`promissoryNoteEngine`, tabela `permupay_promissory_notes`) fica
  **fora do escopo** desta rodada, marcada aqui apenas para registro; só os
  campos cadastrais (CPF/RG/endereço/documento) e o vínculo cliente↔pedido são
  necessários para a "ficha de cliente" pedida.
- **Fase 5 (pedidos PF/PJ)**: `permupay_orders` já tem `customer_id`
  (aponta para `permupay_customers`) e `permupay_b2b_orders` já tem
  `business_id` — a base para diferenciar origem do pedido já existe nos dois
  lados; o trabalho da Fase 5 é de UI/relatório e consistência de rótulos, não
  de schema novo para o vínculo em si.
- **Fase 6 (Solicitações de Produtos)**: evolução do `WishlistAdmin`/`WishlistPublic`
  já existente — mesma tabela-base, com novo campo de status e histórico, não
  substituição.

## 6. Riscos identificados para as próximas fases

- Qualquer migration que adicione colunas a `permupay_customers` deve ser
  puramente aditiva (`ALTER TABLE ... ADD COLUMN`, nullable ou com default) —
  a tabela já tem linhas em produção.
- A ausência de UI de gestão de clientes PF no Ideal Prime hoje significa que
  não há regressão de comportamento visível a quebrar nessa parte (é uma
  lacuna, não uma feature ativa) — mas o **cadastro automático de cliente por
  contato**, que já acontece hoje durante checkout/pedido (`db.customers.ts`,
  função usada por `routers.ts customers.*`), precisa continuar funcionando
  exatamente como está para pedidos de varejo existentes.
- `Pedidos.tsx` já é o maior ponto de divergência de lógica de negócio entre os
  dois repositórios (317 linhas de diff) — qualquer mudança na Fase 5 deve ser
  feita com testes de regressão completos antes/depois, dado que já concentra
  tanto o fluxo de varejo quanto o B2B.
