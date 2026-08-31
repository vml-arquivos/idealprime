/**
 * CotacaoColeta.tsx — Coleta de preços em campo
 * Câmera real por produto, auto-save, progresso, offline
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, CheckCircle2, Circle, Plus, WifiOff, RefreshCw, BarChart3, ChevronDown, Camera, Mic, ScanLine, X, Package, Search, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";
import { useCotacaoOffline } from "@/hooks/useCotacaoOffline";
import { useCameraUpload } from "@/hooks/useCameraUpload";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

type PMap = Record<string, string>;
type NSet = Set<string>;
type FotoMap = Record<string, string>; // key → dataUrl (preview)

export default function CotacaoColeta() {
  const { id } = useParams<{ id: string }>();
  const sessaoId = Number(id);
  const [, nav] = useLocation();
  const utils = trpc.useUtils();

  const [localId, setLocalId]         = useState<number | null>(null);
  const [precos, setPrecos]           = useState<PMap>({});
  const [naoAchados, setNaoAchados]   = useState<NSet>(new Set());
  const [fotosPreview, setFotosPreview] = useState<FotoMap>({});
  const [produtoSheet, setProdutoSheet] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState("");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const [campoAtivo, setCampoAtivo] = useState<{ spId: number; lId: number } | null>(null);

  const { data: sessao, isLoading } = trpc.cotacao.sessoes.obter.useQuery({ id: sessaoId });
  const { data: locais } = trpc.cotacao.locais.listar.useQuery();
  const { data: todosProdutos } = trpc.products.list.useQuery();
  const { data: precosSalvos } = trpc.cotacao.precos.listarSessao.useQuery({ sessaoId });

  useEffect(() => {
    if (!precosSalvos) return;
    const m: PMap = {};
    const n = new Set<string>();
    const f: FotoMap = {};
    for (const p of precosSalvos) {
      const k = `${p.sessaoProdutoId}-${p.localId}`;
      m[k] = p.precoUnitario != null ? String(p.precoUnitario) : "";
      if (!p.encontrado) n.add(k);
      if (p.fotoPreco) f[k] = p.fotoPreco;
    }
    setPrecos(m);
    setNaoAchados(n);
    setFotosPreview(f);
  }, [precosSalvos]);

  useEffect(() => {
    if (locais && locais.length > 0 && !localId) setLocalId(locais[0].id);
  }, [locais]);

  const { isOnline, pendingCount, syncNow } = useCotacaoOffline(sessaoId);
  const { capture, uploading: uploadingFoto } = useCameraUpload();

  const registrar = trpc.cotacao.precos.registrar.useMutation({
    onSuccess: () => utils.cotacao.precos.listarSessao.invalidate({ sessaoId }),
  });

  const adicionarProdutoSessao = trpc.cotacao.sessoes.adicionarProduto.useMutation({
    onSuccess: () => {
      utils.cotacao.sessoes.obter.invalidate({ id: sessaoId });
      setProdutoSheet(false);
      setBuscaProduto("");
      toast.success("Produto incluído na cotação");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const criarProdutoRapido = trpc.products.quickCreate.useMutation({
    onError: (e: any) => toast.error(e.message),
  });

  async function criarEAdicionarProduto() {
    const nome = buscaProduto.trim();
    if (!nome) { toast.error("Digite o nome do produto"); return; }
    const produto: any = await criarProdutoRapido.mutateAsync({ name: nome, category: "OUTRO", notes: "Criado rapidamente durante coleta de cotação" });
    await utils.products.list.invalidate();
    adicionarProdutoSessao.mutate({ sessaoId, produtoId: produto.id, quantidade: 1, unidade: "un", obrigatorio: false });
  }

  const produtosDisponiveis = (todosProdutos ?? []).filter((p: any) =>
    !(sessao?.produtos ?? []).some((sp: any) => sp.produtoId === p.id) &&
    (!buscaProduto.trim() || p.name.toLowerCase().includes(buscaProduto.trim().toLowerCase()))
  );

  const autoSave = useCallback((spId: number, lId: number, val: string, encontrado: boolean, fotoUrl?: string) => {
    const k = `${spId}-${lId}`;
    clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(() => {
      const preco = parseFloat(val.replace(",", "."));
      registrar.mutate({
        sessaoId, sessaoProdutoId: spId, localId: lId,
        precoUnitario: encontrado && !isNaN(preco) ? preco : null,
        encontrado,
        fotoPreco: fotoUrl,
      });
      if (navigator.vibrate) navigator.vibrate(25);
      toast.success("Salvo", { duration: 800, position: "bottom-center", style: { fontSize: "13px" } });
    }, 500);
  }, [sessaoId, registrar]);

  const aplicarDitado = useCallback((text: string) => {
    if (!campoAtivo || !localId) {
      toast.info("Toque primeiro em um campo de preço para aplicar o ditado.");
      return;
    }
    const match = text.replace(/,/g, ".").match(/\d+(?:\.\d{1,2})?/);
    if (!match) {
      toast.error("O ditado não trouxe um valor numérico reconhecível.");
      return;
    }
    const value = match[0];
    const key = `${campoAtivo.spId}-${campoAtivo.lId}`;
    setPrecos((previous) => ({ ...previous, [key]: value }));
    if (!naoAchados.has(key)) autoSave(campoAtivo.spId, campoAtivo.lId, value, true);
  }, [autoSave, campoAtivo, localId, naoAchados]);

  const voice = useVoiceRecorder({ onTranscript: aplicarDitado });

  function abrirScanner() {
    if (!("BarcodeDetector" in window)) {
      toast.info("O escaneamento não é suportado neste navegador. Use a busca manual.");
      return;
    }
    scanInputRef.current?.click();
  }

  async function processarScan(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const Detector = (window as any).BarcodeDetector;
      const detector = new Detector();
      const image = new Image();
      const imageUrl = URL.createObjectURL(file);
      image.src = imageUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      });
      const detected = await detector.detect(image);
      URL.revokeObjectURL(imageUrl);
      const value = detected?.[0]?.rawValue?.trim();
      if (!value) throw new Error("Nenhum QR ou código de barras foi encontrado.");
      setBuscaProduto(value);
      setProdutoSheet(true);
      toast.success("Código lido. Confira o produto antes de incluir.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao escanear o código.");
    }
  }

  function handleValor(spId: number, val: string) {
    if (!localId) return;
    const k = `${spId}-${localId}`;
    setPrecos(p => ({ ...p, [k]: val }));
    if (!naoAchados.has(k)) autoSave(spId, localId, val, true);
  }

  function toggleNaoAchado(spId: number) {
    if (!localId) return;
    const k = `${spId}-${localId}`;
    setNaoAchados(prev => {
      const next = new Set(prev);
      if (next.has(k)) { next.delete(k); autoSave(spId, localId, precos[k] ?? "", true); }
      else { next.add(k); autoSave(spId, localId, "", false); }
      return next;
    });
  }

  function handleFoto(spId: number) {
    if (!localId) return;
    const k = `${spId}-${localId}`;
    capture(({ url, dataUrl }) => {
      setFotosPreview(prev => ({ ...prev, [k]: dataUrl }));
      autoSave(spId, localId, precos[k] ?? "", !naoAchados.has(k), url);
    });
  }

  function removeFoto(spId: number) {
    if (!localId) return;
    const k = `${spId}-${localId}`;
    setFotosPreview(prev => { const n = { ...prev }; delete n[k]; return n; });
    autoSave(spId, localId, precos[k] ?? "", !naoAchados.has(k), undefined);
  }

  function handleEnter(e: React.KeyboardEvent, idx: number, prods: any[]) {
    if (e.key === "Enter") {
      const next = prods[idx + 1];
      if (next && localId) inputRefs.current[`${next.id}-${localId}`]?.focus();
    }
  }

  if (isLoading) return (
    <div className="min-h-svh bg-gray-50 max-w-md mx-auto p-4 space-y-3">
      {[0,1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
    </div>
  );

  if (!sessao) return <div className="min-h-svh flex items-center justify-center text-muted-foreground">Sessão não encontrada</div>;

  const prods = sessao.produtos ?? [];
  const cotados = localId ? prods.filter(p => {
    const k = `${p.id}-${localId}`;
    return (precos[k] !== undefined && precos[k] !== "" && !naoAchados.has(k)) || naoAchados.has(k);
  }).length : 0;
  const pct = prods.length > 0 ? Math.round((cotados / prods.length) * 100) : 0;
  const concluido = pct === 100;

  return (
    <div className="min-h-svh bg-gray-50 flex flex-col max-w-md mx-auto">
      <input
        ref={scanInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={processarScan}
        className="hidden"
        aria-label="Escanear QR ou código de barras"
      />
      {/* Header fixo */}
      <div className="bg-[oklch(0.30_0.13_240)] text-white px-4 pt-10 pb-0 sticky top-0 z-20">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => nav("/cotacoes")} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/10 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{sessao.titulo}</p>
            <p className="text-xs opacity-60">{prods.length} produtos</p>
          </div>
          <button
            onClick={abrirScanner}
            title="Escanear QR ou código de barras"
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 hover:bg-white/10"
          >
            <ScanLine className="h-4 w-4" />
          </button>
          <button
            onClick={() => (voice.recording ? voice.stop() : voice.start())}
            disabled={!voice.supported || voice.uploading}
            title={!voice.supported ? "Ditado não suportado neste navegador" : "Ditar preço"}
            className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${voice.recording ? "bg-red-500 text-white animate-pulse" : "hover:bg-white/10"} disabled:opacity-40`}
          >
            <Mic className="h-4 w-4" />
          </button>
          {!isOnline ? (
            <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded-full flex items-center gap-1">
              <WifiOff className="h-3 w-3" /> Offline
            </span>
          ) : pendingCount > 0 ? (
            <button onClick={syncNow} className="text-xs bg-white/10 text-white px-2 py-1 rounded-full flex items-center gap-1 active:bg-white/20">
              <RefreshCw className="h-3 w-3" /> {pendingCount}
            </button>
          ) : null}
          <button onClick={() => nav(`/cotacoes/${sessaoId}/comparativo`)} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/10 shrink-0">
            <BarChart3 className="h-5 w-5" />
          </button>
        </div>

        {/* Seletor de local */}
        <div className="mb-3">
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
            <MapPin className="h-4 w-4 opacity-70 shrink-0" />
            <select
              className="flex-1 bg-transparent text-white text-sm font-medium outline-none appearance-none"
              value={localId?.toString() ?? ""}
              onChange={e => setLocalId(Number(e.target.value))}
            >
              <option value="" disabled className="text-black">Selecionar local...</option>
              {(locais ?? []).map(l => (
                <option key={l.id} value={l.id} className="text-black">
                  {l.nome}{l.tipoComercio ? ` — ${l.tipoComercio}` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </div>
        </div>

        {/* Progresso */}
        <div className="pb-3">
          <div className="flex justify-between text-xs mb-1 opacity-70">
            <span>{cotados}/{prods.length} pesquisados</span>
            <span className="font-semibold">{pct}%</span>
          </div>
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${concluido ? "bg-emerald-400" : "bg-amber-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Lista de produtos */}
      <div className="flex-1 overflow-y-auto pb-28">
        {!localId ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4 px-8">
            <MapPin className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="font-semibold">Selecione um local</p>
              <p className="text-sm text-muted-foreground mt-1">Escolha onde você está agora</p>
            </div>
            {(!locais || locais.length === 0) && (
              <button onClick={() => nav("/cotacoes/locais")} className="mt-2 text-sm text-primary font-medium flex items-center gap-1">
                <Plus className="h-4 w-4" /> Cadastrar primeiro local
              </button>
            )}
          </div>
        ) : (
          <div className="px-3 py-3 space-y-2">
            {prods.map((p, idx) => {
              const k = `${p.id}-${localId}`;
              const val = precos[k] ?? "";
              const naoAchado = naoAchados.has(k);
              const salvo = (val !== "" && !naoAchado) || naoAchado;
              const fotoPreview = fotosPreview[k];

              return (
                <div key={p.id} className={`rounded-2xl border transition-all ${salvo ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-100"} shadow-sm overflow-hidden`}>
                  <div className="px-4 pt-3 pb-2">
                    <div className="flex items-center gap-3">
                      {/* Status */}
                      <div className="shrink-0">
                        {salvo ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-muted-foreground/30" />}
                      </div>
                      {/* Nome */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">{p.produtoNome}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.quantidade} {p.unidade}
                          {p.obrigatorio && <span className="ml-1.5 text-amber-600 font-medium">★ obrigatório</span>}
                        </p>
                      </div>
                      {/* Input preço */}
                      {!naoAchado && (
                        <div className="relative shrink-0">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium select-none">R$</span>
                          <input
                            ref={el => { inputRefs.current[k] = el; }}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            placeholder="0,00"
                            value={val}
                            onFocus={() => setCampoAtivo({ spId: p.id, lId: localId })}
                            onChange={e => handleValor(p.id, e.target.value)}
                            onKeyDown={e => handleEnter(e, idx, prods)}
                            className={`w-28 h-12 pl-9 pr-2 text-right text-lg font-bold rounded-xl outline-none border-2 transition-colors ${val ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-gray-200 bg-gray-50"}`}
                          />
                        </div>
                      )}
                    </div>

                    {naoAchado && (
                      <p className="mt-1.5 ml-8 text-sm text-red-500 font-medium">✗ Não encontrado neste local</p>
                    )}

                    {/* Foto preview + câmera */}
                    <div className="mt-2 ml-8 flex items-center gap-2">
                      {fotoPreview ? (
                        <div className="relative">
                          <img src={fotoPreview} alt="Preço" className="h-14 w-14 rounded-xl object-cover border border-gray-200" />
                          <button onClick={() => removeFoto(p.id)} className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center shadow">
                            <X className="h-3 w-3 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleFoto(p.id)}
                          disabled={uploadingFoto}
                          className="h-9 px-3 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium flex items-center gap-1.5 hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-50"
                        >
                          <Camera className={`h-3.5 w-3.5 ${uploadingFoto ? "animate-pulse" : ""}`} />
                          {uploadingFoto ? "Enviando..." : "Foto do preço"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Rodapé */}
                  <div className="px-4 pb-2.5 flex justify-end">
                    <button
                      onClick={() => toggleNaoAchado(p.id)}
                      className={`text-xs px-3 py-1 rounded-full transition-colors ${naoAchado ? "bg-red-100 text-red-600 border border-red-200" : "text-muted-foreground hover:bg-gray-100"}`}
                    >
                      {naoAchado ? "↩ Encontrado" : "Não encontrado aqui"}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Banner de conclusão */}
            {concluido && (
              <div className="mt-4 bg-emerald-500 rounded-2xl p-5 text-white text-center shadow-lg">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                <p className="font-bold text-base">Local concluído!</p>
                <p className="text-sm opacity-80 mt-1">Todos os produtos pesquisados</p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      const idx = (locais ?? []).findIndex(l => l.id === localId);
                      const next = (locais ?? [])[idx + 1];
                      if (next) { setLocalId(next.id); window.scrollTo(0, 0); }
                      else toast.info("Este foi o último local cadastrado");
                    }}
                    className="flex-1 bg-white/20 hover:bg-white/30 text-white font-medium py-3 rounded-xl text-sm transition-colors"
                  >
                    Próximo local →
                  </button>
                  <button
                    onClick={() => nav(`/cotacoes/${sessaoId}/comparativo`)}
                    className="flex-1 bg-white text-emerald-700 font-bold py-3 rounded-xl text-sm"
                  >
                    Comparativo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {localId && !concluido && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 pb-6 pt-2 bg-gradient-to-t from-gray-50 to-transparent">
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => nav("/cotacoes/locais")} className="h-12 rounded-2xl border border-gray-200 bg-white text-xs font-medium text-muted-foreground flex items-center justify-center gap-1 active:bg-gray-50">
              <Plus className="h-4 w-4" /> Local
            </button>
            <button onClick={() => setProdutoSheet(true)} className="h-12 rounded-2xl border border-gray-200 bg-white text-xs font-medium text-muted-foreground flex items-center justify-center gap-1 active:bg-gray-50">
              <Package className="h-4 w-4" /> Produto
            </button>
            <button onClick={() => nav(`/cotacoes/${sessaoId}/comparativo`)} className="h-12 rounded-2xl bg-[oklch(0.30_0.13_240)] text-white font-semibold text-xs flex items-center justify-center gap-1 active:scale-[0.97] transition-transform shadow-lg">
              <BarChart3 className="h-4 w-4" /> Comparar
            </button>
          </div>
        </div>
      )}

      {produtoSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setProdutoSheet(false)} />
          <div className="relative bg-white rounded-t-3xl max-w-md mx-auto w-full max-h-[82svh] flex flex-col shadow-2xl">
            <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="h-1 w-10 bg-gray-200 rounded-full" /></div>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <p className="font-bold text-base">Adicionar produto agora</p>
                <p className="text-xs text-muted-foreground">Inclua na cotação sem sair da coleta</p>
              </div>
              <button onClick={() => setProdutoSheet(false)} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-3 py-3 border border-gray-100">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  className="flex-1 bg-transparent outline-none text-sm"
                  placeholder="Buscar ou criar produto..."
                  value={buscaProduto}
                  onChange={e => setBuscaProduto(e.target.value)}
                />
                {buscaProduto && <button onClick={() => setBuscaProduto("")} className="text-muted-foreground"><X className="h-4 w-4" /></button>}
              </div>

              {buscaProduto.trim() && (
                <button
                  onClick={criarEAdicionarProduto}
                  disabled={criarProdutoRapido.isPending || adicionarProdutoSessao.isPending}
                  className="w-full rounded-2xl bg-primary text-white px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {criarProdutoRapido.isPending || adicionarProdutoSessao.isPending ? "Adicionando..." : `Criar “${buscaProduto.trim()}” e incluir`}
                </button>
              )}

              <button onClick={() => nav("/produtos")} className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-muted-foreground flex items-center justify-center gap-2">
                Abrir lista de produtos do site <ExternalLink className="h-4 w-4" />
              </button>

              <div className="space-y-2">
                {produtosDisponiveis.slice(0, 30).map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => adicionarProdutoSessao.mutate({ sessaoId, produtoId: p.id, quantidade: 1, unidade: "un", obrigatorio: false })}
                    disabled={adicionarProdutoSessao.isPending}
                    className="w-full rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left flex items-center gap-3 active:bg-gray-50 disabled:opacity-50"
                  >
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Package className="h-4 w-4 text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.category}</p>
                    </div>
                    <Check className="h-4 w-4 text-emerald-600" />
                  </button>
                ))}
                {produtosDisponiveis.length === 0 && !buscaProduto.trim() && (
                  <p className="text-sm text-muted-foreground text-center py-6">Todos os produtos do site já estão nesta cotação.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
