# Área da Empresa — Cotações e Pedidos

## Objetivo

Esta fase transforma o portal B2B da Ideal Prime em uma área comercial completa para empresas: seleção de produtos, solicitação de cotação detalhada, resposta comercial com preços e condições negociadas, comparação item a item, aprovação e conversão em pedido sem perder os valores acordados.

## Fluxo do cliente

1. A empresa entra no Portal da Empresa e monta sua seleção de produtos.
2. A seleção funciona como uma planilha de compra: quantidade, referência de preço, subtotal estimado e alertas de itens sob consulta.
3. A empresa informa referência/OC, data desejada, local de entrega, contato e observações.
4. A cotação é enviada para a equipe comercial mesmo quando o estoque atual não cobre toda a necessidade ou algum item está sem preço — cotar não é o mesmo que reservar/comprar.
5. A empresa acompanha a proposta completa e compara preço de referência x preço cotado por item.
6. Quando aprovada, a cotação pode ser convertida em pedido. Nesse momento estoque, múltiplos e disponibilidade são revalidados.
7. O pedido grava os preços e condições da proposta aprovada, sem trocar silenciosamente os valores pela tabela comercial vigente no momento da conversão.

## Fluxo da equipe comercial

Na Gestão Comercial / B2B Admin, a equipe pode abrir cada cotação e preencher:

- preço final por item;
- desconto;
- frete;
- validade da proposta;
- condição de pagamento;
- condição/prazo de entrega;
- observações comerciais.

O sistema calcula subtotal e total final. A aprovação é restrita à administração, preservando o controle já existente.

## Documentos e exportações

O portal permite:

- baixar a cotação em XLSX;
- imprimir a cotação ou salvar como PDF pelo diálogo nativo do navegador;
- baixar o pedido em XLSX;
- imprimir o pedido ou salvar como PDF;
- baixar o modelo oficial `ideal-prime-cotacao-pedido.xlsx`.

A planilha exportada de cotação traz comparação de valores por item e resumo financeiro. O pedido exportado preserva os snapshots comerciais da cotação aprovada.

## Banco de dados

Migration aditiva: `0037_b2b_quote_workspace.sql`.

Ela adiciona dados de referência do cliente, entrega, contato, subtotal, desconto, frete, validade e condições comerciais à cotação, além dos campos de preço de referência e preço cotado nos itens.

Não há `DROP TABLE`, `TRUNCATE`, recriação de banco ou alteração destrutiva de histórico. Registros existentes são retrocompatibilizados com os valores já armazenados.

## Regras críticas preservadas

- cotação não movimenta nem reserva estoque;
- pedido continua validando estoque e reservas;
- FIFO e lotes não são alterados por esta fase;
- pedido oriundo de cotação usa exatamente o preço negociado;
- cotação vencida não é convertida em pedido;
- cotação aprovada exige preço final positivo em todos os itens;
- idempotência do pedido e controle transacional continuam ativos;
- comprador só visualiza documentos da própria empresa;
- equipe interna precisa das permissões B2B existentes.

## Validação antes do deploy

Executar no ambiente com dependências e PostgreSQL de teste:

```bash
pnpm release:verify
```

Executar também os testes de integração B2B com `DATABASE_URL` de uma base isolada, nunca contra dados reais de produção.

No deploy, a migration `0037_b2b_quote_workspace` deve ser aplicada automaticamente pelo mecanismo versionado já existente e o healthcheck deve permanecer saudável.
