import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { captureReferralFromLocation } from "@/lib/referral";
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  UserCog,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ProductVisual } from "@/components/ProductVisual";
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
    <div className="animate-pulse">
      <div className="mb-4 rounded-3xl bg-[#E9F3EE]" style={{ aspectRatio: "4/5" }} />
      <div className="space-y-2">
        <div className="h-2 w-16 rounded bg-[#E9F3EE]" />
        <div className="h-4 w-3/4 rounded bg-[#E9F3EE]" />
        <div className="h-4 w-1/2 rounded bg-[#E9F3EE]" />
      </div>
    </div>
  );
}

function HeaderNav({ onNavigate }: { onNavigate?: () => void }) {
  const navClass =
    "text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5B7369] transition-colors hover:text-[#068A5B]";

  return (
    <>
      <button
        onClick={() => {
          document.getElementById("catalogo-shop")?.scrollIntoView({ behavior: "smooth" });
          onNavigate?.();
        }}
        className={navClass}
      >
        Catálogo
      </button>
      <button
        onClick={() => {
          document.getElementById("experiencia-prime")?.scrollIntoView({ behavior: "smooth" });
          onNavigate?.();
        }}
        className={navClass}
      >
        A experiência Prime
      </button>
      <Link href="/desejos">
        <span onClick={onNavigate} className={`cursor-pointer ${navClass}`}>
          Solicitar produto
        </span>
      </Link>
      <Link href="/empresa/cadastro">
        <span onClick={onNavigate} className={`cursor-pointer ${navClass}`}>
          Quero comprar como empresa
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
        className={`group cursor-pointer ${!stock ? "opacity-80" : ""}`}
        style={{ fontFamily: SANS }}
      >
        <div
          className="relative mb-4 overflow-hidden rounded-[1.6rem] border border-[#D5E8E0] bg-white shadow-[0_12px_40px_rgba(12,69,54,0.06)]"
          style={{ aspectRatio: "4/5" }}
        >
          {product.promoTag && stock && (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-[#068A5B] px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-white">
              {product.promoTag}
            </span>
          )}

          <ProductVisual
            src={product.imageUrl}
            alt={product.name}
            category={getCategoryLabel(product)}
            className="absolute inset-0"
            imageClassName="p-5 transition-transform duration-500 group-hover:scale-[1.05]"
          />

          {stock ? (
            <div className="absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-300 group-hover:translate-y-0">
              <div className="flex items-center justify-center gap-2 bg-[#0C4536] py-3 text-center text-[9px] font-semibold uppercase tracking-[0.22em] text-white">
                Ver produto <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-white/72 backdrop-blur-[1px]">
              <span className="rounded-full border border-[#C8DED5] bg-white px-3 py-1.5 text-[9px] uppercase tracking-[0.22em] text-[#5E776D]">
                Disponível sob consulta
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2 px-1">
          <p className="text-[8px] font-semibold uppercase tracking-[0.26em] text-[#068A5B]">
            {getCategoryLabel(product)}
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
            <p className="pt-1 text-xs font-medium text-[#81948B]">Preço sob consulta</p>
          )}
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#8CA096]">
            {stock ? `${product.stockQuantity} disponível(is)` : "Sob consulta comercial"}
          </p>
        </div>
      </article>
    </Link>
  );
}

function Benefit({ icon: Icon, title, description }: { icon: typeof ShieldCheck; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#A8D8C3] bg-white/10 text-[#B9F1D4]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white">{title}</p>
        <p className="mt-1 max-w-[17rem] text-xs leading-relaxed text-white/70">{description}</p>
      </div>
    </div>
  );
}

export default function Marketplace() {
  const { data, isLoading } = trpc.marketplace.products.useQuery();
  const products = (data ?? []) as CatalogProduct[];

  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const shopProducts = useMemo(() => products.filter(isShopProduct), [products]);
  const inStockProducts = useMemo(() => shopProducts.filter(hasStock), [shopProducts]);
  const categories = useMemo(
    () => Array.from(new Set(shopProducts.map(getCategoryLabel))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [shopProducts],
  );

  useEffect(() => {
    captureReferralFromLocation();
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return shopProducts.filter((product) => {
      const productCategory = getCategoryLabel(product);
      const byCategory = category ? productCategory === category : true;
      const bySearch = normalizedSearch
        ? `${product.name} ${product.shortDescription ?? ""} ${product.categoryLabel ?? ""} ${product.description ?? ""}`
            .toLowerCase()
            .includes(normalizedSearch)
        : true;
      return byCategory && bySearch;
    });
  }, [shopProducts, category, search]);

  const hasCatalog = shopProducts.length > 0;
  const hasResults = filteredProducts.length > 0;

  return (
    <div className="min-h-screen bg-[#F7FBF9] text-[#12352B]" style={{ fontFamily: SANS }}>
      <header className="sticky top-0 z-40 border-b border-[#D5E8E0]/90 bg-[#F7FBF9]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[5.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-16">
          <Link href="/vitrine">
            <div className="cursor-pointer">
              <BrandLogo className="w-[150px] sm:w-[190px]" />
            </div>
          </Link>

          <nav className="hidden items-center gap-6 xl:flex">
            <HeaderNav />
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/login">
              <span className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#D5E8E0] bg-white px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#12352B] transition-colors hover:border-[#9ED2BC] hover:text-[#068A5B]">
                <UserCog className="h-3.5 w-3.5" /> Acesso da equipe
              </span>
            </Link>
            <Link href="/portal">
              <span className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#12352B] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:bg-[#068A5B]">
                <Store className="h-3.5 w-3.5" /> Portal da empresa
              </span>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((value) => !value)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#D5E8E0] bg-white text-[#12352B] lg:hidden"
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-[#E1ECE7] bg-white px-4 py-4 lg:hidden">
            <div className="flex flex-col gap-3">
              <HeaderNav onNavigate={() => setMobileMenuOpen(false)} />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Link href="/login">
                  <span onClick={() => setMobileMenuOpen(false)} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D5E8E0] bg-[#F7FBF9] px-4 py-3 text-xs font-semibold text-[#12352B]">
                    <UserCog className="h-4 w-4" /> Acesso da equipe
                  </span>
                </Link>
                <Link href="/portal">
                  <span onClick={() => setMobileMenuOpen(false)} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#12352B] px-4 py-3 text-xs font-semibold text-white">
                    <Store className="h-4 w-4" /> Portal da empresa
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <section className="overflow-hidden border-b border-[#D5E8E0] bg-white">
        <div className="mx-auto grid max-w-7xl items-stretch gap-8 px-6 py-8 lg:grid-cols-[0.86fr_1.14fr] lg:px-16 lg:py-12">
          <div className="flex flex-col justify-center py-4 lg:py-8">
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
                fontSize: "clamp(2.5rem, 5vw, 5rem)",
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
              Catálogo empresarial para higiene, limpeza, descartáveis, utilidades e novas categorias, com relacionamento comercial, pedido, cotação e recompra organizada.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => document.getElementById("catalogo-shop")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-2 rounded-full bg-[#068A5B] px-6 py-3.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white transition-all hover:bg-[#0C4536] active:scale-[0.97]"
              >
                Explorar produtos <ArrowRight className="h-4 w-4" />
              </button>
              <Link href="/empresa/cadastro">
                <span className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#C8DED5] bg-white px-6 py-3.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#12352B] transition-colors hover:border-[#068A5B] hover:text-[#068A5B]">
                  Comprar como empresa
                </span>
              </Link>
            </div>

            <div className="mt-10 grid max-w-xl grid-cols-1 gap-4 border-t border-[#E3EFE9] pt-5 sm:grid-cols-3 sm:gap-5">
              <div className="rounded-2xl bg-[#F7FBF9] p-4 sm:bg-transparent sm:p-0">
                <p className="text-2xl font-bold tracking-[-0.04em] text-[#12352B]">{shopProducts.length}</p>
                <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[#81948B]">Produtos publicados</p>
              </div>
              <div className="rounded-2xl bg-[#F7FBF9] p-4 sm:bg-transparent sm:p-0">
                <p className="text-2xl font-bold tracking-[-0.04em] text-[#12352B]">{inStockProducts.length}</p>
                <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[#81948B]">Disponíveis agora</p>
              </div>
              <div className="rounded-2xl bg-[#F7FBF9] p-4 sm:bg-transparent sm:p-0">
                <p className="text-2xl font-bold tracking-[-0.04em] text-[#12352B]">{categories.length}</p>
                <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[#81948B]">Categorias Prime</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] bg-[#0C4536] shadow-[0_30px_80px_rgba(12,69,54,0.22)] min-h-[24rem] lg:min-h-[34rem]">
            <div
              className="absolute inset-0 opacity-95"
              style={{
                backgroundImage: `linear-gradient(135deg, rgba(6,138,91,0.92), rgba(12,69,54,0.98)), url(${brandPattern})`,
                backgroundPosition: "center",
                backgroundSize: "cover, 520px auto",
              }}
            />
            <div className="absolute -right-24 -top-20 h-80 w-80 rounded-full border border-white/15" />
            <div className="absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full border border-[#9ADCF2]/20" />
            <div className="relative flex h-full min-h-[24rem] flex-col justify-between p-7 sm:p-10 lg:min-h-[34rem]">
              <div className="flex items-start justify-between gap-6">
                <BrandLogo variant="white" compact className="w-[170px] sm:w-[210px]" />
                <span className="rounded-full border border-white/20 px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[0.22em] text-white/75">
                  Coleção Prime
                </span>
              </div>

              <div className="max-w-lg">
                <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.32em] text-[#B9F1D4]">Curadoria comercial</p>
                <h2 className="prime-display text-[2.2rem] leading-[0.98] text-white sm:text-[3.5rem] lg:text-[4.1rem]">
                  A sua próxima escolha começa aqui.
                </h2>
                <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/75">
                  Um canal B2B para consultar produtos, solicitar itens, receber cotações e acompanhar pedidos com clareza operacional.
                </p>
              </div>

              <div className="grid gap-3 border-t border-white/15 pt-5 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/70 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p>Comércio e distribuição</p>
                  <p className="mt-1 text-white/45">Acesso para empresa e equipe administrativa</p>
                </div>
                <div className="flex items-center gap-2 text-[#B9F1D4]">
                  Ver catálogo <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="experiencia-prime" className="bg-[#0C4536] py-9 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 sm:grid-cols-3 lg:px-16">
          <Benefit icon={ShieldCheck} title="Compra segura" description="Informações claras, preços comerciais e histórico organizado para sua operação." />
          <Benefit icon={Truck} title="Disponibilidade real" description="Catálogo, estoque e fila FIFO acompanhados para decisões mais consistentes." />
          <Benefit icon={Sparkles} title="Atendimento Prime" description="Relacionamento comercial próximo, com experiência empresarial mais elegante e eficiente." />
        </div>
      </section>

      <section className="border-b border-[#D5E8E0] bg-[#F4FAF7] py-12">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 lg:grid-cols-2 lg:px-16">
          <div className="rounded-[1.7rem] border border-[#D7E8E1] bg-white p-6 shadow-[0_18px_50px_rgba(12,69,54,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F7F1] text-[#068A5B]">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#068A5B]">Área da empresa</p>
                <h3 className="mt-1 text-xl font-bold text-[#12352B]">Portal empresarial</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[#6C8278]">
              A empresa consulta catálogo autorizado, solicita cotações, acompanha pedidos e visualiza o histórico comercial em um único lugar.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/portal">
                <span className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#068A5B] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-[#0C4536]">
                  Entrar no portal <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
              <Link href="/empresa/cadastro">
                <span className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#D5E8E0] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#12352B] transition hover:border-[#068A5B] hover:text-[#068A5B]">
                  Solicitar cadastro
                </span>
              </Link>
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-[#D7E8E1] bg-white p-6 shadow-[0_18px_50px_rgba(12,69,54,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F6FC] text-[#098EC7]">
                <UserCog className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#098EC7]">Área interna</p>
                <h3 className="mt-1 text-xl font-bold text-[#12352B]">Acesso da equipe</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[#6C8278]">
              Administradores, vendedores e equipe operacional entram por aqui para acessar dashboard, catálogo, estoque, pedidos, clientes e financeiro.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login">
                <span className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#12352B] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-[#098EC7]">
                  Fazer login <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </div>
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
              Explore o catálogo público da Ideal Prime. Quando um item não tiver preço ou estoque imediato, ele continua disponível para consulta comercial.
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
                className="h-11 w-full rounded-full border border-[#C8DED5] bg-white pl-9 pr-3 text-sm text-[#12352B] outline-none transition-colors placeholder:text-[#9CB5A9] focus:border-[#068A5B] sm:w-72"
              />
            </div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#81948B]">{filteredProducts.length} item(ns) visíveis</p>
          </div>
        </div>

        {categories.length > 1 && (
          <div className="mb-10 flex flex-wrap gap-2 border-y border-[#E3EFE9] py-4">
            {[{ key: null, label: "Todos" }, ...categories.map((categoryName) => ({ key: categoryName, label: categoryName }))].map(({ key, label }) => (
              <button
                key={String(key)}
                onClick={() => setCategory(key)}
                className={`rounded-full px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.2em] transition-colors ${
                  category === key
                    ? "bg-[#12352B] text-white"
                    : "border border-[#E0ECE7] bg-white text-[#6C8278] hover:border-[#C8DED5] hover:text-[#068A5B]"
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
        ) : !hasCatalog ? (
          <div className="grid gap-6 rounded-[2rem] border border-[#D5E8E0] bg-white p-8 shadow-[0_20px_60px_rgba(12,69,54,0.06)] sm:grid-cols-[0.95fr_1.05fr] sm:p-12">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#068A5B]">Catálogo Prime</p>
              <h3 className="mt-3 text-3xl text-[#12352B]" style={{ fontFamily: SERIF, fontWeight: 800, lineHeight: 1.05 }}>
                Estamos prontos para popular o catálogo.
              </h3>
            </div>
            <div className="flex flex-col justify-between gap-7 sm:border-l sm:border-[#E3EFE9] sm:pl-10">
              <p className="max-w-md text-sm leading-relaxed text-[#6C8278]">
                Ainda não há produtos públicos visíveis. Faça a carga do Catálogo Mestre ou publique os itens cadastrados no painel administrativo para exibir a seleção nesta página.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/login">
                  <span className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full bg-[#12352B] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#068A5B]">
                    Acesso da equipe <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
                <Link href="/desejos">
                  <span className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-[#068A5B] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#068A5B] transition-colors hover:bg-[#068A5B] hover:text-white">
                    Registrar interesse <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        ) : !hasResults ? (
          <div className="rounded-[2rem] border border-[#D5E8E0] bg-white p-8 text-center shadow-[0_20px_60px_rgba(12,69,54,0.05)] sm:p-12">
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#068A5B]">Busca refinada</p>
            <h3 className="mt-3 text-3xl text-[#12352B]" style={{ fontFamily: SERIF, fontWeight: 800, lineHeight: 1.05 }}>
              Nenhum produto encontrado com esse filtro.
            </h3>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#6C8278]">
              Ajuste o termo de busca ou selecione outra categoria para visualizar os itens publicados no catálogo.
            </p>
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
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#068A5B]">Relacionamento Prime</p>
            <h2 className="mt-3 max-w-2xl text-3xl text-[#12352B] sm:text-4xl" style={{ fontFamily: SERIF, fontWeight: 800, lineHeight: 1.05 }}>
              Não encontrou o que procurava?
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#6C8278]">
              Deixe sua demanda registrada. A equipe Ideal Prime acompanha oportunidades e entra em contato quando encontrar uma opção alinhada ao que você busca.
            </p>
          </div>
          <div className="flex lg:justify-end">
            <Link href="/desejos">
              <span className="inline-flex cursor-pointer items-center gap-3 rounded-full bg-[#068A5B] px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:bg-[#0C4536]">
                Criar lista de desejos <Heart className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="prime-pattern-surface border-t border-[#0C6D4E] py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 lg:flex-row lg:px-16">
          <BrandLogo variant="white" compact />
          <nav className="flex flex-wrap items-center justify-center gap-5 text-[10px] uppercase tracking-[0.22em] text-white/70">
            <button onClick={() => document.getElementById("catalogo-shop")?.scrollIntoView({ behavior: "smooth" })} className="transition-colors hover:text-white">
              Catálogo
            </button>
            <button onClick={() => document.getElementById("experiencia-prime")?.scrollIntoView({ behavior: "smooth" })} className="transition-colors hover:text-white">
              A experiência Prime
            </button>
            <Link href="/portal">
              <span className="cursor-pointer transition-colors hover:text-white">Portal da empresa</span>
            </Link>
            <Link href="/login">
              <span className="cursor-pointer transition-colors hover:text-white">Acesso da equipe</span>
            </Link>
          </nav>
          <p className="text-[10px] text-white/45">© {new Date().getFullYear()} Ideal Prime</p>
        </div>
      </footer>
    </div>
  );
}
