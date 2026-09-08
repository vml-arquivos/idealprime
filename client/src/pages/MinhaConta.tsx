/**
 * client/src/pages/MinhaConta.tsx — Área do cliente
 *
 * Login/cadastro com senha (CustomerAuthPanel) seguido de acesso à própria
 * ficha (dados cadastrais + documentos) e ao histórico de pedidos — pedido
 * explícito da evolução comercial: "o cliente vai ter a conta dele, criar a
 * conta, login, acessar seus dados, produtos, histórico, o que já foi
 * comprado". Ver docs/ideal-prime/AUDITORIA_EVOLUCAO_COMERCIAL.md.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  LogOut,
  Package,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerAuthPanel } from "@/components/CustomerAuthPanel";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import { forgetRememberedContact } from "@/lib/customerSession";
import { STATUS_COLOR, STATUS_LABEL, PAYMENT_LABEL, type OrderStatus } from "@/lib/orderStatus";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type SafeCustomer = NonNullable<RouterOutputs["customerAuth"]["me"]>;

const contactFromUrl = () => {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("contact")?.trim() || "";
};

const fmt = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

function DocumentSlot({
  label,
  url,
  busy,
  onSelect,
}: {
  label: string;
  url: string | null | undefined;
  busy: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">JPG, PNG ou PDF</p>
        </div>
        {url ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3 w-full"
        disabled={busy}
        onClick={onSelect}
      >
        {busy ? "Enviando…" : url ? "Substituir arquivo" : "Enviar arquivo"}
      </Button>
    </div>
  );
}

function ProfileForm({ customer }: { customer: SafeCustomer }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    name: customer.name ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
    city: customer.city ?? "",
    state: customer.state ?? "",
    zipCode: customer.zipCode ?? "",
    cpf: (customer as any).cpf ?? "",
    rg: (customer as any).rg ?? "",
    birthDate: (customer as any).birthDate ? String((customer as any).birthDate).slice(0, 10) : "",
    documentFrontUrl: (customer as any).documentFrontUrl ?? "",
    documentBackUrl: (customer as any).documentBackUrl ?? "",
    proofAddressUrl: (customer as any).proofAddressUrl ?? "",
  });

  useEffect(() => {
    setForm({
      name: customer.name ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      zipCode: customer.zipCode ?? "",
      cpf: (customer as any).cpf ?? "",
      rg: (customer as any).rg ?? "",
      birthDate: (customer as any).birthDate ? String((customer as any).birthDate).slice(0, 10) : "",
      documentFrontUrl: (customer as any).documentFrontUrl ?? "",
      documentBackUrl: (customer as any).documentBackUrl ?? "",
      proofAddressUrl: (customer as any).proofAddressUrl ?? "",
    });
  }, [customer.id]);

  const { capture, uploading } = useDocumentUpload();
  const [uploadingSlot, setUploadingSlot] = useState<"front" | "back" | "proof" | null>(null);

  const updateProfile = trpc.customerAuth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Dados atualizados.");
      utils.customerAuth.me.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm(current => ({ ...current, [field]: event.target.value }));

  const uploadTo = (slot: "front" | "back" | "proof", field: keyof typeof form) => {
    setUploadingSlot(slot);
    capture(result => {
      setForm(current => ({ ...current, [field]: result.url }));
      setUploadingSlot(null);
    });
  };

  const submit = () => {
    if (form.name.trim().length < 2) return toast.error("Informe seu nome completo.");
    updateProfile.mutate({
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      zipCode: form.zipCode.trim() || undefined,
      cpf: form.cpf.trim() || undefined,
      rg: form.rg.trim() || undefined,
      birthDate: form.birthDate || undefined,
      documentFrontUrl: form.documentFrontUrl || undefined,
      documentBackUrl: form.documentBackUrl || undefined,
      proofAddressUrl: form.proofAddressUrl || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nome completo</Label>
          <Input value={form.name} onChange={set("name")} />
        </div>
        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <Input value={form.email} onChange={set("email")} placeholder="voce@email.com" />
        </div>
        <div className="space-y-1.5">
          <Label>CPF</Label>
          <Input value={form.cpf} onChange={set("cpf")} placeholder="000.000.000-00" />
        </div>
        <div className="space-y-1.5">
          <Label>RG</Label>
          <Input value={form.rg} onChange={set("rg")} />
        </div>
        <div className="space-y-1.5">
          <Label>Data de nascimento</Label>
          <Input type="date" value={form.birthDate} onChange={set("birthDate")} />
        </div>
        <div className="space-y-1.5">
          <Label>CEP</Label>
          <Input value={form.zipCode} onChange={set("zipCode")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Endereço</Label>
          <Input value={form.address} onChange={set("address")} />
        </div>
        <div className="space-y-1.5">
          <Label>Cidade</Label>
          <Input value={form.city} onChange={set("city")} />
        </div>
        <div className="space-y-1.5">
          <Label>UF</Label>
          <Input value={form.state} onChange={set("state")} maxLength={2} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Documentos</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <DocumentSlot
            label="Documento (frente)"
            url={form.documentFrontUrl}
            busy={uploading && uploadingSlot === "front"}
            onSelect={() => uploadTo("front", "documentFrontUrl")}
          />
          <DocumentSlot
            label="Documento (verso)"
            url={form.documentBackUrl}
            busy={uploading && uploadingSlot === "back"}
            onSelect={() => uploadTo("back", "documentBackUrl")}
          />
          <DocumentSlot
            label="Comprovante de endereço"
            url={form.proofAddressUrl}
            busy={uploading && uploadingSlot === "proof"}
            onSelect={() => uploadTo("proof", "proofAddressUrl")}
          />
        </div>
      </div>

      <Button onClick={submit} disabled={updateProfile.isPending} className="gap-2">
        {updateProfile.isPending ? "Salvando…" : "Salvar dados"}
      </Button>
    </div>
  );
}

function OrdersHistory() {
  const orders = trpc.customerAuth.myOrders.useQuery();

  if (orders.isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando pedidos…</p>;
  }
  if (!orders.data?.length) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        <ShoppingBag className="mx-auto mb-2 h-8 w-8 opacity-40" />
        Você ainda não tem pedidos.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.data.map(order => (
        <div key={order.id} className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {order.productImageUrl ? (
              <img src={order.productImageUrl} alt={order.productName} className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-medium">{order.productName}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" /> {fmtDate(order.createdAt)} · {order.quantity}x ·{" "}
                {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[order.status as OrderStatus]}`}>
              {STATUS_LABEL[order.status as OrderStatus]}
            </span>
            <strong>{fmt(order.totalPrice)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MinhaConta() {
  const me = trpc.customerAuth.me.useQuery();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"dados" | "pedidos">("pedidos");

  const logout = trpc.customerAuth.logout.useMutation({
    onSuccess: () => {
      forgetRememberedContact();
      utils.customerAuth.me.invalidate();
      toast.success("Você saiu da sua conta.");
    },
  });

  return (
    <div className="min-h-screen bg-[#f6f8f7]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <BrandLogo compact className="w-[140px]" />
          {me.data ? (
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => logout.mutate()}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          ) : (
            <span />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {me.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !me.data ? (
          <div className="mx-auto max-w-md">
            <CustomerAuthPanel
              defaultContact={contactFromUrl()}
              onSuccess={() => utils.customerAuth.me.invalidate()}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0C4536]/10">
                <UserRound className="h-6 w-6 text-[#0C4536]" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{me.data.name}</h1>
                <p className="text-sm text-muted-foreground">{me.data.contact}</p>
              </div>
            </div>

            <Tabs value={tab} onValueChange={value => setTab(value as "dados" | "pedidos")}>
              <TabsList className="grid h-auto w-full grid-cols-2">
                <TabsTrigger value="pedidos" className="gap-2">
                  <ShoppingBag className="h-4 w-4" /> Meus pedidos
                </TabsTrigger>
                <TabsTrigger value="dados" className="gap-2">
                  <UserRound className="h-4 w-4" /> Meus dados
                </TabsTrigger>
              </TabsList>
              <TabsContent value="pedidos" className="mt-5">
                <OrdersHistory />
              </TabsContent>
              <TabsContent value="dados" className="mt-5">
                <ProfileForm customer={me.data} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
