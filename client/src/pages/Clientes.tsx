/**
 * Clientes.tsx — Ficha de clientes (equipe) /clientes
 *
 * Relação unificada de clientes pessoa física (cadastro de varejo,
 * `permupay_customers`) e pessoa jurídica (empresas B2B,
 * `permupay_business_accounts`) pedida na evolução comercial — ver
 * docs/ideal-prime/AUDITORIA_EVOLUCAO_COMERCIAL.md. A ficha PF tem página de
 * detalhe própria (ClienteDetalhe.tsx); a ficha PJ já é gerida em
 * Gestão Comercial (/b2b-admin), que esta lista referencia em vez de
 * duplicar.
 *
 * Inclui, sem distinção entre PF/PJ no cadastro de pessoa física: cadastro
 * completo com documentos (KYC) e análise de crédito (aprovar/reprovar,
 * limite, histórico) — pedido explicitamente ("deixe também a de
 * documentos, deixe também a de crédito pode deixar tudo, sem distinção").
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Upload,
  User,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PAYMENT_LABEL, STATUS_COLOR, STATUS_LABEL_SHORT } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/orderStatus";

const fmt = (value: number) =>
  Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CREDIT_STATUS_LABEL: Record<string, string> = {
  NAO_ANALISADO: "Não analisado",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
};

const CREDIT_STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  NAO_ANALISADO: "outline",
  APROVADO: "secondary",
  REPROVADO: "destructive",
};

type UploadValue = { url: string; dataUrl: string; fileName: string; mimeType: string };

type FormState = {
  name: string;
  contact: string;
  contactType: "WHATSAPP" | "EMAIL";
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  cpf: string;
  rg: string;
  birthDate: string;
};

const initialForm: FormState = {
  name: "",
  contact: "",
  contactType: "WHATSAPP",
  email: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  cpf: "",
  rg: "",
  birthDate: "",
};

type Row = {
  key: string;
  type: "PF" | "PJ";
  id: number;
  name: string;
  contact: string;
  cpf?: string | null;
  creditStatus?: string | null;
  href: string;
};

function UploadSlot({
  label,
  value,
  busy,
  acceptLabel,
  onSelect,
}: {
  label: string;
  value: UploadValue | null;
  busy: boolean;
  acceptLabel: string;
  onSelect: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{acceptLabel}</p>
        </div>
        {value ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </div>
      {value?.mimeType === "application/pdf" ? (
        <a className="mt-3 block truncate text-sm text-primary underline" href={value.dataUrl} target="_blank" rel="noreferrer">
          {value.fileName}
        </a>
      ) : value ? (
        <img src={value.dataUrl} alt={label} className="mt-3 h-28 w-full rounded-lg bg-muted object-contain" />
      ) : null}
      <Button type="button" variant="outline" className="mt-3 w-full gap-2" onClick={onSelect} disabled={busy}>
        <Upload className="h-4 w-4" /> {busy ? "Enviando…" : value ? "Trocar arquivo" : "Selecionar arquivo"}
      </Button>
    </div>
  );
}

/**
 * Relatório rápido do cliente PF (compras + documentos + crédito) aberto a
 * partir da lista, sem sair da tela — equivalente ao botão "Relatório" da
 * ficha de clientes de referência. Não inclui notas promissórias (módulo
 * inexistente no Ideal Prime); a aba "Documentos" mostra os arquivos de KYC
 * enviados no cadastro.
 */
