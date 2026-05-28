// src/components/status-badge.tsx
"use client";

import { CirclePlay, CirclePause } from "lucide-react";

interface StatusBadgeProps {
  active: boolean;
  inactiveLabel?: string;
}

export function StatusBadge({
  active,
  inactiveLabel = "Pausado",
}: StatusBadgeProps) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-itc-sucesso/10 text-itc-sucesso border border-itc-sucesso/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider font-sans">
      <CirclePlay className="h-3 w-3 shrink-0" />
      Ativo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-itc-erro/10 text-itc-erro border border-itc-erro/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider font-sans">
      <CirclePause className="h-3 w-3 shrink-0" />
      {inactiveLabel}
    </span>
  );
}
