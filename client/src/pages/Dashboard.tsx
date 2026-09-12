import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  DollarSign,
  FileText,
  Heart,
  Package,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  Truck,
  UserRoundCheck,
  UsersRound,
  Warehouse,
  Zap,
} from "lucide-react";

type KpiProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  tone?: "green" | "blue" | "amber" | "slate" | "red";
  href?: string;
};

const toneClass: Record<NonNullable<KpiProps["tone"]>, string> = {
  green: "bg-[#E8F7F1] text-[#068A5B] ring-[#B9E6D3]",
  blue: "bg-[#E8F6FC] text-[#098EC7] ring-[#B7DFF0]",
  amber: "bg-[#FFF7E6] text-[#A66A00] ring-[#F0D7A0]",
  slate: "bg-[#EFF4F2] text-[#41675A] ring-[#D6E2DD]",
  red: "bg-[#FFF0EE] text-[#B42318] ring-[#F0C3BD]",
};

function KpiCard({ title, value, subtitle, icon: Icon, tone = "green", href }: KpiProps) {
  const body = (
    <div className={`group relative h-full rounded-2xl border border-[#D6E6DF] bg-white p-5 shadow-[0_12px_36px_rgba(12,69,54,0.05)] transition-all ${href ? "hover:-translate-y-0.5 hover:border-[#9ED2BC] hover:shadow-[0_18px_45px_rgba(12,69,54,0.09)]" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${toneClass[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {href && <ArrowRight className="h-4 w-4 text-[#8EA69D] transition-transform group-hover:translate-x-0.5" />}
      </div>
      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B8278]">{title}</p>
      <p className="mt-1 text-2xl font-bold tracking-[-0.04em] text-[#12352B] sm:text-[1.75rem]">{value}</p>
      {subtitle && <p className="mt-1.5 text-xs leading-relaxed text-[#71877E]">{subtitle}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Section({ title, subtitle, icon: Icon, children, action }: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#D6E6DF] bg-white shadow-[0_12px_36px_rgba(12,69,54,0.04)]">
      <header className="flex items-center justify-between gap-4 border-b border-[#E2EEE9] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ECF8F3] text-[#068A5B]">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#12352B]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-[#71877E]">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function StatusLine({ label, value, tone = "green" }: { label: string; value: string | number; tone?: KpiProps["tone"] }) {
  const dot: Record<string, string> = { green: "bg-[#068A5B]", blue: "bg-[#098EC7]", amber: "bg-[#D89416]", red: "bg-[#B42318]", slate: "bg-[#71877E]" };
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E2EEE9] bg-[#FBFDFC] px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot[tone ?? "green"]}`} />
        <span className="truncate text-sm font-medium text-[#41675A]">{label}</span>
      </div>
      <span className="shrink-0 text-sm font-bold text-[#12352B]">{value}</span>
    </div>
  );
}

