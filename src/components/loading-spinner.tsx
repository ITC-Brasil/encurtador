// src/components/loading-spinner.tsx
"use client";

import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  label?: string;
}

export function LoadingSpinner({
  label = "Carregando...",
}: LoadingSpinnerProps) {
  return (
    <div className="flex h-screen w-full items-center justify-center font-sans text-muted-foreground bg-background gap-2">
      <Loader2 className="h-4 w-4 animate-spin text-itc-ciano" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
