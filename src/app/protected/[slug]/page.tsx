// src/app/protected/[slug]/page.tsx
"use client";

import { useState, use } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LockKeyhole, ArrowRight } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { toast } from "sonner";

export default function ProtectedLinkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error("Por favor, digite a senha.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/unlock/${resolvedParams.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Acesso liberado! Redirecionando...");
        window.location.href = data.originalUrl;
      } else {
        toast.error(data.error || "Senha inválida.");
        setPassword("");
      }
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro de conexão ao validar a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-transparent px-4 transition-colors duration-300">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <Card className="w-full max-w-md border-border shadow-xl bg-card text-card-foreground">
        <form onSubmit={handleUnlock}>
          <CardHeader className="space-y-4 text-center pb-6 pt-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-itc-atencao/10 text-itc-atencao">
              <LockKeyhole className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground font-display">
              Acesso Protegido
            </CardTitle>
            <CardDescription className="text-muted-foreground font-sans text-sm">
              O link{" "}
              <strong className="text-foreground">
                itcbr.xyz/{resolvedParams.slug}
              </strong>{" "}
              exige uma senha para ser acessado.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 px-8">
            <div className="space-y-2 text-left">
              {/* 🔧 Label shadcn/ui no lugar do <label> HTML nativo */}
              <Label
                htmlFor="password"
                className="text-sm font-medium font-sans"
              >
                Senha de Acesso
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-sans h-12 text-center text-lg tracking-widest border-input focus-visible:ring-itc-ciano bg-transparent"
                required
              />
            </div>
          </CardContent>

          <CardFooter className="px-8 pb-8 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-itc-ciano hover:bg-itc-ciano800 text-white font-sans font-medium gap-2 shadow-sm"
            >
              {loading ? "Verificando..." : "Desbloquear Link"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
