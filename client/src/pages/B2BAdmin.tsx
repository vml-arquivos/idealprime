/**
 * B2BAdmin.tsx — Gestão Comercial (/b2b-admin)
 *
 * "Empresas" ganhou aqui um cadastro direto pela equipe ("Nova empresa") —
 * antes só existia o autoatendimento público (/empresa/cadastro), que cria a
 * empresa como PENDING e exige login do responsável na hora. Pedido
 * explícito: a equipe não encontrava onde cadastrar uma empresa direto pelo
 * painel (só via link público) — ver `db.b2b.ts` (`registerBusiness`) e
 * `b2b.router.ts` (`admin.register`).
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Building2, FileText, Plus, ShoppingBag, UserPlus } from "lucide-react";
import { toast } from "sonner";

const money = (value: number) => (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

  const createList = trpc.b2b.admin.createPriceList.useMutation({ onSuccess: () => utils.b2b.admin.priceLists.invalidate(), onError: (error) => toast.error(error.message) });
  const approve = trpc.b2b.admin.approve.useMutation({ onSuccess: () => utils.b2b.admin.businesses.invalidate(), onError: (error) => toast.error(error.message) });
  const suspend = trpc.b2b.admin.suspend.useMutation({ onSuccess: () => utils.b2b.admin.businesses.invalidate(), onError: (error) => toast.error(error.message) });
  const transition = trpc.b2b.admin.transition.useMutation({ onSuccess: () => utils.b2b.admin.orders.invalidate(), onError: (error) => toast.error(error.message) });
  const transitionQuote = trpc.b2b.admin.transitionQuote.useMutation({ onSuccess: () => utils.b2b.admin.quotes.invalidate(), onError: (error) => toast.error(error.message) });

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
      toast.success("Responsável cadastrado — já pode acessar o portal da empresa.");
      setInviteFor(null);
      setInviteForm(initialInviteForm);
      await utils.b2b.admin.businesses.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const setBusinessField = <K extends keyof BusinessForm>(field: K, value: BusinessForm[K]) =>
    setBusinessForm((current) => ({ ...current, [field]: value }));

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

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#215b94]">Relacionamento empresarial</p>
        <h1 className="mt-1 text-2xl font-semibold">Gestão Comercial</h1>
        <p className="text-sm text-muted-foreground">Empresas, tabelas, cotações, pedidos e importações Ideal Prime.</p>
      </div>

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
              Cadastro direto pela equipe — a empresa entra pronta para operar (aprovada), sem
              depender do link público de autoatendimento. O acesso do responsável (login) é
              opcional agora e pode ser cadastrado depois, na própria lista abaixo.
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
              <Label>Tabela comercial</Label>
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
              <Label>Situação inicial</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={businessForm.status}
                onChange={(e) => setBusinessField("status", e.target.value as "PENDING" | "APPROVED")}
              >
                <option value="APPROVED">Aprovada (pode comprar já)</option>
                <option value="PENDING">Pendente (aguardar aprovação depois)</option>
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
        <h2 className="mb-3 font-semibold">Tabelas Comerciais</h2>
        <div className="flex max-w-lg gap-2">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
          <Button onClick={() => createList.mutate({ name, isDefault: !(lists.data?.length) })}>Criar tabela</Button>
        </div>
        <div className="mt-3 space-y-1 text-sm">
          {lists.data?.map((priceList: any) => (
            <div key={priceList.id}>{priceList.name} {priceList.is_default ? "· padrão" : ""} · versão {priceList.latest_version}</div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Importação CSV/XLSX permanece em /api/b2b/import com tabela, modo e arquivo autenticados.</p>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><FileText className="h-5 w-5 text-[#215b94]" /> Cotações Comerciais</h2>
        <div className="space-y-2">
          {quotes.data?.map((quote: any) => (
            <div className="rounded-xl border border-border bg-card p-4" key={quote.id}>
              <div className="flex flex-col justify-between gap-2 md:flex-row">
                <div>
                  <strong>{quote.quote_number} · {quote.trade_name || quote.legal_name}</strong>
                  <div className="text-xs text-muted-foreground">{quote.buyer_name} · {new Date(quote.created_at).toLocaleString("pt-BR")}</div>
                </div>
                <strong className="text-[#067c52]">{money(Number(quote.total_cents || 0))}</strong>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#e8f1fb] px-2.5 py-1 text-xs font-semibold text-[#215b94]">{quote.status}</span>
                {quote.status === "PENDING" && (
                  <>
                    <Button size="sm" onClick={() => transitionQuote.mutate({ id: quote.id, action: "APPROVE" })}>Aprovar</Button>
                    <Button size="sm" variant="outline" onClick={() => transitionQuote.mutate({ id: quote.id, action: "REJECT" })}>Recusar</Button>
                  </>
                )}
                {quote.status === "APPROVED" && (
                  <Button size="sm" variant="outline" onClick={() => transitionQuote.mutate({ id: quote.id, action: "CANCEL" })}>Cancelar</Button>
                )}
              </div>
            </div>
          ))}
          {!quotes.data?.length && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma cotação comercial recebida.</div>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><ShoppingBag className="h-5 w-5 text-[#067c52]" /> Pedidos B2B</h2>
        <div className="space-y-2">
          {orders.data?.map((order: any) => (
            <div className="rounded-xl border border-border p-4" key={order.id}>
              <div className="flex justify-between gap-3">
                <strong>{order.order_number} · {order.trade_name || order.legal_name}</strong>
                <span>{money(Number(order.total_cents || 0))}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{order.commercial_status} · {order.payment_status} · {order.fulfillment_status}</div>
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
        <h2 className="mb-2 font-semibold">Importações de Catálogo</h2>
        {imports.data?.map((job: any) => (
          <div key={job.id} className="text-sm">#{job.id} · {job.mode} · {job.status} · {job.price_list_name}</div>
        ))}
      </section>

      <Dialog open={Boolean(inviteFor)} onOpenChange={(open) => !open && setInviteFor(null)}>
        <DialogContent>
          <DialogTitle>Cadastrar responsável — {inviteFor?.name}</DialogTitle>
          <DialogDescription>
            Cria (ou reaproveita, se já existir) o login que a empresa vai usar para acessar o
            portal B2B, cotar e comprar.
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
