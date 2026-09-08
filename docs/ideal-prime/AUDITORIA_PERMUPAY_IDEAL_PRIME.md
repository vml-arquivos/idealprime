# Auditoria PermuPay Vendas × Ideal Prime

Data: 2026-09-08
Método: comparação de árvore de arquivos (`diff -rq`), leitura linha a linha dos módulos críticos, migrações aplicadas contra PostgreSQL 16 local real (não simulado), reprodução ativa de bugs de concorrência com scripts contra o banco, `tsc --noEmit`, `vitest run` e `vite build` executados de fato. Nenhum achado abaixo foi aceito apenas por estar descrito em README/CHECKLIST/RELATORIO existentes — cada um foi confirmado no código-fonte e, quando aplicável, no banco.

Convenção de severidade: **BLOQUEADOR** (impede produção), **ALTO**, **MÉDIO**, **BAIXO**.

---

## 1. Resumo executivo

O Ideal Prime foi bifurcado do PermuPay Vendas logo após a migration `0028_customers_cart`. A partir daí os dois repositórios seguiram caminhos **totalmente diferentes**:

- O PermuPay continuou evoluindo o núcleo de vendas: migrations `0029`…`0035` (KYC/crédito de clientes, promissórias, segurança de clientes, métodos de pagamento por produto, histórico/comunicações de clientes, expansão de métodos em configurações de pagamento, produtos em destaque/hero).
- O Ideal Prime, a partir do mesmo ponto, implementou apenas o B2B: migrations `0029_ideal_prime_b2b` e `0030_enterprise_permissions_quotes`.

Isso significa que o Ideal Prime **nunca recebeu** sete migrations inteiras de funcionalidade do PermuPay, e o módulo B2B, embora funcionalmente mais completo do que os arquivos `schema.b2b.ts`/`b2b.router.ts` sugerem à primeira vista (287 linhas de lógica real em `db.b2b.ts`, com transação serializável, `FOR UPDATE`, idempotência e locks), contém **três bugs de autorização/concorrência confirmados por execução real** contra um Postgres local, além de uma lacuna de schema Drizzle que é, ela própria, um risco de perda de dados.

Nenhum desses pontos bloqueadores é cosmético; todos foram reproduzidos.

---

## 2. Achados BLOQUEADORES

### B1 — Vazamento de pedidos entre empresas via `b2b.order`

**Onde:** `server/b2b.router.ts:39-41`, `server/db.b2b.ts:103-105` (`getOrder`).

```ts
order: authenticatedProcedure
  .input(z.object({ id: z.number().int().positive() }))
  .query(({ ctx, input }) => b2b.getOrder(ctx.user.id, input.id, (ctx.user as any).accountType !== "BUYER")),
```

O procedure usa `authenticatedProcedure` puro — **sem** `permissionProcedure`/checagem de `B2B_OPERATIONS`. Qualquer usuário interno autenticado (`accountType !== "BUYER"`), **mesmo sem nenhuma permissão B2B atribuída**, cai no ramo `isStaff=true` de `getOrder`, cuja query é:

```sql
select o.*, b.legal_name, b.trade_name
from permupay_b2b_orders o
join permupay_business_accounts b on b.id = o.business_account_id
where o.id = $1        -- SEM filtro de membership/permissão
```

Ou seja: um funcionário interno qualquer (ex.: um perfil de expedição sem nenhuma permissão B2B marcada) consegue ler `trpc.b2b.order.query({id})` para **qualquer** `id` sequencial e obter valores, itens, `delivery_snapshot`/`terms_snapshot` e status de **qualquer empresa**, sem checagem de posse. Isso viola diretamente o requisito "`getOrder` ... devem verificar ownership/membership no servidor" e "empresa A não lê dados da empresa B" — a violação aqui é interna (staff sem permissão lê dados comerciais de todas as empresas), o que é igualmente grave porque a autorização por permissão é o mecanismo central pedido pela especificação ("usuário interno não deve receber mais acesso do que seu role/permissões permitem").

**Corrigido nesta entrega** (seção 6.1).

### B2 — Importação CSV/XLSX sem checagem de permissão