function CustomerReportDialog({
  customerId,
  open,
  onOpenChange,
  isAdmin,
}: {
  customerId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}) {
  const utils = trpc.useUtils();
  const customerQuery = trpc.customers.admin.get.useQuery(
    { id: customerId as number },
    { enabled: Boolean(customerId) }
  );
  const ordersQuery = trpc.customers.admin.orders.useQuery(
    { id: customerId as number },
    { enabled: Boolean(customerId) }
  );

  const [creditNotes, setCreditNotes] = useState("");
  const [creditLimit, setCreditLimit] = useState("");

  const updateCredit = trpc.customers.admin.updateCreditStatus.useMutation({
    onSuccess: async () => {
      toast.success("Análise de crédito atualizada.");
      await Promise.all([
        utils.customers.admin.get.invalidate({ id: customerId as number }),
        utils.customers.admin.list.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const customer = customerQuery.data as any;
  const orders = (ordersQuery.data ?? []) as any[];
  const totalPaid = orders
    .filter(order => order.status === "PAGO")
    .reduce((acc, order) => acc + Number(order.totalPrice ?? 0), 0);
  const totalPending = orders
    .filter(order => order.status === "AGUARDANDO_PAGAMENTO" || order.status === "RESERVADO")
    .reduce((acc, order) => acc + Number(order.totalPrice ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-full max-w-3xl sm:max-w-3xl flex-col overflow-hidden p-0">
        <div className="border-b px-6 pb-4 pt-6">
          <DialogTitle>{customer?.name ?? "Cliente"}</DialogTitle>
          <DialogDescription>
            Relatório completo: compras, documentos e análise de crédito.
          </DialogDescription>
        </div>

        {!customer ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-3">
                <span className="block text-xs text-muted-foreground">Contato</span>
                <strong className="text-sm">{customer.contact}</strong>
              </div>
              <div className="rounded-xl border p-3">
                <span className="block text-xs text-muted-foreground">CPF</span>
                <strong className="text-sm">{customer.cpf || "Não informado"}</strong>
              </div>
              <div className="rounded-xl border p-3">
                <span className="block text-xs text-muted-foreground">Total pago</span>
                <strong className="text-sm text-emerald-700">{fmt(totalPaid)}</strong>
              </div>
              <div className="rounded-xl border p-3">
                <span className="block text-xs text-muted-foreground">Em aberto</span>
                <strong className="text-sm text-amber-700">{fmt(totalPending)}</strong>
              </div>
            </div>

            <Tabs defaultValue="compras" className="mt-5 space-y-4">
              <TabsList className="grid h-auto w-full grid-cols-3">
                <TabsTrigger value="compras" className="gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5" /> Compras
                </TabsTrigger>
                <TabsTrigger value="documentos" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Documentos
                </TabsTrigger>
                <TabsTrigger value="credito" className="gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Crédito
                </TabsTrigger>
              </TabsList>

              <TabsContent value="compras" className="space-y-3">
                {ordersQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : orders.length ? (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2">Pedido</th>
                          <th className="px-3 py-2">Produto</th>
                          <th className="px-3 py-2">Pagamento</th>
                          <th className="px-3 py-2">Situação</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(order => (
                          <tr key={order.id} className="border-b last:border-0">
                            <td className="px-3 py-2 text-xs text-muted-foreground">#{order.id}</td>
                            <td className="px-3 py-2">{order.productName}</td>
                            <td className="px-3 py-2">{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[order.status as OrderStatus]}`}>
                                {STATUS_LABEL_SHORT[order.status as OrderStatus]}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">{fmt(order.totalPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Este cliente ainda não possui compras registradas.</p>
                )}
              </TabsContent>

              <TabsContent value="documentos" className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Documentos enviados no cadastro (KYC) — usados para crediário e análise de crédito.
                </p>
                {customer.documentFrontUrl || customer.documentBackUrl || customer.proofAddressUrl ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {customer.documentFrontUrl && (
                      <a href={customer.documentFrontUrl} target="_blank" rel="noreferrer" className="rounded-xl border p-3 text-xs text-primary underline">
                        Documento — frente
                      </a>
                    )}
                    {customer.documentBackUrl && (
                      <a href={customer.documentBackUrl} target="_blank" rel="noreferrer" className="rounded-xl border p-3 text-xs text-primary underline">
                        Documento — verso
                      </a>
                    )}
                    {customer.proofAddressUrl && (
                      <a href={customer.proofAddressUrl} target="_blank" rel="noreferrer" className="rounded-xl border p-3 text-xs text-primary underline">
                        Comprovante de endereço
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum documento enviado ainda.</p>
                )}
              </TabsContent>

              <TabsContent value="credito" className="space-y-3">
                <div className="rounded-xl border p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">Análise de crédito</p>
                    <Badge variant={CREDIT_STATUS_VARIANT[customer.creditStatus] ?? "outline"}>
                      {CREDIT_STATUS_LABEL[customer.creditStatus] ?? customer.creditStatus}
                    </Badge>
                  </div>
                  {customer.creditNotes && (
                    <p className="mb-3 text-xs text-muted-foreground">Observação atual: {customer.creditNotes}</p>
                  )}
                  {customer.creditLimit != null && (
                    <p className="mb-3 text-xs text-muted-foreground">Limite de crédito: {fmt(Number(customer.creditLimit))}</p>
                  )}
                  {isAdmin ? (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Observações da análise de crédito (opcional)"
                        value={creditNotes}
                        onChange={event => setCreditNotes(event.target.value)}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Limite de crédito (R$, opcional)"
                        value={creditLimit}
                        onChange={event => setCreditLimit(event.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                          disabled={updateCredit.isPending}
                          onClick={() =>
                            updateCredit.mutate({
                              customerId: customer.id,
                              creditStatus: "APROVADO",
                              creditNotes: creditNotes || undefined,
                              creditLimit: creditLimit ? Number(creditLimit) : undefined,
                            })
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar crédito
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-destructive"
                          disabled={updateCredit.isPending}
                          onClick={() =>
                            updateCredit.mutate({
                              customerId: customer.id,
                              creditStatus: "REPROVADO",
                              creditNotes: creditNotes || undefined,
                            })
                          }
                        >
                          Reprovar crédito
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Somente o administrador pode alterar a análise de crédito.</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Clientes() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [creditFilter, setCreditFilter] = useState<string>("TODOS");
  const [form, setForm] = useState<FormState>(initialForm);
  const [docFront, setDocFront] = useState<UploadValue | null>(null);
  const [docBack, setDocBack] = useState<UploadValue | null>(null);
  const [proofAddress, setProofAddress] = useState<UploadValue | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const documentUpload = useDocumentUpload();

  const customersQuery = trpc.customers.admin.list.useQuery({
    search: search.trim() || undefined,
    creditStatus: creditFilter === "TODOS" ? undefined : (creditFilter as any),
  });
  const businesses = trpc.b2b.admin.businesses.useQuery();

  const registerCustomer = trpc.customers.admin.register.useMutation({
    onSuccess: async () => {
      toast.success("Cliente cadastrado com sucesso.");
      setForm(initialForm);
      setDocFront(null);
      setDocBack(null);
      setProofAddress(null);
      await utils.customers.admin.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const setField = (field: keyof FormState, value: string) =>
    setForm(current => ({ ...current, [field]: value }));

  const handleRegister = () => {
    if (!form.name.trim() || !form.contact.trim()) {
      toast.error("Informe nome e contato do cliente.");
      return;
    }
    registerCustomer.mutate({
      name: form.name.trim(),
      contact: form.contact.trim(),
      contactType: form.contactType,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      zipCode: form.zipCode.trim() || undefined,
      cpf: form.cpf.trim() || undefined,
      rg: form.rg.trim() || undefined,
      birthDate: form.birthDate || undefined,
      documentFrontUrl: docFront?.url,
      documentBackUrl: docBack?.url,
      proofAddressUrl: proofAddress?.url,
    });
  };

  const pfCustomers = customersQuery.data ?? [];
  const summary = useMemo(
    () => ({
      total: pfCustomers.length,
      aprovados: pfCustomers.filter((c: any) => c.creditStatus === "APROVADO").length,
      pendentes: pfCustomers.filter((c: any) => c.creditStatus === "NAO_ANALISADO").length,
    }),
    [pfCustomers]
  );

  const rows: Row[] = useMemo(() => {
    const pf: Row[] = pfCustomers.map((customer: any) => ({
      key: `pf-${customer.id}`,
      type: "PF",
      id: customer.id,
      name: customer.name,
      contact: customer.contact,
      cpf: customer.cpf,
      creditStatus: customer.creditStatus,
      href: `/clientes/${customer.id}`,
    }));

    const needle = search.trim().toLowerCase();
    const pj: Row[] = (businesses.data ?? [])
      .filter(
        (business: any) =>
          !needle ||
          `${business.trade_name || ""} ${business.legal_name || ""} ${business.cnpj || ""}`
            .toLowerCase()
            .includes(needle)
      )
      .map((business: any) => ({
        key: `pj-${business.id}`,
        type: "PJ" as const,
        id: business.id,
        name: business.trade_name || business.legal_name,
        contact: business.cnpj,
        href: "/b2b-admin",
      }));

    return [...pf, ...pj].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [pfCustomers, businesses.data, search]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pessoa física e pessoa jurídica em um só lugar — cadastro, documentos, análise de
            crédito, histórico de compras e relacionamento.
          </p>
        </div>

        <Tabs defaultValue="lista" className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-2">
            <TabsTrigger value="lista" className="gap-2">
              <Users className="h-4 w-4" /> Clientes cadastrados
            </TabsTrigger>
            <TabsTrigger value="novo" className="gap-2">
              <Plus className="h-4 w-4" /> Novo cliente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total de clientes</p>
                  <p className="mt-1 text-2xl font-bold">{rows.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Crédito aprovado</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">{summary.aprovados}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Aguardando análise</p>
                  <p className="mt-1 text-2xl font-bold text-amber-700">{summary.pendentes}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="h-4 w-4" /> Clientes
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="w-56 pl-8"
                      placeholder="Buscar por nome, contato, e-mail, CPF ou CNPJ"
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                    />
                  </div>
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={creditFilter}
                    onChange={event => setCreditFilter(event.target.value)}
                  >
                    <option value="TODOS">Todas as situações</option>
                    <option value="NAO_ANALISADO">Não analisado</option>
                    <option value="APROVADO">Aprovado</option>
                    <option value="REPROVADO">Reprovado</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {customersQuery.isLoading || businesses.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : rows.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-3">Tipo</th>
                          <th className="px-3 py-3">Cliente</th>
                          <th className="px-3 py-3">Contato / documento</th>
                          <th className="px-3 py-3">CPF</th>
                          <th className="px-3 py-3">Crédito</th>
                          <th className="px-3 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(row => (
                          <tr key={row.key} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-3 py-3">
                              <Badge variant={row.type === "PJ" ? "default" : "secondary"} className="gap-1">
                                {row.type === "PJ" ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                {row.type === "PJ" ? "Empresa" : "Pessoa física"}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 font-medium">{row.name}</td>
                            <td className="px-3 py-3 text-muted-foreground">{row.contact}</td>
                            <td className="px-3 py-3">{row.type === "PF" ? row.cpf || "—" : "—"}</td>
                            <td className="px-3 py-3">
                              {row.type === "PF" ? (
                                <Badge variant={CREDIT_STATUS_VARIANT[row.creditStatus ?? ""] ?? "outline"}>
                                  {CREDIT_STATUS_LABEL[row.creditStatus ?? ""] ?? row.creditStatus}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {row.type === "PF" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={() => setSelectedCustomerId(row.id)}
                                  >
                                    <FileText className="h-3.5 w-3.5" /> Relatório
                                  </Button>
                                )}
                                <Link href={row.href}>
                                  <Button size="sm" className="gap-1">
                                    <ChevronRight className="h-3.5 w-3.5" /> Ver ficha
                                  </Button>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="novo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="h-4 w-4" /> Dados pessoais e de contato
                </CardTitle>
                <CardDescription>
                  Cadastre o cliente pessoa física para poder registrar vendas, crediário e
                  análise de crédito. Para empresas (pessoa jurídica), use "Nova empresa" em
                  Gestão Comercial.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nome completo</Label>
                  <Input value={form.name} onChange={event => setField("name", event.target.value)} placeholder="Nome completo do cliente" />
                </div>
                <div className="space-y-2">
                  <Label>Contato (WhatsApp ou e-mail)</Label>
                  <Input value={form.contact} onChange={event => setField("contact", event.target.value)} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de contato</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.contactType}
                    onChange={event => setField("contactType", event.target.value as "WHATSAPP" | "EMAIL")}
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">E-mail</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    value={form.cpf}
                    onChange={event => setField("cpf", event.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="Somente números"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label>RG</Label>
                  <Input value={form.rg} onChange={event => setField("rg", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data de nascimento</Label>
                  <Input type="date" value={form.birthDate} onChange={event => setField("birthDate", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={event => setField("email", event.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Endereço completo</Label>
                  <Input value={form.address} onChange={event => setField("address", event.target.value)} placeholder="Rua, número e complemento" />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={event => setField("city", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input maxLength={2} value={form.state} onChange={event => setField("state", event.target.value.toUpperCase())} placeholder="UF" />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input value={form.zipCode} onChange={event => setField("zipCode", event.target.value)} inputMode="numeric" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Documentação
                </CardTitle>
                <CardDescription>
                  Necessária para crediário e análise de crédito. Pode ser enviada depois, se necessário.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <UploadSlot
                  label="Documento — frente"
                  value={docFront}
                  busy={documentUpload.uploading}
                  acceptLabel="RG, CNH ou documento oficial"
                  onSelect={() => documentUpload.capture(setDocFront)}
                />
                <UploadSlot
                  label="Documento — verso"
                  value={docBack}
                  busy={documentUpload.uploading}
                  acceptLabel="Opcional, quando houver verso"
                  onSelect={() => documentUpload.capture(setDocBack)}
                />
                <UploadSlot
                  label="Comprovante de endereço"
                  value={proofAddress}
                  busy={documentUpload.uploading}
                  acceptLabel="Conta de luz, água ou similar"
                  onSelect={() => documentUpload.capture(setProofAddress)}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button className="gap-2" onClick={handleRegister} disabled={registerCustomer.isPending}>
                <Plus className="h-4 w-4" /> {registerCustomer.isPending ? "Cadastrando…" : "Cadastrar cliente"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <CustomerReportDialog
        customerId={selectedCustomerId}
        open={Boolean(selectedCustomerId)}
        onOpenChange={open => !open && setSelectedCustomerId(null)}
        isAdmin={isAdmin}
      />
    </DashboardLayout>
  );
}
