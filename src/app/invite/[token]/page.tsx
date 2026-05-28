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
import { GoogleIcon } from "@/components/google-icon";
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
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (user.email?.toLowerCase() !== inviteData.email.toLowerCase()) {
        await auth.signOut();
        toast.error(
          `Este convite é de uso restrito para ${inviteData.email}. Autentique-se com a conta correta.`,
        );
        setIsSigningIn(false);
        return;
      }

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
              <GoogleIcon className="h-5 w-5 shrink-0" />
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
