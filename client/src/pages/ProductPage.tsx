/**
 * ProductPage.tsx — Ideal Prime (v7 — Estilo Sephora)
 *
 * Layout limpo inspirado na Sephora:
 * - Imagem grande, fundo branco, sem borda, sem rounded
 * - Categoria pequena + Nome bold em uppercase
 * - Preço grande + parcelamentos em texto simples abaixo
 * - Divisor fino
 * - UM botão único: "Reservar produto" → abre BuyModal com formas de pagamento
 * - Aviso discreto: "Escolha a forma de pagamento na próxima etapa"
 * - Quantidade disponível em texto pequeno
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { captureReferralFromLocation } from "@/lib/referral";
import {
  ArrowLeft, Share2, ShoppingBag, Heart, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { BuyModal } from "@/components/BuyModal";
import logo from "@/assets/logo.png";

const fmt = (v: number | null | undefined): string => {
  if (!v || v === 0) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
};

const CAT: Record<string, string> = {
  CELULAR: "Celulares", ELETRONICO: "Eletrônicos",
  PERFUME: "Perfumes & Fragrâncias", OUTRO: "Outros",
};

const FONT = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap";
if (typeof document !== "undefined" && !document.getElementById("pp-v7")) {
  const l = document.createElement("link");
  l.id = "pp-v7"; l.rel = "stylesheet"; l.href = FONT;
  document.head.appendChild(l);
}
const SANS = "'DM Sans', 'Poppins', sans-serif";

function Skeleton() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: SANS }}>
      <div className="h-14 border-b" style={{ borderColor: "#f0f0f0" }} />
      <div className="max-w-5xl mx-auto px-6 py-12 grid md:grid-cols-2 gap-16">
        <div className="animate-pulse bg-neutral-50" style={{ aspectRatio: "1/1" }} />
        <div className="space-y-5 pt-2">
          <div className="h-3 animate-pulse bg-neutral-100 rounded w-20" />
          <div className="h-8 animate-pulse bg-neutral-100 rounded w-full" />
          <div className="h-10 animate-pulse bg-neutral-100 rounded w-1/2 mt-6" />
          <div className="h-4 animate-pulse bg-neutral-100 rounded w-2/3" />
          <div className="h-px bg-neutral-100 mt-6" />
          <div className="h-12 animate-pulse bg-neutral-100 rounded mt-4" />
        </div>
      </div>
    </div>
  );
}

export default function ProductPage() {
  const params = useParams<{ id?: string }>();
  const productId = params.id ? Number(params.id) : undefined;
  const [showBuyModal, setShowBuyModal] = useState(false);

  useEffect(() => {
    captureReferralFromLocation();
  }, []);

  const q = trpc.marketplace.productById.useQuery(
    { id: productId! },
    { enabled: !!productId && !isNaN(productId!) }
  );

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: q.data?.name ?? "Produto", url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado!");
    }
  };

  if (!productId || isNaN(productId)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" style={{ fontFamily: SANS }}>
        <div className="text-center space-y-4">
          <p className="text-neutral-400 text-sm">Produto não encontrado.</p>
          <Link href="/vitrine">
            <button className="px-5 py-2 border text-sm text-neutral-500 hover:border-neutral-400 transition-all" style={{ borderColor: "#e0e0e0" }}>
              ← Voltar ao catálogo
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (q.isLoading) return <Skeleton />;

  if (!q.data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" style={{ fontFamily: SANS }}>
        <div className="text-center space-y-4">
          <ShoppingBag className="w-10 h-10 text-neutral-200 mx-auto" />
          <h2 className="text-base font-medium" style={{ color: "#555" }}>Produto não disponível</h2>
          <Link href="/vitrine">
            <button className="px-5 py-2 border text-sm text-neutral-500 hover:border-neutral-400 transition-all" style={{ borderColor: "#e0e0e0" }}>
              ← Voltar ao catálogo
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const p: any = q.data;
  const catLabel   = p.categoryLabel || CAT[p.category] || p.category;
  const inStock    = (p.stockQuantity ?? 0) > 0;
  const isLow      = inStock && (p.stockQuantity ?? 0) <= (p.minimumStock ?? 2);

  const pixVal     = (p.suggestedPricePix ?? 0) > 0 ? p.suggestedPricePix
                   : (p.suggestedPrice    ?? 0) > 0 ? p.suggestedPrice : null;
  const cardVal    = (p.suggestedPriceCard    ?? 0) > 0 ? p.suggestedPriceCard    : null;
  const boletoVal  = (p.suggestedPriceBoleto  ?? 0) > 0 ? p.suggestedPriceBoleto  : null;
  const cardInst   = Math.max(1, Math.round(p.cardInstallments ?? 1));
  const boletoMon  = Math.max(1, Math.round(p.boletoMonths     ?? 1));
  const hasPrice   = !!(pixVal || cardVal || boletoVal);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: SANS }}>

      {/* ── HEADER — mínimo, limpo ── */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          backgroundColor: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(12px)",
          borderColor: "#f0f0f0",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/vitrine">
            <button
              className="flex items-center gap-1.5 text-xs font-medium transition-colors group"
              style={{ color: "#aaa", fontFamily: SANS }}
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span className="uppercase tracking-[0.16em]">Catálogo</span>
            </button>
          </Link>

          <Link href="/vitrine">
            <img src={logo} alt="Shoop" className="h-9 w-auto object-contain cursor-pointer select-none" />
          </Link>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: "#aaa", fontFamily: SANS }}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline uppercase tracking-[0.16em]">Compartilhar</span>
          </button>
        </div>
      </header>

      {/* ── CONTEÚDO ── */}
      <main className="max-w-5xl mx-auto px-6 py-10 sm:py-14">
        <div className="grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-10 md:gap-20 items-start">

          {/* IMAGEM — fundo branco, sem cor, sem borda arredondada */}
          <div className="md:sticky md:top-20">
            <div
              className="relative overflow-hidden"
              style={{
                aspectRatio: "1 / 1",
                backgroundColor: "#ffffff",
                border: "1px solid #efefef",
              }}
            >
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="absolute inset-0 w-full h-full object-contain p-8"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ShoppingBag className="w-12 h-12 text-neutral-200" />
                </div>
              )}

              {/* Badge promoTag */}
              {p.promoTag && inStock && (
                <span
                  className="absolute top-3 left-3 text-[9px] font-bold tracking-[0.18em] uppercase px-2.5 py-1 z-10"
                  style={{ backgroundColor: "#111", color: "#fff" }}
                >
                  {p.promoTag}
                </span>
              )}

              {/* Últimas unidades */}
              {isLow && !p.promoTag && (
                <span
                  className="absolute top-3 left-3 text-[9px] font-bold tracking-[0.14em] uppercase px-2.5 py-1 z-10"
                  style={{ backgroundColor: "#111", color: "#fff" }}
                >
                  Últimas unidades
                </span>
              )}

              {/* Wishlist */}
              <button
                className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center hover:text-rose-500 transition-colors"
                style={{ color: "#ccc" }}
                aria-label="Favoritar"
              >
                <Heart className="w-4 h-4" />
              </button>

              {/* Indisponível */}
              {!inStock && (
                <div
                  className="absolute inset-0 flex items-center justify-center z-10"
                  style={{ backgroundColor: "rgba(255,255,255,0.8)" }}
                >
                  <span
                    className="text-[9px] font-semibold tracking-[0.24em] uppercase border px-3 py-1.5"
                    style={{ borderColor: "#ddd", color: "#aaa" }}
                  >
                    Indisponível
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* DETALHES — estilo Sephora */}
          <div className="space-y-5 pt-1">

            {/* Categoria — pequena, cinza, uppercase */}
            <p
              className="text-[10px] font-semibold tracking-[0.32em] uppercase"
              style={{ color: "#aaa" }}
            >
              {catLabel}
            </p>

            {/* Nome — bold, uppercase como Sephora */}
            <h1
              style={{
                fontFamily: SANS,
                fontSize: "clamp(1.3rem, 2.4vw, 1.8rem)",
                fontWeight: 700,
                color: "#111",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
                textTransform: "uppercase",
              }}
            >
              {p.name}
            </h1>

            {/* Descrição curta */}
            {p.shortDescription && (
              <p className="text-sm font-light leading-relaxed" style={{ color: "#666" }}>
                {p.shortDescription}
              </p>
            )}

            {/* PREÇOS — estilo Sephora: grande + texto simples */}
            {inStock && hasPrice ? (
              <div className="space-y-1.5 pt-1">
                {/* Preço principal */}
                {pixVal && (
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span
                      style={{
                        fontFamily: SANS,
                        fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
                        fontWeight: 700,
                        color: "#111",
                        letterSpacing: "-0.04em",
                      }}
                    >
                      {fmt(pixVal)}
                    </span>
                    <span
                      className="text-[9px] font-bold tracking-[0.18em] uppercase"
                      style={{ color: "#15803d" }}
                    >
                      PIX / Dinheiro
                    </span>
                  </div>
                )}

                {/* Parcelamentos — texto limpo, sem destaque */}
                {cardVal && (
                  <p className="text-sm" style={{ color: "#555", fontFamily: SANS }}>
                    ou {cardInst > 1 ? `${cardInst}x de ${fmt(cardVal / cardInst)}` : fmt(cardVal)} no cartão
                  </p>
                )}
                {boletoVal && (
                  <p className="text-sm" style={{ color: "#555", fontFamily: SANS }}>
                    ou {boletoMon > 1 ? `${boletoMon}x de ${fmt(boletoVal / boletoMon)}` : fmt(boletoVal)} no boleto
                  </p>
                )}
              </div>
            ) : inStock ? (
              <p className="text-sm italic pt-1" style={{ color: "#bbb" }}>Consulte o preço</p>
            ) : null}

            {/* Divisor fino */}
            <div style={{ height: 1, backgroundColor: "#efefef", marginTop: 8 }} />

            {/* BOTÃO ÚNICO — Reservar */}
            {inStock ? (
              <div className="space-y-2.5 pt-1">
                <button
                  onClick={() => setShowBuyModal(true)}
                  className="w-full py-3.5 text-sm font-semibold tracking-[0.1em] transition-all duration-200 uppercase"
                  style={{ backgroundColor: "#111", color: "#fff", fontFamily: SANS }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#333"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#111"; }}
                >
                  Reservar produto
                </button>

                <p
                  className="text-xs text-center"
                  style={{ color: "#bbb", fontFamily: SANS }}
                >
                  Escolha a forma de pagamento na próxima etapa
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                <p className="text-sm" style={{ color: "#aaa" }}>
                  Este produto está temporariamente indisponível.
                </p>
                <Link href="/desejos">
                  <button
                    className="w-full py-3.5 text-sm font-medium border transition-all hover:border-neutral-400 flex items-center justify-center gap-2 uppercase tracking-[0.1em]"
                    style={{ borderColor: "#e0e0e0", color: "#888", fontFamily: SANS }}
                  >
                    <Heart className="w-4 h-4" />
                    Avisar quando chegar
                  </button>
                </Link>
              </div>
            )}

            {/* Sem preço — WhatsApp */}
            {inStock && !hasPrice && (
              <a
                href="https://wa.me/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors"
                style={{ backgroundColor: "#22c55e", color: "#fff" }}
              >
                <MessageCircle className="w-4 h-4" />
                Consultar via WhatsApp
              </a>
            )}

            {/* Quantidade */}
            {inStock && (
              <p className="text-xs" style={{ color: "#bbb", fontFamily: SANS }}>
                {p.stockQuantity} {p.stockQuantity === 1 ? "unidade disponível" : "unidades disponíveis"}
              </p>
            )}
          </div>
        </div>

        {/* Descrição completa */}
        {p.description && (
          <div className="mt-16 max-w-xl border-t pt-10" style={{ borderColor: "#f0f0f0" }}>
            <p
              className="text-[9px] font-bold tracking-[0.32em] uppercase mb-4"
              style={{ color: "#bbb" }}
            >
              Sobre o produto
            </p>
            <p
              className="text-sm font-light leading-relaxed whitespace-pre-line"
              style={{ color: "#666" }}
            >
              {p.description}
            </p>
          </div>
        )}

        {/* Voltar */}
        <div className="mt-14 pt-8 border-t" style={{ borderColor: "#f0f0f0" }}>
          <Link href="/vitrine">
            <button
              className="inline-flex items-center gap-2 text-[10px] font-medium tracking-[0.2em] uppercase transition-colors group hover:text-neutral-800"
              style={{ color: "#bbb", fontFamily: SANS }}
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Voltar ao catálogo
            </button>
          </Link>
        </div>
      </main>

      {/* Footer mínimo */}
      <footer className="border-t py-8" style={{ borderColor: "#f0f0f0" }}>
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <nav className="flex items-center gap-6">
            <Link href="/vitrine">
              <span className="text-[9px] tracking-[0.2em] uppercase cursor-pointer transition-colors hover:text-neutral-700" style={{ color: "#bbb" }}>
                Catálogo
              </span>
            </Link>
            <Link href="/desejos">
              <span className="text-[9px] tracking-[0.2em] uppercase cursor-pointer transition-colors hover:text-neutral-700" style={{ color: "#bbb" }}>
                Lista de Desejos
              </span>
            </Link>
          </nav>
          <p className="text-[9px] tracking-wide" style={{ color: "#ddd" }}>
            © {new Date().getFullYear()} Ideal Prime
          </p>
        </div>
      </footer>

      {/* BuyModal — formas de pagamento aparecem aqui */}
      {showBuyModal && (
        <BuyModal
          product={{
            id: p.id,
            name: p.name,
            suggestedPricePix:    p.suggestedPricePix    ?? 0,
            suggestedPriceCard:   p.suggestedPriceCard   ?? 0,
            suggestedPriceBoleto: p.suggestedPriceBoleto ?? 0,
            suggestedPrice:       p.suggestedPrice       ?? 0,
            cardInstallments:     p.cardInstallments,
            boletoMonths:         p.boletoMonths,
          }}
          onClose={() => setShowBuyModal(false)}
        />
      )}
    </div>
  );
}
