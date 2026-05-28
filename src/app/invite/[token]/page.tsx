// src/app/invite/[token]/page.tsx
"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { auth, db, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { toast } from "sonner";
import { UserPlus, AlertTriangle, Loader2 } from "lucide-react";

interface InviteData {
  email: string;
  role: string;
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);

  const [status, setStatus] = useState<"loading" | "valid" | "invalid">(
    "loading",
  );
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await fetch(
          `/api/invites/validate/${resolvedParams.token}`,
        );
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setErrorMessage(data.error || "Convite inválido.");
          setStatus("invalid");
          return;
        }

        setInviteData({ email: data.email, role: data.role });
        setStatus("valid");
      } catch {
        setErrorMessage(
          "Erro ao verificar o convite corporativo. Tente novamente.",
        );
        setStatus("invalid");
      }
    };

    validateToken();
  }, [resolvedParams.token]);

  const handleGoogleLogin = async () => {
    if (!inviteData) return;
    setIsSigningIn(true);

    try {
      // 1. Autenticar com o Google Auth corporativo
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // 2. Verificar se o e-mail do Google bate com o e-mail do convite
      if (user.email?.toLowerCase() !== inviteData.email.toLowerCase()) {
        await auth.signOut();
        toast.error(
          `Este convite é de uso restrito para ${inviteData.email}. Autentique-se com a conta correta.`,
        );
        setIsSigningIn(false);
        return;
      }

      // 3. Criar documento do usuário no Firestore com o UID como chave
      await setDoc(doc(db, "users", user.uid), {
        name: user.displayName || inviteData.email,
        email: user.email,
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        role: inviteData.role,
        status: "Ativo",
        isActive: true,
        createdAt: serverTimestamp(),
      });

      // 4. Marcar convite como utilizado — Bearer Token obrigatório para a rota autenticada
      const idToken = await user.getIdToken();
      await fetch(`/api/invites/use`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          token: resolvedParams.token,
          usedBy: user.uid,
        }),
      });

      toast.success("Bem-vindo à equipe do Grupo ITC Brasil!");
      router.push("/dashboard");
    } catch (error: unknown) {
      console.error("Erro no login via convite:", error);
      toast.error("Falha na autenticação corporativa. Tente novamente.");
      setIsSigningIn(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-itc-ciano" />
          <p className="text-sm font-sans font-medium">
            Autenticando chaves de segurança...
          </p>
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="relative flex h-screen w-full items-center justify-center bg-transparent px-4">
        <div className="absolute top-4 right-4">
          <ModeToggle />
        </div>
        <Card className="w-full max-w-md border-border shadow-xl bg-card">
          <CardHeader className="space-y-4 text-center pb-4 pt-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-itc-erro/10">
              <AlertTriangle className="h-7 w-7 text-itc-erro" />
            </div>
            <CardTitle className="text-xl font-bold font-sans text-foreground">
              Convite de Acesso Inválido
            </CardTitle>
            <CardDescription className="font-sans text-sm text-muted-foreground px-4">
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8 px-8">
            <p className="text-xs text-center text-muted-foreground font-sans bg-muted/40 border border-border p-3 rounded-md">
              Entre em contato direto com a administração da ITC Brasil para
              gerar um novo token de convite oficial.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-transparent px-4">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <Card className="w-full max-w-md border-border shadow-xl bg-card">
        <CardHeader className="space-y-4 text-center pb-6 pt-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-itc-ciano/10">
            <UserPlus className="h-7 w-7 text-itc-ciano" />
          </div>
          <CardTitle className="text-xl font-bold font-sans text-foreground">
            Aceitar Convite Corporativo
          </CardTitle>
          <CardDescription className="font-sans text-sm text-muted-foreground px-2">
            Você recebeu credenciais de acesso como{" "}
            <strong className="text-foreground font-semibold">
              {inviteData?.role}
            </strong>
            . Vincule sua conta Google autorizada para ativar o painel.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pb-8 px-8">
          <div className="rounded-md bg-muted/60 border border-border px-4 py-3">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground font-sans mb-1">
              Endereço de E-mail Autorizado
            </p>
            <p className="text-sm font-medium font-mono text-foreground break-all">
              {inviteData?.email}
            </p>
          </div>

          <Button
            onClick={handleGoogleLogin}
            disabled={isSigningIn}
            className="w-full bg-itc-ciano hover:bg-itc-ciano800 text-white h-11 flex items-center justify-center gap-3 font-sans font-medium text-sm transition-all shadow-sm"
          >
            {isSigningIn ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
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
            )}
            {isSigningIn
              ? "Vinculando Credenciais..."
              : "Ativar com Google Auth"}
          </Button>

          <p className="text-center text-[10px] text-muted-foreground font-sans">
            Aviso de Conformidade: Somente a conta Google vinculada ao e-mail
            listado acima obterá permissão de escrita e persistência.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
