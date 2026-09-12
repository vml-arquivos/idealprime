import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const CATEGORY_META: Array<{ test: RegExp; emoji: string; label: string; gradient: string }> = [
  { test: /limpeza|desinf|deterg|cera|lava|multiuso|alcool|cloro/i, emoji: "🧽", label: "Limpeza", gradient: "from-emerald-50 via-white to-cyan-50" },
  { test: /higiene|fralda|infantil|cuidado|shampoo|sabonete|bebe|bebê/i, emoji: "🧴", label: "Higiene", gradient: "from-sky-50 via-white to-blue-50" },
  { test: /descart|embalag|copo|prato|talher|saco/i, emoji: "🥤", label: "Descartáveis", gradient: "from-cyan-50 via-white to-slate-50" },
  { test: /epi|seguran|luva|mascara|máscara|bota|oculos|óculos/i, emoji: "🦺", label: "EPI", gradient: "from-amber-50 via-white to-orange-50" },
  { test: /papel|dispenser|toalheiro/i, emoji: "🧻", label: "Papel", gradient: "from-stone-50 via-white to-slate-50" },
  { test: /eletron|eletrôn|celular|informat|comput|fone|monitor/i, emoji: "💻", label: "Eletrônicos", gradient: "from-indigo-50 via-white to-blue-50" },
  { test: /brinquedo|infantil|jogo|boneca/i, emoji: "🧸", label: "Brinquedos", gradient: "from-fuchsia-50 via-white to-pink-50" },
  { test: /escritorio|escritório|papelaria/i, emoji: "📎", label: "Papelaria", gradient: "from-violet-50 via-white to-slate-50" },
  { test: /cozinha|copa|utilidade|equipamento|balde|vassoura|rodo/i, emoji: "🧹", label: "Utilidades", gradient: "from-teal-50 via-white to-emerald-50" },
  { test: /alimento|bebida/i, emoji: "🥫", label: "Alimentos", gradient: "from-orange-50 via-white to-amber-50" },
];

type Props = {
  src?: string | null;
  alt: string;
  category?: string | null;
  className?: string;
  imageClassName?: string;
  compact?: boolean;
};

export function ProductVisual({ src, alt, category, className, imageClassName, compact = false }: Props) {
  const [failed, setFailed] = useState(false);
  const meta = useMemo(() => {
    const source = `${category ?? ""} ${alt}`;
    return CATEGORY_META.find((item) => item.test.test(source)) ?? {
      emoji: "📦",
      label: "Produto",
      gradient: "from-slate-50 via-white to-emerald-50",
    };
  }, [category, alt]);

  if (src && !failed) {
    return (
      <div className={cn("overflow-hidden bg-white", className)}>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-contain", imageClassName)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br",
        meta.gradient,
        className,
      )}
      aria-label={`Imagem não disponível para ${alt}`}
    >
      <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,#068A5B_1px,transparent_0)] [background-size:16px_16px]" />
      <div className="relative flex flex-col items-center gap-1.5 text-center">
        <span className={compact ? "text-2xl" : "text-5xl"} aria-hidden="true">{meta.emoji}</span>
        {!compact && (
          <span className="max-w-[85%] text-[9px] font-bold uppercase tracking-[0.18em] text-[#41675A]">
            {meta.label}
          </span>
        )}
      </div>
    </div>
  );
}
