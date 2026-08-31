import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

interface UploadResult {
  url: string;
  dataUrl: string;
  fileName: string;
  mimeType: string;
}

export function useDocumentUpload() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const callbackRef = useRef<((result: UploadResult) => void) | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!inputRef.current && typeof document !== "undefined") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif,application/pdf";
    input.style.display = "none";
    document.body.appendChild(input);
    inputRef.current = input;
  }

  const capture = useCallback((onResult: (result: UploadResult) => void) => {
    callbackRef.current = onResult;
    const input = inputRef.current;
    if (!input) return;
    input.value = "";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () =>
            reject(new Error("Não foi possível ler o arquivo"));
          reader.readAsDataURL(file);
        });
        const response = await fetch(
          `/api/upload/image?folder=vendedores&filename=${encodeURIComponent(file.name)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.url)
          throw new Error(payload.error || "Falha no upload do documento");
        callbackRef.current?.({
          url: payload.url,
          dataUrl,
          fileName: file.name,
          mimeType: file.type,
        });
        toast.success("Documento enviado", {
          duration: 1400,
          position: "bottom-center",
        });
      } catch (error) {
        toast.error(
          `Erro ao enviar documento: ${error instanceof Error ? error.message : "tente novamente"}`
        );
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }, []);

  return { capture, uploading };
}
