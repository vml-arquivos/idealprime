# Relatório de implantação — Ideal Prime

## Estado do código

Refatoração B2B implementada sobre a base PermuPay Vendas de forma aditiva. A publicação remota e os gates efetivamente executados devem ser registrados neste arquivo pelo CI/deploy.

## Controles implementados

RBAC equipe/comprador no servidor, conta empresarial e membership, tabela versionada em centavos, catálogo empresarial isolado, pedido multitem idempotente, reservas de estoque, estados comercial/financeiro/atendimento separados, importação auditável, upload administrativo autenticado, documentos privados, porta fixa, healthcheck com banco e volume Ideal Prime.

## Limites intencionais

Não há NF-e, gateway de cobrança individual, e-mail/WhatsApp automático, ERP, estorno bancário automático ou múltiplos depósitos. Pagamento nesta versão é confirmação manual. Esses itens não devem ser apresentados como concluídos.
