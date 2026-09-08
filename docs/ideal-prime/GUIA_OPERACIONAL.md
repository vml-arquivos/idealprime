# Guia Operacional — Ideal Prime B2B

Este guia cobre a operação do módulo B2B no dia a dia: cadastro de empresa, importação, aprovação, tabela de preços, pedido, cancelamento e deploy. Para achados de auditoria e o que foi corrigido, ver `AUDITORIA_PERMUPAY_IDEAL_PRIME.md`.

## 1. Cadastro de empresa compradora

- Fluxo público: `/empresa/cadastro` → `trpc.b2b.signup` → cria a empresa com `status='PENDING'` e o primeiro usuário (role `MANAGER` da membership, `accountType='BUYER'`).
- CNPJ é normalizado (apenas dígitos) e validado (14 dígitos); duplicidade de CNPJ é rejeitada no banco (`UNIQUE` + `CHECK` de formato desde a migration `0031_b2b_hardening`).
- Enquanto `PENDING`, a empresa **não** acessa catálogo, cotação ou pedido — `resolveBusinessContext` bloqueia no servidor independentemente do que a interface mostrar.
- Para adicionar um **segundo usuário** a uma empresa já existente (financeiro, comprador adicional) sem passar pelo cadastro público de novo, use `trpc.b2b.admin.inviteMember` (permissão `b2b.operations`): recebe `businessAccountId`, `name`, `email`, `password`, `role` (`MANAGER`/`BUYER`).

## 2. Aprovação

- `trpc.b2b.admin.approve` (somente `role='admin'`) muda `status` para `APPROVED` e permite definir, no mesmo passo: tabela de preços (`priceListId`), responsável comercial (`accountManagerUserId`), condições de pagamento (`paymentTerms`, JSON livre) e pedido mínimo (`minOrderCents`).
- Sem `priceListId` explícito, o pedido/cotação cai na tabela marcada `is_default=true` e `active=true` (só pode haver uma no sistema — índice único parcial).
- `trpc.b2b.admin.suspend` marca `SUSPENDED`: bloqueia imediatamente novas cotações/pedidos (mesma checagem de `resolveBusinessContext`), sem apagar histórico.

## 3. Tabela de preços (versionada)

- Uma tabela (`permupay_price_lists`) tem N versões (`permupay_price_list_versions`), cada uma com seus itens/preços (`permupay_price_list_items`, preço em centavos inteiros).
- Pedidos/cotações sempre referenciam `price_list_version_id` — alterar preços cria uma **nova versão**; pedidos antigos mantêm o snapshot do preço no momento da compra (`unit_price_cents`/`sku_snapshot`/`name_snapshot` gravados no item). Alterar uma tabela nunca reescreve pedidos existentes.
- Só a versão mais recente com `effective_from <= now()` é considerada vigente.

## 4. Importação de produtos/preços (CSV/XLSX)

- Endpoint: `POST /api/b2b/import?mode=PRICES|INVENTORY&priceListId=<id>&filename=produtos.csv` (multipart bruto no corpo). Exige sessão de staff **e** permissão `b2b.operations` (corrigido nesta entrega — antes bastava ser staff).
- Formato aceito: CSV (`;` como separador, cabeçalho exato `sku;nome;categoria;unidade;multiplo_venda;preco_venda;estoque_fisico;ativo`) ou XLSX com aba `PRODUTOS`.
- Limite de 10MB e **5000 linhas** por arquivo (novo limite desta entrega, evita importações que prendem a transação por tempo excessivo).
- Fórmulas em células XLSX são rejeitadas. SKU mantém zeros à esquerda (tratado como texto). Preço aceita `1.234,56` e `1234,56`; rejeita formatos ambíguos (`1,234.56`).
- Idempotência: o hash SHA-256 do arquivo + `mode:priceListId:referenceAt` (a "profileKey") é gravado em `permupay_import_jobs`. Reenviar o **mesmo arquivo** com os mesmos parâmetros retorna `{repeated: true}` e não cria nova versão de tabela nem duplica produtos.
- Modo `PRICES`: cria/atualiza produto e preço; não mexe em estoque. Modo `INVENTORY`: também atualiza `stock_quantity`, mas rejeita se o novo estoque físico for menor que as reservas B2B ativas do produto.
- Produto novo criado por importação nasce com `published=false` — **não** aparece na vitrine pública automaticamente; alguém da equipe precisa publicá-lo manualmente pela tela de produtos.
- Resultado da importação (`{repeated, job}` ou erro) deve ser exibido no backoffice com contagem de criados/atualizados; o detalhe por linha fica em `permupay_import_rows` (consultável via `trpc.b2b.admin.imports` para o histórico de jobs).

## 5. Catálogo, cotação e pedido do comprador

