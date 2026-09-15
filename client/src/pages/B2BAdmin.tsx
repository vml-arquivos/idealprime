/**
 * B2BAdmin.tsx — Empresas (/b2b-admin)
 *
 * "Empresas" ganhou aqui um cadastro direto pela equipe ("Nova empresa") —
 * antes só existia o autoatendimento público (/empresa/cadastro), que cria a
 * empresa como PENDING e exige login do responsável na hora. Pedido
 * explícito: a equipe não encontrava onde cadastrar uma empresa direto pelo
 * painel (só via link público) — ver `db.b2b.ts` (`registerBusiness`) e
 * `b2b.router.ts` (`admin.register`).
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, CheckCircle2, Download, FileSpreadsheet, FileText, Plus, Save, ShieldCheck, ShoppingBag, Upload, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { exportQuoteSpreadsheet, printQuoteDocument } from "@/lib/b2bDocuments";

const money = (value: number) => (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const moneyInputToCents = (value: string) => {
  const raw = value.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const number = Number(normalized || 0);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : 0;
};

const centsToMoneyInput = (value: unknown) => (Number(value || 0) / 100).toFixed(2).replace(".", ",");

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  SUSPENDED: "Suspensa",
};
const STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  APPROVED: "secondary",
  SUSPENDED: "destructive",
};

const DISPLAY_STATUS: Record<string, string> = {
  PENDING: "Aguardando",
  APPROVED: "Aprovado",
  SUSPENDED: "Suspenso",
  REJECTED: "Recusado",
  CANCELLED: "Cancelado",
  CANCELADO: "Cancelado",
  ACCEPTED: "Aceito",
  PROCESSING: "Em andamento",
  PAYMENT_PENDING: "Pagamento pendente",
  PAID: "Pago",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  ENTREGUE: "Entregue",
  COMPLETED: "Concluído",
  FAILED: "Falhou",
};

const IMPORT_MODE_LABEL: Record<string, string> = {
  INVENTORY: "Produtos, preços e estoque",
  PRICES: "Produtos e preços",
};

const displayStatus = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  if (DISPLAY_STATUS[normalized]) return DISPLAY_STATUS[normalized];
  return normalized
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
};

type BusinessForm = {
  legalName: string;
  tradeName: string;
  cnpj: string;
  email: string;
  phone: string;
  status: "PENDING" | "APPROVED";
  priceListId: string;
};

const initialBusinessForm: BusinessForm = {
  legalName: "",
  tradeName: "",
  cnpj: "",
  email: "",
  phone: "",
  status: "APPROVED",
  priceListId: "",
};

type InviteForm = { name: string; email: string; password: string };
const initialInviteForm: InviteForm = { name: "", email: "", password: "" };

export default function B2BAdmin() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const businesses = trpc.b2b.admin.businesses.useQuery();
  const lists = trpc.b2b.admin.priceLists.useQuery();
  const orders = trpc.b2b.admin.orders.useQuery();
  const quotes = trpc.b2b.admin.quotes.useQuery();
  const imports = trpc.b2b.admin.imports.useQuery();
  const [name, setName] = useState("Tabela B2B padrão");
  const [businessForm, setBusinessForm] = useState<BusinessForm>(initialBusinessForm);
  const [inviteFor, setInviteFor] = useState<{ id: number; name: string } | null>(null);
  const [inviteForm, setInviteForm] = useState<InviteForm>(initialInviteForm);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"PRICES" | "INVENTORY">("INVENTORY");
  const [importPriceListId, setImportPriceListId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);
  const [quotePriceEdits, setQuotePriceEdits] = useState<Record<number, string>>({});
  const [quoteFreight, setQuoteFreight] = useState("0,00");
  const [quoteDiscount, setQuoteDiscount] = useState("0,00");
  const [quoteValidUntil, setQuoteValidUntil] = useState("");
  const [quotePaymentTerms, setQuotePaymentTerms] = useState("");
  const [quoteDeliveryTerms, setQuoteDeliveryTerms] = useState("");
  const [quoteCommercialNotes, setQuoteCommercialNotes] = useState("");

  const quoteDetail = trpc.b2b.quote.useQuery(
    { id: selectedQuoteId || 1 },
    { enabled: Boolean(selectedQuoteId) },
  );

  const createList = trpc.b2b.admin.createPriceList.useMutation({ onSuccess: () => utils.b2b.admin.priceLists.invalidate(), onError: (error) => toast.error(error.message) });
  const approve = trpc.b2b.admin.approve.useMutation({ onSuccess: () => utils.b2b.admin.businesses.invalidate(), onError: (error) => toast.error(error.message) });
  const suspend = trpc.b2b.admin.suspend.useMutation({ onSuccess: () => utils.b2b.admin.businesses.invalidate(), onError: (error) => toast.error(error.message) });
  const transition = trpc.b2b.admin.transition.useMutation({ onSuccess: () => utils.b2b.admin.orders.invalidate(), onError: (error) => toast.error(error.message) });
  const transitionQuote = trpc.b2b.admin.transitionQuote.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.b2b.admin.quotes.invalidate(),
        selectedQuoteId ? utils.b2b.quote.invalidate({ id: selectedQuoteId }) : Promise.resolve(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });
  const saveQuoteProposal = trpc.b2b.admin.saveQuoteProposal.useMutation({
    onSuccess: async () => {
      toast.success("Proposta comercial salva.");
      await Promise.all([
        utils.b2b.admin.quotes.invalidate(),
        selectedQuoteId ? utils.b2b.quote.invalidate({ id: selectedQuoteId }) : Promise.resolve(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const registerBusiness = trpc.b2b.admin.register.useMutation({
    onSuccess: async () => {
      toast.success("Empresa cadastrada com sucesso.");
      setBusinessForm(initialBusinessForm);
      await utils.b2b.admin.businesses.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const inviteMember = trpc.b2b.admin.inviteMember.useMutation({
    onSuccess: async () => {
      toast.success("Responsável cadastrado — já pode acessar a área da empresa.");
      setInviteFor(null);
      setInviteForm(initialInviteForm);
      await utils.b2b.admin.businesses.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const setBusinessField = <K extends keyof BusinessForm>(field: K, value: BusinessForm[K]) =>
    setBusinessForm((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    const quote: any = quoteDetail.data;
    if (!quote) return;
    const edits: Record<number, string> = {};
    for (const item of quote.items || []) {
      edits[Number(item.id)] = centsToMoneyInput(item.quotedUnitPriceCents ?? item.unitPriceCents ?? 0);
    }
    setQuotePriceEdits(edits);
    setQuoteFreight(centsToMoneyInput(quote.freight_cents));
    setQuoteDiscount(centsToMoneyInput(quote.discount_cents));
    setQuoteValidUntil(quote.valid_until ? String(quote.valid_until).slice(0, 10) : "");
    setQuotePaymentTerms(quote.payment_terms_text || "");
    setQuoteDeliveryTerms(quote.delivery_terms_text || "");
    setQuoteCommercialNotes(quote.commercial_notes || "");
  }, [quoteDetail.data]);

  const handleSaveQuoteProposal = async (approveAfter = false) => {
    const quote: any = quoteDetail.data;
    if (!quote) return;
    try {
      await saveQuoteProposal.mutateAsync({
        quoteId: quote.id,
        items: (quote.items || []).map((item: any) => ({
          itemId: Number(item.id),
          quotedUnitPriceCents: moneyInputToCents(quotePriceEdits[Number(item.id)] ?? "0"),
        })),
        freightCents: moneyInputToCents(quoteFreight),
        discountCents: moneyInputToCents(quoteDiscount),
        validUntil: quoteValidUntil || undefined,
        paymentTermsText: quotePaymentTerms.trim() || undefined,
        deliveryTermsText: quoteDeliveryTerms.trim() || undefined,
        commercialNotes: quoteCommercialNotes.trim() || undefined,
      });
      if (approveAfter) {
        await transitionQuote.mutateAsync({ id: quote.id, action: "APPROVE" });
        toast.success("Cotação salva e aprovada. A empresa já pode convertê-la em pedido.");
        setSelectedQuoteId(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a proposta.");
    }
  };

  const quoteProposalSubtotal = ((quoteDetail.data as any)?.items || []).reduce(
    (sum: number, item: any) => sum + Number(item.quantity || 0) * moneyInputToCents(quotePriceEdits[Number(item.id)] ?? "0"),
    0,
  );
  const quoteProposalDiscount = moneyInputToCents(quoteDiscount);
  const quoteProposalFreight = moneyInputToCents(quoteFreight);
  const quoteProposalTotal = Math.max(0, quoteProposalSubtotal - quoteProposalDiscount + quoteProposalFreight);

  const handleImportCatalog = async () => {
    if (!importFile) {
      toast.error("Selecione a planilha XLSX ou CSV.");
      return;
    }
    const fallbackPriceList = lists.data?.find((item: any) => item.is_default)?.id ?? lists.data?.[0]?.id;
    const priceListId = Number(importPriceListId || fallbackPriceList);
    if (!priceListId) {
      toast.error("Crie ou selecione uma tabela de preços antes de atualizar os produtos.");
      return;
    }

    setIsImporting(true);
    try {
      const params = new URLSearchParams({
        filename: importFile.name,
        mode: importMode,
        priceListId: String(priceListId),
      });
      const response = await fetch(`/api/b2b/import?${params.toString()}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/octet-stream" },
        body: importFile,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar os produtos.");

      if (payload.repeated) {
        toast.info("Este mesmo arquivo já havia sido processado para esta tabela e modo.");
      } else {
        const summary = payload.job?.summary;
        toast.success(
          summary
            ? `Atualização concluída: ${summary.created} novo(s), ${summary.updated} atualizado(s).`
            : "Produtos atualizados com sucesso.",
        );
      }
      setImportFile(null);
      await Promise.all([utils.b2b.admin.imports.invalidate(), utils.b2b.admin.priceLists.invalidate()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar os produtos.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleRegisterBusiness = () => {
    if (!businessForm.legalName.trim() || !businessForm.cnpj.trim() || !businessForm.email.trim()) {
      toast.error("Informe razão social, CNPJ e e-mail da empresa.");
      return;
    }
    registerBusiness.mutate({
      legalName: businessForm.legalName.trim(),
      tradeName: businessForm.tradeName.trim() || undefined,
      cnpj: businessForm.cnpj.trim(),
      email: businessForm.email.trim(),
      phone: businessForm.phone.trim() || undefined,
      status: businessForm.status,
      priceListId: businessForm.priceListId ? Number(businessForm.priceListId) : undefined,
    });
  };

  const approvedCompanies = (businesses.data ?? []).filter((item: any) => item.status === "APPROVED").length;
  const pendingCompanies = (businesses.data ?? []).filter((item: any) => item.status === "PENDING").length;
  const openQuotes = (quotes.data ?? []).filter((item: any) => ["PENDING", "APPROVED"].includes(item.status)).length;
  const openOrders = (orders.data ?? []).filter((item: any) => item.commercial_status !== "CANCELADO" && item.fulfillment_status !== "ENTREGUE").length;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-[#0C4536] px-6 py-7 text-white shadow-[0_22px_60px_rgba(12,69,54,0.14)] sm:px-8">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#B9F1D4]">Empresas</p>
            <h1 className="prime-display mt-2 text-3xl leading-tight sm:text-4xl">Empresas e pedidos</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">Cadastre empresas, organize produtos e acompanhe pedidos em um só lugar.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
            {[
              ["Empresas ativas", approvedCompanies],
              ["Aguardando aprovação", pendingCompanies],
              ["Orçamentos abertos", openQuotes],
              ["Pedidos em andamento", openOrders],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 backdrop-blur-sm">
                <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-white/55">{label}</p>
                <p className="mt-1 text-2xl font-medium">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Building2 className="h-5 w-5 text-[#215b94]" /> Empresas
        </h2>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" /> Nova empresa
            </CardTitle>
            <CardDescription>
              Cadastre uma empresa para ela poder comprar. O acesso do responsável pode ser criado agora ou depois.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Razão social</Label>
              <Input
                value={businessForm.legalName}
                onChange={(e) => setBusinessField("legalName", e.target.value)}
                placeholder="Razão social da empresa"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome fantasia</Label>
              <Input value={businessForm.tradeName} onChange={(e) => setBusinessField("tradeName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                value={businessForm.cnpj}
                onChange={(e) => setBusinessField("cnpj", e.target.value.replace(/\D/g, "").slice(0, 14))}
                placeholder="Somente números"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={businessForm.email} onChange={(e) => setBusinessField("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={businessForm.phone} onChange={(e) => setBusinessField("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tabela de preços</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={businessForm.priceListId}
                onChange={(e) => setBusinessField("priceListId", e.target.value)}
              >
                <option value="">Padrão do sistema</option>
                {lists.data?.map((priceList: any) => (
                  <option key={priceList.id} value={priceList.id}>
                    {priceList.name}
                    {priceList.is_default ? " · padrão" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Como começar</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={businessForm.status}
                onChange={(e) => setBusinessField("status", e.target.value as "PENDING" | "APPROVED")}
              >
                <option value="APPROVED">Aprovada — pode comprar</option>
                <option value="PENDING">Aguardando aprovação</option>
              </select>
            </div>
          </CardContent>
          <div className="flex justify-end px-6 pb-6">
            <Button className="gap-2" onClick={handleRegisterBusiness} disabled={registerBusiness.isPending}>
              <Plus className="h-4 w-4" /> {registerBusiness.isPending ? "Cadastrando…" : "Cadastrar empresa"}
            </Button>
          </div>
        </Card>

        <div className="space-y-2">
          {businesses.data?.map((business: any) => (
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center" key={business.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{business.trade_name || business.legal_name}</strong>
                  <Badge variant={STATUS_VARIANT[business.status] ?? "outline"}>{STATUS_LABEL[business.status] ?? business.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{business.cnpj} · {business.email}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {business.status === "PENDING" && (
                  <Button size="sm" onClick={() => approve.mutate({ id: business.id, priceListId: lists.data?.find((item: any) => item.is_default)?.id })}>
                    Aprovar empresa
                  </Button>
                )}
                {business.status === "APPROVED" && (
                  <Button size="sm" variant="outline" onClick={() => suspend.mutate({ id: business.id })}>
                    Suspender
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setInviteFor({ id: business.id, name: business.trade_name || business.legal_name });
                    setInviteForm(initialInviteForm);
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Cadastrar responsável
                </Button>
              </div>
            </div>
          ))}
          {!businesses.data?.length && (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma empresa cadastrada ainda.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-medium">Tabelas de preços</h2>
        <div className="flex max-w-lg gap-2">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
          <Button onClick={() => createList.mutate({ name, isDefault: !(lists.data?.length) })}>Criar tabela de preços</Button>
        </div>
        <div className="mt-3 space-y-1 text-sm">
          {lists.data?.map((priceList: any) => (
            <div key={priceList.id}>{priceList.name} {priceList.is_default ? "· padrão" : ""} · versão {priceList.latest_version}</div>
          ))}
        </div>
        <Card className="mt-5 border-[#b9d6ee]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4 text-[#215b94]" /> Atualizar produtos por planilha
            </CardTitle>
            <CardDescription>
              Envie a planilha oficial para criar ou atualizar produtos, preços e estoque. Deixe o preço em branco
              para mostrar “sob consulta”.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2 lg:col-span-2">
                <Label>Arquivo</Label>
                <Input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">A aba XLSX deve se chamar PRODUTOS. Limite: 5.000 itens / 10 MB.</p>
              </div>
              <div className="space-y-2">
                <Label>Atualizar</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={importMode}
                  onChange={(event) => setImportMode(event.target.value as "PRICES" | "INVENTORY")}
                >
                  <option value="INVENTORY">Produtos, preços e estoque</option>
                  <option value="PRICES">Produtos e preços — manter estoque</option>
                </select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Tabela de preços</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={importPriceListId}
                  onChange={(event) => setImportPriceListId(event.target.value)}
                >
                  <option value="">Usar tabela padrão</option>
                  {lists.data?.map((priceList: any) => (
                    <option key={priceList.id} value={priceList.id}>
                      {priceList.name}{priceList.is_default ? " · padrão" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleImportCatalog} disabled={isImporting || !importFile} className="flex-1 gap-2">
                  <Upload className="h-4 w-4" /> {isImporting ? "Atualizando…" : "Atualizar produtos"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
              <div className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#067c52]" />
                <span>
                  Para adicionar mercadoria nova, use <strong>Entrada</strong>. Assim o estoque e os custos ficam corretos.
                </span>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0 gap-2">
                <a href="/templates/ideal-prime-catalogo-master.xlsx" download>
                  <Download className="h-3.5 w-3.5" /> Baixar modelo
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex flex-col justify-between gap-2 md:flex-row md:items-end">
          <div>
            <h2 className="flex items-center gap-2 font-medium"><FileText className="h-5 w-5 text-[#215b94]" /> Cotações empresariais</h2>
            <p className="mt-1 text-sm text-muted-foreground">Abra a solicitação, informe os preços finais e as condições comerciais antes de aprovar.</p>
          </div>
        </div>
        <div className="space-y-2">
          {quotes.data?.map((quote: any) => (
            <div className="rounded-xl border border-border bg-card p-4" key={quote.id}>
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{quote.quote_number} · {quote.trade_name || quote.legal_name}</strong>
                    <span className="rounded-full bg-[#e8f1fb] px-2.5 py-1 text-xs font-medium text-[#215b94]">{displayStatus(quote.status)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{quote.buyer_name} · {new Date(quote.created_at).toLocaleString("pt-BR")} · {quote.item_count || 0} item(ns){quote.customer_reference ? ` · Ref. ${quote.customer_reference}` : ""}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="mr-2 text-[#067c52]">{money(Number(quote.total_cents || 0))}</strong>
                  <Button size="sm" variant="outline" onClick={() => setSelectedQuoteId(Number(quote.id))}>Abrir cotação</Button>
                  {quote.status === "PENDING" && <Button size="sm" variant="outline" onClick={() => transitionQuote.mutate({ id: quote.id, action: "REJECT" })}>Recusar</Button>}
                  {quote.status === "APPROVED" && <Button size="sm" variant="outline" onClick={() => transitionQuote.mutate({ id: quote.id, action: "CANCEL" })}>Cancelar</Button>}
                </div>
              </div>
            </div>
          ))}
          {!quotes.data?.length && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma cotação recebida.</div>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-medium"><ShoppingBag className="h-5 w-5 text-[#067c52]" /> Pedidos</h2>
        <div className="space-y-2">
          {orders.data?.map((order: any) => (
            <div className="rounded-xl border border-border p-4" key={order.id}>
              <div className="flex justify-between gap-3">
                <strong>{order.order_number} · {order.trade_name || order.legal_name}</strong>
                <span>{money(Number(order.total_cents || 0))}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{displayStatus(order.commercial_status)} · {displayStatus(order.payment_status)} · {displayStatus(order.fulfillment_status)}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[["ACCEPT", "Aceitar"], ["PAY", "Confirmar pagamento"], ["SHIP", "Expedir"], ["CANCEL", "Cancelar"]].map(([action, label]) => (
                  <Button key={action} size="sm" variant="outline" onClick={() => transition.mutate({ id: order.id, action: action as "ACCEPT" | "PAY" | "SHIP" | "CANCEL" })}>{label}</Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Atualizações por planilha</h2>
        {imports.data?.map((job: any) => (
          <div key={job.id} className="text-sm">Atualização #{job.id} · {IMPORT_MODE_LABEL[job.mode] ?? "Produtos"} · {displayStatus(job.status)} · {job.price_list_name}</div>
        ))}
      </section>

      <Dialog open={Boolean(selectedQuoteId)} onOpenChange={(open) => !open && setSelectedQuoteId(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogTitle>Preparar proposta comercial</DialogTitle>
          <DialogDescription>
            Defina preço final, frete, desconto, validade e condições. A empresa verá o comparativo e poderá gerar o pedido com estes mesmos valores.
          </DialogDescription>
          {quoteDetail.isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando cotação...</div>
          ) : quoteDetail.data ? (
            <div className="space-y-5 pt-2">
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-4">
                <div><p className="text-[10px] uppercase text-muted-foreground">Cotação</p><p className="mt-1 font-semibold">{(quoteDetail.data as any).quote_number}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Empresa</p><p className="mt-1 font-semibold">{(quoteDetail.data as any).trade_name || (quoteDetail.data as any).legal_name}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Comprador</p><p className="mt-1 font-semibold">{(quoteDetail.data as any).buyer_name}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Status</p><p className="mt-1 font-semibold">{displayStatus((quoteDetail.data as any).status)}</p></div>
                {(quoteDetail.data as any).customer_reference && <div><p className="text-[10px] uppercase text-muted-foreground">Referência / OC</p><p className="mt-1 text-sm">{(quoteDetail.data as any).customer_reference}</p></div>}
                {(quoteDetail.data as any).requested_delivery_date && <div><p className="text-[10px] uppercase text-muted-foreground">Entrega desejada</p><p className="mt-1 text-sm">{new Date(`${String((quoteDetail.data as any).requested_delivery_date).slice(0,10)}T12:00:00`).toLocaleDateString("pt-BR")}</p></div>}
                {(quoteDetail.data as any).contact_name && <div><p className="text-[10px] uppercase text-muted-foreground">Contato</p><p className="mt-1 text-sm">{(quoteDetail.data as any).contact_name}</p></div>}
                {(quoteDetail.data as any).delivery_address && <div className="md:col-span-4"><p className="text-[10px] uppercase text-muted-foreground">Entrega / local</p><p className="mt-1 text-sm">{(quoteDetail.data as any).delivery_address}</p></div>}
                {(quoteDetail.data as any).notes && <div className="md:col-span-4"><p className="text-[10px] uppercase text-muted-foreground">Observação do cliente</p><p className="mt-1 whitespace-pre-wrap text-sm">{(quoteDetail.data as any).notes}</p></div>}
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-muted/50 text-xs"><tr><th className="px-3 py-2 text-left">SKU</th><th className="px-3 py-2 text-left">Produto</th><th className="px-3 py-2 text-right">Qtd.</th><th className="px-3 py-2 text-right">Referência</th><th className="px-3 py-2 text-right">Preço cotado</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                  <tbody className="divide-y">
                    {((quoteDetail.data as any).items || []).map((item: any) => {
                      const quotedCents = moneyInputToCents(quotePriceEdits[Number(item.id)] ?? "0");
                      return (
                        <tr key={item.id}>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{item.sku}</td>
                          <td className="px-3 py-3"><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.unit}</div></td>
                          <td className="px-3 py-3 text-right font-medium">{item.quantity}</td>
                          <td className="px-3 py-3 text-right">{money(Number(item.catalogUnitPriceCents ?? item.unitPriceCents ?? 0))}</td>
                          <td className="px-3 py-3"><Input className="ml-auto w-32 text-right" value={quotePriceEdits[Number(item.id)] ?? ""} onChange={(e) => setQuotePriceEdits((current) => ({ ...current, [Number(item.id)]: e.target.value }))} disabled={(quoteDetail.data as any).status !== "PENDING"} /></td>
                          <td className="px-3 py-3 text-right font-semibold text-[#067c52]">{money(Number(item.quantity || 0) * quotedCents)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>Validade da proposta</Label><Input type="date" value={quoteValidUntil} onChange={(e) => setQuoteValidUntil(e.target.value)} disabled={(quoteDetail.data as any).status !== "PENDING"} /></div>
                  <div className="space-y-2"><Label>Condição de pagamento</Label><Input placeholder="Ex.: boleto 28 dias / PIX" value={quotePaymentTerms} onChange={(e) => setQuotePaymentTerms(e.target.value)} disabled={(quoteDetail.data as any).status !== "PENDING"} /></div>
                  <div className="space-y-2 md:col-span-2"><Label>Condição / prazo de entrega</Label><Input placeholder="Ex.: até 5 dias úteis após confirmação" value={quoteDeliveryTerms} onChange={(e) => setQuoteDeliveryTerms(e.target.value)} disabled={(quoteDetail.data as any).status !== "PENDING"} /></div>
                  <div className="space-y-2 md:col-span-2"><Label>Observações comerciais</Label><Textarea className="min-h-24" placeholder="Informações que devem constar na proposta enviada ao cliente." value={quoteCommercialNotes} onChange={(e) => setQuoteCommercialNotes(e.target.value)} disabled={(quoteDetail.data as any).status !== "PENDING"} /></div>
                </div>
                <div className="rounded-xl border bg-[#f4f9f6] p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <div className="space-y-2"><Label>Desconto total</Label><Input value={quoteDiscount} onChange={(e) => setQuoteDiscount(e.target.value)} disabled={(quoteDetail.data as any).status !== "PENDING"} /></div>
                    <div className="space-y-2"><Label>Frete</Label><Input value={quoteFreight} onChange={(e) => setQuoteFreight(e.target.value)} disabled={(quoteDetail.data as any).status !== "PENDING"} /></div>
                  </div>
                  <div className="mt-4 space-y-2 border-t pt-4 text-sm">
                    <div className="flex justify-between"><span>Subtotal</span><b>{money(quoteProposalSubtotal)}</b></div>
                    <div className="flex justify-between"><span>Desconto</span><b className="text-[#067c52]">− {money(quoteProposalDiscount)}</b></div>
                    <div className="flex justify-between"><span>Frete</span><b>{money(quoteProposalFreight)}</b></div>
                    <div className="flex justify-between border-t pt-3 text-base"><span className="font-semibold">Total da proposta</span><strong className="text-[#067c52]">{money(quoteProposalTotal)}</strong></div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button variant="outline" className="gap-2" onClick={() => exportQuoteSpreadsheet(quoteDetail.data as any).catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível exportar a cotação."))}><FileSpreadsheet className="h-4 w-4" />XLSX</Button>
                <Button variant="outline" onClick={() => { try { printQuoteDocument(quoteDetail.data as any); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível imprimir a cotação."); } }}>Imprimir / PDF</Button>
                <Button variant="outline" onClick={() => setSelectedQuoteId(null)}>Fechar</Button>
                {(quoteDetail.data as any).status === "PENDING" && (
                  <>
                    <Button variant="outline" className="gap-2" onClick={() => handleSaveQuoteProposal(false)} disabled={saveQuoteProposal.isPending}><Save className="h-4 w-4" />Salvar proposta</Button>
                    {isAdmin ? (
                      <Button className="gap-2 bg-[#067c52] hover:bg-[#056343]" onClick={() => handleSaveQuoteProposal(true)} disabled={saveQuoteProposal.isPending || transitionQuote.isPending}><CheckCircle2 className="h-4 w-4" />Salvar e aprovar</Button>
                    ) : (
                      <span className="self-center text-xs text-muted-foreground">A aprovação final é restrita ao administrador.</span>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-red-600">Não foi possível carregar a cotação.</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(inviteFor)} onOpenChange={(open) => !open && setInviteFor(null)}>
        <DialogContent>
          <DialogTitle>Cadastrar responsável — {inviteFor?.name}</DialogTitle>
          <DialogDescription>
            Cria o acesso que a empresa usará para entrar, pedir orçamento e comprar.
          </DialogDescription>
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>Nome do responsável</Label>
              <Input value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>E-mail de acesso</Label>
              <Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" value={inviteForm.password} onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="flex justify-end">
              <Button
                disabled={inviteMember.isPending}
                onClick={() => {
                  if (!inviteFor) return;
                  if (!inviteForm.name.trim() || !inviteForm.email.trim() || inviteForm.password.length < 8) {
                    toast.error("Informe nome, e-mail e uma senha com pelo menos 8 caracteres.");
                    return;
                  }
                  inviteMember.mutate({
                    businessAccountId: inviteFor.id,
                    name: inviteForm.name.trim(),
                    email: inviteForm.email.trim(),
                    password: inviteForm.password,
                    role: "MANAGER",
                  });
                }}
              >
                {inviteMember.isPending ? "Cadastrando…" : "Cadastrar responsável"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