**Onde:** `server/_core/index.ts:136-150` (`POST /api/b2b/import`).

A rota HTTP verifica apenas `user.accountType !== "BUYER"`, isto é, qualquer conta interna autenticada — **independentemente de possuir a permissão `b2b.operations`** — pode importar produtos/preços em massa, criando produtos novos, alterando `active`, `stock_quantity` (modo `INVENTORY`) e criando novas versões de tabela de preço. Isso é inconsistente com o restante do admin B2B (`admin.imports`, `admin.businesses` etc. exigem `permissionProcedure(B2B_OPERATIONS)`) e viola "Admin importa produtos e preços... conforme as permissões" e "toda mutation sensível deve validar a sessão e a permissão no servidor".

**Corrigido nesta entrega** (seção 6.2).

### B3 — `createOrderFromQuote` não é atômico: uma cotação pode virar dois pedidos (reproduzido)

**Onde:** `server/db.b2b.ts:262-287`.

A função faz: (1) `SELECT` da cotação **fora de transação/lock**; (2) checa `status==='APPROVED'`; (3) chama `createOrder` (abre sua própria transação separada); (4) só then executa `UPDATE ... SET status='CONVERTED' WHERE status='APPROVED'`. Entre os passos (1)-(4) não existe lock nem transação compartilhada, então duas conversões concorrentes (duplo clique, timeout+retry do navegador, dois separadores de tela) podem ambas passar pela checagem de status antes que a primeira grave `CONVERTED`.

**Reproduzido de fato** contra Postgres 16 local (script descartável, não incluído no repositório, usando as funções reais de `db.b2b.ts`): em 1 de 5 execuções concorrentes, a mesma cotação aprovada gerou **dois pedidos** (`IP-20260908-84B15C2C` e `IP-20260908-E7F8D85A`), cada um com sua própria reserva de estoque — dobrando a reserva de itens vendidos a partir de uma única cotação. Isso viola diretamente "`createOrderFromQuote` deve validar que a cotação... não foi convertida" e "retry após timeout não pode duplicar pedido".

Nas outras 4 execuções, a segunda chamada foi rejeitada corretamente ("cotação precisa ser aprovada" ou erro de serialização de estoque) — o que confirma que o bug é uma condição de corrida sensível a timing, não uma falha determinística, o que o torna mais perigoso em produção sob carga real (é exatamente o padrão que só aparece com usuários reais).

**Corrigido nesta entrega** (seção 6.3), com teste de regressão que repete a concorrência.

### B4 — Reservas de estoque B2B nunca expiram

**Onde:** `server/db.b2b.ts:96` (cria reserva com `expires_at = now() + interval '24 hours'`); `server/_core/index.ts:182-193` (job periódico); `server/db.orders.ts:676` (`expireStaleReservations`).

O job de 10 em 10 minutos registrado em `server/_core/index.ts` chama `expireStaleReservations()` **importado de `../db.orders`**, que opera exclusivamente sobre a tabela legada `permupay_orders` (fluxo interno/PDV do PermuPay). Não existe, em lugar nenhum do código, uma rotina que:

```sql
update permupay_b2b_stock_reservations
set status='EXPIRED'
where status='ACTIVE' and expires_at < now()
```

Isso significa que todo pedido B2B criado e nunca confirmado (carrinho abandonado, cliente que não paga) **mantém a reserva ACTIVE para sempre**, subtraindo permanentemente do estoque comercial disponível (`buyerCatalog`/`createOrder` calculam disponibilidade descontando reservas `ACTIVE`). Em volume, isso trava a venda de produtos populares indefinidamente. A coluna `expires_at` e o valor `'EXPIRED'` do enum de status existem no schema exatamente para isso — só falta o job.

**Corrigido nesta entrega** (seção 6.4).

### B5 — `schema.b2b.ts` incompleto: risco de `DROP TABLE` em futura geração de migration

**Onde:** `drizzle.config.ts` (`schema: "./drizzle/schema*.ts"`), `drizzle/schema.b2b.ts` (28 linhas, 4 tabelas).

