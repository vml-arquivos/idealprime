import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  productId: number;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clear: () => void;
  total: number;
  itemCount: number;
};

const STORAGE_KEY = "ideal_prime_cart";
const LEGACY_STORAGE_KEY = "permupay_cart";
const CartContext = createContext<CartContextValue | null>(null);

function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const parsed = JSON.parse(current || legacy || "[]");
    const items = Array.isArray(parsed)
      ? parsed.filter(item => item && Number(item.productId) > 0)
      : [];
    if (!current && legacy) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return items;
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readStoredCart);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      addItem: (item, quantity = 1) =>
        setItems(current => {
          const existing = current.find(
            entry => entry.productId === item.productId
          );
          if (existing) {
            return current.map(entry =>
              entry.productId === item.productId
                ? {
                    ...entry,
                    quantity:
                      entry.quantity + Math.max(1, Math.floor(quantity)),
                  }
                : entry
            );
          }
          return [
            ...current,
            { ...item, quantity: Math.max(1, Math.floor(quantity)) },
          ];
        }),
      removeItem: productId =>
        setItems(current =>
          current.filter(item => item.productId !== productId)
        ),
      updateQuantity: (productId, quantity) =>
        setItems(current => {
          const next = Math.floor(Number(quantity));
          return next <= 0
            ? current.filter(item => item.productId !== productId)
            : current.map(item =>
                item.productId === productId
                  ? { ...item, quantity: next }
                  : item
              );
        }),
      clear: () => setItems([]),
      total: items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      ),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    [items]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart deve ser usado dentro de CartProvider");
  return value;
}
