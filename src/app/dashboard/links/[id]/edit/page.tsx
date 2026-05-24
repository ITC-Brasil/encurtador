// src/app/dashboard/links/[id]/edit/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Link2, Type, Lock } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { toast } from "sonner";

export default function EditLinkPage() {
  const router = useRouter();
  const params = useParams();
  const linkId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    originalUrl: "",
    slug: "",
  });

  // Estados do gerenciamento de senha
  const [isProtected, setIsProtected] = useState(false);
  const [password, setPassword] = useState("");
  const [hadPasswordInitially, setHadPasswordInitially] = useState(false);

  useEffect(() => {
    if (!linkId) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      try {
        const docRef = doc(db, "links", linkId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            title: data.title || "",
            originalUrl: data.originalUrl || "",
            slug: data.slug || "",
          });

          if (data.passwordHash) {
            setIsProtected(true);
            setHadPasswordInitially(true);
          }
        } else {
          toast.error("Link não encontrado.");
          router.push("/dashboard");
        }
      } catch (error) {
        toast.error("Erro ao buscar dados do link.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, linkId]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.originalUrl) {
      return toast.error("Preencha os campos obrigatórios.");
    }

    if (isProtected && !hadPasswordInitially && !password) {
      return toast.error("Por favor, digite a senha de proteção.");
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, "links", linkId);

      const updateFields: any = {
        title: formData.title,
        originalUrl: formData.originalUrl,
      };

      // Lógica de alteração/remoção de senha
      if (!isProtected) {
        updateFields.passwordHash = null; // Remove a senha do banco
      } else if (password) {
        updateFields.passwordHash = password; // Grava a nova senha digitada
      } // Se isProtected for true mas o campo password estiver vazio, mantém a senha antiga intocada

      await updateDoc(docRef, updateFields);

      toast.success("Link atualizado com sucesso!");
      router.push(`/dashboard/links/${linkId}`);
    } catch (error) {
      toast.error("Erro ao atualizar o link.");
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center font-sans text-muted-foreground">
        Carregando dados do link...
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 max-w-3xl mx-auto w-full font-sans transition-colors duration-300 space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-5">
        <Button
          variant="ghost"
          onClick={() => router.push(`/dashboard/links/${linkId}`)}
          className="text-muted-foreground pl-0 hover:bg-transparent font-sans"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar aos Detalhes
        </Button>
        <ModeToggle />
      </div>

      <Card className="bg-card border-border shadow-sm text-card-foreground">
        <form onSubmit={handleUpdate}>
          <CardHeader>
            <CardTitle className="text-2xl font-bold font-display">
              Editar Link
            </CardTitle>
            <CardDescription className="font-sans text-muted-foreground">
              Altere o destino, identificação ou configurações de senha. O QR
              Code atual continuará funcionando perfeitamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Link Curto */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4 text-itc-ciano" /> Link Curto (Não
                Editável)
              </label>
              <Input
                disabled
                value={`itcbr.xyz/${formData.slug}`}
                className="bg-muted text-muted-foreground cursor-not-allowed border-border"
              />
              <p className="text-xs text-muted-foreground">
                Para garantir a integridade dos impressos, o slug não pode ser
                alterado.
              </p>
            </div>

            {/* Título */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Type className="h-4 w-4 text-itc-ciano" /> Identificação
                (Título)
              </label>
              <Input
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Ex: Campanha Comercial"
                className="border-input focus-visible:ring-itc-ciano"
              />
            </div>

            {/* URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Link2 className="h-4 w-4 text-itc-ciano" /> Destino Original
                (URL)
              </label>
              <Input
                type="url"
                required
                value={formData.originalUrl}
                onChange={(e) =>
                  setFormData({ ...formData, originalUrl: e.target.value })
                }
                placeholder="https://exemplo.com/pagina"
                className="border-input focus-visible:ring-itc-ciano"
              />
            </div>

            {/* Gerenciamento de Senha */}
            <div className="space-y-4 pt-6 border-t border-border mt-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="password-protect"
                  checked={isProtected}
                  onCheckedChange={(checked) => setIsProtected(!!checked)}
                  className="border-border data-[state=checked]:bg-itc-ciano data-[state=checked]:border-itc-ciano"
                />
                <label
                  htmlFor="password-protect"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1.5 text-foreground"
                >
                  <Lock className="h-4 w-4 text-itc-ciano" /> Exigir senha para
                  acessar este link curto
                </label>
              </div>

              {isProtected && (
                <div className="flex flex-col gap-3 pl-5 ml-1.5 mt-3 border-l-2 border-itc-ciano/30 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-sm font-medium text-foreground">
                    {hadPasswordInitially
                      ? "Alterar Senha"
                      : "Definir Senha de Acesso"}
                  </label>
                  <Input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      hadPasswordInitially
                        ? "Nova senha (deixe em branco para manter a atual)"
                        : "Digite a senha de acesso"
                    }
                    className="border-input focus-visible:ring-itc-ciano w-full"
                  />
                  {hadPasswordInitially && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
                      * Este link já possui uma senha ativa. Desmarque a
                      caixinha acima se desejar remover a proteção por completo.
                    </p>
                  )}
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSaving}
              className="w-full bg-itc-ciano hover:bg-itc-ciano800 text-white font-sans font-medium gap-2 mt-4 shadow-sm"
            >
              {isSaving ? (
                "Salvando..."
              ) : (
                <>
                  <Save className="h-4 w-4" /> Salvar Alterações
                </>
              )}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
