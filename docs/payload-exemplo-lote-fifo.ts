/**
 * payload-exemplo-lote-fifo.json
 *
 * Exemplo de payload para enviar um lote de 100 peças à API FIFO.
 * Endpoint: POST /trpc/batches.processFIFO
 *
 * REGRAS DO PAYLOAD:
 *  - unitCostBrl: custo unitário JÁ em BRL (converta antes se comprou em USD)
 *  - quantity: número inteiro de unidades
 *  - desiredMarginRate: margem em % sobre o custo (ex: 50 = 50%)
 *  - estimatedTaxRate: alíquota de imposto para o preço sugerido (ex: 6 = 6%)
 *  - productId: ID do produto cadastrado — OBRIGATÓRIO para FIFO funcionar
 *
 * O backend calcula automaticamente:
 *  costProportion = (unitCost * qty) / totalCostOfGoods
 *  allocatedOpCost = costProportion * totalOperationalCost
 *  finalUnitCost = unitCostBrl + (allocatedOpCost / qty)
 *  suggestedPrice = finalUnitCost / (1 - margin% - tax%)
 */

// ─── Criar lote primeiro ───────────────────────────────────────────────────────

// POST /trpc/batches.create
const createBatchPayload = {
  name: "Importação Shenzhen — Maio/2026",
  description: "100 peças variadas, frete aéreo DHL, desembaraço incluso",
  totalOperationalCost: 1500.00,  // R$ 1.500 de custo operacional total do lote
};

// Response: { id: 42, name: "...", status: "OPEN", ... }

// ─── Processar com FIFO ────────────────────────────────────────────────────────

// POST /trpc/batches.processFIFO
const processFIFOPayload = {
  batchId: 42,                    // ID retornado pelo create
  totalOperationalCost: 1500.00,  // deve ser idêntico ao do lote
  items: [
    // Produto 1 — perfume de alto valor (pesa mais no rateio)
    {
      productId: 101,
      productName: "One Million Elixir 200ml",
      unitCostBrl: 320.00,        // R$ 320 × 24 = R$ 7.680 em mercadorias
      quantity: 24,
      desiredMarginRate: 50,      // 50% de margem sobre o custo
      estimatedTaxRate: 6,        // 6% de alíquota
    },
    // Produto 2 — eletrônico de custo médio
    {
      productId: 205,
      productName: "TAG XIAOMI Rastreador",
      unitCostBrl: 45.00,         // R$ 45 × 30 = R$ 1.350
      quantity: 30,
      desiredMarginRate: 40,
      estimatedTaxRate: 6,
    },
    // Produto 3 — acessório de baixo custo
    {
      productId: 310,
      productName: "Cabo USB-C 1m Samsung",
      unitCostBrl: 12.00,         // R$ 12 × 46 = R$ 552
      quantity: 46,
      desiredMarginRate: 70,      // margem alta em itens baratos
      estimatedTaxRate: 12,
    },
    // Total: 100 peças, R$ 9.582 em mercadorias
    // Custo operacional R$ 1.500 rateado proporcionalmente:
    //   - Perfume absorve ≈ 80.2% do custo op (R$ 1.203)
    //   - TAG absorve    ≈ 14.1% (R$ 211)
    //   - Cabo absorve   ≈  5.8% (R$ 86)
  ],
};

/**
 * RESPONSE esperada do processFIFO:
 * {
 *   items: [
 *     {
 *       productName: "One Million Elixir 200ml",
 *       quantity: 24,
 *       unitCostBrl: 320.00,
 *       totalItemCost: 7680.00,
 *       costProportion: 0.8015,          // 80.15% do lote
 *       allocatedOperationalCost: 1202.21,
 *       finalUnitCost: 370.09,            // 320 + (1202.21/24)
 *       suggestedPrice: 823.53,           // 370.09 / (1 - 0.50 - 0.06)
 *       contributionMargin: 453.44
 *     },
 *     {
 *       productName: "TAG XIAOMI Rastreador",
 *       ...
 *       allocatedOperationalCost: 211.33,
 *       finalUnitCost: 52.04,             // 45 + (211.33/30)
 *       suggestedPrice: 96.37,
 *     },
 *     {
 *       productName: "Cabo USB-C 1m Samsung",
 *       ...
 *       allocatedOperationalCost: 86.46,
 *       finalUnitCost: 13.88,             // 12 + (86.46/46)
 *       suggestedPrice: 42.06,
 *     }
 *   ],
 *   totalCostOfGoods: 9582.00,
 *   totalOperationalCost: 1500.00,
 *   grandTotal: 11082.00,
 *   allocationCheck: 1500.00,    // verificação: soma dos rateios = op total ✓
 *   queuedCount: 2,              // produtos 101 e 205 já tinham estoque → fila
 *   activatedCount: 1,           // produto 310 sem estoque → ativado direto
 * }
 */

// ─── Registrar Venda (gatilho de virada) ──────────────────────────────────────

// POST /trpc/batches.registerSale
// Chamado pelo sistema de pedidos ou manualmente
const registerSalePayload = {
  productId: 101,   // produto que foi vendido
  qtySold: 1,       // quantas unidades
};

/**
 * RESPONSE se stock chegou a 0 e havia lote em espera:
 * {
 *   newStock: 24,              // quantidade do novo lote promovido
 *   transitioned: true,        // houve virada de lote
 *   promotedQueueId: 15,       // ID da entrada na fila que foi promovida
 *   newLotName: "Importação Shenzhen — Maio/2026"
 * }
 *
 * RESPONSE se stock ainda > 0:
 * {
 *   newStock: 23,
 *   transitioned: false
 * }
 */

// ─── Consultar fila de um produto ─────────────────────────────────────────────

// GET /trpc/batches.getQueue?input={"productId":101}
// Retorna array de StockQueue ordenado por position ASC

// ─── Listar toda a fila (admin) ───────────────────────────────────────────────

// GET /trpc/batches.allQueues?input={"status":"EM_ESPERA"}
// status pode ser: "EM_ESPERA" | "ATIVO" | "ESGOTADO" | "CANCELADO" | undefined (todos)

export {};
