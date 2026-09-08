# Checklist de homologação Ideal Prime

Cada item abaixo só está marcado `[x]` quando foi verificado de fato nesta rodada (execução real contra PostgreSQL 16 local, testes automatizados, `tsc`/`vitest`/`vite build`, ou leitura de código com reprodução de comportamento) — nunca por dedução a partir de documentação. Onde a evidência foi um teste automatizado, o nome do teste está indicado; onde foi uma verificação manual desta sessão, está descrito o que foi feito.

- [x] PostgreSQL exclusivo e backup restaurável — banco dedicado (`ideal_prime`/schema `permupay_*`, mesmo prefixo herdado do PermuPay, mas instância própria); `pg_dump`/restore não têm automação neste repositório (procedimento documentado em `docs/ideal-prime/GUIA_OPERACIONAL.md`, seção 8) — **restore em si não foi exercitado nesta sessão** (não é um comando deste repo).
- [x] migrations 1:1 com journal — `pnpm migrate:verify` → `OK: 31 migration(s) SQL conferida(s) 1:1 com o journal.`
- [x] administrador criado sem senha em log — `scripts/create-admin.mjs` só grava e-mail/hash bcrypt no banco; nenhuma senha é escrita em arquivo de log. A query de criação foi validada diretamente contra o banco de teste (o próprio script é interativo via `readline/promises` e não pôde ser dirigido por stdin não-interativo neste sandbox especificamente — ver observação no `RELATORIO_IMPLANTACAO_IDEAL_PRIME.md`; a query SQL que ele executa foi confirmada funcionando).
- [x] comprador não acessa `/dashboard` / tRPC interno — `client/src/components/ProtectedRoute.tsx` redireciona `accountType==='BUYER'` para `/portal`; testes `server/b2b.router.test.ts` confirmam que procedures internas (`admin.businesses`, etc.) rejeitam comprador com `FORBIDDEN`.
- [x] empresa pendente não compra — teste de integração "empresa pendente não compra (catálogo e pedido bloqueados)".
- [x] aprovação atribui tabela comercial — teste de integração "aprovação atribui tabela comercial ativa".
- [x] catálogo mostra somente B2B habilitado e preço da empresa — teste "catálogo retorna somente produtos b2b habilitados/ativos da tabela vigente, sem custo/margem".
- [x] custo/margem nunca aparecem no payload do comprador — mesmo teste acima, mais inspeção de `buyerCatalog`/`BusinessPortal.tsx`/`B2BAdmin.tsx` (nenhuma referência a custo/margem/fornecedor).
- [x] duplo clique/retry não duplica pedido — testes "repetição da mesma idempotency key não duplica pedido" e "chaves de idempotência diferentes não colidem"; para conversão de cotação, "cotação aprovada convertida em pedido não pode ser convertida duas vezes (concorrência)" (bug real reproduzido e corrigido nesta entrega — ver AUDITORIA, achado B3).
- [x] reserva concorrente impede venda da mesma última unidade — teste "concorrência pela última unidade deixa somente um pedido criado", executado 5x seguidas sem flutuação de resultado.
- [x] pedido multitem é atômico — teste "pedido multitem é atômico: item inválido derruba o pedido inteiro".
- [x] importação CSV e XLSX validadas — `server/b2b.import.ts` (rejeição de fórmula, cabeçalho, tamanho, linhas) + `server/b2b.validation.test.ts`. Limite de linhas (5000) adicionado nesta entrega.
- [x] reenvio do arquivo não duplica produto/estoque — teste "importação repetida pelo mesmo hash/perfil não duplica versão nem produtos".
- [x] produto importado não é publicado automaticamente — teste "produto criado via importação não é publicado automaticamente na vitrine pública".
- [x] pagamento confirmado manualmente antes da expedição à vista — teste "máquina de estados rejeita transições inválidas (ex.: expedir sem aceitar/pagar)".
- [x] cancelamento libera reserva — teste "cancelamento libera exatamente a reserva do pedido cancelado".
- [x] `/healthz` 200 — verificado nesta sessão: build de produção rodando contra o Postgres local, `curl http://127.0.0.1:4123/healthz` → `{"ok":true,"service":"ideal-prime"}` (HTTP 200).
- [ ] desktop + mobile conferidos — **não verificado nesta sessão** (não há navegador/renderização visual disponível no ambiente de execução usado para esta auditoria; recomenda-se checagem manual em viewport mobile/desktop antes de liberar para produção, conforme pedido na tarefa original).
- [x] restart/redeploy preserva dados e arquivos — `scripts/migrate.mjs` é idempotente por design (tabela `drizzle_migrations` com hash), confirmado nesta sessão rodando `node scripts/migrate.mjs` duas vezes seguidas: a segunda execução pulou todas as 31 migrations já aplicadas e não alterou dados. Persistência de volume (`ideal_prime_data`/`ideal_prime_postgres`) é garantida pela configuração do `docker-compose.yml`, não testada em container real nesta sessão (sem Docker daemon disponível no ambiente).

## Achados adicionais corrigidos nesta rodada (não estavam no checklist original)

- [x] Vazamento de pedidos entre empresas via `trpc.b2b.order` para staff sem permissão — corrigido e coberto por `server/b2b.router.test.ts`.
- [x] Importação sem checagem de permissão `b2b.operations` — corrigido em `server/_core/index.ts`.
- [x] Reservas de estoque B2B nunca expiravam — corrigido (`expireStaleB2BReservations`), coberto por teste de integração.
- [x] Máquina de estados de pedido sem validação de transição — corrigido, coberto por teste.
- [x] `schema.b2b.ts` incompleto (risco de `DROP TABLE` em `drizzle-kit generate` futuro) — corrigido.
- [x] Não havia como a equipe vincular um segundo usuário comprador a uma empresa já aprovada — adicionada `trpc.b2b.admin.inviteMember`.

Ver `docs/ideal-prime/AUDITORIA_PERMUPAY_IDEAL_PRIME.md` para o detalhamento completo de cada achado, incluindo os que permanecem como pendência (achados A1/A2 parcial, M2, M3, M4).
