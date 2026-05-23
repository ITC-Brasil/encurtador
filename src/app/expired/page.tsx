// src/app/expired/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, ArrowLeft, Mail } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

export default function ExpiredPage() {
  const router = useRouter();

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-transparent px-4 transition-colors duration-300">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <Card className="w-full max-w-lg border-border shadow-2xl bg-card text-card-foreground">
        <CardHeader className="space-y-4 text-center pb-6 pt-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-itc-erro/10 text-itc-erro">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground font-display">
            Link Expirado
          </CardTitle>
          <CardDescription className="text-muted-foreground font-sans text-base px-6">
            O link de acesso do Grupo ITC Brasil que você tentou acessar não
            está mais disponível. Ele pode ter passado do prazo de validade ou
            atingido o limite de acessos.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pb-8 px-8">
          <div className="rounded-lg bg-accent/50 p-4 border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-1 font-display">
              Precisa de ajuda?
            </h3>
            <p className="text-sm text-muted-foreground font-sans">
              Se você acredita que isso é um erro ou precisa de um novo link
              para os projetos de qualificação, entre em contato com o
              administrador da unidade.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="w-full flex-1 gap-2 font-sans"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar ao Início
            </Button>
            <Button
              className="w-full flex-1 gap-2 bg-itc-ciano hover:bg-itc-ciano800 text-white font-sans shadow-sm"
              onClick={() =>
                (window.location.href = "mailto:contato@itcbrasil.com.br")
              }
            >
              <Mail className="h-4 w-4" /> Contatar Suporte
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
