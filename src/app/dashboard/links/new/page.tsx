// src/app/dashboard/links/new/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Link2, ShieldCheck, Calendar } from "lucide-react";
import { toast } from "sonner";
import { ModeToggle } from "@/components/mode-toggle";

export default function NewLinkPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const generateRandomSlug = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!originalUrl) {
      toast.error("A URL de destino é obrigatória.");
      return;
    }

    if (
      !originalUrl.startsWith("http://") &&
      !originalUrl.startsWith("https://")
    ) {
      toast.error("A URL deve começar com http:// ou https://");
      return;
    }

    setSubmitting(true);

    let finalSlug = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    if (!finalSlug) {
      finalSlug = generateRandomSlug();
    }

    if (finalSlug.length < 3) {
      toast.error("O slug customizado deve conter pelo menos 3 caracteres.");
      setSubmitting(false);
      return;
    }

    try {
      const linksRef = collection(db, "links");
      const q = query(linksRef, where("slug", "==", finalSlug));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        toast.error("Este link curto (slug) já está em uso na base da ITC.");
        setSubmitting(false);
        return;
      }

      const linkPayload: any = {
        title: title.trim() || "Link Sem Título",
        originalUrl: originalUrl.trim(),
        slug: finalSlug,
        clickCount: 0,
        isActive: true,
        createdBy: user.uid,
        createdAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxClicks: maxClicks ? parseInt(maxClicks, 10) : null,
        passwordHash: password ? password : null,
      };

      await addDoc(collection(db, "links"), linkPayload);

      toast.success(`Sucesso! itcbr.xyz/${finalSlug} foi criado.`);
      router.push("/dashboard");
    } catch (error) {
      console.error("Erro ao criar link:", error);
      toast.error("Falha ao salvar o encurtador no banco.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center font-sans text-muted-foreground bg-background">
        Verificando credenciais corporativas...
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 max-w-3xl mx-auto w-full font-sans space-y-6 transition-colors duration-300">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          className="text-muted-foreground hover:text-foreground gap-2 pl-0 hover:bg-transparent"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
        </Button>
        <ModeToggle />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-display">
          Criar Novo Link Curto
        </h1>
        <p className="text-sm text-muted-foreground font-sans">
          Encurte URLs para materiais, carretas ou campanhas do Grupo ITC
          Brasil.
        </p>
      </div>

      <form onSubmit={handleCreateLink}>
        <Card className="bg-card border-border shadow-sm text-card-foreground">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-foreground font-sans">
              Parâmetros do Link
            </CardTitle>
            <CardDescription className="text-muted-foreground font-sans">
              Configure o destino e as regras de acesso do encurtador.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Título / Identificação Interna
              </label>
              <Input
                type="text"
                placeholder="Ex: Formulário de Inscrição — Carreta 04 (Qualifica DF)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-sans border-input bg-transparent text-foreground focus-visible:ring-itc-ciano"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                URL Original (Destino Longo) *
              </label>
              <Input
                type="text"
                placeholder="https://docs.google.com/forms/d/..."
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                className="font-sans border-input bg-transparent text-foreground focus-visible:ring-itc-ciano"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Link Encurtador Customizado
              </label>
              <div className="flex items-center rounded-md border border-input bg-accent/50 focus-within:ring-2 focus-within:ring-itc-ciano focus-within:border-transparent transition">
                <span className="pl-3 text-sm text-muted-foreground font-mono select-none">
                  itcbr.xyz/
                </span>
                <input
                  type="text"
                  placeholder="ex-qualifica-df"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-transparent py-2 px-1 text-sm font-mono text-foreground outline-none"
                />
              </div>
              <p className="text-xs text-muted-foreground font-sans">
                Apenas letras, números, hífens e sublinhados. Deixe em branco
                para gerar código aleatório.
              </p>
            </div>

            <div className="h-px bg-border my-2" />

            <h3 className="text-sm font-semibold text-foreground font-sans flex items-center gap-2">
              Regras Avançadas e Restrições{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (Opcional)
              </span>
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground font-sans flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" /> Expira
                  em (Data/Hora)
                </label>
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="font-sans border-input bg-transparent text-foreground text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground font-sans flex items-center gap-1">
                  <Link2 className="h-3 w-3 text-muted-foreground" /> Limite
                  Máximo de Cliques
                </label>
                <Input
                  type="number"
                  placeholder="Ex: 500"
                  value={maxClicks}
                  onChange={(e) => setMaxClicks(e.target.value)}
                  className="font-sans border-input bg-transparent text-foreground text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground font-sans flex items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />{" "}
                Proteger por Senha de Acesso
              </label>
              <Input
                type="password"
                placeholder="Digite uma senha para visitantes externos"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-sans border-input bg-transparent text-foreground focus-visible:ring-itc-ciano"
              />
            </div>
          </CardContent>

          <CardFooter className="bg-accent/30 border-t border-border px-6 py-4 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="border-border text-foreground hover:bg-accent font-sans"
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-itc-ciano hover:bg-itc-ciano800 text-white font-medium shadow-sm font-sans"
              disabled={submitting}
            >
              {submitting ? "Gravando no Firestore..." : "Gerar Link Curto"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
