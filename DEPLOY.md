# Deploy Ideal Prime

## Topologia recomendada

Aplicação Dockerfile + PostgreSQL 16 dedicado + volume persistente `/var/data/ideal-prime`. Não reutilize banco, JWT, sessão, volumes ou domínio da PermuPay.

## Variáveis obrigatórias

Use `.env.example` como contrato. Em produção: `NODE_ENV=production`, `PORT=4000`, `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `APP_URL`, `DATA_DIR=/var/data/ideal-prime`, `UPLOAD_DIR=/var/data/ideal-prime/uploads`. `DB_SSL=true` exige validação normal do certificado; não há fallback para `rejectUnauthorized:false`.

Variáveis `VITE_*` são públicas e não podem conter segredos.

## Coolify

1. Aponte o recurso ao repositório `vml-arquivos/idealprime`, branch `main`, Dockerfile na raiz.
2. Crie PostgreSQL exclusivo e privado; não exponha 5432 à Internet.
3. Anexe volume persistente em `/var/data/ideal-prime`.
4. Configure as variáveis no recurso e execute o deploy.
5. A entrada do container executa `scripts/migrate.mjs` antes do servidor.
6. Confirme `GET /healthz` = HTTP 200 e a revisão/commit em execução.
7. Crie o administrador via shell seguro do recurso: `node scripts/create-admin.mjs`.

## Rollback

Não faça `DROP`, `TRUNCATE`, force-push nem limpeza global de volumes. Antes de novas migrations, faça backup do PostgreSQL e do volume. O rollback de aplicação deve usar um commit anterior compatível com o schema; migrations aditivas permanecem no banco.
