import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { captureReferralFromLocation } from "@/lib/referral";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ClipboardList,
  FileText,
  Headphones,
  Menu,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ProductVisual } from "@/components/ProductVisual";
import brandPattern from "@/assets/brand/ideal-prime-pattern.png";

interface CatalogProduct {
  id: number;
  sku?: string | null;
  name: string;
  category: string;
  categoryLabel: string | null;
  brand?: string | null;
  subcategory?: string | null;
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
  isFeatured?: boolean;
  featuredOrder?: number;
}

const CAT: Record<string, string> = {
  CELULAR: "Celulares",
  ELETRONICO: "Eletrônicos",
  PERFUME: "Perfumaria",
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

const getCategoryLabel = (product: CatalogProduct) =>
  product.categoryLabel || CAT[product.category] || product.category;

function ProductSkeleton() {
  return (
    <div className="animate-pulse rounded-[1.6rem] border border-[#E0ECE7] bg-white p-3 shadow-[0_16px_45px_rgba(12,69,54,0.05)]">
      <div className="mb-4 rounded-[1.2rem] bg-[#E9F3EE]" style={{ aspectRatio: "1/1" }} />
      <div className="space-y-2 px-1 pb-2">
        <div className="h-2 w-16 rounded bg-[#E9F3EE]" />
        <div className="h-4 w-3/4 rounded bg-[#E9F3EE]" />
        <div className="h-4 w-1/2 rounded bg-[#E9F3EE]" />
      </div>
    </div>
  );
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function HeaderNav({ onNavigate }: { onNavigate?: () => void }) {
  const navClass =
    "text-[12px] font-medium text-[#415D52] transition-colors hover:text-[#068A5B]";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          scrollToSection("catalogo-shop");
          onNavigate?.();
        }}
        className={navClass}
      >
        Catálogo
      </button>
      <button
        type="button"
        onClick={() => {
          scrollToSection("para-empresas");
          onNavigate?.();
        }}
        className={navClass}
      >
        Para empresas
      </button>
      <button
        type="button"
        onClick={() => {
          scrollToSection("sobre-ideal-prime");
          onNavigate?.();
        }}
        className={navClass}
      >
        Sobre
      </button>
      <Link href="/desejos">
        <span onClick={onNavigate} className={`cursor-pointer ${navClass}`}>
          Solicitar produto
        </span>
      </Link>
    </>
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
        className="group h-full cursor-pointer overflow-hidden rounded-[1.55rem] border border-[#DCEAE4] bg-white p-3 shadow-[0_18px_55px_rgba(12,69,54,0.065)] transition-all duration-300 hover:-translate-y-1 hover:border-[#B8D9CA] hover:shadow-[0_24px_65px_rgba(12,69,54,0.11)]"
        style={{ fontFamily: SANS }}
      >
        <div
          className="relative overflow-hidden rounded-[1.15rem] bg-[#F7FAF8]"
          style={{ aspectRatio: "1/1" }}
        >
          {product.promoTag && stock && (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-[#068A5B] px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-white">
              {product.promoTag}
            </span>
          )}

          <ProductVisual
            src={product.imageUrl}
            alt={product.name}
            category={getCategoryLabel(product)}
            className="absolute inset-0"
            imageClassName="p-5 transition-transform duration-500 group-hover:scale-[1.045]"
          />
        </div>

        <div className="flex min-h-[14.5rem] flex-col px-1 pb-1 pt-4">
          <p className="text-[8px] font-semibold uppercase tracking-[0.25em] text-[#068A5B]">
            {getCategoryLabel(product)}
          </p>
          {product.brand && (
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8A9D94]">
              {product.brand}
            </p>
          )}
          <h3 className="mt-2 line-clamp-2 text-[0.98rem] font-bold leading-[1.26] text-[#12352B]">
            {product.name}
          </h3>
          {product.shortDescription && (
            <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[#71867D]">
              {product.shortDescription}
            </p>
          )}

          <div className="mt-auto pt-4">
            {pix ? (
              <div>
                <p className="text-lg font-bold tracking-[-0.04em] text-[#0C4536]">{fmt(pix)}</p>
                {card && installments > 1 && (
                  <p className="mt-0.5 text-[9px] font-medium text-[#5F7A6E]">
                    ou {installments}x de {fmt(card / installments)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm font-semibold text-[#0C4536]">Preço sob consulta</p>
            )}

            <div className="mt-3 flex items-center gap-2 text-[10px] text-[#6E8379]">
              <span className={`h-2 w-2 rounded-full ${stock ? "bg-[#0B9A66]" : "bg-[#C5A247]"}`} />
              {stock ? "Disponível" : "Consulte disponibilidade"}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#E7F0EC] pt-3 text-[10px] font-semibold text-[#12352B]">
              Ver produto
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

function Benefit({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E4F4ED] text-[#068A5B]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#12352B]">{title}</p>
        <p className="mt-1 max-w-[16rem] text-[11px] leading-relaxed text-[#70857B]">{description}</p>
      </div>
    </div>
  );
}

function FeatureChip({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ShoppingBag;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[1.1rem] border border-white/65 bg-white/80 px-4 py-3 shadow-[0_12px_32px_rgba(12,69,54,0.08)] backdrop-blur-md">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E4F4ED] text-[#0C6F4D]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-[#12352B]">{title}</p>
        <p className="mt-0.5 text-[9px] leading-relaxed text-[#6F837A]">{description}</p>
      </div>
    </div>
  );
}

function StepCard({
  number,
  icon: Icon,
  title,
  description,
}: {
  number: number;
  icon: typeof Building2;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-[1.5rem] border border-[#DCEAE4] bg-white p-6 shadow-[0_18px_45px_rgba(12,69,54,0.05)]">
      <div className="flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8F5EF] text-xs font-bold text-[#0C6F4D]">
          {number}
        </span>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2F8F5] text-[#0C6F4D]">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <h3 className="mt-5 text-base font-semibold text-[#12352B]">{title}</h3>
      <p className="mt-2 text-[11px] leading-relaxed text-[#71867D]">{description}</p>
    </div>
  );
}

export default function Marketplace() {
  const { data, isLoading } = trpc.marketplace.products.useQuery();
  const { data: featuredData, isLoading: isFeaturedLoading } = trpc.marketplace.featuredProducts.useQuery();
  const [location] = useLocation();
  const products = (data ?? []) as CatalogProduct[];
  const featuredProducts = (featuredData ?? []) as CatalogProduct[];
  const isFullCatalog = location === "/vitrine";

  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const shopProducts = useMemo(() => products.filter(isShopProduct), [products]);
  const homeProducts = useMemo(
    () => (featuredProducts.length > 0 ? featuredProducts : shopProducts.slice(0, 10)),
    [featuredProducts, shopProducts],
  );
  const pageProducts = isFullCatalog ? shopProducts : homeProducts;
  const showcaseProducts = useMemo(() => homeProducts.slice(0, 4), [homeProducts]);
  const categories = useMemo(
    () => Array.from(new Set(pageProducts.map(getCategoryLabel))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [pageProducts],
  );

  useEffect(() => {
    captureReferralFromLocation();
  }, []);

  useEffect(() => {
    const title = isFullCatalog
      ? "Catálogo de Produtos para Empresas | Ideal Prime"
      : "Ideal Prime | Produtos, Cotações e Pedidos para Empresas";
    const description = isFullCatalog
      ? "Explore o catálogo Ideal Prime com produtos para higiene, limpeza, descartáveis, EPI, utilidades e outras soluções para empresas."
      : "Ideal Prime: comércio e distribuição para empresas. Consulte produtos, organize cotações, compare valores e condições e faça pedidos em um só lugar.";
    const canonical = isFullCatalog
      ? "https://idealprimecomercio.com/vitrine"
      : "https://idealprimecomercio.com/";

    document.title = title;

    const ensureMeta = (selector: string, attrs: Record<string, string>) => {
      let element = document.head.querySelector<HTMLMetaElement>(selector);
      if (!element) {
        element = document.createElement("meta");
        document.head.appendChild(element);
      }
      Object.entries(attrs).forEach(([key, value]) => element?.setAttribute(key, value));
    };

    ensureMeta('meta[name="description"]', { name: "description", content: description });
    ensureMeta('meta[property="og:title"]', { property: "og:title", content: title });
    ensureMeta('meta[property="og:description"]', { property: "og:description", content: description });
    ensureMeta('meta[property="og:url"]', { property: "og:url", content: canonical });

    let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;
  }, [isFullCatalog]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return pageProducts.filter((product) => {
      const productCategory = getCategoryLabel(product);
      const byCategory = category ? productCategory === category : true;
      const bySearch = normalizedSearch
        ? `${product.name} ${product.brand ?? ""} ${product.shortDescription ?? ""} ${product.categoryLabel ?? ""} ${product.description ?? ""}`
            .toLowerCase()
            .includes(normalizedSearch)
        : true;
      return byCategory && bySearch;
    });
  }, [pageProducts, category, search]);

  const hasCatalog = pageProducts.length > 0;
  const hasResults = filteredProducts.length > 0;

  return (
    <div className="min-h-screen bg-[#FBFDFC] text-[#12352B]" style={{ fontFamily: SANS }}>
      <header className="sticky top-0 z-40 border-b border-[#E1ECE7]/90 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[5.2rem] max-w-[92rem] items-center justify-between gap-4 px-5 sm:px-7 lg:px-10 xl:px-14">
          <Link href="/">
            <div className="cursor-pointer">
              <BrandLogo className="w-[152px] sm:w-[185px]" />
            </div>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            <HeaderNav />
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => scrollToSection("catalogo-shop")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D9E7E1] bg-white text-[#466157] transition hover:border-[#A9CCBC] hover:text-[#068A5B]"
              aria-label="Buscar produtos"
            >
              <Search className="h-4 w-4" />
            </button>
            <Link href="/login">
              <span className="inline-flex cursor-pointer items-center rounded-full border border-[#BBD4C9] bg-white px-5 py-2.5 text-[11px] font-semibold text-[#12352B] transition-colors hover:border-[#068A5B] hover:text-[#068A5B]">
                Entrar
              </span>
            </Link>
            <Link href="/portal">
              <span className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#0C4536] px-5 py-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#068A5B]">
                Área da empresa <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((value) => !value)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#D5E8E0] bg-white text-[#12352B] md:hidden"
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-[#E1ECE7] bg-white px-5 py-5 md:hidden">
            <div className="flex flex-col gap-4">
              <HeaderNav onNavigate={() => setMobileMenuOpen(false)} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link href="/login">
                  <span onClick={() => setMobileMenuOpen(false)} className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#D5E8E0] bg-[#F7FBF9] px-3 py-3 text-xs font-semibold text-[#12352B]">
                    Entrar
                  </span>
                </Link>
                <Link href="/portal">
                  <span onClick={() => setMobileMenuOpen(false)} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#12352B] px-3 py-3 text-xs font-semibold text-white">
                    Área da empresa <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <section className="relative overflow-hidden border-b border-[#E1ECE7] bg-white">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[52%] bg-[radial-gradient(circle_at_65%_25%,rgba(6,138,91,0.14),transparent_42%),linear-gradient(135deg,rgba(244,250,247,0.2),rgba(230,242,236,0.9))] lg:block" />
        <div className="mx-auto grid max-w-[92rem] items-center gap-10 px-5 py-12 sm:px-7 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-16 xl:px-14 xl:py-20">
          <div className="relative z-10 max-w-2xl">
            <p className="text-[9px] font-semibold uppercase tracking-[0.34em] text-[#068A5B] sm:text-[10px]">
              Ideal Prime · Comércio e Distribuição
            </p>
            <h1
              className="mt-5 text-[#12352B]"
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(3rem, 6vw, 6.35rem)",
                fontWeight: 400,
                lineHeight: 0.9,
                letterSpacing: "-0.035em",
              }}
            >
              Produtos que
              <br />
              movimentam o
              <br />
              <span className="text-[#068A5B]">seu negócio.</span>
            </h1>
            <p className="mt-7 max-w-xl text-[0.98rem] leading-7 text-[#667D73] sm:text-[1.03rem]">
              Higiene, limpeza, descartáveis, utilidades e outras soluções para empresas que querem comprar melhor, repor com agilidade e manter a operação em movimento.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => scrollToSection("catalogo-shop")}
                className="inline-flex items-center gap-2 rounded-full bg-[#0C6F4D] px-6 py-3.5 text-[11px] font-semibold text-white transition-all hover:bg-[#0C4536] active:scale-[0.98]"
              >
                Explorar catálogo <ArrowRight className="h-4 w-4" />
              </button>
              <Link href="/empresa/cadastro">
                <span className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#BBD4C9] bg-white px-6 py-3.5 text-[11px] font-semibold text-[#12352B] transition-colors hover:border-[#068A5B] hover:text-[#068A5B]">
                  Comprar como empresa
                </span>
              </Link>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-2.5 text-[10px] text-[#61796E]">
                <Truck className="h-4 w-4 text-[#068A5B]" /> Entrega organizada
              </div>
              <div className="flex items-center gap-2.5 text-[10px] text-[#61796E]">
                <ShieldCheck className="h-4 w-4 text-[#068A5B]" /> Marcas selecionadas
              </div>
              <div className="flex items-center gap-2.5 text-[10px] text-[#61796E]">
                <Headphones className="h-4 w-4 text-[#068A5B]" /> Suporte comercial
              </div>
            </div>
          </div>

          <div className="relative min-h-[33rem] overflow-hidden rounded-[2.2rem] border border-[#D8E8E1] bg-[#EEF7F2] p-5 shadow-[0_28px_90px_rgba(12,69,54,0.12)] sm:p-7 lg:min-h-[38rem]">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `url(${brandPattern})`,
                backgroundPosition: "center",
                backgroundSize: "520px auto",
              }}
            />
            <div className="absolute -left-28 bottom-[-8rem] h-[28rem] w-[28rem] rounded-full bg-white/70 blur-sm" />
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-[#0C6F4D]/15" />

            <div className="relative grid h-full gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="relative flex min-h-[26rem] items-end justify-center pt-12 lg:min-h-[32rem]">
                {showcaseProducts.length > 0 ? (
                  <div className="relative h-[25rem] w-full max-w-[28rem] sm:h-[29rem] lg:h-[32rem]">
                    {showcaseProducts.map((product, index) => {
                      const placements = [
                        "left-[4%] top-[28%] z-20 w-[46%] rotate-[-2deg]",
                        "right-[0%] top-[12%] z-10 w-[43%] rotate-[2deg]",
                        "left-[26%] bottom-[0%] z-30 w-[48%]",
                        "right-[4%] bottom-[14%] z-20 w-[36%] rotate-[3deg]",
                      ];
                      return (
                        <div
                          key={product.id}
                          className={`absolute overflow-hidden rounded-[1.5rem] border border-white/80 bg-white shadow-[0_20px_55px_rgba(12,69,54,0.16)] ${placements[index] ?? placements[0]}`}
                          style={{ aspectRatio: "4/5" }}
                        >
                          <ProductVisual
                            src={product.imageUrl}
                            alt={product.name}
                            category={getCategoryLabel(product)}
                            className="absolute inset-0"
                            imageClassName="p-4 sm:p-5"
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-64 w-64 items-center justify-center rounded-full bg-white text-[#0C6F4D] shadow-[0_24px_65px_rgba(12,69,54,0.12)]">
                    <Boxes className="h-20 w-20" />
                  </div>
                )}
              </div>

              <div className="relative flex flex-col justify-center gap-3 pb-3 lg:pb-0">
                <div className="mb-2">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.26em] text-[#068A5B]">Soluções para empresas</p>
                  <h2 className="mt-2 text-2xl text-[#12352B] sm:text-3xl" style={{ fontFamily: SERIF, lineHeight: 1.05 }}>
                    Menos retrabalho. Mais controle para comprar melhor.
                  </h2>
                </div>
                <FeatureChip icon={ShoppingBag} title="Catálogo empresarial" description="Produtos e condições organizados para sua operação." />
                <FeatureChip icon={ClipboardList} title="Cotações sem complicação" description="Centralize necessidades e acompanhe cada solicitação." />
                <FeatureChip icon={BarChart3} title="Comparativo de valores" description="Visualize preços e condições de forma clara para decidir melhor." />
                <FeatureChip icon={PackageCheck} title="Pedidos em poucos passos" description="Da seleção à confirmação, com histórico em um só lugar." />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="sobre-ideal-prime" className="border-b border-[#DFECE6] bg-[#F2F8F5] py-8">
        <div className="mx-auto grid max-w-[92rem] gap-7 px-5 sm:grid-cols-2 sm:px-7 lg:grid-cols-4 lg:px-10 xl:px-14">
          <Benefit icon={Boxes} title="Mix para empresas" description="Variedade de produtos reunida em um único ambiente." />
          <Benefit icon={PackageCheck} title="Reposição simplificada" description="Mais agilidade para manter a operação em movimento." />
          <Benefit icon={Headphones} title="Atendimento comercial" description="Uma equipe próxima para necessidades específicas." />
          <Benefit icon={BarChart3} title="Compra com previsibilidade" description="Valores, condições e histórico para decisões mais seguras." />
        </div>
      </section>

      <main id="catalogo-shop" className="mx-auto max-w-[92rem] px-5 py-16 sm:px-7 lg:px-10 lg:py-20 xl:px-14">
        <div className="grid gap-7 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-[9px] font-semibold uppercase tracking-[0.34em] text-[#068A5B]">Nosso catálogo</p>
            <h2
              className="mt-4 max-w-3xl text-[#12352B]"
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(2.5rem, 4.7vw, 5rem)",
                fontWeight: 400,
                lineHeight: 0.96,
                letterSpacing: "-0.035em",
              }}
            >
              {isFullCatalog ? "Catálogo de produtos para empresas." : "Um catálogo pensado para o dia a dia das empresas."}
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[#6B8177] lg:justify-self-end">
            Encontre produtos de higiene, limpeza, descartáveis, EPI, utilidades e muito mais. Consulte disponibilidade, organize cotações e compre com mais clareza e agilidade.
          </p>
        </div>

        <div className="mt-9 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8DA39A]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar produtos, marcas ou categorias..."
              aria-label="Buscar produtos no catálogo"
              className="h-12 w-full rounded-xl border border-[#CFE1D9] bg-white pl-11 pr-4 text-sm text-[#12352B] shadow-[0_10px_30px_rgba(12,69,54,0.035)] outline-none transition placeholder:text-[#9CB0A7] focus:border-[#068A5B] focus:ring-4 focus:ring-[#068A5B]/5"
            />
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {[{ key: null, label: "Todos" }, ...categories.slice(0, 6).map((categoryName) => ({ key: categoryName, label: categoryName }))].map(({ key, label }) => (
                <button
                  type="button"
                  key={String(key)}
                  onClick={() => setCategory(key)}
                  className={`rounded-full px-4 py-2.5 text-[9px] font-semibold transition-colors ${
                    category === key
                      ? "bg-[#12352B] text-white"
                      : "border border-[#D8E7E0] bg-white text-[#647B70] hover:border-[#A9CCBC] hover:text-[#068A5B]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!isFullCatalog && (
          <div className="mt-6 flex flex-col gap-3 rounded-[1.2rem] border border-[#DCE9E3] bg-[#F8FBF9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#068A5B]">Seleção Ideal Prime</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#71867D]">
                Mostramos uma seleção inicial. O catálogo completo continua disponível com mais produtos, preços e opções para cotação.
              </p>
            </div>
            <Link href="/vitrine">
              <span className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[#BFD7CC] bg-white px-4 py-2.5 text-[10px] font-semibold text-[#12352B] transition hover:border-[#068A5B] hover:text-[#068A5B]">
                Ver catálogo completo <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
        )}

        <div className="mt-8">
          {isLoading || isFeaturedLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <ProductSkeleton key={index} />
              ))}
            </div>
          ) : !hasCatalog ? (
            <div className="grid gap-6 rounded-[2rem] border border-[#D5E8E0] bg-white p-8 shadow-[0_20px_60px_rgba(12,69,54,0.06)] sm:grid-cols-[0.95fr_1.05fr] sm:p-12">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#068A5B]">Catálogo Prime</p>
                <h3 className="mt-3 text-3xl text-[#12352B]" style={{ fontFamily: SERIF, lineHeight: 1.05 }}>
                  O catálogo está sendo preparado.
                </h3>
              </div>
              <div className="flex flex-col justify-between gap-7 sm:border-l sm:border-[#E3EFE9] sm:pl-10">
                <p className="max-w-md text-sm leading-relaxed text-[#6C8278]">
                  Ainda não há produtos públicos visíveis. A equipe pode publicar os itens cadastrados no painel administrativo para exibir a seleção nesta página.
                </p>
                <Link href="/desejos">
                  <span className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full bg-[#12352B] px-5 py-3 text-[10px] font-semibold text-white transition-colors hover:bg-[#068A5B]">
                    Solicitar um produto <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </div>
            </div>
          ) : !hasResults ? (
            <div className="rounded-[2rem] border border-[#D5E8E0] bg-white p-8 text-center shadow-[0_20px_60px_rgba(12,69,54,0.05)] sm:p-12">
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#068A5B]">Busca refinada</p>
              <h3 className="mt-3 text-3xl text-[#12352B]" style={{ fontFamily: SERIF, lineHeight: 1.05 }}>
                Nenhum produto encontrado com esse filtro.
              </h3>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#6C8278]">
                Ajuste o termo de busca ou selecione outra categoria para visualizar os itens publicados no catálogo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </main>

      <section id="para-empresas" className="border-y border-[#DDEAE4] bg-[#F6FAF8] py-16 lg:py-20">
        <div className="mx-auto max-w-[92rem] px-5 sm:px-7 lg:px-10 xl:px-14">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-end">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#068A5B]">Para empresas</p>
              <h2
                className="mt-4 max-w-3xl text-[#12352B]"
                style={{ fontFamily: SERIF, fontSize: "clamp(2.45rem, 4.4vw, 4.8rem)", lineHeight: 0.96, letterSpacing: "-0.035em" }}
              >
                Comprar para sua empresa ficou mais simples.
              </h2>
            </div>
            <div className="lg:justify-self-end">
              <p className="max-w-xl text-sm leading-7 text-[#6B8177]">
                Centralize necessidades, organize cotações, compare valores e condições e transforme uma cotação aprovada em pedido sem planilhas paralelas nem retrabalho.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-medium text-[#526B60]">
                <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#068A5B]" /> Histórico organizado</span>
                <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#068A5B]" /> Condições centralizadas</span>
                <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#068A5B]" /> Menos retrabalho</span>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_0.85fr]">
            <StepCard number={1} icon={Building2} title="Cadastre sua empresa" description="Informe os dados da empresa e crie o acesso empresarial de forma simples e segura." />
            <StepCard number={2} icon={Search} title="Consulte o catálogo" description="Encontre produtos, veja disponibilidade e reúna os itens que sua operação precisa." />
            <StepCard number={3} icon={FileText} title="Cote e faça pedidos" description="Envie sua seleção, acompanhe condições e avance para o pedido com tudo registrado." />

            <div className="flex flex-col justify-between rounded-[1.5rem] bg-[#0C4536] p-6 text-white shadow-[0_24px_60px_rgba(12,69,54,0.18)]">
              <div>
                <Sparkles className="h-6 w-6 text-[#B9F1D4]" />
                <p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.26em] text-[#B9F1D4]">Experiência Prime</p>
                <h3 className="mt-2 text-2xl" style={{ fontFamily: SERIF, lineHeight: 1.02 }}>
                  Tudo em um único fluxo comercial.
                </h3>
                <p className="mt-3 text-[11px] leading-relaxed text-white/70">
                  Produtos, cotações, comparativos, pedidos e histórico para sua empresa comprar com mais clareza.
                </p>
              </div>
              <Link href="/empresa/cadastro">
                <span className="mt-7 inline-flex w-full cursor-pointer items-center justify-between rounded-full bg-white px-5 py-3 text-[10px] font-semibold text-[#12352B] transition hover:bg-[#EAF6F0]">
                  Criar acesso empresarial <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-b border-[#DCE9E3] bg-[#EFF7F3] py-14 lg:py-16">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-[#068A5B]/10" />
        <div className="mx-auto grid max-w-[92rem] items-center gap-7 px-5 sm:px-7 lg:grid-cols-[1fr_0.9fr_auto] lg:px-10 xl:px-14">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#068A5B]">Não encontrou o produto?</p>
            <h2 className="mt-3 max-w-xl text-4xl text-[#12352B] sm:text-5xl" style={{ fontFamily: SERIF, lineHeight: 0.98, letterSpacing: "-0.03em" }}>
              Não encontrou o produto que precisa?
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[#6B8177]">
            Conte para a Ideal Prime o que sua empresa procura. Nossa equipe comercial analisa a necessidade e retorna com opções alinhadas à sua operação.
          </p>
          <Link href="/desejos">
            <span className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-[#8EBDA9] bg-white px-6 py-3.5 text-[11px] font-semibold text-[#12352B] transition hover:border-[#068A5B] hover:text-[#068A5B]">
              Solicitar um produto <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </section>

      <footer className="prime-pattern-surface py-12 text-white">
        <div className="mx-auto max-w-[92rem] px-5 sm:px-7 lg:px-10 xl:px-14">
          <div className="grid gap-10 border-b border-white/15 pb-10 md:grid-cols-[1.35fr_0.8fr_0.8fr_1fr]">
            <div>
              <BrandLogo variant="white" compact className="w-[190px]" />
              <p className="mt-5 max-w-sm text-xs leading-6 text-white/65">
                Produtos e soluções para empresas comprarem com mais clareza, agilidade e organização.
              </p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/50">Navegação</p>
              <div className="mt-4 flex flex-col gap-3 text-xs text-white/75">
                <button type="button" onClick={() => scrollToSection("catalogo-shop")} className="w-fit hover:text-white">Catálogo</button>
                <button type="button" onClick={() => scrollToSection("para-empresas")} className="w-fit hover:text-white">Para empresas</button>
                <Link href="/desejos"><span className="cursor-pointer hover:text-white">Solicitar produto</span></Link>
              </div>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/50">Acessos</p>
              <div className="mt-4 flex flex-col gap-3 text-xs text-white/75">
                <Link href="/portal"><span className="cursor-pointer hover:text-white">Área da empresa</span></Link>
                <Link href="/empresa/cadastro"><span className="cursor-pointer hover:text-white">Cadastro empresarial</span></Link>
                <Link href="/login"><span className="cursor-pointer hover:text-white">Acesso da equipe</span></Link>
              </div>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/50">Ideal Prime</p>
              <p className="mt-4 text-xl leading-tight text-white" style={{ fontFamily: SERIF }}>
                Mais que distribuição, parceria para o seu negócio.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-6 text-[10px] text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Ideal Prime. Todos os direitos reservados.</p>
            <p>Comércio e distribuição para empresas.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
