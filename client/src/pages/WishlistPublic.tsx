/**
 * WishlistPublic.tsx — Lista de Desejos Pública /desejos
 *
 * v2 — Refatoração completa conforme regras de negócio:
 * ─ Formulário: Nome + Telefone + Seleção múltipla de produtos do catálogo
 * ─ Sem campos de orçamento (removidos)
 * ─ Telefone = chave de identificação: ao digitar, recupera pedidos anteriores
 * ─ Produtos carregados dinamicamente da vitrine (trpc.marketplace.products)
 * ─ Multi-select: usuário adiciona/remove produtos com botões + / ×
 */

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Heart,
  Send,
  CheckCircle2,
  ArrowLeft,
  Plus,
  X,
  Search,
  Clock,
  PhoneCall,
  Package,
  Loader2,
  Phone,
  User,
  ShoppingBag,
} from "lucide-react";
import { useLocation } from "wouter";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CatalogProduct {
  id: number;
  name: string;
  category: string;
  categoryLabel: string | null;
  imageUrl: string | null;
  suggestedPricePix: number;
  suggestedPrice: number;
  stockQuantity: number;
}

interface WishlistEntry {
  id: string;       // ID interno do campo (não é o productId)
  productId: number | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  NOVO:        { label: "Recebido",     color: "bg-yellow-100 text-yellow-800", icon: Clock },
  VISUALIZADO: { label: "Em análise",   color: "bg-blue-100 text-blue-800",    icon: Clock },
  CONTATADO:   { label: "Em contato",   color: "bg-orange-100 text-orange-800", icon: PhoneCall },
  ATENDIDO:    { label: "Atendido ✓",   color: "bg-green-100 text-green-800",  icon: CheckCircle2 },
  FECHADO:     { label: "Encerrado",    color: "bg-gray-100 text-gray-600",    icon: Package },
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// Gera ID único para linhas do multi-select
let _uid = 0;
const uid = () => `wl-${++_uid}`;

// ─── Componente de linha de produto ──────────────────────────────────────────
// [INJETADO] Cada linha tem um Select de produto + botão para remover

function ProductLine({
  entry,
  products,
  usedIds,
  onSelect,
  onRemove,
  canRemove,
}: {
  entry: WishlistEntry;
  products: CatalogProduct[];
  usedIds: Set<number>;
  onSelect: (entryId: string, productId: number) => void;
  onRemove: (entryId: string) => void;
  canRemove: boolean;
}) {
  // Filtra produtos disponíveis: mostra todos, marca os já selecionados em outras linhas
  const available = products.filter(
    (p) => !usedIds.has(p.id) || p.id === entry.productId
  );

  const selected = products.find((p) => p.id === entry.productId);

  return (
    <div className="flex items-center gap-2">
      {/* Thumbnail se tiver imagem */}
      {selected?.imageUrl ? (
        <img src={selected.imageUrl} alt={selected.name}
          className="w-10 h-10 rounded-lg object-contain bg-muted shrink-0 border" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 border">
          <ShoppingBag className="w-4 h-4 text-muted-foreground" />
        </div>
      )}

      <Select
        value={entry.productId ? String(entry.productId) : ""}
        onValueChange={(v) => onSelect(entry.id, Number(v))}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Selecionar produto..." />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {products.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhum produto disponível
            </div>
          )}
          {products.map((p) => {
            const alreadyUsed = usedIds.has(p.id) && p.id !== entry.productId;
            const price = (p.suggestedPricePix ?? 0) > 0 ? p.suggestedPricePix : p.suggestedPrice;
            return (
              <SelectItem
                key={p.id}
                value={String(p.id)}
                disabled={alreadyUsed}
                className={alreadyUsed ? "opacity-40" : ""}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate max-w-[180px]">{p.name}</span>
                  {price > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {fmt(price)}
                    </span>
                  )}
                  {alreadyUsed && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      (já adicionado)
                    </span>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(entry.id)}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Remover"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function WishlistPublic() {
  const [, nav] = useLocation();

  // Formulário simplificado — sem budget
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [entries, setEntries] = useState<WishlistEntry[]>([{ id: uid(), productId: null }]);
  const [notesPublic, setNotesPublic] = useState("");
  const [customWish, setCustomWish] = useState(false);
  const [customWishText, setCustomWishText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Estados de UI
  const [submitted, setSubmitted] = useState(false);
  const [submittedPhone, setSubmittedPhone] = useState("");

  // [INJETADO] View de "meus pedidos" — ativado ao digitar telefone
  const [showMyRequests, setShowMyRequests] = useState(false);
  const [lookupPhone, setLookupPhone] = useState("");
  const [phoneDebounced, setPhoneDebounced] = useState("");

  // Debounce do lookup por telefone
  useEffect(() => {
    const t = setTimeout(() => setPhoneDebounced(lookupPhone.replace(/\D/g, "")), 600);
    return () => clearTimeout(t);
  }, [lookupPhone]);

  // ── Queries ──────────────────────────────────────────────────────────────

  // Carrega produtos do catálogo para o select
  const productsQuery = trpc.marketplace.products.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const products = (productsQuery.data ?? []) as CatalogProduct[];

  // [INJETADO] Busca pedidos existentes pelo telefone digitado no lookup
  const myRequestsQuery = trpc.wishlist.myRequests.useQuery(
    { phone: phoneDebounced },
    { enabled: showMyRequests && phoneDebounced.length >= 8 }
  );

  // [INJETADO] Auto-lookup: ao preencher o telefone no form e sair do campo,
  // verifica silenciosamente se há pedidos existentes para mostrar aviso
  const [phoneForAutoCheck, setPhoneForAutoCheck] = useState("");
  const autoCheckQuery = trpc.wishlist.myRequests.useQuery(
    { phone: phoneForAutoCheck.replace(/\D/g, "") },
    { enabled: phoneForAutoCheck.replace(/\D/g, "").length >= 10 }
  );
  const hasExistingRequests = (autoCheckQuery.data?.length ?? 0) > 0;

  // ── Multi-select helpers ──────────────────────────────────────────────────

  // IDs já selecionados (para desabilitar nos outros dropdowns)
  const usedIds = useMemo(
    () => new Set(entries.map((e) => e.productId).filter(Boolean) as number[]),
    [entries]
  );

  const handleSelectProduct = (entryId: string, productId: number) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, productId } : e))
    );
    setErrors((e) => ({ ...e, products: "" }));
  };

  const handleRemoveEntry = (entryId: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  };

  const handleAddEntry = () => {
    setEntries((prev) => [...prev, { id: uid(), productId: null }]);
  };

  // ── Mutation ──────────────────────────────────────────────────────────────

  const createMutation = trpc.wishlist.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setSubmittedPhone(phone);
    },
    onError: (err) => setErrors({ global: err.message }),
  });

  // ── Validação ─────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2)
      errs.name = "Informe seu nome (mín. 2 caracteres)";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10)
      errs.phone = "Informe um telefone válido com DDD (mín. 10 dígitos)";
    const validEntries = entries.filter((e) => e.productId !== null);
    if (validEntries.length === 0 && (!customWish || !customWishText.trim()))
      errs.products = "Selecione ao menos 1 produto ou descreva o que deseja";
    if (customWish && !customWishText.trim())
      errs.products = "Descreva o que você está procurando";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const validProductIds = entries
      .map((e) => e.productId)
      .filter(Boolean) as number[];

    const notesComposed = [
      customWish && customWishText.trim() ? `Desejo livre: ${customWishText.trim()}` : "",
      notesPublic.trim(),
    ].filter(Boolean).join(" | ");

    createMutation.mutate({
      visitorName: name.trim(),
      contact: phone.trim(),
      contactType: "WHATSAPP",
      productIds: validProductIds,
      notesPublic: notesComposed || undefined,
    });
  };

  // ── Tela de sucesso ───────────────────────────────────────────────────────

  if (submitted) {
    const selectedProducts = entries
      .map((e) => products.find((p) => p.id === e.productId))
      .filter(Boolean) as CatalogProduct[];

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Desejo registrado!</h1>
            <p className="text-muted-foreground text-sm">
              Obrigado, <strong>{name}</strong>! Entraremos em contato pelo WhatsApp{" "}
              <strong>{phone}</strong> quando os produtos estiverem disponíveis.
            </p>
          </div>

          {selectedProducts.length > 0 && (
            <div className="rounded-xl border bg-card p-4 text-left space-y-2">
              <p className="text-sm font-medium">Produtos solicitados:</p>
              {selectedProducts.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name}
                      className="w-8 h-8 rounded object-contain bg-muted border shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <span className="truncate">{p.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button onClick={() => { setSubmitted(false); setName(""); setPhone(""); setEntries([{ id: uid(), productId: null }]); }} variant="outline">
              Registrar outro desejo
            </Button>
            <Button onClick={() => nav("/")} variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Ver catálogo
            </Button>
          </div>

          <button
            className="text-xs text-muted-foreground hover:text-foreground underline"
            onClick={() => { setLookupPhone(submittedPhone); setShowMyRequests(true); setSubmitted(false); }}
          >
            Ver meus pedidos registrados
          </button>
        </div>
      </div>
    );
  }

  // ── Tela "Meus pedidos" ───────────────────────────────────────────────────
  // [INJETADO] Lookup por telefone — recupera pedidos anteriores do visitante

  if (showMyRequests) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
          <button
            onClick={() => setShowMyRequests(false)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao formulário
          </button>

          <div>
            <h1 className="text-2xl font-bold">Meus pedidos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Digite seu telefone para ver os desejos que você registrou
            </p>
          </div>

          {/* [INJETADO] Campo de telefone para lookup */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Seu telefone (WhatsApp)
            </Label>
            <Input
              value={lookupPhone}
              onChange={(e) => setLookupPhone(e.target.value)}
              placeholder="Ex: 61999999999 (com DDD)"
              type="tel"
            />
            <p className="text-xs text-muted-foreground">
              Usamos apenas dígitos para a busca — qualquer formato é aceito
            </p>
          </div>

          {myRequestsQuery.isLoading && phoneDebounced.length >= 8 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando seus pedidos...
            </div>
          )}

          {!myRequestsQuery.isLoading && phoneDebounced.length >= 8 && myRequestsQuery.data?.length === 0 && (
            <div className="rounded-xl border bg-card p-8 text-center space-y-2">
              <Package className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Nenhum pedido encontrado para este telefone.
              </p>
            </div>
          )}

          {myRequestsQuery.data && myRequestsQuery.data.length > 0 && (
            <div className="space-y-3">
              {(myRequestsQuery.data as any[]).map((req) => {
                const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG["NOVO"];
                const productIds: number[] = req.productIds ?? [];
                const reqProducts = productIds
                  .map((id: number) => products.find((p) => p.id === id))
                  .filter(Boolean) as CatalogProduct[];

                return (
                  <div key={req.id} className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{req.visitorName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.createdAt).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Produtos do pedido */}
                    {reqProducts.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Produtos:</p>
                        {reqProducts.map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name}
                                className="w-8 h-8 rounded object-contain bg-muted border shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                                <ShoppingBag className="w-3 h-3 text-muted-foreground" />
                              </div>
                            )}
                            <span className="text-sm">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : productIds.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {productIds.length} produto{productIds.length !== 1 ? "s" : ""} solicitado{productIds.length !== 1 ? "s" : ""}
                      </p>
                    ) : req.description ? (
                      <p className="text-sm text-muted-foreground">{req.description}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Formulário principal ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/5 to-transparent border-b">
        <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-3">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
            <Heart className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Lista de Desejos</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Não encontrou o que procura? Registre aqui e entraremos em contato
            assim que o produto estiver disponível.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-10">
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* ── Seção 1: Dados de contato ────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold border-b pb-2">Seus dados de contato</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="visitor-name" className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Seu nome *
                </Label>
                <Input
                  id="visitor-name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((r) => ({ ...r, name: "" })); }}
                  placeholder="Como prefere ser chamado?"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              {/* [INJETADO] Telefone como chave de identificação */}
              <div className="space-y-1.5">
                <Label htmlFor="visitor-phone" className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Telefone WhatsApp *
                </Label>
                <Input
                  id="visitor-phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setErrors((r) => ({ ...r, phone: "" }));
                    // Limpa o auto-check se o usuário editar o telefone
                    setPhoneForAutoCheck("");
                  }}
                  onBlur={() => {
                    // [INJETADO] Auto-check silencioso ao sair do campo
                    const digits = phone.replace(/\D/g, "");
                    if (digits.length >= 10) setPhoneForAutoCheck(phone);
                  }}
                  placeholder="Ex: 61999999999 (com DDD)"
                  type="tel"
                />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
            </div>

            {/* [INJETADO] Banner de pedidos anteriores detectados */}
            {hasExistingRequests && !autoCheckQuery.isLoading && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-blue-900">
                    Você já tem pedidos registrados com este telefone!
                  </p>
                  <button
                    type="button"
                    onClick={() => { setLookupPhone(phone); setShowMyRequests(true); }}
                    className="text-blue-600 hover:underline text-xs mt-0.5"
                  >
                    Ver meus pedidos anteriores →
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── Seção 2: Seleção de produtos ─────────────────────────── */}
          {/* [NOVO] Multi-select dinâmico com produtos do catálogo */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold border-b pb-2">
              Quais produtos você deseja?
            </h2>

            {productsQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando produtos...
              </div>
            )}

            {!productsQuery.isLoading && products.length === 0 && (
              <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground text-center">
                Nenhum produto disponível no catálogo no momento.
              </div>
            )}

            {products.length > 0 && (
              <div className="space-y-3">
                {/* Linhas de seleção de produto */}
                {entries.map((entry) => (
                  <ProductLine
                    key={entry.id}
                    entry={entry}
                    products={products}
                    usedIds={usedIds}
                    onSelect={handleSelectProduct}
                    onRemove={handleRemoveEntry}
                    canRemove={entries.length > 1}
                  />
                ))}

                {/* Botão adicionar mais produto */}
                {entries.length < products.length && (
                  <button
                    type="button"
                    onClick={handleAddEntry}
                    className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Adicionar outro produto
                  </button>
                )}

                {/* Opção de desejo livre */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => { setCustomWish((v) => !v); setErrors((e) => ({ ...e, products: "" })); }}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${customWish ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                      {customWish && <span className="text-white text-[10px] font-bold">✓</span>}
                    </span>
                    Não encontrei o que procuro — quero descrever meu desejo
                  </button>

                  {customWish && (
                    <div className="mt-2 space-y-1">
                      <textarea
                        autoFocus
                        value={customWishText}
                        onChange={(e) => { setCustomWishText(e.target.value); setErrors((err) => ({ ...err, products: "" })); }}
                        placeholder="Ex: Quero um iPhone 14 Pro Max 256GB cor preta, pode ser seminovo..."
                        maxLength={500}
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      />
                      <p className="text-xs text-muted-foreground text-right">{customWishText.length}/500</p>
                    </div>
                  )}
                </div>

                {errors.products && (
                  <p className="text-xs text-destructive">{errors.products}</p>
                )}
              </div>
            )}
          </section>

          {/* ── Seção 3: Observação opcional ─────────────────────────── */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold border-b pb-2">
              Observações <span className="text-muted-foreground font-normal text-sm">(opcional)</span>
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="notes-public">
                Alguma preferência específica? (cor, tamanho, condição...)
              </Label>
              <Input
                id="notes-public"
                value={notesPublic}
                onChange={(e) => setNotesPublic(e.target.value)}
                placeholder="Ex: Prefiro cor preta, tamanho M, produto novo"
                maxLength={300}
              />
            </div>
          </section>

          {/* Erro global */}
          {errors.global && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              {errors.global}
            </div>
          )}

          {/* ── Submit ────────────────────────────────────────────────── */}
          <div className="space-y-3 pt-2">
            <Button
              type="submit"
              className="w-full gap-2 h-12 text-base"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {createMutation.isPending ? "Registrando..." : "Registrar meu desejo"}
            </Button>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => nav("/")}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Ver catálogo
              </button>
              <button
                type="button"
                onClick={() => { setShowMyRequests(true); setLookupPhone(phone); }}
                className="hover:text-foreground transition-colors"
              >
                Ver meus pedidos
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
