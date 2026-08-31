/**
 * client/src/components/BuyModal.tsx
 *
 * ALTERAÇÕES:
 * 1. Segurança preservada: não envia unitPrice; backend calcula preço.
 * 2. Adiciona DINHEIRO como forma de pagamento manual.
 * 3. Mantém PIX, cartão e boleto funcionando.
 * 4. Mantém opção de adicionar produto extra ao pedido.
 * 5. Usa uma CTA principal: "Reservar produto".
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  X,
  CheckCircle,
  ShoppingBag,
  Zap,
  CreditCard,
  FileText,
  PlusCircle,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getStoredReferralCode } from "@/lib/referral";

type PaymentMethod = "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO";

interface ProductInfo {
  id: number;
  name: string;
  suggestedPricePix: number;
  suggestedPriceCard: number;
  suggestedPriceBoleto: number;
  suggestedPrice: number;
  cardInstallments?: number | null;
  boletoMonths?: number | null;
}

interface BuyModalProps {
  product: ProductInfo;
  /** Método vindo da página pública, quando o cliente já selecionou uma opção */
  initialPaymentMethod?: PaymentMethod;
  /** Nome e contato pré-preenchidos se o usuário estiver logado */
  prefillName?: string;
  prefillContact?: string;
  onClose: () => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function resolvePrice(
  specific: number | null | undefined,
  fallback: number | null | undefined
): number {
  return (specific ?? 0) > 0 ? (specific as number) : (fallback ?? 0);
}

function methodLabel(method: PaymentMethod) {
  switch (method) {
    case "PIX": return "Pix";
    case "DINHEIRO": return "Dinheiro";
    case "CARTAO": return "Cartão";
    case "BOLETO": return "Boleto";
  }
}

