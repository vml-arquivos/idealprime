import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type VoiceRecorderOptions = {
  onTranscript: (text: string) => void;
};

export function useVoiceRecorder({ onTranscript }: VoiceRecorderOptions) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [supported, setSupported] = useState(false);
  const transcribeMutation = trpc.voice.transcribe.useMutation();

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
      "MediaRecorder" in window &&
      !!navigator.mediaDevices?.getUserMedia,
    );
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const start = useCallback(async () => {
    if (!supported || recording || uploading) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: preferredMime });
      const chunks: Blob[] = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        toast.error("Não foi possível gravar o áudio.");
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.onstop = async () => {
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        const blob = new Blob(chunks, { type: "audio/webm" });
        if (!blob.size) {
          toast.error("Nenhum áudio foi capturado.");
          return;
        }

        setUploading(true);
        try {
          const uploadResponse = await fetch(`/api/upload/audio?filename=cotacao_${Date.now()}.webm`, {
            method: "POST",
            headers: { "Content-Type": "audio/webm" },
            body: blob,
          });
          if (!uploadResponse.ok) {
            const payload = await uploadResponse.json().catch(() => ({}));
            throw new Error(payload.error || "Falha no upload do áudio.");
          }
          const { url } = await uploadResponse.json() as { url: string };
          const result = await transcribeMutation.mutateAsync({
            audioUrl: url,
            language: "pt-BR",
            prompt: "Transcreva o ditado de um preço ou observação de cotação em português do Brasil.",
          });
          if ("error" in result) throw new Error(result.error);
          onTranscriptRef.current(result.text.trim());
          toast.success("Ditado transcrito", { duration: 1400, position: "bottom-center" });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Erro ao transcrever o áudio.");
        } finally {
          setUploading(false);
        }
      };

      recorder.start();
      setRecording(true);
      toast.info("Gravando… toque novamente para parar.", { duration: 1800, position: "bottom-center" });
    } catch (error) {
      toast.error(error instanceof Error && error.name === "NotAllowedError"
        ? "Permita o uso do microfone para ditar."
        : "Não foi possível acessar o microfone.");
    }
  }, [recording, supported, transcribeMutation, uploading]);

  return {
    recording,
    uploading: uploading || transcribeMutation.isPending,
    supported,
    start,
    stop,
  };
}
