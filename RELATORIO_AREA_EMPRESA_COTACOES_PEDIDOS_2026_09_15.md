# Relatório — Área Empresarial de Cotações e Pedidos

## Implementado

- portal empresarial reorganizado em Produtos e seleção, Cotações e Pedidos;
- seleção de compra com subtotal de referência;
- solicitação de cotação com referência/OC, entrega, contato e observações;
- cotação permitida para necessidade superior ao estoque atual, sem gerar reserva prematura;
- mesa comercial para precificação item a item;
- comparação preço de referência x preço cotado;
- desconto, frete, validade e condições comerciais;
- aprovação/rejeição/cancelamento dentro da máquina de estados existente;
- conversão da cotação aprovada em pedido preservando preço e condições negociados;
- revalidação de estoque/reservas somente na criação do pedido;
- planilha XLSX de cotação;
- planilha XLSX de pedido;
- impressão / salvar como PDF de cotação e pedido;
- modelo oficial de planilha disponibilizado no portal;
- migration aditiva `0037_b2b_quote_workspace`;
- testes de autorização e integração ampliados.

## Verificações realizadas neste pacote

- migration journal: 37 migrations conferidas 1:1;
- parsing/transpilação sintática dos arquivos TypeScript/TSX modificados: aprovado;
- planilha modelo criada e verificada estruturalmente;
- escopo de alteração restrito ao módulo B2B, migration, testes e template de documento.

## Validação que deve ocorrer no CI/homologação

O ambiente de empacotamento não possui as dependências do projeto instaladas e não deve substituir o CI. Antes da publicação, executar `pnpm release:verify` e a suíte B2B com PostgreSQL isolado. Não marcar produção como concluída sem healthcheck e smoke test do portal empresarial.
