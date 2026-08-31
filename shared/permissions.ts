export const PERMISSIONS = {
  DASHBOARD: "dashboard",
  PRODUCTS: "products",
  INVENTORY: "inventory",
  PRICING: "pricing",
  SALES: "sales",
  REPORTS: "reports",
  B2B_OPERATIONS: "b2b.operations",
  B2B_CATALOG: "b2b.catalog",
  B2B_QUOTES: "b2b.quotes",
  B2B_ORDERS: "b2b.orders",
  B2B_ORDER_HISTORY: "b2b.order_history",
  USERS: "users",
  SETTINGS: "settings",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  [PERMISSIONS.DASHBOARD]: "Dashboard",
  [PERMISSIONS.PRODUCTS]: "Produtos",
  [PERMISSIONS.INVENTORY]: "Estoque e entrada",
  [PERMISSIONS.PRICING]: "Simulações e preços",
  [PERMISSIONS.SALES]: "Pedidos e vendas",
  [PERMISSIONS.REPORTS]: "Relatórios",
  [PERMISSIONS.B2B_OPERATIONS]: "Operação B2B",
  [PERMISSIONS.B2B_CATALOG]: "Catálogo empresarial",
  [PERMISSIONS.B2B_QUOTES]: "Cotações empresariais",
  [PERMISSIONS.B2B_ORDERS]: "Pedidos empresariais",
  [PERMISSIONS.B2B_ORDER_HISTORY]: "Histórico empresarial",
  [PERMISSIONS.USERS]: "Usuários",
  [PERMISSIONS.SETTINGS]: "Configurações",
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as PermissionKey[];

export const STAFF_DEFAULT_PERMISSIONS: PermissionKey[] = [...ALL_PERMISSIONS];

export const BUYER_DEFAULT_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.B2B_CATALOG,
  PERMISSIONS.B2B_QUOTES,
  PERMISSIONS.B2B_ORDERS,
  PERMISSIONS.B2B_ORDER_HISTORY,
];

export function hasPermission(
  permissions: unknown,
  permission: PermissionKey,
  role?: string,
): boolean {
  if (role === "admin") return true;
  return Array.isArray(permissions) && permissions.includes(permission);
}
