// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { auth, db, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ModeToggle } from "@/components/mode-toggle";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userQuery = query(
        collection(db, "users"),
        where("email", "==", user.email),
      );
      const userSnap = await getDocs(userQuery);

      if (!userSnap.empty) {
        toast.success("Bem-vindo ao Encurtador ITC!");
        router.push("/dashboard");
        return;
      }

      await auth.signOut();
      toast.error("Acesso negado — esta conta não possui convite ativo.");
    } catch (error) {
      console.error("Erro no processo de login:", error);
      toast.error("Falha na autenticação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-transparent px-4 transition-colors duration-300">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <Card className="w-full max-w-md border-border shadow-xl bg-card text-card-foreground backdrop-blur-sm">
        <CardHeader className="space-y-4 text-center pb-8 pt-8">
          {/* Lógica Invertida da Logo Corrigida */}
          <div className="mx-auto h-16 w-48 relative">
            <img
              src="/images/logo-light.png"
              alt="ITC Brasil"
              className="h-full w-full object-contain dark:hidden"
            />
            <img
              src="/images/logo-dark.png"
              alt="ITC Brasil"
              className="h-full w-full object-contain hidden dark:block"
            />
          </div>

          <CardTitle className="text-xl font-bold tracking-tight text-foreground font-display mt-2">
            Encurtador de URLs
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            variant="outline"
            className="w-full h-11 flex items-center justify-center gap-3 transition-all border-border hover:bg-accent hover:text-accent-foreground font-sans font-medium"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {loading
              ? "Autenticando colaborador..."
              : "Entrar com a conta Google"}
          </Button>

          <p className="text-center text-xs text-muted-foreground font-sans mt-4">
            Acesso restrito apenas a colaboradores autorizados.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
