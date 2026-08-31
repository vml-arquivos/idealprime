/**
 * useCameraUpload.ts — Hook para captura de foto via câmera nativa
 *
 * Usa <input type="file" capture="environment"> — funciona em Android e iOS
 * sem nenhuma permissão especial ou lib externa.
 *
 * Comprime a imagem via canvas antes do upload (max 900px, quality 0.75).
 * Envia para /api/upload/image (endpoint já existente no servidor).
 */

import { useRef, useState, useCallback } from "react";
import { toast } from "sonner";

interface UploadResult {
  url: string;
  dataUrl: string; // preview local imediato
}

async function compressImage(
  file: File,
  maxPx = 900,
  quality = 0.75
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) {
          height = Math.round((height * maxPx) / width);
          width = maxPx;
        } else {
          width = Math.round((width * maxPx) / height);
          height = maxPx;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error("Falha ao comprimir"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function useCameraUpload(options?: {
  facingMode?: "environment" | "user";
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const callbackRef = useRef<((result: UploadResult) => void) | null>(null);

  // Cria o input hidden uma vez
  if (!inputRef.current) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = options?.facingMode ?? "environment";
    input.style.display = "none";
    document.body.appendChild(input);
    inputRef.current = input;
  }

  const capture = useCallback((onResult: (r: UploadResult) => void) => {
    callbackRef.current = onResult;
    if (inputRef.current) {
      // reset para permitir re-seleção do mesmo arquivo
      inputRef.current.value = "";
      inputRef.current.onchange = async () => {
        const file = inputRef.current?.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
          // Preview local imediato
          const dataUrl = await new Promise<string>(res => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.readAsDataURL(file);
          });

          // Comprimir
          const blob = await compressImage(file);

          // Upload
          const res = await fetch(
            `/api/upload/image?productId=0&filename=cotacao_${Date.now()}.jpg`,
            {
              method: "POST",
              headers: { "Content-Type": "image/jpeg" },
              body: blob,
            }
          );
          if (!res.ok) throw new Error("Falha no upload");
          const { url } = await res.json();

          callbackRef.current?.({ url, dataUrl });
          toast.success("Foto salva", {
            duration: 1200,
            position: "bottom-center",
          });
        } catch (e: any) {
          toast.error("Erro ao salvar foto: " + e.message);
        } finally {
          setUploading(false);
        }
      };
      inputRef.current.click();
    }
  }, []);

  return { capture, uploading };
}
