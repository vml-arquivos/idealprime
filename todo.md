# PermuPay Vendas — TODO

## Motor de Cálculo
- [x] Criar shared/pricingCalculator.ts com tipos, interfaces e motor de cálculo isolado
- [x] Implementar cálculo reverso de margem (preco_base = custo_total / (1 - soma_percentuais))
- [x] Implementar juros compostos para boleto e parcelamento
- [x] Implementar diagnóstico automático (APROVADO, ATENÇÃO, RISCO, PREJUÍZO)
- [x] Implementar sugestão de preço psicológico (terminando em ,90)
- [x] Implementar cálculo de markup
- [x] Implementar cálculo de melhor/pior forma de pagamento

## Testes Unitários
- [x] Criar shared/pricingCalculator.test.ts com Vitest
- [x] Teste: Pix com imposto e margem
- [x] Teste: Boleto parcelado com juros mensal
- [x] Teste: Débito com taxa financeira
- [x] Teste: Crédito parcelado com juros e antecipação
- [x] Teste: Erro quando soma de percentuais >= 100%
- [x] Teste: Diagnóstico de prejuízo
- [x] Teste: Margem real e markup

## Frontend — Página do Simulador
- [x] Criar client/src/pages/PricingSimulator.tsx
- [x] Formulário de entrada do produto (nome, categoria, NCM, custos, margem)
- [x] Campos fiscais editáveis por forma de pagamento com alíquotas sugeridas
- [x] Aviso fiscal obrigatório visível
- [x] Campos específicos para boleto (meses, juros, taxa fixa, inadimplência, opção juros)
- [x] Campos específicos para cartão (taxas, parcelas, antecipação, juros, opção absorção)
- [x] Cards de resultado por forma de pagamento
- [x] Tabela comparativa completa (8 colunas + diagnóstico)
- [x] Destaque visual para melhor forma de pagamento
- [x] Sugestão de preço psicológico
- [x] Alerta de produto não saudável
- [x] Validações de formulário com mensagens amigáveis
- [x] Registrar rota /simulador em App.tsx

## Estilo Visual
- [x] Tema elegante e sofisticado (dark/light refinado)
- [x] Tipografia profissional via Google Fonts (Inter + JetBrains Mono)
- [x] Componentes shadcn/ui com customização visual
- [x] Layout responsivo (mobile-first)
- [x] Hierarquia visual clara: formulário → cards → tabela

## Build e Qualidade
- [x] Rodar pnpm check (TypeScript sem erros)
- [x] Rodar pnpm test (32/32 testes passando)
- [x] Rodar pnpm build (build limpo, sem erros)
- [x] Corrigir todos os erros gerados

## Deploy e Commit
- [x] Configurar variáveis de ambiente (.env.example)
- [x] Criar Dockerfile para Coolify com PostgreSQL 14
- [x] Criar docker-compose.yml para desenvolvimento local
- [x] Commitar com mensagem: feat: add automatic pricing simulator
