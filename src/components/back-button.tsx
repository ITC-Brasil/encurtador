// src/components/back-button.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  label?: string;
  href?: string;
}

export function BackButton({
  label = "Voltar ao Painel",
  href = "/dashboard",
}: BackButtonProps) {
  const router = useRouter();

  return (
    <Button
      variant="outline"
      onClick={() => router.push(href)}
      className="border-border text-muted-foreground hover:text-itc-ciano hover:border-itc-ciano/40 hover:bg-itc-ciano/5 font-sans text-xs gap-1.5 h-8 px-3 transition-all duration-200"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}