`db.b2b.ts` não usa Drizzle — usa um `pg.Pool` cru com SQL manual — mas o **glob de configuração do drizzle-kit** (`schema*.ts`) inclui `schema.b2b.ts` mesmo assim. As migrations `0029`/`0030` criaram 13 tabelas/alterações; `schema.b2b.ts` só declara 5 (`businessAccounts`, `businessMemberships`, `priceLists`, `priceListVersions`, `priceListItems`) e nenhuma das 8 restantes (`permupay_b2b_orders`, `permupay_b2b_order_items`, `permupay_b2b_stock_reservations`, `permupay_b2b_notifications`, `permupay_import_jobs`, `permupay_import_rows`, `permupay_b2b_quotes`, `permupay_b2b_quote_items`). Qualquer execução futura de `drizzle-kit generate` vai comparar o banco real contra este schema incompleto e **propor `DROP TABLE`** para as 8 tabelas ausentes — um desastre se alguém rodar isso sem revisar o SQL gerado a fundo. `db:push` já está corretamente desabilitado no `package.json`, o que evita o pior cenário, mas o schema deveria refletir a realidade do banco de qualquer forma, inclusive para tipagem seguro se algum código futuro migrar para Drizzle nessas tabelas.

**Corrigido nesta entrega** (seção 6.5): `schema.b2b.ts` completado com as 13 tabelas/colunas na íntegra, idêntico ao SQL aplicado.

---

## 3. Achados ALTOS

### A1 — Regressão funcional: 7 migrations e módulos inteiros do PermuPay nunca chegaram ao Ideal Prime

Presentes no PermuPay e **ausentes** no Ideal Prime:

| Módulo PermuPay | Migration/arquivo | Impacto se cliente empresarial também usa o fluxo legado |
|---|---|---|
| KYC/crédito de clientes | `0029_customers_kyc_credit.sql` | Sem esse controle, o legado de venda direta a clientes perde a análise de crédito. |
| Promissórias | `0030_promissory_notes.sql`, `shared/promissoryNoteEngine.ts` (+teste), `server/db.promissoryNotes.ts` (+teste), página `Promissorias.tsx` | Módulo inteiro de nota promissória ausente — não compila nem existe no Ideal Prime. |
| Segurança de clientes | `0031_customer_security.sql` | Hardenings de conta de cliente do PermuPay não existem no Ideal Prime. |
| Métodos de pagamento por produto | `0032_product_payment_methods.sql` | Produtos no Ideal Prime não podem restringir métodos de pagamento por item. |
| Histórico/comunicações de clientes | `0033_customer_history_and_communications.sql` | Sem histórico de interação com cliente. |
| Expansão de métodos em config. de pagamento | `0034_payment_settings_methods.sql` | Config. de pagamento do Ideal Prime está atrás da do PermuPay. |
| Produtos em destaque/hero | `0035_products_featured_hero.sql` | Vitrine do Ideal Prime não suporta produtos "hero"/destaque que o PermuPay já suporta. |
| CRM de clientes (páginas) | `client/src/pages/Clientes.tsx`, `ClienteDetalhe.tsx` | Não existem no Ideal Prime — não há tela para gerir clientes de venda direta. |
| Venda direta / nova venda | `client/src/pages/NovaVenda.tsx` | Ausente. |
| Autenticação de cliente (loja) | `server/_core/customerAuth.ts`, `client/src/lib/customerSession.ts`, `client/src/components/CustomerAuthPanel.tsx` | Ausente — a Loja/MinhaConta do Ideal Prime não tem o mesmo backend de sessão de cliente que o PermuPay já endureceu. |
| Documentos/relatório PDF | `server/_core/documentRoutes.ts`, `server/pdf.documents.ts`, `client/src/components/ReceiptModal.tsx`, `client/src/lib/receipt.ts` | Emissão de recibo/documento ausente. |
| Motor de expiração de reserva (genérico) | `shared/reservationExpiry.ts` (+teste) | Este é o motor que deveria ter sido reaproveitado para B2 (ver B4) — existe pronto no PermuPay e nunca foi portado nem generalizado. |

