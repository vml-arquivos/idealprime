import type { ImgHTMLAttributes } from "react";
import logoColor from "@/assets/brand/ideal-prime-logo.png";
import logoWhite from "@/assets/brand/ideal-prime-logo-white.png";
import symbol from "@/assets/brand/ideal-prime-symbol.png";

export type BrandLogoVariant = "color" | "white";

interface BrandLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  variant?: BrandLogoVariant;
  compact?: boolean;
}

export function BrandLogo({ variant = "color", compact = false, className = "", ...props }: BrandLogoProps) {
  return (
    <img
      src={variant === "white" ? logoWhite : logoColor}
      alt="Ideal Prime — Comércio e Distribuição"
      className={`block h-auto object-contain ${compact ? "w-[132px] sm:w-[156px]" : "w-[174px] sm:w-[210px]"} ${className}`}
      {...props}
    />
  );
}

export function BrandSymbol({ className = "", ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">) {
  return (
    <img
      src={symbol}
      alt="Símbolo Ideal Prime"
      className={`block h-auto w-12 object-contain ${className}`}
      {...props}
    />
  );
}
