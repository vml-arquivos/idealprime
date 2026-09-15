# Ideal Prime — correção do fluxo Cotação → Pedido

Data: 15/09/2026

## Objetivo

Corrigir o fluxo empresarial para que uma cotação respondida e liberada pela Ideal Prime possa ser aceita pela empresa e convertida em pedido, com visualização completa nos dois painéis e sem a necessidade de rolagem horizontal em modais/tabelas principais.

## Alterações implementadas

- Modal de cotação do painel interno ampliado para até 96% da viewport / 1400 px, com corpo rolável vertical e rodapé fixo.
- Botão principal do admin renomeado para **Salvar e liberar para pedido** e mantido sempre visível.
- Tabelas de cotação e pedido ganharam layout desktop sem largura mínima que force rolagem lateral e cartões responsivos no mobile.
- Portal da empresa mostra claramente o estado **Pronta para pedido** após a aprovação comercial.
- A empresa pode desmarcar itens da cotação aprovada antes de gerar o pedido.
- Conversão de cotação aceita `selectedQuoteItemIds` e cria o pedido somente com os itens confirmados.
- Em pedido parcial, desconto global é rateado proporcionalmente ao subtotal selecionado; frete é preservado conforme a proposta.
- Após conversão, a cotação muda para `CONVERTED`, o pedido é criado, aparece imediatamente na aba Pedidos e pode ser aberto pelo vínculo da cotação.
- Painel admin agora possui **Abrir pedido** com modal detalhado, itens, origem, condições, subtotal, desconto, frete e total.
- Portal da empresa passou a exibir detalhamento equivalente do pedido.
- Cotações e pedidos são atualizados automaticamente a cada 15 s e ao retornar o foco da janela.
- XLSX de cotação e pedido foi reorganizado em uma única planilha profissional por documento, com seções de identificação, empresa, itens, totais e condições comerciais.
- PDF/impressão do pedido informa quando o pedido foi gerado parcialmente a partir da cotação.
- Teste de integração adicionado para pedido parcial a partir de cotação aprovada.

## Compatibilidade

- Nenhuma migration nova foi necessária.
- As 37 migrations existentes continuam 1:1 com o journal.
- Não houve alteração destrutiva em estoque, FIFO, reservas, usuários, clientes ou catálogo.
- Estoque continua sendo revalidado somente no momento da conversão em pedido.

## Verificações executadas neste ambiente

- `node scripts/verify-migrations.mjs`: OK — 37 migrations.
- `git diff --check`: OK.
- Parsing/transpilação sintática TypeScript/TSX dos 6 arquivos alterados: OK.
- A suíte completa (`pnpm check`, `pnpm test`, `pnpm build`) não foi executada aqui porque o ambiente não possui `node_modules` e a instalação externa de dependências expirou por timeout. O CI deve executar a validação completa antes do redeploy.