**Isto é uma regressão em relação à regra "preserve integralmente o comportamento funcional já incorporado ao Ideal Prime"** apenas na medida em que essas funcionalidades façam parte do que já rodava em produção do lado herdado — como o Ideal Prime nunca as teve (bifurcou antes delas existirem), tecnicamente não é uma regressão no sentido de "quebrou algo que funcionava no Ideal Prime", mas é uma **lacuna de paridade** que a tarefa pede para fechar ("aproveitando as mudanças do PermuPay sem regressões"). Classificado ALTO (não bloqueador do fluxo B2B em si) porque:

1. Envolve dinheiro (promissórias, KYC de crédito) — risco financeiro se alguém assumir que esse controle existe.
2. É volume grande de trabalho (7 migrations + módulos client/server completos) que **não foi portado nesta entrega** — decisão explicada na seção 5.

### A2 — `admin.createUser` permite criar conta `BUYER` órfã (sem empresa vinculada)

**Onde:** `server/routers.ts:1233-1248`.

`admin.createUser` aceita `accountType: "BUYER"` e cria o usuário isoladamente, sem criar `permupay_business_memberships`. Não existe nenhuma mutation para "convidar" um segundo comprador para uma empresa já aprovada — a única forma de vincular usuário↔empresa é `b2b.signup` (fluxo público de auto-cadastro). Isso quebra o requisito "se houver convite ou criação direta de usuários pela equipe, torne o fluxo seguro e auditável" — não há como o time comercial adicionar um segundo usuário (ex.: financeiro do cliente) a uma empresa já aprovada sem pedir para o cliente se cadastrar de novo com o mesmo CNPJ (o que falharia por unicidade de CNPJ).

**Corrigido nesta entrega** (seção 6.6): nova mutation `b2b.admin.inviteMember`.

### A3 — Máquina de estados do pedido/cotação não valida transição atual

**Onde:** `server/db.b2b.ts:107-114` (`transitionOrder`), `server/db.b2b.ts:252-260` (`transitionQuote`).

`transitionOrder('ACCEPT')` e `transitionOrder('PAY')` não checam o `commercial_status`/`payment_status` atual antes de aplicar — um pedido `CANCELADO` pode receber `PAY` (fica com `payment_status='PAGO'` apesar de cancelado) e `ACCEPT` pode ser chamado múltiplas vezes sem efeito colateral grave, mas sem generar erro conforme "rejeite transições inválidas". `transitionQuote` já tem uma guarda parcial (`where status in ('PENDING','APPROVED')`), mas não distingue as transições válidas a partir de cada estado (ex.: `REJECT` a partir de `APPROVED` é aceito hoje, quando o fluxo correto costuma travar aprovação/rejeição como terminais mútuos).

**Corrigido nesta entrega** (seção 6.7).

---

## 4. Achados MÉDIOS

- **M1 — `/portal` é rota pública sem redirecionamento para usuário deslogado.** `App.tsx` não envolve `BusinessPortal` em `ProtectedRoute`; a própria página não faz `useEffect` de redirecionamento quando `user` é `null` — apenas retorna `null` (tela em branco). Servidor já protege via tRPC (`authenticatedProcedure`), então não há vazamento de dados, mas a UX fica sem feedback (viola "todos os fluxos devem ter estados de... erro"). Corrigido nesta entrega (seção 6.8).
- **M2 — Autorização de ações administrativas mistura dois modelos.** `admin.approve`, `admin.suspend`, `admin.createPriceList`, `admin.transition`, `admin.transitionQuote` exigem `role==='admin'` (via `adminProcedure`), enquanto `admin.businesses`, `admin.priceLists`, `admin.orders`, `admin.quotes`, `admin.imports` aceitam qualquer staff com a permissão `b2b.operations`. Isso é seguro (mais restritivo, não mais permissivo), mas é inconsistente com o texto do requisito ("conforme as permissões") — hoje nenhuma combinação de permissões dá a um funcionário não-admin o poder de aprovar/suspender empresa ou mudar status de pedido. Mantido como está por ser fail-safe; documentado para decisão do responsável do produto (não é um bug de segurança).
- **M3 — Import não distingue "modo PRICES" de alteração indevida de custo.** O requisito pede "não altere custo automaticamente se o modo não autorizar". `applyImport` não grava nenhum campo de custo (`acquisitionCost`, `finalUnitCostBrl` etc.) em nenhum dos dois modos — ok por omissão, mas também não existe um terceiro modo "custos" nem trava explícita, então o comportamento correto hoje é "nunca mexe em custo", o que atende ao requisito só porque a função é limitada. Nenhuma mudança de código necessária; documentado.
- **M4 — `create-admin.mjs` não mascara a senha digitada no terminal.** `readline.question` ecoa o texto normalmente. Não é logado em arquivo (atende ao requisito literal), mas fica visível na tela/scrollback do terminal. Baixo risco operacional; sugerido usar leitura mascarada em iteração futura.

