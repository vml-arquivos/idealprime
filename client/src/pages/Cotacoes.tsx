/**
 * Cotacoes.tsx — Dashboard principal do módulo de cotação
 * PWA mobile-first, layout próprio para uso em campo
 */

import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ShoppingCart, Plus, MapPin, BarChart3, MoreVertical, Trash2,
  CheckCircle, Clock, XCircle, Tag, LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS = {
  em_andamento: { label: "Em andamento", dot: "bg-amber-500",   icon: Clock },
  concluida:    { label: "Concluída",    dot: "bg-emerald-500", icon: CheckCircle },
  cancelada:    { label: "Cancelada",    dot: "bg-red-400",     icon: XCircle },
} as const;

export default function Cotacoes() {
  const [, nav] = useLocation();
  const utils = trpc.useUtils();

  const { data: sessoes, isLoading } = trpc.cotacao.sessoes.listar.useQuery();
  const { data: locais } = trpc.cotacao.locais.listar.useQuery();

  const remover = trpc.cotacao.sessoes.remover.useMutation({
    onSuccess: () => { utils.cotacao.sessoes.listar.invalidate(); toast.success("Sessão removida"); },
    onError: (e: any) => toast.error(e.message),
  });
  const atualizar = trpc.cotacao.sessoes.atualizar.useMutation({
    onSuccess: () => { utils.cotacao.sessoes.listar.invalidate(); toast.success("Status atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const emAndamento = sessoes?.filter(s => s.status === "em_andamento") ?? [];
  const concluidas  = sessoes?.filter(s => s.status !== "em_andamento") ?? [];

  return (
    <div className="min-h-svh bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-[oklch(0.30_0.13_240)] text-white px-4 pt-10 pb-5">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => nav("/dashboard")} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors">
            <LayoutDashboard className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-bold tracking-tight">Cotações</h1>
            <p className="text-xs opacity-60">Pesquisa de preços</p>
          </div>
          <button onClick={() => nav("/cotacoes/locais")} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors relative">
            <MapPin className="h-5 w-5" />
            {(locais?.length ?? 0) > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-amber-400 rounded-full ring-2 ring-[oklch(0.30_0.13_240)]" />
            )}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatChip label="Sessões" val={sessoes?.length ?? 0} />
          <StatChip label="Em campo" val={emAndamento.length} highlight />
          <StatChip label="Locais" val={locais?.length ?? 0} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-28">
        <div className="px-4 py-4 space-y-5">
          {emAndamento.length > 0 && (
            <Section title="Em campo agora">
              {emAndamento.map(s => (
                <SessaoCard key={s.id} sessao={s} nav={nav} remover={remover} atualizar={atualizar} />
              ))}
            </Section>
          )}
          {concluidas.length > 0 && (
            <Section title="Histórico">
              {concluidas.map(s => (
                <SessaoCard key={s.id} sessao={s} nav={nav} remover={remover} atualizar={atualizar} />
              ))}
            </Section>
          )}
          {isLoading && [0,1,2].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          {!isLoading && (!sessoes || sessoes.length === 0) && <EmptyState onNew={() => nav("/cotacoes/nova")} />}
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-gray-50 to-transparent max-w-md mx-auto">
        <button
          onClick={() => nav("/cotacoes/nova")}
          className="w-full h-14 rounded-2xl bg-[oklch(0.30_0.13_240)] text-white font-semibold shadow-lg flex items-center justify-center gap-2 active:scale-[0.97] transition-transform text-base"
        >
          <Plus className="h-5 w-5" />
          Nova Cotação
        </button>
      </div>
    </div>
  );
}

function StatChip({ label, val, highlight }: { label: string; val: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 text-center ${highlight ? "bg-amber-400/25" : "bg-white/10"}`}>
      <div className="text-2xl font-bold leading-none">{val}</div>
      <div className="text-[11px] opacity-70 mt-0.5">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">{title}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center">
        <ShoppingCart className="h-10 w-10 text-primary" />
      </div>
      <div>
        <p className="font-semibold text-lg">Nenhuma cotação ainda</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-[220px]">Crie uma sessão e vá a campo pesquisar preços</p>
      </div>
    </div>
  );
}

function SessaoCard({ sessao, nav, remover, atualizar }: any) {
  const cfg = STATUS[sessao.status as keyof typeof STATUS];
  const total = (sessao as any).totalProdutos ?? 0;
  const destino = sessao.status === "em_andamento" ? `/cotacoes/${sessao.id}/coletar` : `/cotacoes/${sessao.id}/comparativo`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button className="w-full text-left p-4 active:bg-gray-50 transition-colors" onClick={() => nav(destino)}>
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot} shrink-0`} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{sessao.titulo}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" />{total} produto{total !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(sessao.createdAt), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              sessao.status === "em_andamento" ? "bg-primary/10 text-primary" : "bg-emerald-50 text-emerald-700"
            }`}>
              {sessao.status === "em_andamento" ? "Coletar →" : "Ver →"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 transition-colors" onClick={e => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => nav(`/cotacoes/${sessao.id}/comparativo`)}>
                  <BarChart3 className="h-4 w-4 mr-2" /> Comparativo
                </DropdownMenuItem>
                {sessao.status === "em_andamento" && (
                  <DropdownMenuItem onClick={() => atualizar.mutate({ id: sessao.id, status: "concluida" })}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Concluir
                  </DropdownMenuItem>
                )}
                {sessao.status === "concluida" && (
                  <DropdownMenuItem onClick={() => atualizar.mutate({ id: sessao.id, status: "em_andamento" })}>
                    <Clock className="h-4 w-4 mr-2" /> Reabrir
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={e => e.preventDefault()}>
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir "{sessao.titulo}"?</AlertDialogTitle>
                      <AlertDialogDescription>Todos os preços coletados serão removidos.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => remover.mutate({ id: sessao.id })}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </button>
    </div>
  );
}
