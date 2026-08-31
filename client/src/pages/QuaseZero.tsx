/**
 * QuaseZero.tsx — Vitrine Pública "Quase Zero"
 *
 * Página pública separada para produtos usados, seminovos, mostruário e peças únicas.
 * Ela reutiliza os produtos publicados do marketplace, mas destaca itens que tenham
 * sinais de "usado", "seminovo", "quase zero", "mostruário", "open box" etc.
 *
 * Sem migration e sem backend novo:
 * - usa trpc.marketplace.products
 * - linka para /vitrine/:id
 * - se ainda não houver itens marcados, mostra os produtos disponíveis como vitrine inicial
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, BadgeCheck, Heart, PackageCheck, Recycle, Search, ShoppingBag, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

interface CatalogProduct {
  id: number; name: string; category: string; categoryLabel: string | null;
  shortDescription: string | null; description: string | null;
  imageUrl: string | null; promoTag: string | null;
  suggestedPrice: number; suggestedPricePix: number;
  suggestedPriceCard: number; suggestedPriceBoleto: number;
  stockQuantity: number; minimumStock: number;
  paymentPlatform: string | null; pixKey: string | null;
  pixLink: string | null; cardPaymentUrl: string | null;
  boletoUrl: string | null; cardInstallments?: number | null; boletoMonths?: number | null;
  salesChannel?: "SHOP" | "QUASE_ZERO" | "BOTH" | string | null;
  productCondition?: "NEW" | "SEMINOVO" | "USADO" | "MOSTRUARIO" | "OPEN_BOX" | "REEMBALADO" | string | null;
  conditionNotes?: string | null;
  isUniquePiece?: boolean | null;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CAT: Record<string, string> = {
  CELULAR: "Celulares",
  ELETRONICO: "Eletrônicos",
  PERFUME: "Perfumes & Fragrâncias",
  OUTRO: "Outros",
};

const pixPrice = (p: CatalogProduct) =>
  (p.suggestedPricePix ?? 0) > 0 ? p.suggestedPricePix :
  (p.suggestedPrice ?? 0) > 0 ? p.suggestedPrice : null;

const cardPrice = (p: CatalogProduct) =>
  (p.suggestedPriceCard ?? 0) > 0 ? p.suggestedPriceCard : null;

const hasStock = (p: CatalogProduct) => (p.stockQuantity ?? 0) > 0;

const usedTerms = [
  "quase zero",
  "usado",
  "usada",
  "seminovo",
  "seminova",
  "mostruario",
  "mostruário",
  "open box",
  "reembalado",
  "vitrine",
  "unico",
  "único",
];

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function isQuaseZeroProduct(p: CatalogProduct) {
  const haystack = normalizeText([
    p.name,
    p.shortDescription,
    p.description,
    p.categoryLabel,
    p.promoTag,
  ].filter(Boolean).join(" "));

  return usedTerms.some((term) => haystack.includes(normalizeText(term)));
}

const SERIF = "var(--font-display)";
const SANS = "var(--font-sans)";

function QuaseZeroLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="inline-flex items-center gap-3 select-none">
      <div className="prime-pattern-surface flex h-12 w-12 items-center justify-center rounded-2xl border border-[#9ADCF2]/60 shadow-sm">
        <span className="prime-display text-2xl text-white">QZ</span>
      </div>
      {!compact && <BrandLogo compact className="w-[150px]" />}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 rounded-[1.6rem] bg-stone-100" style={{ aspectRatio: "4/5" }} />
      <div className="space-y-2">
        <div className="h-2 w-20 rounded-full bg-stone-100" />
        <div className="h-4 w-3/4 rounded-full bg-stone-100" />
        <div className="mt-2 h-3 w-1/3 rounded-full bg-stone-100" />
      </div>
    </div>
  );
}

function conditionLabel(value?: string | null) {
  const map: Record<string, string> = {
    NEW: "Novo",
    SEMINOVO: "Seminovo",
    USADO: "Usado",
    MOSTRUARIO: "Mostruário",
    OPEN_BOX: "Open Box",
    REEMBALADO: "Reembalado",
  };
  return map[String(value ?? "").toUpperCase()] ?? "Quase Zero";
}

function ProductCard({ product: p }: { product: CatalogProduct }) {
  const stock = hasStock(p);
  const pix = pixPrice(p);
  const card = cardPrice(p);
  const inst = Math.max(1, Math.round(p.cardInstallments ?? 3));

  return (
    <Link href={`/vitrine/${p.id}`}>
      <article
        className={`group cursor-pointer select-none ${!stock ? "opacity-45 pointer-events-none" : ""}`}
        style={{ fontFamily: SANS }}
      >
        <div
          className="relative mb-4 overflow-hidden rounded-[1.6rem] border border-stone-100 bg-white shadow-[0_14px_40px_rgba(28,25,23,0.06)]"
          style={{ aspectRatio: "4/5" }}
        >
          {p.imageUrl ? (
            <img
              src={p.imageUrl}
              alt={p.name}
              className="absolute inset-0 h-full w-full object-contain p-5 transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <ShoppingBag className="h-8 w-8 text-stone-200" />
              <span className="text-[9px] uppercase tracking-[0.3em] text-stone-300">Sem imagem</span>
            </div>
          )}

          <span className="absolute left-3 top-3 z-10 rounded-full bg-stone-950 px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-white">
            {conditionLabel(p.productCondition)}
          </span>

          {p.stockQuantity === 1 && stock && (
            <span className="absolute right-3 top-3 z-10 rounded-full bg-[#E8F7FC] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#07567A]">
              Peça única
            </span>
          )}

          {stock && (
            <div className="absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0">
              <div className="flex items-center justify-center gap-2 bg-stone-950 py-3.5 text-center text-[9px] font-semibold uppercase tracking-[0.22em] text-white">
                Ver peça <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1 px-0.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#068A5B]">
            {p.categoryLabel || CAT[p.category] || p.category}
          </p>

          <h3
            className="line-clamp-2 leading-snug text-[#12352B] transition-colors duration-300 group-hover:text-[#068A5B]"
            style={{ fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 700, letterSpacing: "-0.02em", minHeight: "2.8em" }}
          >
            {p.name}
          </h3>

          {p.shortDescription && (
            <p className="line-clamp-1 text-[11px] font-light text-stone-400">
              {p.shortDescription}
            </p>
          )}

          <div className="pt-2">
            {stock && pix ? (
              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold text-[#12352B]" style={{ fontFamily: SANS, fontSize: "1rem", letterSpacing: "-0.02em" }}>
                    {fmt(pix)}
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                    Pix / dinheiro
                  </span>
                </div>
                {card && inst > 1 && (
                  <p className="mt-0.5 text-[10px] font-light text-stone-400">
                    ou {inst}× de {fmt(card / inst)} no cartão
                  </p>
                )}
              </div>
            ) : stock ? (
              <span className="text-xs italic text-stone-400">Consulte o preço</span>
            ) : (
              <span className="text-xs text-stone-400">Indisponível</span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function QuaseZero() {
  const [cat, setCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { data, isLoading } = trpc.marketplace.quaseZeroProducts.useQuery();

  const quaseZeroProducts = useMemo(() => ((data ?? []) as CatalogProduct[]).filter((p) => hasStock(p)), [data]);

  const cats = useMemo(() => Array.from(new Set(quaseZeroProducts.map((p) => p.category))), [quaseZeroProducts]);

  const filtered = useMemo(() => {
    const q = normalizeText(search);
    return quaseZeroProducts.filter((p) => {
      const matchesCategory = cat ? p.category === cat : true;
      const matchesSearch = q
        ? normalizeText([p.name, p.shortDescription, p.categoryLabel, p.promoTag].filter(Boolean).join(" ")).includes(q)
        : true;
      return matchesCategory && matchesSearch;
    });
  }, [quaseZeroProducts, cat, search]);

  const featured = filtered[0] ?? quaseZeroProducts[0];

  return (
    <div className="min-h-screen bg-[#FBFDFC] text-[#12352B]" style={{ fontFamily: SANS }}>
      <header className="sticky top-0 z-50 border-b border-stone-200/70 bg-[#FBFDFC]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-24 max-w-7xl items-center justify-between gap-6 px-6 lg:px-16">
          <Link href="/vitrine">
            <button className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400 transition-colors hover:text-[#12352B]">
              <ArrowLeft className="h-4 w-4" /> Catálogo
            </button>
          </Link>

          <Link href="/quase-zero">
            <div className="cursor-pointer">
              <QuaseZeroLogo />
            </div>
          </Link>

          <Link href="/vitrine">
            <div className="hidden items-center gap-2 md:flex">
              <BrandLogo compact className="opacity-90" />
            </div>
          </Link>
        </div>
      </header>

      <section className="border-b border-stone-200/70">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-14 lg:grid-cols-[0.95fr_1.05fr] lg:px-16 lg:py-20">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#9ADCF2] bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#068A5B] shadow-sm">
              <Recycle className="h-3.5 w-3.5" /> Usados, seminovos e peças únicas
            </div>

            <div>
              <h1
                className="max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.06em] text-[#12352B] sm:text-6xl lg:text-7xl"
                style={{ fontFamily: SERIF }}
              >
                Quase
                <br />
                <span className="text-[#068A5B]">Zero</span>
              </h1>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-[#5E776D]">
                Uma curadoria especial de peças com estado de conservação elevado, preço mais leve e disponibilidade limitada.
              </p>
            </div>

            <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <BadgeCheck className="mb-3 h-5 w-5 text-emerald-600" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#12352B]">Curadoria</p>
                <p className="mt-1 text-xs leading-relaxed text-[#5E776D]">peças selecionadas</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <PackageCheck className="mb-3 h-5 w-5 text-[#068A5B]" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#12352B]">Peças únicas</p>
                <p className="mt-1 text-xs leading-relaxed text-[#5E776D]">estoque limitado</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <Sparkles className="mb-3 h-5 w-5 text-stone-800" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#12352B]">Preço especial</p>
                <p className="mt-1 text-xs leading-relaxed text-[#5E776D]">reservas rápidas</p>
              </div>
            </div>

            <button
              onClick={() => document.getElementById("quase-zero-lista")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-8 py-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-white transition-colors hover:bg-amber-800"
            >
              Ver peças disponíveis <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="relative hidden min-h-[460px] items-center justify-center lg:flex">
            <div className="absolute inset-0 rounded-[2.5rem] border border-stone-200 bg-white shadow-[0_28px_80px_rgba(28,25,23,0.08)]" />
            {featured ? (
              <Link href={`/vitrine/${featured.id}`}>
                <div className="group relative z-10 grid w-full max-w-[620px] grid-cols-[1fr_0.75fr] gap-6 px-8">
                  <div className="relative h-[390px] overflow-hidden rounded-[2rem] bg-[#FBFDFC]">
                    {featured.imageUrl ? (
                      <img src={featured.imageUrl} alt={featured.name} className="h-full w-full object-contain p-8 transition-transform duration-700 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ShoppingBag className="h-14 w-14 text-stone-200" />
                      </div>
                    )}
                    <span className="absolute left-5 top-5 rounded-full bg-stone-950 px-4 py-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-white">
                      destaque
                    </span>
                  </div>

                  <div className="flex flex-col justify-end pb-8">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.32em] text-[#068A5B]">Última peça</p>
                    <h2 className="mt-3 line-clamp-3 text-3xl font-black leading-tight tracking-[-0.04em]" style={{ fontFamily: SERIF }}>
                      {featured.name}
                    </h2>
                    <p className="mt-5 text-2xl font-bold text-[#12352B]">
                      {pixPrice(featured) ? fmt(pixPrice(featured)!) : "Consulte"}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-400">Pix ou dinheiro</p>
                    <div className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-[#068A5B] px-5 py-3 text-[9px] font-bold uppercase tracking-[0.22em] text-white">
                      Reservar peça <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="relative z-10 text-center text-stone-400">Nenhuma peça disponível ainda.</div>
            )}
          </div>
        </div>
      </section>

      <section id="quase-zero-lista" className="mx-auto max-w-7xl px-6 py-12 lg:px-16">
        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.35em] text-[#068A5B]">Disponíveis agora</p>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-[#12352B]" style={{ fontFamily: SERIF }}>
              Últimas peças Quase Zero
            </h2>
            <p className="mt-2 max-w-xl text-sm text-[#5E776D]">
              Para aparecer aqui, cadastre o produto no admin com Canal de venda “Quase Zero” ou “Ambos”.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-300" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar peça..."
                className="h-11 w-full rounded-full border border-stone-200 bg-white pl-11 pr-4 text-sm outline-none transition-colors focus:border-[#098EC7] sm:w-64"
              />
            </div>
          </div>
        </div>

        {cats.length > 1 && (
          <div className="mb-10 flex gap-2 overflow-x-auto pb-1">
            {[{ key: null, label: "Todos" }, ...cats.map((c) => ({ key: c, label: CAT[c] || c }))].map(({ key, label }) => (
              <button
                key={String(key)}
                onClick={() => setCat(key)}
                className={`shrink-0 rounded-full border px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                  cat === key
                    ? "border-stone-950 bg-stone-950 text-white"
                    : "border-stone-200 bg-white text-[#5E776D] hover:border-[#9ADCF2] hover:text-[#068A5B]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-stone-200 bg-white p-12 text-center">
            <ShoppingBag className="mx-auto mb-4 h-10 w-10 text-stone-200" />
            <h3 className="text-xl font-bold text-[#12352B]">Nenhuma peça encontrada</h3>
            <p className="mt-2 text-sm text-[#5E776D]">Cadastre ou marque produtos como Quase Zero para aparecerem aqui.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-14 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </section>

      <footer className="border-t border-stone-200 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:flex-row lg:px-16">
          <QuaseZeroLogo />
          <nav className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/vitrine">
              <span className="cursor-pointer text-[9px] uppercase tracking-[0.2em] text-stone-400 transition-colors hover:text-[#12352B]">Ideal Prime</span>
            </Link>
            <Link href="/desejos">
              <span className="cursor-pointer text-[9px] uppercase tracking-[0.2em] text-stone-400 transition-colors hover:text-[#12352B]">Lista de desejos</span>
            </Link>
          </nav>
          <p className="text-[9px] tracking-wide text-stone-300">© {new Date().getFullYear()} Quase Zero</p>
        </div>
      </footer>
    </div>
  );
}
