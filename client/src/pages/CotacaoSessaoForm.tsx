/**
 * CotacaoSessaoForm.tsx — Criar nova sessão de cotação
 * PWA mobile-first — seletor de produtos rápido com busca inline
 */

import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Search, Plus, Trash2, AlertCircle, ChevronRight,
  Package, Check, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface Prod {
  produtoId: number; nome: string; categoria: string;
  quantidade: number; unidade: string; obrigatorio: boolean; ordem: number;
}

export default function CotacaoSessaoForm() {
  const params = useParams<{ id?: string }>();
  const sessaoId = params.id ? Number(params.id) : null;
  const [, nav] = useLocation();
  const utils = trpc.useUtils();

  const [titulo, setTitulo]     = useState("");
  const [busca, setBusca]       = useState("");
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const [produtos, setProdutos] = useState<Prod[]>([]);
  const [criandoProduto, setCriandoProduto] = useState(false);

  const { data: todosProd, isLoading: loadProd } = trpc.products.list.useQuery();
  const { data: sessaoExist, isLoading: loadSessao } = trpc.cotacao.sessoes.obter.useQuery(
    { id: sessaoId! }, { enabled: !!sessaoId }
  );

  useEffect(() => {
    if (sessaoExist) {
      setTitulo(sessaoExist.titulo);
      setProdutos(sessaoExist.produtos.map(p => ({
        produtoId: p.produtoId, nome: p.produtoNome, categoria: p.produtoCategoria,
        quantidade: parseFloat(String(p.quantidade)),
        unidade: p.unidade ?? "un", obrigatorio: p.obrigatorio, ordem: p.ordem,
      })));
    }
  }, [sessaoExist]);

  const criar = trpc.cotacao.sessoes.criar.useMutation({
    onSuccess: (d) => {
      utils.cotacao.sessoes.listar.invalidate();
      toast.success("Sessão criada!");
      nav(`/cotacoes/${d.id}/coletar`);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const atualizar = trpc.cotacao.sessoes.atualizar.useMutation({
    onSuccess: () => {
      utils.cotacao.sessoes.listar.invalidate();
      toast.success("Sessão atualizada");
      nav("/cotacoes");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const criarProdutoRapido = trpc.products.quickCreate.useMutation({
    onSuccess: (produto: any) => {
      utils.products.list.invalidate();
      add(produto);
      setBusca("");
      setCriandoProduto(false);
      setMostrarBusca(false);
      toast.success("Produto criado e adicionado à cotação");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtrados = (todosProd ?? []).filter(p =>
    !produtos.find(sp => sp.produtoId === p.id) &&
    (busca === "" || p.name.toLowerCase().includes(busca.toLowerCase()))
  );

  function add(p: any) {
    setProdutos(prev => [...prev, {
      produtoId: p.id, nome: p.name, categoria: p.category,
      quantidade: 1, unidade: "un", obrigatorio: false, ordem: prev.length,
    }]);
  }

  function remove(idx: number) { setProdutos(prev => prev.filter((_, i) => i !== idx)); }

  function save() {
    if (!titulo.trim()) { toast.error("Informe o título"); return; }
    if (produtos.length === 0) { toast.error("Adicione pelo menos um produto"); return; }
    if (sessaoId) {
      atualizar.mutate({ id: sessaoId, titulo });
    } else {
      criar.mutate({
        titulo,
        produtos: produtos.map((p, i) => ({
          produtoId: p.produtoId, quantidade: p.quantidade,
          unidade: p.unidade, obrigatorio: p.obrigatorio, ordem: i,
        })),
      });
    }
  }

  const saving = criar.isPending || atualizar.isPending;

  return (
    <div className="min-h-svh bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-[oklch(0.30_0.13_240)] text-white px-4 pt-10 pb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => nav("/cotacoes")} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/10 active:bg-white/20 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-base font-bold">{sessaoId ? "Editar Sessão" : "Nova Sessão"}</h1>
            <p className="text-xs opacity-60">{sessaoId ? "Altere os dados" : "Defina o que pesquisar"}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        <div className="px-4 py-4 space-y-4">
          {/* Título */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              Título da cotação *
            </label>
            <input
              className="w-full text-base font-medium bg-transparent outline-none placeholder:text-muted-foreground/50"
              placeholder="Ex: Feira + Atacado — semana 23"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              autoFocus
            />
          </div>

          {/* Produtos selecionados */}
          {!sessaoId && (
            <>
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Produtos ({produtos.length})
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => nav("/produtos")}
                    className="text-xs font-medium text-muted-foreground flex items-center gap-1"
                  >
                    Produtos <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setMostrarBusca(v => !v)}
                    className="text-xs font-medium text-primary flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Busca inline */}
              {mostrarBusca && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      autoFocus
                      className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50"
                      placeholder="Buscar produto..."
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                    />
                    {busca && (
                      <button onClick={() => setBusca("")} className="text-muted-foreground hover:text-foreground">
                        ×
                      </button>
                    )}
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                    {loadProd && (
                      <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
                    )}
                    {!loadProd && filtrados.length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground space-y-3">
                        <p>{busca ? "Nenhum produto encontrado" : "Todos os produtos já adicionados"}</p>
                        {busca.trim() && (
                          <button
                            onClick={() => criarProdutoRapido.mutate({ name: busca.trim(), category: "OUTRO", notes: "Criado rapidamente pela cotação" })}
                            disabled={criandoProduto || criarProdutoRapido.isPending}
                            className="w-full rounded-xl bg-primary text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                          >
                            {criarProdutoRapido.isPending ? "Criando..." : `Criar produto “${busca.trim()}” agora`}
                          </button>
                        )}
                        <button onClick={() => nav("/produtos")} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-muted-foreground flex items-center justify-center gap-1">
                          Abrir lista completa de produtos <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {filtrados.slice(0, 30).map(p => (
                      <button
                        key={p.id}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                        onClick={() => { add(p); if (filtrados.length <= 1) setMostrarBusca(false); }}
                      >
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.category}</p>
                        </div>
                        <Plus className="h-4 w-4 text-primary shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de selecionados */}
              {produtos.length === 0 ? (
                <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
                  <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Adicione os produtos que serão pesquisados</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                  {produtos.map((p, i) => (
                    <div key={p.produtoId} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{p.categoria}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Qtd */}
                        <div className="flex items-center gap-1">
                          <button
                            className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold active:bg-gray-200"
                            onClick={() => setProdutos(prev => prev.map((x, j) => j === i ? { ...x, quantidade: Math.max(0.5, x.quantidade - (x.quantidade <= 1 ? 0.5 : 1)) } : x))}
                          >−</button>
                          <span className="text-sm font-semibold w-7 text-center">{p.quantidade}</span>
                          <button
                            className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold active:bg-gray-200"
                            onClick={() => setProdutos(prev => prev.map((x, j) => j === i ? { ...x, quantidade: x.quantidade + 1 } : x))}
                          >+</button>
                        </div>
                        {/* Unidade */}
                        <input
                          value={p.unidade}
                          onChange={e => setProdutos(prev => prev.map((x, j) => j === i ? { ...x, unidade: e.target.value } : x))}
                          className="w-10 text-xs text-center bg-gray-100 rounded-lg py-1 outline-none"
                        />
                        {/* Obrigatório */}
                        <button
                          title="Produto obrigatório"
                          onClick={() => setProdutos(prev => prev.map((x, j) => j === i ? { ...x, obrigatorio: !x.obrigatorio } : x))}
                          className={`h-6 w-6 rounded-full flex items-center justify-center transition-colors ${p.obrigatorio ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400"}`}
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                        </button>
                        {/* Remover */}
                        <button
                          onClick={() => remove(i)}
                          className="h-6 w-6 rounded-full flex items-center justify-center bg-red-50 text-red-500 active:bg-red-100 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {produtos.length > 0 && (
                <p className="text-xs text-muted-foreground px-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  Toque no <span className="font-medium">!</span> para marcar produto obrigatório — locais sem ele serão desqualificados
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Botão salvar fixo */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-gray-50 to-transparent max-w-md mx-auto">
        <button
          onClick={save}
          disabled={saving}
          className="w-full h-14 rounded-2xl bg-[oklch(0.30_0.13_240)] text-white font-semibold shadow-lg flex items-center justify-center gap-2 active:scale-[0.97] transition-transform text-base disabled:opacity-50"
        >
          {saving ? "Salvando..." : sessaoId ? "Salvar alterações" : `Criar e ir a campo →`}
        </button>
      </div>
    </div>
  );
}
