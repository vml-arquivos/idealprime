import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { captureReferralFromLocation } from "@/lib/referral";
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import brandPattern from "@/assets/brand/ideal-prime-pattern.png";

interface CatalogProduct {
  id: number;
  name: string;
  category: string;
  categoryLabel: string | null;
  shortDescription: string | null;
  description: string | null;
  imageUrl: string | null;
  promoTag: string | null;
  suggestedPrice: number;
  suggestedPricePix: number;
  suggestedPriceCard: number;
  suggestedPriceBoleto: number;
  stockQuantity: number;
  minimumStock: number;
  cardInstallments?: number | null;
  boletoMonths?: number | null;
  salesChannel?: "SHOP" | "QUASE_ZERO" | "BOTH" | string | null;
  productCondition?: string | null;
}

const CAT: Record<string, string> = {
  CELULAR: "Celulares",
  ELETRONICO: "Eletrônicos",
  PERFUME: "Perfumes & Fragrâncias",
  OUTRO: "Outros",
};

const SERIF = "var(--font-display)";
const SANS = "var(--font-sans)";

const fmt = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pixPrice = (product: CatalogProduct) =>
  (product.suggestedPricePix ?? 0) > 0
    ? product.suggestedPricePix
    : (product.suggestedPrice ?? 0) > 0
      ? product.suggestedPrice
      : null;

const cardPrice = (product: CatalogProduct) =>
  (product.suggestedPriceCard ?? 0) > 0 ? product.suggestedPriceCard : null;

const hasStock = (product: CatalogProduct) => (product.stockQuantity ?? 0) > 0;

const isShopProduct = (product: CatalogProduct) => {
  const channel = String(product.salesChannel ?? "SHOP").toUpperCase();
  return channel !== "QUASE_ZERO";
};

function ProductSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 bg-[#E9F3EE]" style={{ aspectRatio: "4/5" }} />
      <div className="space-y-2">
        <div className="h-2 w-16 rounded bg-[#E9F3EE]" />
        <div className="h-4 w-3/4 rounded bg-[#E9F3EE]" />
        <div className="h-4 w-1/2 rounded bg-[#E9F3EE]" />
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: CatalogProduct }) {
  const stock = hasStock(product);
  const pix = pixPrice(product);
  const card = cardPrice(product);
  const installments = Math.max(1, Math.round(product.cardInstallments ?? 3));

  return (
    <Link href={`/vitrine/${product.id}`}>
      <article
        className={`group cursor-pointer ${!stock ? "opacity-55" : ""}`}
        style={{ fontFamily: SANS }}
      >
        <div
          className="relative mb-4 overflow-hidden border border-[#D5E8E0] bg-white"
          style={{ aspectRatio: "4/5" }}
        >
          {product.promoTag && stock && (
            <span className="absolute left-3 top-3 z-10 bg-[#068A5B] px-2.5 py-1.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-white">
              {product.promoTag}
            </span>
          )}

          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="absolute inset-0 h-full w-full object-contain p-5 transition-transform duration-500 group-hover:scale-[1.05]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#F7FBF9]">
              <ShoppingBag className="h-8 w-8 text-[#B9D5C8]" />
            </div>
          )}

          {stock ? (
            <div className="absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-300 group-hover:translate-y-0">
              <div className="flex items-center justify-center gap-2 bg-[#0C4536] py-3 text-center text-[9px] font-semibold uppercase tracking-[0.22em] text-white">
                Ver produto <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <span className="border border-[#C8DED5] bg-white px-3 py-1.5 text-[9px] uppercase tracking-[0.22em] text-[#5E776D]">
                Indisponível
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[8px] font-semibold uppercase tracking-[0.26em] text-[#068A5B]">
            {product.categoryLabel || CAT[product.category] || product.category}
          </p>
          <h3
            className="line-clamp-2 text-[1.02rem] text-[#12352B]"
            style={{ fontFamily: SERIF, fontWeight: 700, lineHeight: 1.22, minHeight: "2.45rem" }}
          >
            {product.name}
          </h3>
          {product.shortDescription && (
            <p className="line-clamp-2 text-xs leading-relaxed text-[#6C8278]">
              {product.shortDescription}
            </p>
          )}
          {pix ? (
            <div className="pt-1">
              <p className="text-lg font-bold tracking-[-0.04em] text-[#0C4536]">
                {fmt(pix)}
              </p>
              {card && installments > 1 && (
                <p className="text-[10px] font-semibold uppercase text-[#068A5B]">
                  ou {installments}x de {fmt(card / installments)}
                </p>
              )}
            </div>
          ) : (
            <p className="pt-1 text-xs italic text-[#81948B]">Consulte o preço</p>
          )}
        </div>
      </article>
    </Link>
  );
}

function Benefit({ icon: Icon, title, description }: { icon: typeof ShieldCheck; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#A8D8C3] bg-white/10 text-[#B9F1D4]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white">{title}</p>
        <p className="mt-1 max-w-[17rem] text-xs leading-relaxed text-white/65">{description}</p>
      </div>
    </div>
  );
}

export default function Marketplace() {
  const { data, isLoading } = trpc.marketplace.products.useQuery();
  const products = (data ?? []) as CatalogProduct[];
  const PANEL = import.meta.env.VITE_PANEL_URL ?? "";

  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const shopProducts = useMemo(() => products.filter(isShopProduct), [products]);
  const inStockProducts = useMemo(() => shopProducts.filter(hasStock), [shopProducts]);
  const categories = useMemo(
    () => Array.from(new Set(inStockProducts.map((product) => product.category))),
    [inStockProducts]
  );

  useEffect(() => {
    captureReferralFromLocation();
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return inStockProducts.filter((product) => {
      const byCategory = category ? product.category === category : true;
      const bySearch = normalizedSearch
        ? `${product.name} ${product.shortDescription ?? ""} ${product.categoryLabel ?? ""}`
            .toLowerCase()
            .includes(normalizedSearch)
        : true;
      return byCategory && bySearch;
    });
  }, [inStockProducts, category, search]);

  return (
    <div className="min-h-screen bg-[#F7FBF9]" style={{ fontFamily: SANS }}>
      <header className="sticky top-0 z-40 border-b border-[#D5E8E0]/80 bg-[#F7FBF9]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[5.25rem] max-w-7xl items-center justify-between gap-8 px-6 lg:px-16">
          <Link href="/vitrine">
            <div className="cursor-pointer">
              <BrandLogo />
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <button
              onClick={() => document.getElementById("catalogo-shop")?.scrollIntoView({ behavior: "smooth" })}
              className="border-b border-[#068A5B] pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#12352B]"
            >
              Catálogo
            </button>
            <button
              onClick={() => document.getElementById("experiencia-prime")?.scrollIntoView({ behavior: "smooth" })}
              className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#6C8278] transition-colors hover:text-[#068A5B]"
            >
              A experiência PRIME
            </button>
            <Link href="/desejos">
              <span className="cursor-pointer text-[10px] font-medium uppercase tracking-[0.22em] text-[#6C8278] transition-colors hover:text-[#068A5B]">
                Lista de desejos
              </span>
            </Link>
            <a href={`${PANEL}/login`} className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#6C8278] transition-colors hover:text-[#068A5B]">
              Gerenciar
            </a>
          </nav>

          <a
            href={`${PANEL}/login`}
            className="border border-[#12352B] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#12352B] transition-colors hover:bg-[#12352B] hover:text-white"
          >
            Entrar
          </a>
        </div>
      </header>

      <section className="overflow-hidden border-b border-[#D5E8E0] bg-white">
        <div className="mx-auto grid max-w-7xl items-stretch gap-8 px-6 py-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-16 lg:py-12">
          <div className="flex flex-col justify-center py-6 lg:py-10">
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px w-10 bg-[#068A5B]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#068A5B]">
                Ideal Prime · catálogo oficial
              </span>
            </div>

            <h1
              className="max-w-xl text-[#12352B]"
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(2.7rem, 5vw, 5.2rem)",
                fontWeight: 800,
                lineHeight: 0.98,
                letterSpacing: "-0.055em",
              }}
            >
              Escolhas que elevam
              <br />
              <span className="text-[#068A5B]">o seu negócio.</span>
            </h1>

            <p className="mt-6 max-w-md text-[0.98rem] leading-relaxed text-[#6C8278]">
              Produtos selecionados, disponibilidade transparente e uma experiência de compra pensada para quem exige padrão PRIME.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => document.getElementById("catalogo-shop")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-2 bg-[#068A5B] px-6 py-3.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white transition-all hover:bg-[#0C4536] active:scale-[0.97]"
              >
                Explorar produtos <ArrowRight className="h-4 w-4" />
              </button>
              <Link href="/desejos">
                <span className="inline-flex cursor-pointer items-center gap-2 border border-[#C8DED5] bg-white px-6 py-3.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#12352B] transition-colors hover:border-[#068A5B] hover:text-[#068A5B]">
                  Falar com a PRIME
                </span>
              </Link>
            </div>

            <div className="mt-10 grid max-w-lg grid-cols-3 gap-5 border-t border-[#E3EFE9] pt-5">
              <div>
                <p className="text-2xl font-bold tracking-[-0.04em] text-[#12352B]">{shopProducts.length}</p>
                <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[#81948B]">Produtos no catálogo</p>
              </div>
              <div>
                <p className="text-2xl font-bold tracking-[-0.04em] text-[#12352B]">{inStockProducts.length}</p>
                <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[#81948B]">Disponíveis agora</p>
              </div>
              <div>
                <p className="text-2xl font-bold tracking-[-0.04em] text-[#12352B]">{categories.length}</p>
                <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[#81948B]">Categorias PRIME</p>
              </div>
            </div>
          </div>

          <div className="relative min-h-[24rem] overflow-hidden bg-[#0C4536] lg:min-h-[34rem]">
            <div
              className="absolute inset-0 opacity-90"
              style={{
                backgroundImage: `linear-gradient(135deg, rgba(6,138,91,0.92), rgba(12,69,54,0.98)), url(${brandPattern})`,
                backgroundPosition: "center",
                backgroundSize: "cover, 520px auto",
              }}
            />
            <div className="absolute -right-24 -top-20 h-80 w-80 rounded-full border border-white/15" />
            <div className="absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full border border-[#9ADCF2]/20" />
            <div className="relative flex h-full min-h-[24rem] flex-col justify-between p-8 sm:p-12 lg:min-h-[34rem]">
              <div className="flex items-start justify-between gap-6">
                <BrandLogo variant="white" compact className="w-[175px] sm:w-[210px]" />
                <span className="rounded-full border border-white/20 px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[0.22em] text-white/75">
                  Coleção PRIME
                </span>
              </div>

              <div className="max-w-md">
                <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.32em] text-[#B9F1D4]">Curadoria comercial</p>
                <h2 className="prime-display text-4xl leading-[0.98] text-white sm:text-6xl">
                  A sua próxima escolha começa aqui.
                </h2>
                <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/70">
                  Uma seleção objetiva de produtos para comprar com clareza, confiança e atendimento próximo.
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-white/15 pt-5 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/65">
                <span>Comércio e distribuição</span>
                <span className="flex items-center gap-2 text-[#B9F1D4]">Ver catálogo <ArrowUpRight className="h-3.5 w-3.5" /></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="experiencia-prime" className="bg-[#0C4536] py-9 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 sm:grid-cols-3 lg:px-16">
          <Benefit icon={ShieldCheck} title="Compra segura" description="Informações claras para você escolher com tranquilidade." />
          <Benefit icon={Truck} title="Disponibilidade real" description="Catálogo e estoque organizados para uma decisão objetiva." />
          <Benefit icon={Sparkles} title="Atendimento PRIME" description="Uma experiência comercial próxima, elegante e eficiente." />
        </div>
      </section>

      <main id="catalogo-shop" className="mx-auto max-w-7xl px-6 py-16 lg:px-16 lg:py-20">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-8 bg-[#068A5B]" />
              <p className="text-[9px] font-semibold uppercase tracking-[0.34em] text-[#068A5B]">Seleção Ideal Prime</p>
            </div>
            <h2 className="text-[#12352B]" style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 3.5vw, 3.35rem)", fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.045em" }}>
              Produtos para vender,
              <br />
              <span className="text-[#068A5B]">escolhas para permanecer.</span>
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#6C8278]">
              Explore a seleção atual da PRIME e encontre produtos com preço, disponibilidade e atendimento apresentados sem ruído.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CB5A9]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar produto..."
                aria-label="Buscar produto"
                className="h-11 w-full border border-[#C8DED5] bg-white pl-9 pr-3 text-sm text-[#12352B] outline-none transition-colors placeholder:text-[#9CB5A9] focus:border-[#068A5B] sm:w-64"
              />
            </div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#81948B]">{filteredProducts.length} disponíveis</p>
          </div>
        </div>

        {categories.length > 1 && (
          <div className="mb-10 flex flex-wrap gap-2 border-y border-[#E3EFE9] py-4">
            {[{ key: null, label: "Todos" }, ...categories.map((categoryName) => ({ key: categoryName, label: CAT[categoryName] || categoryName }))].map(({ key, label }) => (
              <button
                key={String(key)}
                onClick={() => setCategory(key)}
                className={`px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.2em] transition-colors ${
                  category === key
                    ? "bg-[#12352B] text-white"
                    : "border border-transparent text-[#6C8278] hover:border-[#C8DED5] hover:text-[#068A5B]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <ProductSkeleton key={index} />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="grid gap-6 border border-[#D5E8E0] bg-white p-8 sm:grid-cols-[0.8fr_1.2fr] sm:p-12">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#068A5B]">Catálogo PRIME</p>
              <h3 className="mt-3 text-3xl text-[#12352B]" style={{ fontFamily: SERIF, fontWeight: 800, lineHeight: 1.05 }}>
                Uma seleção feita para o seu próximo movimento.
              </h3>
            </div>
            <div className="flex flex-col justify-between gap-7 sm:border-l sm:border-[#E3EFE9] sm:pl-10">
              <p className="max-w-md text-sm leading-relaxed text-[#6C8278]">
                Estamos organizando os produtos disponíveis para apresentar a melhor seleção PRIME. Enquanto isso, registre sua demanda e nossa equipe acompanha sua procura.
              </p>
              <Link href="/desejos">
                <span className="inline-flex w-fit cursor-pointer items-center gap-2 border border-[#068A5B] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#068A5B] transition-colors hover:bg-[#068A5B] hover:text-white">
                  Registrar interesse <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-14 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      <section className="border-t border-[#D5E8E0] bg-white py-16">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-16">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#068A5B]">Relacionamento PRIME</p>
            <h2 className="mt-3 max-w-2xl text-3xl text-[#12352B] sm:text-4xl" style={{ fontFamily: SERIF, fontWeight: 800, lineHeight: 1.05 }}>
              Não encontrou o que procurava?
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#6C8278]">
              Deixe sua demanda registrada. A equipe Ideal Prime acompanha oportunidades e entra em contato quando encontrar uma opção alinhada ao que você busca.
            </p>
          </div>
          <div className="flex lg:justify-end">
            <Link href="/desejos">
              <span className="inline-flex cursor-pointer items-center gap-3 bg-[#068A5B] px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:bg-[#0C4536]">
                Criar lista de desejos <Heart className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="prime-pattern-surface border-t border-[#0C6D4E] py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 lg:flex-row lg:px-16">
          <BrandLogo variant="white" compact />
          <nav className="flex flex-wrap items-center justify-center gap-7 text-[10px] uppercase tracking-[0.22em] text-white/70">
            <button onClick={() => document.getElementById("catalogo-shop")?.scrollIntoView({ behavior: "smooth" })} className="transition-colors hover:text-white">
              Catálogo
            </button>
            <button onClick={() => document.getElementById("experiencia-prime")?.scrollIntoView({ behavior: "smooth" })} className="transition-colors hover:text-white">
              A experiência PRIME
            </button>
            <Link href="/desejos">
              <span className="cursor-pointer transition-colors hover:text-white">Lista de desejos</span>
            </Link>
            <a href={`${PANEL}/login`} className="transition-colors hover:text-white">Entrar</a>
          </nav>
          <p className="text-[10px] text-white/45">© {new Date().getFullYear()} Ideal Prime</p>
        </div>
      </footer>
    </div>
  );
}
