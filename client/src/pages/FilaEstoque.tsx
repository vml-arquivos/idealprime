import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Clock3, Layers3, PackageCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

type QueueStatus = "ATIVO" | "EM_ESPERA" | "ESGOTADO" | "CANCELADO";

const STATUS: Record<QueueStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  ATIVO: { label: "Lote ativo", icon: PackageCheck, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  EM_ESPERA: { label: "Em espera", icon: Clock3, className: "border-amber-200 bg-amber-50 text-amber-700" },
  ESGOTADO: { label: "Esgotado", icon: CheckCircle2, className: "border-slate-200 bg-slate-50 text-slate-600" },
  CANCELADO: { label: "Cancelado", icon: XCircle, className: "border-red-200 bg-red-50 text-red-700" },
};

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FilaEstoque() {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<QueueStatus | "TODOS">("TODOS");
  const queues = trpc.batches.allQueues.useQuery(status === "TODOS" ? {} : { status });
  const products = trpc.products.list.useQuery();
  const cancel = trpc.batches.cancelQueue.useMutation({
    onSuccess: async () => {
      toast.success("Entrada removida da fila de espera.");
      await utils.batches.allQueues.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const productById = useMemo(
    () => new Map((products.data ?? []).map((product: any) => [Number(product.id), product])),
    [products.data],
  );

  const summary = useMemo(() => {
    const rows = queues.data ?? [];
    return {
      active: rows.filter((entry: any) => entry.status === "ATIVO").length,
      waiting: rows.filter((entry: any) => entry.status === "EM_ESPERA").length,
      exhausted: rows.filter((entry: any) => entry.status === "ESGOTADO").length,
    };
  }, [queues.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#215b94]">Controle de estoque</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <Layers3 className="h-6 w-6 text-[#067c52]" /> Fila FIFO
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Acompanhe qual lote está vendendo agora e quais entradas aguardam sua vez. Um lote novo só assume o estoque quando o lote ativo zera.
          </p>
        </div>
        <div className="min-w-52 space-y-2">
          <Label>Filtrar situação</Label>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as QueueStatus | "TODOS")}
          >
            <option value="TODOS">Todos os lotes</option>
            <option value="ATIVO">Ativos</option>
            <option value="EM_ESPERA">Em espera</option>
            <option value="ESGOTADO">Esgotados</option>
            <option value="CANCELADO">Cancelados</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="pt-5"><div className="text-2xl font-semibold text-emerald-700">{summary.active}</div><div className="text-xs text-muted-foreground">lotes ativos exibidos</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-2xl font-semibold text-amber-700">{summary.waiting}</div><div className="text-xs text-muted-foreground">lotes aguardando</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-2xl font-semibold">{summary.exhausted}</div><div className="text-xs text-muted-foreground">lotes esgotados exibidos</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ordem dos lotes</CardTitle>
          <CardDescription>
            A importação por planilha não sobrescreve produtos que tenham lote em espera; novas compras devem entrar por Entrada/FIFO.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {queues.isLoading && <div className="py-10 text-center text-sm text-muted-foreground">Carregando fila…</div>}
          {!queues.isLoading && !queues.data?.length && (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              Nenhuma entrada de fila encontrada para este filtro.
            </div>
          )}
          {queues.data?.map((entry: any) => {
            const product: any = productById.get(Number(entry.productId));
            const config = STATUS[entry.status as QueueStatus] ?? STATUS.EM_ESPERA;
            const Icon = config.icon;
            return (
              <div key={entry.id} className="flex flex-col gap-4 rounded-xl border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="truncate">{product?.name || `Produto #${entry.productId}`}</strong>
                    <Badge variant="outline" className={config.className}>
                      <Icon className="mr-1 h-3 w-3" /> {config.label}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {product?.sku ? `SKU ${product.sku} · ` : ""}posição {entry.position} · fila #{entry.id}
                    {entry.batchId ? ` · entrada #${entry.batchId}` : ""}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                  <div><span className="block text-[11px] text-muted-foreground">Quantidade</span><strong>{Number(entry.quantity || 0).toLocaleString("pt-BR")}</strong></div>
                  <div><span className="block text-[11px] text-muted-foreground">Saldo do lote</span><strong>{Number(entry.quantityRemaining || 0).toLocaleString("pt-BR")}</strong></div>
                  <div><span className="block text-[11px] text-muted-foreground">Custo unit.</span><strong>{money(Number(entry.unitCost || 0))}</strong></div>
                  <div><span className="block text-[11px] text-muted-foreground">Ativado</span><strong>{entry.activatedAt ? new Date(entry.activatedAt).toLocaleDateString("pt-BR") : "—"}</strong></div>
                </div>
                {entry.status === "EM_ESPERA" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate({ queueId: Number(entry.id) })}
                  >
                    Cancelar entrada
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Não use ajuste agregado de estoque para simular compra de um novo lote. Use <strong>Entrada</strong>, pois é ali que o custo e a posição FIFO ficam registrados.</span>
      </div>
    </div>
  );
}