## 5. Achados BAIXOS

- Estilo de código extremamente denso (uma linha por função inteira) em `db.b2b.ts`/`b2b.router.ts`/`b2b.import.ts` dificulta revisão e aumenta risco de erro humano em mudanças futuras — sugerido reformatar com `pnpm format` (Prettier já configurado) numa PR dedicada, sem mudar comportamento.
- `xlsx` é importado estaticamente por `Products.tsx`/`SimulationsExport.tsx` e dinamicamente por `BatchPricing.tsx` — Vite avisa que o chunk não é dividido; não é bug funcional, é otimização de bundle.

---

## 6. Correções aplicadas nesta entrega

Todas as correções abaixo foram aplicadas diretamente no código deste repositório (`idealprime-main`) e cobertas por teste automatizado sempre que tecnicamente possível sem infraestrutura externa.

1. **B1** — `b2b.order` passou a exigir permissão explícita (`B2B_OPERATIONS` para staff, `B2B_ORDER_HISTORY` para comprador) antes de consultar `getOrder`.
2. **B2** — `POST /api/b2b/import` agora verifica `hasPermission(user.permissions, PERMISSIONS.B2B_OPERATIONS, user.role)` além de `accountType !== 'BUYER'`.
3. **B3** — `createOrderFromQuote` foi reescrito para rodar em **uma única transação `SERIALIZABLE`**, com `SELECT ... FOR UPDATE` da cotação antes de decidir a conversão; `createOrder` foi refatorado para aceitar um `PoolClient` externo opcional, permitindo compor as duas operações atomicamente.
4. **B4** — Adicionada `expireStaleB2BReservations()` em `db.b2b.ts` e integrada ao job periódico existente em `server/_core/index.ts`.
5. **B5** — `drizzle/schema.b2b.ts` completado com as 13 tabelas/relações do B2B, batendo 1:1 com o SQL das migrations `0029`/`0030`.
6. **A2** — Nova mutation `b2b.admin.inviteMember` (permissão `B2B_OPERATIONS`) para o time comercial vincular um novo usuário comprador a uma empresa já existente, com senha hasheada e auditoria via `updated_at`.
7. **A3** — `transitionOrder`/`transitionQuote` agora validam a transição a partir do estado atual e rejeitam transições inválidas com mensagem específica.
8. **M1** — `BusinessPortal.tsx` agora redireciona para `/login` quando não autenticado.

Migrations aditivas novas criadas para suportar o acima sem `DROP`/alteração destrutiva: ver `drizzle/0031_b2b_hardening.sql`.

## 7. Fora do escopo desta entrega (não implementado)

Ver `RELATORIO_IMPLANTACAO_IDEAL_PRIME.md` para a lista completa e justificativa. Em resumo: os 7 módulos legados listados em A1 (promissórias, KYC/crédito, segurança de cliente, métodos de pagamento por produto, histórico/comunicação de cliente, produtos hero, CRM de clientes/venda direta/documentos PDF) **não foram portados** nesta rodada — portar cada um exige o mesmo nível de auditoria comportamental (não só copiar arquivo) feito aqui para o B2B, e fazer isso com qualidade para sete módulos simultaneamente, sem banco de produção para validar, teria um risco de regressão maior do que deixá-los documentados como pendência priorizada. Recomenda-se tratá-los como entregas subsequentes, uma de cada vez, cada uma com sua própria auditoria comportamental e migration aditiva.
