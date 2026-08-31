/**
 * ImageUpload.tsx — Componente de upload de imagem de produto
 *
 * Fluxo:
 *  1. Usuário seleciona imagem (drag & drop ou clique)
 *  2. Componente pede URL pré-assinada ao servidor via tRPC
 *  3. Browser faz PUT direto no S3/R2 (sem passar pelo servidor Node)
 *  4. Componente chama onSuccess(publicUrl) com a URL pública final
 *  5. Pai salva a URL no produto via products.setImageUrl
 */

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, ImageIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ImageUploadProps {
  productId: number;
  currentImageUrl?: string | null;
  onSuccess: (publicUrl: string) => void;
  className?: string;
}

type UploadState =
  | { type: "idle" }
  | { type: "preview"; file: File; objectUrl: string }
  | { type: "uploading"; progress: number }
  | { type: "success"; url: string }
  | { type: "error"; message: string };

// ─── Tipos de MIME aceitos ─────────────────────────────────────────────────────

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_MB = 5;

// ─── Componente ───────────────────────────────────────────────────────────────

export function ImageUpload({
  productId,
  currentImageUrl,
  onSuccess,
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ type: "idle" });
  const [isDragging, setIsDragging] = useState(false);

  const setImageUrl = trpc.products.setImageUrl.useMutation();

  // ── Validação de arquivo ──────────────────────────────────────────────────

  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Formato não suportado. Use JPEG, PNG, WebP ou GIF.`;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `Arquivo muito grande. Máximo ${MAX_SIZE_MB}MB.`;
    }
    return null;
  }

  // ── Selecionar arquivo ────────────────────────────────────────────────────

  function handleFileSelect(file: File) {
    const error = validateFile(file);
    if (error) {
      setState({ type: "error", message: error });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setState({ type: "preview", file, objectUrl });
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = ""; // reset para permitir re-selecionar o mesmo arquivo
  }

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (state.type !== "preview") return;

    const { file } = state;

    try {
      setState({ type: "uploading", progress: 10 });

      // 1. Upload direto para o servidor local
      setState({ type: "uploading", progress: 40 });

      const uploadResponse = await fetch(
        `/api/upload/image?productId=${productId}&filename=${encodeURIComponent(file.name)}`,
        {
          method: "POST",
          body: file,
          headers: { "Content-Type": file.type },
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(`Falha no upload: ${uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();
      const finalUrl = uploadData.url;

      setState({ type: "uploading", progress: 80 });

      // 2. Salvar URL pública no produto
      await setImageUrl.mutateAsync({ productId, imageUrl: finalUrl });

      setState({ type: "success", url: finalUrl });
      onSuccess(finalUrl);
    } catch (err: any) {
      setState({ type: "error", message: err.message ?? "Erro ao fazer upload." });
    }
  }

  // ── Cancelar / Resetar ────────────────────────────────────────────────────

  function handleCancel() {
    if (state.type === "preview") {
      URL.revokeObjectURL(state.objectUrl);
    }
    setState({ type: "idle" });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const previewSrc =
    state.type === "preview"
      ? state.objectUrl
      : state.type === "success"
      ? state.url
      : currentImageUrl ?? null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Área de drop */}
      <div
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-colors cursor-pointer overflow-hidden",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          (state.type === "uploading") && "pointer-events-none"
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ minHeight: 200 }}
      >
        {previewSrc ? (
          /* Preview da imagem */
          <div className="relative">
            <img
              src={previewSrc}
              alt="Preview"
              className="w-full max-h-64 object-contain"
            />
            {state.type === "success" && (
              <div className="absolute top-2 right-2">
                <div className="bg-green-500 text-white rounded-full p-1">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Placeholder */
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Clique ou arraste uma imagem</p>
              <p className="text-xs mt-0.5">JPEG, PNG, WebP ou GIF — até {MAX_SIZE_MB}MB</p>
            </div>
          </div>
        )}

        {/* Overlay de drag */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <Upload className="w-8 h-8 text-primary animate-bounce" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Barra de progresso */}
      {state.type === "uploading" && (
        <div className="space-y-1">
          <Progress value={state.progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground text-center">
            Enviando imagem…
          </p>
        </div>
      )}

      {/* Erro */}
      {state.type === "error" && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {state.message}
        </div>
      )}

      {/* Botões de ação */}
      {state.type === "preview" && (
        <div className="flex gap-2">
          <Button size="sm" onClick={handleUpload} className="flex-1 gap-2">
            <Upload className="w-3.5 h-3.5" />
            Enviar imagem
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {state.type === "success" && (
        <p className="text-xs text-center text-green-600 font-medium">
          ✓ Imagem salva com sucesso
        </p>
      )}

      {(state.type === "idle" || state.type === "error") && previewSrc && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Trocar imagem
        </Button>
      )}
    </div>
  );
}
