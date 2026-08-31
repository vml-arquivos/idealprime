/**
 * ImageGallery.tsx — Galeria de imagens de produto
 *
 * Funcionalidades:
 * - Upload de até 4 imagens via S3 presigned URL
 * - Definir thumbnail (imagem principal)
 * - Reordenar por drag-and-drop (botões ← →)
 * - Apagar imagem individual
 * - Editar texto alternativo (alt text)
 * - Preview em tempo real antes do upload
 */

import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Star,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

const MAX_IMAGES = 4;
const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif";

interface Props {
  productId: number;
}

export default function ImageGallery({ productId }: Props) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [editingAlt, setEditingAlt] = useState<number | null>(null);
  const [altDraft, setAltDraft] = useState("");

  // ── Queries e mutations ──────────────────────────────────────────────────────
  const { data: images = [], isLoading } = trpc.products.getImages.useQuery(
    { productId },
    { enabled: !!productId }
  );

  // Upload local — sem S3

  const addImage = trpc.products.addImage.useMutation({
    onSuccess: () => {
      utils.products.getImages.invalidate({ productId });
      toast.success("Imagem adicionada com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  const setThumbnail = trpc.products.setThumbnail.useMutation({
    onSuccess: () => {
      utils.products.getImages.invalidate({ productId });
      toast.success("Thumbnail definida!");
    },
    onError: (e) => toast.error(e.message),
  });

  const reorderImages = trpc.products.reorderImages.useMutation({
    onSuccess: () => utils.products.getImages.invalidate({ productId }),
    onError: (e) => toast.error(e.message),
  });

  const deleteImage = trpc.products.deleteImage.useMutation({
    onSuccess: () => {
      utils.products.getImages.invalidate({ productId });
      toast.success("Imagem removida.");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateAlt = trpc.products.updateImageAlt.useMutation({
    onSuccess: () => {
      utils.products.getImages.invalidate({ productId });
      setEditingAlt(null);
      toast.success("Texto alternativo atualizado.");
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Upload handler ───────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remaining = MAX_IMAGES - images.length;
    const toUpload = files.slice(0, remaining);

    if (files.length > remaining) {
      toast.warning(
        `Limite de ${MAX_IMAGES} imagens. Apenas ${remaining} arquivo(s) serão enviados.`
      );
    }

    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i]!;
      setUploadingIndex(images.length + i);
      try {
        const uploadResp = await fetch(
          `/api/upload/image?productId=${productId}&filename=${encodeURIComponent(file.name)}`,
          { method: "POST", body: file, headers: { "Content-Type": file.type } }
        );
        if (!uploadResp.ok) throw new Error(`Falha no upload: ${uploadResp.statusText}`);
        const { url } = await uploadResp.json();

        await addImage.mutateAsync({
          productId,
          url,
          storageKey: url,
        });
      } catch (err: any) {
        toast.error(`Erro ao enviar ${file.name}: ${err.message}`);
      }
    }

    setUploadingIndex(null);
    // Limpar input para permitir re-upload do mesmo arquivo
    e.target.value = "";
  };

  // ── Reordenar ────────────────────────────────────────────────────────────────
  const moveImage = (index: number, direction: -1 | 1) => {
    const newOrder = [...images];
    const target = index + direction;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target]!, newOrder[index]!];
    reorderImages.mutate({
      productId,
      orderedIds: newOrder.map((img) => img.id),
    });
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando galeria...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Grade de imagens ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {images.map((img, idx) => (
          <div
            key={img.id}
            className={`relative group rounded-lg overflow-hidden border-2 transition-colors ${
              img.isThumbnail
                ? "border-primary shadow-md"
                : "border-border hover:border-primary/50"
            }`}
          >
            {/* Imagem */}
            <div className="aspect-square bg-muted">
              <img
                src={img.url}
                alt={img.altText ?? img.url}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Badge thumbnail */}
            {img.isThumbnail && (
              <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-current" />
                Capa
              </div>
            )}

            {/* Overlay de ações */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
              {/* Linha superior: thumbnail + apagar */}
              <div className="flex justify-between">
                {!img.isThumbnail && (
                  <button
                    title="Definir como capa"
                    onClick={() =>
                      setThumbnail.mutate({ imageId: img.id, productId })
                    }
                    className="bg-white/20 hover:bg-primary text-white rounded p-1 transition-colors"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  title="Remover imagem"
                  onClick={() =>
                    deleteImage.mutate({ imageId: img.id, productId })
                  }
                  className="bg-white/20 hover:bg-destructive text-white rounded p-1 transition-colors ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Linha inferior: reordenar */}
              <div className="flex justify-between">
                <button
                  title="Mover para esquerda"
                  onClick={() => moveImage(idx, -1)}
                  disabled={idx === 0}
                  className="bg-white/20 hover:bg-white/40 text-white rounded p-1 transition-colors disabled:opacity-30"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  title="Mover para direita"
                  onClick={() => moveImage(idx, 1)}
                  disabled={idx === images.length - 1}
                  className="bg-white/20 hover:bg-white/40 text-white rounded p-1 transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Editar alt text */}
            {editingAlt === img.id ? (
              <div className="absolute bottom-0 left-0 right-0 bg-background/95 p-1.5 flex gap-1">
                <Input
                  value={altDraft}
                  onChange={(e) => setAltDraft(e.target.value)}
                  placeholder="Texto alternativo"
                  className="h-6 text-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      updateAlt.mutate({
                        imageId: img.id,
                        productId,
                        altText: altDraft,
                      });
                    if (e.key === "Escape") setEditingAlt(null);
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={() =>
                    updateAlt.mutate({
                      imageId: img.id,
                      productId,
                      altText: altDraft,
                    })
                  }
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                </Button>
              </div>
            ) : (
              <button
                title="Editar texto alternativo"
                onClick={() => {
                  setEditingAlt(img.id);
                  setAltDraft(img.altText ?? "");
                }}
                className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[10px] py-0.5 text-center opacity-0 group-hover:opacity-100 transition-opacity truncate px-1"
              >
                {img.altText ? img.altText : "Editar alt text"}
              </button>
            )}
          </div>
        ))}

        {/* ── Slot de upload ─────────────────────────────────────────────── */}
        {images.length < MAX_IMAGES && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingIndex !== null}
            className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/70 bg-muted/30 hover:bg-muted/60 transition-colors flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadingIndex !== null ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs">Enviando...</span>
              </>
            ) : (
              <>
                <ImagePlus className="w-6 h-6" />
                <span className="text-xs font-medium">
                  Adicionar
                </span>
                <span className="text-[10px]">
                  {images.length}/{MAX_IMAGES}
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Input de arquivo oculto ──────────────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Legenda ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3 text-primary" />
          = Imagem de capa (thumbnail)
        </span>
        <span>Passe o mouse sobre a imagem para ver as ações</span>
        <span>Máx. {MAX_IMAGES} imagens · JPEG, PNG, WebP, GIF · até 5MB cada</span>
      </div>


    </div>
  );
}