- `trpc.b2b.catalog`: só retorna produtos com `active=true`, `b2b_enabled=true` e preço na versão vigente da tabela da empresa. Nunca inclui custo/margem/fornecedor.
- `trpc.b2b.createQuote`: cria uma cotação (`PENDING`) com total calculado no servidor. `trpc.b2b.admin.transitionQuote` (`APPROVE`/`REJECT`/`CANCEL`, `role='admin'`) move o status — transições fora da máquina de estados são rejeitadas (ex.: aprovar uma cotação já rejeitada).
- `trpc.b2b.createOrderFromQuote`: converte uma cotação **aprovada** em pedido de forma atômica (uma única transação `SERIALIZABLE` com `SELECT ... FOR UPDATE` na cotação) — duas conversões concorrentes da mesma cotação nunca geram dois pedidos (bug corrigido nesta entrega, com teste de regressão).
- `trpc.b2b.createOrder`: pedido direto (sem cotação), exige permissão `b2b.orders`. Preço e total são sempre recalculados no servidor a partir da tabela vigente — o cliente nunca envia preço. Multitem, transacional (tudo ou nada) e idempotente por `idempotencyKey` (a mesma chave repetida retorna o mesmo pedido; chaves diferentes nunca colidem).
- Reserva de estoque: cada item do pedido gera uma reserva `ACTIVE` com validade de 24h. Um job a cada 10 minutos (`expireStaleB2BReservations`, novo nesta entrega) expira reservas vencidas e libera a disponibilidade — antes desta correção, reservas nunca expiravam e travavam estoque indefinidamente.

## 6. Fluxo de pedido pela equipe (estados)

Estados separados — comercial (`commercial_status`), pagamento (`payment_status`) e expedição (`fulfillment_status`) — com transições validadas (`trpc.b2b.admin.transition`, `role='admin'`):

| Ação | Só permitida a partir de | Efeito |
|---|---|---|
| `ACCEPT` | `commercial_status='ENVIADO'` | `commercial_status='ACEITO'` |
| `PAY` | `commercial_status != 'CANCELADO'` e ainda não pago | `payment_status='PAGO'` |
| `SHIP` | `commercial_status='ACEITO'`, `fulfillment_status='AGUARDANDO_SEPARACAO'`, pago (ou `allowShippingBeforePayment` nas condições da empresa) | baixa definitiva do estoque, `fulfillment_status='ENVIADO'`, reservas viram `CONSUMED` |
| `CANCEL` | não cancelado e não expedido/entregue | `commercial_status='CANCELADO'`, reservas viram `RELEASED` (estoque volta a ficar disponível) |

Qualquer transição fora dessa tabela é rejeitada com mensagem específica (corrigido nesta entrega — antes não havia validação de estado atual).

## 7. Isolamento entre empresas

- Toda consulta de pedido/cotação passa por `JOIN` com `permupay_business_memberships` filtrando por `user_id` **e** `active=true` — nunca por um `businessId` vindo do cliente.
- Exceção controlada: staff com a permissão `b2b.operations` pode consultar qualquer pedido (`trpc.b2b.order` com `id`) — isso é intencional (suporte/operação), mas agora exige a permissão explicitamente (corrigido nesta entrega; antes qualquer conta interna, com ou sem permissão B2B, conseguia ler pedidos de qualquer empresa).

## 8. Deploy, backup e rollback

- **Migrations**: `docker-entrypoint.sh` roda `node scripts/migrate.mjs` antes de subir a aplicação. O script usa `pg_advisory_lock` (só uma instância migra por vez) e uma tabela de controle `drizzle_migrations` (hash por tag) — reinícios repetidos não reaplicam migrations já rodadas. Nunca use `drizzle-kit push` em produção (o script `db:push` já está desabilitado propositalmente no `package.json`).
- **Healthcheck**: `GET /healthz` retorna 200 só se o banco responder (`pingDatabase`); usado pelo `HEALTHCHECK` do `Dockerfile` e pelo `docker-compose.yml`.
- **Volume persistente**: `ideal_prime_data` (uploads/documentos, `DATA_DIR`/`UPLOAD_DIR`) e `ideal_prime_postgres` (dados do banco) — ambos declarados no `docker-compose.yml`, sobrevivem a `docker compose down`/redeploy (não usar `down -v`).
- **Backup**: `pg_dump` regular do banco `ideal_prime` (fora deste repositório — nenhuma automação de backup está incluída; documentar no runbook de infraestrutura do ambiente que hospeda o Postgres).
- **Restore**: restaurar o dump em um Postgres vazio e então rodar `node scripts/migrate.mjs` normalmente (idempotente — pula migrations já registradas no dump restaurado, aplica só as que faltarem).
- **Rollback de aplicação**: como as migrations são só aditivas (sem `DROP`), fazer rollback da imagem da aplicação para uma versão anterior é seguro mesmo com o schema já atualizado — código antigo simplesmente ignora colunas/tabelas novas que não usa. Rollback de uma migration específica não tem script automático; é uma operação manual e deliberada (escrever e revisar a `ALTER TABLE` inversa antes de aplicar).
- **Criação de administrador**: `node scripts/create-admin.mjs` (interativo, pede e-mail/nome/senha pelo terminal — senha nunca aparece em log ou histórico de shell). Requer `DATABASE_URL`. Senha mínima de 12 caracteres.
- **Variáveis de ambiente**: ver `.env.example` — nenhum segredo real está commitado; `JWT_SECRET`/`SESSION_SECRET`/`POSTGRES_PASSWORD` precisam ser gerados por ambiente.

## 9. Limitações intencionais (fora do escopo desta entrega)

Ver `RELATORIO_IMPLANTACAO_IDEAL_PRIME.md` para a lista completa. Resumo: emissão de NF-e, gateway de pagamento individual, notificações automáticas (e-mail/WhatsApp), integração com ERP, estorno bancário automático e múltiplos depósitos não existem nesta versão — pagamento é confirmação manual pela equipe. Além disso, sete migrations/módulos do PermuPay (promissórias, KYC/crédito de cliente, segurança de cliente, métodos de pagamento por produto, histórico/comunicação de cliente, produtos hero, CRM de clientes) não foram portados para o Ideal Prime nesta rodada — ver achado A1 da auditoria.
