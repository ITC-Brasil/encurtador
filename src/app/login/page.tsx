// src/app/login/page.tsx

"use client";

import { useState, useEffect } from "react";
import { auth, db, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ModeToggle } from "@/components/mode-toggle";
import { GoogleIcon } from "@/components/google-icon";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // 🧹 LIMPEZA DE SEGURANÇA: Limpa o cookie se o usuário caiu na tela de login
  // Isso evita que o Middleware cause loopings de redirecionamento
  useEffect(() => {
    document.cookie = `itc-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict${window.location.protocol === "https:" ? "; Secure" : ""}`;
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // 🔧 Busca por UID (leitura direta por ID) em vez de query por e-mail
      // Mais eficiente, consistente com o modelo de dados e sem edge cases de e-mail duplicado
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        // Grava o cookie de autenticação ativa antes de ir para o dashboard
        document.cookie = `itc-auth=active; path=/; max-age=86400; SameSite=Strict${window.location.protocol === "https:" ? "; Secure" : ""}`;

        toast.success("Bem-vindo ao Encurtador ITC!");
        router.push("/dashboard");
        return;
      }

      await auth.signOut();
      toast.error("Acesso negado — esta conta não possui convite ativo.");
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      toast.error("Falha na autenticação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-transparent px-4">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <Card className="w-full max-w-md border-border shadow-xl bg-card">
        <CardHeader className="space-y-4 text-center pb-6 pt-8">
          <CardTitle className="text-xl font-bold font-sans text-foreground">
            Acessar o Painel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-8 px-8">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-11 flex items-center justify-center gap-3 transition-all border-border hover:bg-accent hover:text-accent-foreground font-sans font-medium"
          >
            <GoogleIcon className="h-5 w-5 shrink-0" />
            {loading ? "Autenticando..." : "Entrar com o Google"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
