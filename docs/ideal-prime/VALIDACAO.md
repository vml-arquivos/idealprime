# Validação e não regressão

Gate mínimo antes de liberação comercial:

1. `pnpm install --frozen-lockfile`;
2. `pnpm migrate:verify`;
3. `pnpm check`;
4. `pnpm test`;
5. `pnpm build`;
6. build da imagem Docker;
7. migrations em PostgreSQL real vazio e reexecução idempotente;
8. concorrência de duas compras sobre a última unidade;
9. comprador A tentando ler pedido/empresa B deve receber acesso negado;
10. comprador tentando rota administrativa deve receber `FORBIDDEN`;
11. importação válida, inválida, repetida e inventário abaixo de reserva;
12. pedido multitem com falha deve deixar zero pedido/reserva parcial;
13. pagamento manual e expedição devem permanecer estados distintos;
14. reinício/redeploy preserva banco e uploads;
15. `/healthz` responde 200 apenas com banco acessível.

Uma home carregando não comprova checkout saudável.
