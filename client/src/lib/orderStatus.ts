export type OrderStatus =
  | "AGUARDANDO_PAGAMENTO"
  | "RESERVADO"
  | "PAGO"
  | "CANCELADO"
  | "EXPIRADO";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  RESERVADO: "Reservado",
  PAGO: "Pagamento confirmado / liberado para retirada",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
};

export const STATUS_LABEL_SHORT: Record<OrderStatus, string> = {
  AGUARDANDO_PAGAMENTO: "Aguard. pagamento",
  RESERVADO: "Reservado",
  PAGO: "Liberado ✓",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  AGUARDANDO_PAGAMENTO: "bg-blue-100 text-blue-800 border-blue-200",
  RESERVADO: "bg-yellow-100 text-yellow-800 border-yellow-200",
  PAGO: "bg-green-100 text-green-800 border-green-200",
  CANCELADO: "bg-red-100 text-red-800 border-red-200",
  EXPIRADO: "bg-gray-100 text-gray-500 border-gray-200",
};

export const PAYMENT_LABEL: Record<string, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  BOLETO: "Boleto",
};
