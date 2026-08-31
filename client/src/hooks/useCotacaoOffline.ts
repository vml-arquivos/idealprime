/**
 * client/src/hooks/useCotacaoOffline.ts
 *
 * Hook para suporte offline do módulo de cotação.
 * Usa localStorage para fila simples (sem dependência de Dexie).
 * Para produção com volume alto, substituir por IndexedDB/Dexie.
 *
 * Funcionalidade:
 * - Detecta status de conectividade
 * - Mantém fila de preços pendentes no localStorage
 * - Sincroniza automaticamente ao reconectar
 * - Expõe pendingCount e syncNow para o UI
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { nanoid } from "nanoid";

const QUEUE_KEY = "cotacao_sync_queue";

interface QueueItem {
  uuid: string;
  sessaoId: number;
  sessaoProdutoId: number;
  localId: number;
  precoUnitario: number | null;
  encontrado: boolean;
  observacao?: string;
  timestamp: number;
}

function lerFila(): QueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function salvarFila(fila: QueueItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(fila));
}

function adicionarNaFila(item: Omit<QueueItem, "uuid" | "timestamp">) {
  const fila = lerFila();
  // Substitui entrada existente para mesma sessaoProdutoId + localId
  const idx = fila.findIndex(
    (q) =>
      q.sessaoProdutoId === item.sessaoProdutoId &&
      q.localId === item.localId
  );
  const entry: QueueItem = { ...item, uuid: nanoid(), timestamp: Date.now() };
  if (idx >= 0) {
    fila[idx] = entry;
  } else {
    fila.push(entry);
  }
  salvarFila(fila);
  return fila.length;
}

function limparFila() {
  localStorage.removeItem(QUEUE_KEY);
}

export function useCotacaoOffline(sessaoId: number) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(() => lerFila().length);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const lote = trpc.cotacao.precos.lote.useMutation({
    onSuccess: (data) => {
      limparFila();
      setPendingCount(0);
      setSyncing(false);
      syncingRef.current = false;
    },
    onError: () => {
      setSyncing(false);
      syncingRef.current = false;
    },
  });

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    const fila = lerFila();
    if (fila.length === 0) return;

    syncingRef.current = true;
    setSyncing(true);
    toast.loading("Sincronizando dados offline...", { id: "sync" });

    lote.mutate(
      {
        itens: fila.map((q) => ({
          sessaoId: q.sessaoId,
          sessaoProdutoId: q.sessaoProdutoId,
          localId: q.localId,
          precoUnitario: q.precoUnitario,
          encontrado: q.encontrado,
          observacao: q.observacao,
          uuidLocal: q.uuid,
        })),
      },
      {
        onSuccess: () => {
          toast.success(`${fila.length} preços sincronizados`, { id: "sync" });
        },
        onError: (err) => {
          toast.error("Falha na sincronização: " + err.message, { id: "sync" });
        },
      }
    );
  }, [lote]);

  // Monitorar conectividade
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      // Sincroniza automaticamente ao reconectar
      setTimeout(() => syncNow(), 1000);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow]);

  // Expõe função para salvar offline quando sem internet
  function salvarOffline(item: Omit<QueueItem, "uuid" | "timestamp">) {
    const count = adicionarNaFila(item);
    setPendingCount(count);
  }

  return {
    isOnline,
    pendingCount,
    syncing,
    syncNow,
    salvarOffline,
  };
}
