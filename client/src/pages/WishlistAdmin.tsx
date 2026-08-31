/**
 * WishlistAdmin.tsx — Painel admin /desejos-admin
 *
 * Gerenciamento completo de pedidos da lista de desejos:
 * - Listagem com filtros por status e categoria
 * - Expansão inline com notas e ações de status
 * - Exportação CSV
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Heart,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  CELULAR: "📱 Celular",
  ELETRONICO: "💻 Eletrônico",
  PERFUME: "🌸 Perfume",
  OUTRO: "📦 Outro",
};

const STATUS_OPTIONS = [
  { value: "NOVO", label: "Novo", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "VISUALIZADO", label: "Visualizado", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "CONTATADO", label: "Contatado", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "ATENDIDO", label: "Atendido", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "FECHADO", label: "Fechado", color: "bg-gray-100 text-gray-600 border-gray-200" },
];

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ─── Componente ───────────────────────────────────────────────────────────────

export default function WishlistAdmin() {
  const utils = trpc.useUtils();
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});

  const { data: requests = [], isLoading, refetch } = trpc.wishlist.list.useQuery(
    {
      status: filterStatus as any || undefined,
      category: filterCategory || undefined,
    },
    { refetchInterval: 30_000 }
  );

  // Produtos do catálogo para resolver nomes a partir dos productIds
  const { data: catalogProducts = [] } = trpc.marketplace.products.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const productMap = new Map((catalogProducts as any[]).map((p: any) => [p.id, p]));

  const updateStatus = trpc.wishlist.updateStatus.useMutation({
    onSuccess: (updated) => {
      utils.wishlist.list.invalidate();
      utils.wishlist.counts.invalidate();
      toast.success(`Status atualizado para "${updated.status}"`);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteRequest = trpc.wishlist.delete.useMutation({
    onSuccess: () => {
      utils.wishlist.list.invalidate();
      utils.wishlist.counts.invalidate();
      toast.success("Pedido excluído.");
    },
    onError: (e) => toast.error(e.message),
  });

  // Filtro de busca local (nome, contato, descrição)
  const filtered = (requests as any[]).filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.visitorName.toLowerCase().includes(q) ||
      r.contact.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      (r.brand && r.brand.toLowerCase().includes(q)) ||
      (r.model && r.model.toLowerCase().includes(q))
    );
  });

  // Exportação CSV
  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum pedido para exportar");
      return;
    }
    const rows: string[][] = [
      [
        "ID",
        "Nome",
        "Contato",
        "Tipo",
        "Categoria",
        "Marca",
        "Modelo",
        "Descrição",
        "Orçamento Mín",
        "Orçamento Máx",
        "Status",
        "Notas Admin",
        "Data",
      ],
    ];
    (filtered as any[]).forEach((r) => {
      rows.push([
        String(r.id),
        r.visitorName,
        r.contact,
        r.contactType,
        r.category ?? "",
        r.brand ?? "",
        r.model ?? "",
        r.description,
        r.budgetMin > 0 ? formatBRL(r.budgetMin) : "",
        r.budgetMax > 0 ? formatBRL(r.budgetMax) : "",
        r.status,
        r.adminNotes ?? "",
        new Date(r.createdAt).toLocaleDateString("pt-BR"),
      ]);
    });
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell);
            return s.includes(",") || s.includes('"')
              ? `"${s.replace(/"/g, '""')}"`
              : s;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `desejos-${new Date().toISOString().split("T")[0]}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Contadores por status
  const counts = STATUS_OPTIONS.reduce<Record<string, number>>((acc, s) => {
    acc[s.value] = (requests as any[]).filter((r) => r.status === s.value).length;
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
              <Heart className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Lista de Desejos</h1>
              <p className="text-sm text-muted-foreground">
                {(requests as any[]).length} pedido
                {(requests as any[]).length !== 1 ? "s" : ""} registrado
                {(requests as any[]).length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={exportCSV}
              disabled={(requests as any[]).length === 0}
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Badges de contagem por status */}
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() =>
                setFilterStatus(filterStatus === s.value ? "" : s.value)
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filterStatus === s.value
                  ? s.color + " ring-2 ring-offset-1 ring-current"
                  : "bg-muted text-muted-foreground border-transparent hover:border-border"
              }`}
            >
              {s.label}
              <span className="font-bold">{counts[s.value] ?? 0}</span>
            </button>
          ))}
          {filterStatus && (
            <button
              onClick={() => setFilterStatus("")}
              className="text-xs text-muted-foreground hover:text-foreground underline px-1"
            >
              Limpar filtro
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, contato, descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filterCategory || "all"}
            onValueChange={(v) => setFilterCategory(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <Heart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {search || filterStatus || filterCategory
                ? "Nenhum pedido encontrado com os filtros aplicados."
                : "Nenhum pedido registrado ainda."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {(filtered as any[]).map((req) => {
              const isExpanded = expandedId === req.id;
              const statusCfg =
                STATUS_OPTIONS.find((s) => s.value === req.status) ??
                STATUS_OPTIONS[0];
              const notes = editingNotes[req.id] ?? req.adminNotes ?? "";

              return (
                <div
                  key={req.id}
                  className="rounded-xl border bg-card overflow-hidden transition-all"
                >
                  {/* Linha principal — clicável para expandir */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : req.id)
                    }
                  >
                    {/* Badge de status */}
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${statusCfg.color}`}
                    >
                      {statusCfg.label}
                    </span>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {req.visitorName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {req.contactType === "WHATSAPP" ? "📱" : "📧"}{" "}
                          {req.contact}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                        {(req as any).notesPublic || req.description || (() => {
                          const ids: number[] = (req as any).productIds ?? [];
                          const names = ids.map((id: number) => productMap.get(id)?.name).filter(Boolean);
                          return names.length > 0 ? names.join(", ") : `${ids.length} produto(s)`;
                        })()}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {req.category && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            {CATEGORY_LABELS[req.category] ?? req.category}
                          </span>
                        )}
                        {req.brand && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            {req.brand}
                          </span>
                        )}
                        {req.model && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            {req.model}
                          </span>
                        )}
                        {(req.budgetMin > 0 || req.budgetMax > 0) && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            💰{" "}
                            {req.budgetMax > 0
                              ? `até ${formatBRL(req.budgetMax)}`
                              : `a partir de ${formatBRL(req.budgetMin)}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Data + expand icon */}
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {new Date(req.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </p>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 mt-1 ml-auto text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 mt-1 ml-auto text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Painel expandido */}
                  {isExpanded && (
                    <div className="border-t px-4 py-4 space-y-4 bg-muted/20">

                      {/* Produtos selecionados */}
                      {(() => {
                        const ids: number[] = (req as any).productIds ?? [];
                        const resolved = ids.map((id: number) => productMap.get(id)).filter(Boolean);
                        if (resolved.length > 0) return (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">Produtos solicitados</p>
                            <div className="space-y-1.5">
                              {resolved.map((p: any) => (
                                <div key={p.id} className="flex items-center gap-2 text-sm">
                                  {p.imageUrl
                                    ? <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded object-contain bg-muted border shrink-0" />
                                    : <div className="w-8 h-8 rounded bg-muted border shrink-0 flex items-center justify-center text-muted-foreground text-xs">📦</div>
                                  }
                                  <span className="font-medium">{p.name}</span>
                                  {p.suggestedPricePix > 0 && (
                                    <span className="text-xs text-muted-foreground ml-auto">{formatBRL(p.suggestedPricePix)} Pix</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                        if (ids.length > 0) return (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Produtos solicitados</p>
                            <p className="text-sm text-muted-foreground">{ids.length} produto(s) — não encontrados no catálogo atual</p>
                          </div>
                        );
                        return null;
                      })()}

                      {/* Desejo livre / observação pública */}
                      {(req as any).notesPublic && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Observação do cliente</p>
                          <p className="text-sm bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">{(req as any).notesPublic}</p>
                        </div>
                      )}

                      {/* Descrição legada (pedidos antigos) */}
                      {req.description && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Descrição completa</p>
                          <p className="text-sm">{req.description}</p>
                        </div>
                      )}

                      {/* Notas admin */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Notas internas
                        </label>
                        <Textarea
                          value={notes}
                          onChange={(e) =>
                            setEditingNotes((n) => ({
                              ...n,
                              [req.id]: e.target.value,
                            }))
                          }
                          placeholder="Anotações do atendimento (não visível ao visitante)..."
                          rows={2}
                          className="resize-none text-sm"
                        />
                      </div>

                      {/* Ações de status */}
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs text-muted-foreground mr-1">
                          Alterar status:
                        </span>
                        {STATUS_OPTIONS.filter(
                          (s) => s.value !== req.status
                        ).map((s) => (
                          <Button
                            key={s.value}
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={updateStatus.isPending}
                            onClick={() =>
                              updateStatus.mutate({
                                id: req.id,
                                status: s.value as any,
                                adminNotes: notes || undefined,
                              })
                            }
                          >
                            {s.label}
                          </Button>
                        ))}
                        <div className="ml-auto">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={deleteRequest.isPending}
                            onClick={() => {
                              if (
                                confirm(
                                  `Excluir o pedido de ${req.visitorName}?`
                                )
                              ) {
                                deleteRequest.mutate({ id: req.id });
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
