/**
 * ClienteDetalhe.tsx — Ficha do cliente pessoa física (equipe) /clientes/:id
 *
 * Dados cadastrais, histórico de compras e trilha de comunicações
 * ("conversas") pedidos na evolução comercial — ver
 * docs/ideal-prime/AUDITORIA_EVOLUCAO_COMERCIAL.md. A edição usa
 * `customers.admin.update`; o log de comunicações usa
 * `customers.admin.logCommunication`/`communications`.
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageSquare, Package, Send, User } from "lucide-react";
import { toast } from "sonner";
import { STATUS_COLOR, STATUS_LABEL, PAYMENT_LABEL, type OrderStatus } from "@/lib/orderStatus";

const fmt = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDateTime = (value: string | Date) => new Date(value).toLocaleString("pt-BR");

export default function ClienteDetalhe({ id }: { id: number }) {
  const utils = trpc.useUtils();
  const customer = trpc.customers.admin.get.useQuery({ id });
  const orders = trpc.customers.admin.orders.useQuery({ id });
  const communications = trpc.customers.admin.communications.useQuery({ customerId: id });

  const [edit, setEdit] = useState<Record<string, string>>({});
  const editing = customer.data
    ? {
        name: edit.name ?? customer.data.name ?? "",
        email: edit.email ?? customer.data.email ?? "",
        address: edit.address ?? customer.data.address ?? "",
        city: edit.city ?? customer.data.city ?? "",
        state: edit.state ?? customer.data.state ?? "",
        zipCode: edit.zipCode ?? customer.data.zipCode ?? "",
        cpf: edit.cpf ?? (customer.data as any).cpf ?? "",
        rg: edit.rg ?? (customer.data as any).rg ?? "",
      }
    : null;

  const update = trpc.customers.admin.update.useMutation({
    onSuccess: () => {
      toast.success("Cadastro atualizado.");
      utils.customers.admin.get.invalidate({ id });
    },
    onError: error => toast.error(error.message),
  });

  const [commForm, setCommForm] = useState({ channel: "WHATSAPP" as "WHATSAPP" | "EMAIL", purpose: "", target: "", message: "" });
  const logComm = trpc.customers.admin.logCommunication.useMutation({
    onSuccess: () => {
      toast.success("Comunicação registrada.");
      setCommForm({ channel: "WHATSAPP", purpose: "", target: "", message: "" });
      utils.customers.admin.communications.invalidate({ customerId: id });
    },
    onError: error => toast.error(error.message),
  });

  if (customer.isLoading) {
    return (
      <DashboardLayout>
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </DashboardLayout>
    );
  }
  if (!customer.data) {
    return (
      <DashboardLayout>
        <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/clientes" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0C4536]/10">
            <User className="h-5 w-5 text-[#0C4536]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{customer.data.name}</h1>
            <p className="text-sm text-muted-foreground">{customer.data.contact}</p>
          </div>
        </div>

        <Tabs defaultValue="compras" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="compras" className="gap-1.5">
              <Package className="h-4 w-4" /> Compras
            </TabsTrigger>
            <TabsTrigger value="dados" className="gap-1.5">
              <User className="h-4 w-4" /> Dados
            </TabsTrigger>
            <TabsTrigger value="comunicacoes" className="gap-1.5">
              <MessageSquare className="h-4 w-4" /> Comunicações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compras" className="space-y-3">
            {!orders.data?.length && (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nenhum pedido registrado para este cliente.
              </p>
            )}
            {orders.data?.map((order: any) => (
              <div key={order.id} className="flex flex-col justify-between gap-2 rounded-xl border p-4 sm:flex-row sm:items-center">
                <div>
                  <p className="font-medium">{order.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDateTime(order.createdAt)} · {order.quantity}x · {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[order.status as OrderStatus]}`}>
                    {STATUS_LABEL[order.status as OrderStatus]}
                  </span>
                  <strong>{fmt(order.totalPrice)}</strong>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="dados" className="space-y-4">
            {editing && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input value={editing.name} onChange={e => setEdit(c => ({ ...c, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input value={editing.email} onChange={e => setEdit(c => ({ ...c, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CPF</Label>
                    <Input value={editing.cpf} onChange={e => setEdit(c => ({ ...c, cpf: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>RG</Label>
                    <Input value={editing.rg} onChange={e => setEdit(c => ({ ...c, rg: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Endereço</Label>
                    <Input value={editing.address} onChange={e => setEdit(c => ({ ...c, address: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cidade</Label>
                    <Input value={editing.city} onChange={e => setEdit(c => ({ ...c, city: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>UF</Label>
                    <Input value={editing.state} maxLength={2} onChange={e => setEdit(c => ({ ...c, state: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CEP</Label>
                    <Input value={editing.zipCode} onChange={e => setEdit(c => ({ ...c, zipCode: e.target.value }))} />
                  </div>
                </div>
                <Button
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id, ...editing })}
                >
                  {update.isPending ? "Salvando…" : "Salvar alterações"}
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="comunicacoes" className="space-y-4">
            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-medium">Registrar comunicação</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={commForm.channel} onValueChange={value => setCommForm(c => ({ ...c, channel: value as "WHATSAPP" | "EMAIL" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="EMAIL">E-mail</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Assunto (ex.: confirmação de pedido)"
                  value={commForm.purpose}
                  onChange={e => setCommForm(c => ({ ...c, purpose: e.target.value }))}
                />
                <Input
                  className="sm:col-span-2"
                  placeholder="Contato de destino (WhatsApp ou e-mail)"
                  value={commForm.target}
                  onChange={e => setCommForm(c => ({ ...c, target: e.target.value }))}
                />
                <Textarea
                  className="sm:col-span-2"
                  placeholder="Prévia da mensagem (opcional)"
                  value={commForm.message}
                  onChange={e => setCommForm(c => ({ ...c, message: e.target.value }))}
                />
              </div>
              <Button
                className="mt-3 gap-2"
                disabled={logComm.isPending || commForm.purpose.trim().length < 2 || commForm.target.trim().length < 3}
                onClick={() =>
                  logComm.mutate({
                    customerId: id,
                    channel: commForm.channel,
                    purpose: commForm.purpose.trim(),
                    target: commForm.target.trim(),
                    messagePreview: commForm.message.trim() || undefined,
                  })
                }
              >
                <Send className="h-4 w-4" /> Registrar
              </Button>
            </div>

            <div className="space-y-2">
              {!communications.data?.items.length && (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nenhuma comunicação registrada ainda.
                </p>
              )}
              {communications.data?.items.map((item: any) => (
                <div key={item.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <strong>{item.purpose}</strong>
                    <span className="text-xs text-muted-foreground">{fmtDateTime(item.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.channel === "WHATSAPP" ? "WhatsApp" : "E-mail"} · {item.target}
                  </p>
                  {item.messagePreview && <p className="mt-2 text-sm">{item.messagePreview}</p>}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
