-- Migration: 0012_app_settings
-- Criação idempotente da tabela de configurações globais da aplicação

CREATE TABLE IF NOT EXISTS permupay_app_settings (
  key     text        PRIMARY KEY,
  value   jsonb       NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Configuração padrão de precificação (idempotente)
INSERT INTO permupay_app_settings (key, value, updated_at)
VALUES (
  'pricing_defaults',
  '{
    "taxRegime": "SIMPLES_NACIONAL",
    "taxCash": "6",
    "taxBoleto": "6",
    "taxDebit": "6",
    "taxCreditCash": "6",
    "taxCreditInstallment": "6",
    "boletoMonths": "3",
    "boletoMonthlyRate": "1.99",
    "boletoFixedFee": "3.50",
    "boletoDefaultRisk": "2",
    "boletoCustomerPaysInterest": false,
    "cardDebitFee": "1.5",
    "cardCreditCashFee": "2.5",
    "cardCreditInstallmentFee": "3.5",
    "cardInstallments": "6",
    "cardAnticipationRate": "1.5",
    "cardMonthlyRate": "1.99",
    "cardCustomerPaysInterest": false
  }'::jsonb,
  now()
)
ON CONFLICT (key) DO NOTHING;
