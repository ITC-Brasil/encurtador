import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Gera estilos inline para badges de categoria com cor customizada.
 * Converte a cor hex em rgba para fundo, borda e texto com transparências adequadas.
 */
export function getCategoryBadgeStyle(hexColor: string): {
  backgroundColor: string;
  borderColor: string;
  color: string;
} {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.35)`,
    color: hexColor,
  };
}