export function BuyModal({
  product: p,
  initialPaymentMethod = "PIX",
  prefillName = "",
  prefillContact = "",
  onClose,
}: BuyModalProps) {
  const [step, setStep] = useState<"method" | "form" | "success">("method");
  const [method, setMethod] = useState<PaymentMethod>(initialPaymentMethod);
  const [name, setName] = useState(prefillName);
  const [contact, setContact] = useState(prefillContact);
  const [contactType, setContactType] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const [quantity, setQuantity] = useState(1);
  const [orderId, setOrderId] = useState<number | null>(null);
  const referralCode = getStoredReferralCode();

  // Produto adicional
  const [extraProductId, setExtraProductId] = useState<number | "">("");
  const allProducts = trpc.marketplace.products.useQuery(undefined, {
    staleTime: 60_000,
  });

  const pixPrice = resolvePrice(p.suggestedPricePix, p.suggestedPrice);
  // Sem regra própria de taxa/desconto para dinheiro: usa preço à vista.
  // Preferência: mesmo preço do Pix, com fallback para suggestedPrice.
  const cashPrice = pixPrice > 0 ? pixPrice : resolvePrice(p.suggestedPrice, p.suggestedPricePix);
  const cardPrice = resolvePrice(p.suggestedPriceCard, p.suggestedPrice);
  const boletoPrice = resolvePrice(p.suggestedPriceBoleto, p.suggestedPrice);
  const inst = Math.max(1, Math.round(p.cardInstallments ?? 1));
  const boletoMonths = Math.max(1, Math.round(p.boletoMonths ?? 1));

  const priceByMethod: Record<PaymentMethod, number> = {
    PIX: pixPrice,
    DINHEIRO: cashPrice,
    CARTAO: cardPrice,
    BOLETO: boletoPrice,
  };

  const methodOptions = useMemo(() => ([
    {
      key: "PIX" as PaymentMethod,
      title: "Pix",
      subtitle: "Pagamento instantâneo",
      price: pixPrice,
      icon: <Zap className="w-5 h-5" />,
      activeClass: "border-emerald-500 bg-emerald-50 text-emerald-700",
    },
    {
      key: "DINHEIRO" as PaymentMethod,
      title: "Dinheiro",
      subtitle: "Pagamento manual na retirada/entrega",
      price: cashPrice,
      icon: <Banknote className="w-5 h-5" />,
      activeClass: "border-amber-500 bg-amber-50 text-amber-700",
    },
    {
      key: "CARTAO" as PaymentMethod,
      title: "Cartão",
      subtitle: inst > 1 ? `${inst}x de ${fmt(cardPrice / inst)}` : "Cartão de crédito",
      price: cardPrice,
      icon: <CreditCard className="w-5 h-5" />,
      activeClass: "border-blue-500 bg-blue-50 text-blue-700",
    },
    {
      key: "BOLETO" as PaymentMethod,
      title: "Boleto",
      subtitle: boletoMonths > 1 ? `${boletoMonths}x de ${fmt(boletoPrice / boletoMonths)}` : "Pagamento por boleto",
      price: boletoPrice,
      icon: <FileText className="w-5 h-5" />,
      activeClass: "border-neutral-700 bg-neutral-50 text-neutral-900",
    },
  ]), [pixPrice, cashPrice, cardPrice, boletoPrice, inst, boletoMonths]);

  const createOrder = trpc.orders.create.useMutation({
    onSuccess: (data) => {
      setOrderId(data.id);
      setStep("success");
    },
    onError: (e) => toast.error(e.message),
  });

  // Produto extra selecionado
  const extraProduct = allProducts.data?.find((pr) => pr.id === extraProductId);
  const createExtraOrder = trpc.orders.create.useMutation({
    onError: (e) => console.warn("Pedido extra falhou:", e.message),
  });

  const handleGoToPayment = () => {
    if (!name.trim()) return toast.error("Informe seu nome");
    if (!contact.trim()) return toast.error("Informe seu WhatsApp ou email");
    if ((priceByMethod[method] ?? 0) <= 0) {
      return toast.error("Produto sem preço válido para esta forma de pagamento");
    }

    // Segurança: o preço NÃO é enviado pelo navegador.
    // O backend calcula o valor correto pelo produto e forma de pagamento.
    createOrder.mutate(
      {
        productId: p.id,
        quantity,
        buyerName: name.trim(),
        buyerContact: contact.trim(),
        buyerContactType: contactType,
        paymentMethod: method,
        referralCode: referralCode ?? undefined,
      },
      {
        onSuccess: () => {
          if (extraProductId && extraProduct) {
            createExtraOrder.mutate({
              productId: extraProduct.id,
              quantity: 1,
              buyerName: name.trim(),
              buyerContact: contact.trim(),
              buyerContactType: contactType,
              paymentMethod: method,
              referralCode: referralCode ?? undefined,
            });
          }
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900 text-base">
            {step === "success" ? "Reserva registrada!" : `Reservar — ${p.name}`}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step: escolha do método */}
        {step === "method" && (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-neutral-500">
              Escolha a forma de pagamento preferida para a reserva:
            </p>

            {/* Seletor de quantidade */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 bg-neutral-50">
              <span className="text-sm font-medium text-neutral-700">Quantidade</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-neutral-400 hover:bg-white transition-all font-bold text-lg leading-none"
                >
                  −
                </button>
                <span className="text-base font-bold text-neutral-900 w-6 text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-neutral-400 hover:bg-white transition-all font-bold text-lg leading-none"
                >
                  +
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {methodOptions
                .filter((opt) => opt.price > 0)
                .map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setMethod(opt.key)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                      method === opt.key
                        ? opt.activeClass
                        : "border-neutral-200 hover:border-neutral-300 text-neutral-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={method === opt.key ? "" : "text-neutral-400"}>
                        {opt.icon}
                      </span>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-neutral-900">{opt.title}</p>
                        <p className="text-xs text-neutral-500">{opt.subtitle}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-neutral-900">
                        {fmt(opt.price * quantity)}
                      </p>
                      {quantity > 1 && (
                        <p className="text-[10px] text-neutral-400">
                          {quantity}× {fmt(opt.price)}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
            </div>

            <Button className="w-full mt-2" onClick={() => setStep("form")}>
              Continuar reserva
            </Button>
          </div>
        )}

        {/* Step: dados do comprador */}
        {step === "form" && (
          <div className="px-6 py-5 space-y-4">
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
              <div className="flex items-start gap-3">
                <ShoppingBag className="w-4 h-4 text-neutral-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 line-clamp-2">{p.name}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {methodLabel(method)} — {quantity > 1 ? `${quantity}× ${fmt(priceByMethod[method] ?? 0)} = ` : ""}<span className="font-semibold text-neutral-800">{fmt((priceByMethod[method] ?? 0) * quantity)}</span>
                  </p>
                </div>
                {/* Ajuste de quantidade inline no form */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-6 h-6 rounded border border-neutral-200 flex items-center justify-center text-neutral-500 hover:bg-neutral-100 text-sm font-bold leading-none"
                  >−</button>
                  <span className="text-sm font-bold w-5 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-6 h-6 rounded border border-neutral-200 flex items-center justify-center text-neutral-500 hover:bg-neutral-100 text-sm font-bold leading-none"
                  >+</button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600">Nome</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600">Contato</label>
              <Input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="WhatsApp ou email"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600">Tipo de contato</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => setContactType("WHATSAPP")}
                  className={`py-2 rounded-lg border text-sm ${
                    contactType === "WHATSAPP"
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 text-neutral-600"
                  }`}
                >
                  WhatsApp
                </button>
                <button
                  onClick={() => setContactType("EMAIL")}
                  className={`py-2 rounded-lg border text-sm ${
                    contactType === "EMAIL"
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 text-neutral-600"
                  }`}
                >
                  Email
                </button>
              </div>
            </div>

            {/* Produto adicional */}
            <div className="border-t border-neutral-100 pt-4">
              <label className="text-xs font-medium text-neutral-600 flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" />
                Adicionar outro produto ao pedido
              </label>
              <select
                value={extraProductId}
                onChange={(e) => setExtraProductId(e.target.value ? Number(e.target.value) : "")}
                className="mt-1 w-full h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none focus:border-neutral-400"
              >
                <option value="">Nenhum produto adicional</option>
                {allProducts.data
                  ?.filter((pr) => pr.id !== p.id)
                  .map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("method")}>
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={handleGoToPayment}
                disabled={createOrder.isPending}
              >
                {createOrder.isPending ? "Registrando..." : `Reservar produto`}
              </Button>
            </div>
          </div>
        )}

        {/* Step: sucesso */}
        {step === "success" && (
          <div className="px-6 py-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-900">Reserva registrada</h3>
              <p className="text-sm text-neutral-500 mt-1">
                Sua reserva #{orderId} foi registrada ({quantity} {quantity === 1 ? "unidade" : "unidades"}). Nossa equipe seguirá com a confirmação do pagamento.
              </p>
              {method === "DINHEIRO" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
                  Pagamento em dinheiro será combinado na retirada ou entrega.
                </p>
              )}
            </div>
            <p className="text-xs text-neutral-400">
              A reserva fica pendente até a confirmação manual do atendimento.
            </p>
            <Button className="w-full" onClick={onClose}>
              Fechar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