function MiniBar({ label, value, max, tone = "green" }: { label: string; value: number; max: number; tone?: "green" | "blue" | "amber" | "red" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const fill = { green: "bg-[#068A5B]", blue: "bg-[#098EC7]", amber: "bg-[#D89416]", red: "bg-[#B42318]" }[tone];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-[#61796F]">{label}</span>
        <span className="font-bold text-[#12352B]">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#EDF4F1]">
        <div className={`h-full rounded-full transition-all duration-700 ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, error, refetch } = trpc.dashboard.useQuery();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1500px] space-y-6 p-1 sm:p-2">
        <Skeleton className="h-48 rounded-3xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
        <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[460px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-white p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50"><AlertCircle className="h-8 w-8 text-red-500" /></div>
        <h2 className="text-lg font-bold text-[#12352B]">Não foi possível carregar o painel</h2>
        <p className="max-w-lg text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-xl bg-[#068A5B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0C6549]"><RefreshCcw className="h-4 w-4" /> Tentar novamente</button>
      </div>
    );
  }

  if (!data) return null;
  const d = data as any;
  const e = d.enterprise ?? {};
  const fmtBrl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtInt = (v: number) => Number(v || 0).toLocaleString("pt-BR");

  const totalProducts = Number(d.totalProducts ?? 0);
  const activeProducts = Number(d.activeProducts ?? 0);
  const publishedProducts = Number(e.publishedProducts ?? 0);
  const b2bProducts = Number(e.b2bProducts ?? 0);
  const lowStock = Number(e.lowStockProducts ?? 0);
  const outOfStock = Number(e.outOfStockProducts ?? 0);
  const retailRevenue = Number(d.faturamentoConfirmado ?? 0);
  const b2bRevenue = Number(e.b2bRevenue ?? 0);
  const consolidatedRevenue = retailRevenue + b2bRevenue;
  const recentSims = (d.recentSimulations ?? []) as any[];
  const totalSims = Number(d.totalSimulations ?? 0);
  const healthyCount = Number(d.healthyCount ?? 0);
  const attentionCount = Number(d.attentionCount ?? 0);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-1 sm:p-2">
      <section className="relative overflow-hidden rounded-3xl bg-[#0C4536] px-6 py-7 text-white shadow-[0_24px_70px_rgba(12,69,54,0.18)] sm:px-8 sm:py-8 lg:px-10">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/10" />
        <div className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-[#098EC7]/10 blur-2xl" />
        <div className="relative grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-10 bg-[#9ADCF2]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#B9F1D4]">Central de operação empresarial</span>
            </div>
            <h1 className="prime-display max-w-3xl text-4xl leading-[0.98] sm:text-5xl">Ideal Prime em uma única visão.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70">
              Catálogo, empresas, estoque FIFO, cotações, pedidos, fiscal e relacionamento comercial reunidos para conduzir a operação B2B sem perder o controle do detalhe.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/b2b-admin"><span className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#0C4536] transition hover:bg-[#E9F7F1]"><Building2 className="h-4 w-4" /> Gestão B2B</span></Link>
              <Link href="/produtos"><span className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10"><Package className="h-4 w-4" /> Catálogo</span></Link>
              <Link href="/fila-estoque"><span className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10"><Boxes className="h-4 w-4" /> Fila FIFO</span></Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/55">Empresas aprovadas</p>
              <p className="mt-2 text-2xl font-bold">{fmtInt(e.businessApproved)}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/55">Pedidos B2B abertos</p>
              <p className="mt-2 text-2xl font-bold">{fmtInt(e.b2bOrdersOpen)}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/55">Cotações aguardando</p>
              <p className="mt-2 text-2xl font-bold">{fmtInt(e.quotesPending)}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/55">Fila FIFO</p>
              <p className="mt-2 text-2xl font-bold">{fmtInt(e.fifoWaiting)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <KpiCard title="Faturamento confirmado" value={fmtBrl(consolidatedRevenue)} subtitle={`B2B ${fmtBrl(b2bRevenue)} · varejo ${fmtBrl(retailRevenue)}`} icon={DollarSign} tone="green" href="/pedidos" />
        <KpiCard title="Valor em estoque" value={fmtBrl(e.inventoryValue)} subtitle={`${fmtInt(activeProducts)} produtos ativos`} icon={Warehouse} tone="blue" href="/estoque" />
        <KpiCard title="Empresas B2B" value={fmtInt(e.businessTotal)} subtitle={`${fmtInt(e.businessPending)} aguardando análise`} icon={Building2} tone="green" href="/b2b-admin" />
        <KpiCard title="Pedidos B2B" value={fmtInt(e.b2bOrdersTotal)} subtitle={`${fmtInt(e.b2bOrdersPaid)} com pagamento confirmado`} icon={ShoppingCart} tone="blue" href="/b2b-admin" />
        <KpiCard title="Estoque em atenção" value={fmtInt(lowStock + outOfStock)} subtitle={`${fmtInt(lowStock)} baixo · ${fmtInt(outOfStock)} zerado`} icon={AlertTriangle} tone={lowStock + outOfStock > 0 ? "amber" : "slate"} href="/estoque" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Operação comercial B2B" subtitle="Empresas, cotações, reservas e pedidos" icon={Building2} action={<Link href="/b2b-admin"><span className="cursor-pointer text-xs font-bold text-[#068A5B] hover:underline">Abrir gestão →</span></Link>}>
          <div className="space-y-3">
            <StatusLine label="Empresas aprovadas" value={fmtInt(e.businessApproved)} tone="green" />
            <StatusLine label="Cadastros pendentes" value={fmtInt(e.businessPending)} tone={e.businessPending > 0 ? "amber" : "slate"} />
            <StatusLine label="Cotações pendentes" value={fmtInt(e.quotesPending)} tone={e.quotesPending > 0 ? "blue" : "slate"} />
            <StatusLine label="Unidades reservadas" value={fmtInt(e.activeReservationQty)} tone="blue" />
            <StatusLine label="Pedidos ainda em operação" value={fmtInt(e.b2bOrdersOpen)} tone="green" />
          </div>
        </Section>

        <Section title="Catálogo e estoque" subtitle="Disponibilidade, publicação e canal empresarial" icon={Boxes} action={<Link href="/produtos"><span className="cursor-pointer text-xs font-bold text-[#068A5B] hover:underline">Gerenciar →</span></Link>}>
          {totalProducts === 0 ? (
            <div className="py-8 text-center text-sm text-[#71877E]">Importe o Catálogo Mestre Ideal Prime para iniciar os indicadores.</div>
          ) : (
            <div className="space-y-5">
              <MiniBar label="Produtos ativos" value={activeProducts} max={Math.max(totalProducts, 1)} tone="green" />
              <MiniBar label="Publicados na vitrine" value={publishedProducts} max={Math.max(totalProducts, 1)} tone="blue" />
              <MiniBar label="Habilitados para B2B" value={b2bProducts} max={Math.max(totalProducts, 1)} tone="green" />
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-xl bg-[#FFF7E6] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#91600A]">Baixo estoque</p><p className="mt-1 text-2xl font-bold text-[#6B4C13]">{fmtInt(lowStock)}</p></div>
                <div className="rounded-xl bg-[#FFF0EE] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A3382E]">Sem estoque</p><p className="mt-1 text-2xl font-bold text-[#7E281F]">{fmtInt(outOfStock)}</p></div>
              </div>
            </div>
          )}
        </Section>

        <Section title="Fiscal e conformidade" subtitle="Visão de notas fiscais e pendências" icon={ReceiptText} action={<Link href="/notas-fiscais"><span className="cursor-pointer text-xs font-bold text-[#068A5B] hover:underline">Abrir fiscal →</span></Link>}>
          <div className="space-y-3">
            <StatusLine label="Notas autorizadas" value={fmtInt(e.invoicesAuthorized)} tone="green" />
            <StatusLine label="Aguardando emissão/provedor" value={fmtInt(e.invoicesPending)} tone={e.invoicesPending > 0 ? "blue" : "slate"} />
            <StatusLine label="Rejeitadas ou com erro" value={fmtInt(e.invoiceErrors)} tone={e.invoiceErrors > 0 ? "red" : "slate"} />
            <div className="mt-4 rounded-xl border border-[#D9E8E2] bg-[#F7FBF9] p-4">
              <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[#068A5B]" /><div><p className="text-sm font-bold text-[#12352B]">Operação rastreável</p><p className="mt-1 text-xs leading-relaxed text-[#71877E]">Pedidos B2B preservam snapshots comerciais e reservas; a emissão fiscal mantém histórico de eventos por nota.</p></div></div>
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <Section title="Saúde comercial" subtitle="Precificação, clientes e time de vendas" icon={BarChart3}>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-5">
              <MiniBar label="Simulações saudáveis" value={healthyCount} max={Math.max(totalSims, 1)} tone="green" />
              <MiniBar label="Simulações em atenção" value={attentionCount} max={Math.max(totalSims, 1)} tone="amber" />
              <div className="grid grid-cols-2 gap-3">
                <Link href="/clientes"><div className="cursor-pointer rounded-xl border border-[#E2EEE9] p-4 transition hover:border-[#9ED2BC]"><UsersRound className="h-5 w-5 text-[#068A5B]" /><p className="mt-3 text-xl font-bold text-[#12352B]">{fmtInt(e.customersTotal)}</p><p className="text-xs text-[#71877E]">clientes cadastrados</p></div></Link>
                <Link href="/vendedores"><div className="cursor-pointer rounded-xl border border-[#E2EEE9] p-4 transition hover:border-[#9ED2BC]"><UserRoundCheck className="h-5 w-5 text-[#098EC7]" /><p className="mt-3 text-xl font-bold text-[#12352B]">{fmtInt(e.activeSellers)}</p><p className="text-xs text-[#71877E]">vendedores ativos</p></div></Link>
              </div>
            </div>
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B8278]">Simulações recentes</p>
              {recentSims.length === 0 ? (
                <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-[#CFE0D9] bg-[#FBFDFC] p-6 text-center"><Calculator className="h-7 w-7 text-[#A8BEB5]" /><p className="mt-3 text-sm font-medium text-[#61796F]">Nenhuma simulação registrada.</p></div>
              ) : (
                <div className="divide-y divide-[#E4EFEB] rounded-xl border border-[#E2EEE9] px-4">
                  {recentSims.slice(0, 5).map((s: any) => (
                    <Link key={s.id} href={`/simulacoes/${s.id}`}><div className="flex cursor-pointer items-center justify-between gap-3 py-3.5"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#12352B]">{s.name}</p><p className="mt-0.5 text-xs text-[#82978F]">{s.createdAt ? new Date(s.createdAt).toLocaleDateString("pt-BR") : ""}</p></div><TrendingUp className="h-4 w-4 shrink-0 text-[#068A5B]" /></div></Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="Ações rápidas" subtitle="Atalhos para a operação diária" icon={Zap}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Nova empresa", desc: "Cadastro e tabela", icon: Building2, href: "/b2b-admin" },
              { label: "Novo produto", desc: "Catálogo mestre", icon: Package, href: "/produtos/novo" },
              { label: "Entrada / FIFO", desc: "Receber estoque", icon: Truck, href: "/entrada-produtos" },
              { label: "Pedidos", desc: "Acompanhar vendas", icon: ClipboardCheck, href: "/pedidos" },
              { label: "Notas fiscais", desc: "Emissão e eventos", icon: FileText, href: "/notas-fiscais" },
              { label: "Portal B2B", desc: "Visão do cliente", icon: Store, href: "/portal" },
            ].map(({ label, desc, icon: Icon, href }) => (
              <Link key={label} href={href}><div className="group cursor-pointer rounded-xl border border-[#E1ECE7] bg-[#FBFDFC] p-4 transition hover:border-[#9ED2BC] hover:bg-[#F1FAF6]"><Icon className="h-5 w-5 text-[#068A5B]" /><p className="mt-3 text-sm font-bold text-[#12352B]">{label}</p><p className="mt-0.5 text-[11px] text-[#71877E]">{desc}</p></div></Link>
            ))}
          </div>
        </Section>
      </div>

      {(Number(d.wishlistCounts?.novo ?? 0) > 0 || Number(d.ordersAguardando ?? 0) > 0 || Number(e.invoiceErrors ?? 0) > 0) && (
        <section className="rounded-2xl border border-[#EADDBF] bg-[#FFF9EC] p-5 sm:p-6">
          <div className="flex items-start gap-3"><Clock3 className="mt-0.5 h-5 w-5 text-[#A66A00]" /><div className="flex-1"><h2 className="text-sm font-bold text-[#674A14]">Pendências que pedem ação</h2><div className="mt-3 flex flex-wrap gap-2 text-xs"><Link href="/desejos-admin"><span className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-2 font-semibold text-[#674A14] shadow-sm"><Heart className="h-3.5 w-3.5" /> {fmtInt(d.wishlistCounts?.novo)} solicitações novas</span></Link><Link href="/pedidos"><span className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-2 font-semibold text-[#674A14] shadow-sm"><ShoppingCart className="h-3.5 w-3.5" /> {fmtInt(d.ordersAguardando)} pagamentos aguardando</span></Link>{Number(e.invoiceErrors ?? 0) > 0 && <Link href="/notas-fiscais"><span className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-2 font-semibold text-[#9E2F25] shadow-sm"><AlertCircle className="h-3.5 w-3.5" /> {fmtInt(e.invoiceErrors)} notas com erro</span></Link>}</div></div></div>
        </section>
      )}
    </div>
  );
}
