# Importação de produtos — contrato v1

Cabeçalho único:

```text
sku;nome;categoria;unidade;multiplo_venda;preco_venda;estoque_fisico;ativo
```

CSV deve ser UTF-8 e separado por `;`. XLSX deve conter a aba `PRODUTOS`. Fórmulas são rejeitadas. Limite HTTP: 10 MB.

- SKU é texto obrigatório, normalizado em caixa alta; duplicidade bloqueia todo o lote.
- Para produto novo, nome/categoria/unidade são obrigatórios.
- `preco_venda` vira centavos e rejeita notação monetária ambígua.
- `PRICES` atualiza produto/tabela sem mexer no saldo.
- `INVENTORY` trata `estoque_fisico` como saldo absoluto e bloqueia saldo menor que reservas ativas.
- Célula vazia em atualização preserva dados existentes.
- Ausência de SKU no arquivo não exclui produto.
- Importar nunca define `published=true`.
- Hash + perfil impedem repetição do mesmo lote.

Endpoint autenticado para equipe: `POST /api/b2b/import?filename=...&mode=PRICES|INVENTORY&priceListId=...&referenceAt=...` com o arquivo no corpo bruto.
