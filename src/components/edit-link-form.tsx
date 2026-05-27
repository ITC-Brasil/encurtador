// src/components/edit-link-form.tsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore"; // 🟢 Timestamp importado aqui
import bcrypt from "bcryptjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Link2, Type, Lock } from "lucide-react";
import { toast } from "sonner";
import { registerLog, FirestorePrimitive } from "@/lib/audit";

interface EditLinkFormProps {
  linkId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function EditLinkForm({
  linkId,
  onSuccess,
  onCancel,
}: EditLinkFormProps) {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [initialData, setInitialData] = useState<Record<string, unknown>>({});

  const [formData, setFormData] = useState({
    title: "",
    originalUrl: "",
    slug: "",
  });

  const [isProtected, setIsProtected] = useState(false);
  const [password, setPassword] = useState("");
  const [hadPasswordInitially, setHadPasswordInitially] = useState(false);

  useEffect(() => {
    if (!linkId) return;

    const fetchLinkData = async () => {
      try {
        const docRef = doc(db, "links", linkId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();

          setInitialData(data);

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
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        toast.error("Erro ao buscar dados do link.");
      } finally {
        setLoading(false);
      }
    };

    fetchLinkData();
  }, [linkId]);

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
      const currentUser = auth.currentUser;
      const docRef = doc(db, "links", linkId);

      // 🟢 O Timestamp foi adicionado à tipagem permitida neste objeto
      const updateFields: Record<string, string | null | boolean | Timestamp> =
        {
          title: formData.title,
          originalUrl: formData.originalUrl,
        };

      const beforeState: Record<string, FirestorePrimitive> = {};
      const afterState: Record<string, FirestorePrimitive> = {};
      let hasChanges = false;

      if (initialData.title !== updateFields.title) {
        beforeState.title = (initialData.title as string) || "Sem título";
        afterState.title = updateFields.title as string;
        hasChanges = true;
      }

      if (initialData.originalUrl !== updateFields.originalUrl) {
        beforeState.originalUrl = initialData.originalUrl as string;
        afterState.originalUrl = updateFields.originalUrl as string;
        hasChanges = true;
      }

      let passwordChanged = false;
      if (!isProtected && hadPasswordInitially) {
        updateFields.passwordHash = null;
        beforeState.protection = "Senha Ativada";
        afterState.protection = "Senha Removida";
        hasChanges = true;
        passwordChanged = true;
      } else if (isProtected && password) {
        updateFields.passwordHash = await bcrypt.hash(password, 10);
        beforeState.protection = hadPasswordInitially
          ? "Senha Alterada"
          : "Desprotegido";
        afterState.protection = "Nova Senha Aplicada";
        hasChanges = true;
        passwordChanged = true;
      }

      // 🟢 AQUI ESTÁ A MÁGICA: Registrando a Data e Hora da Edição!
      if (hasChanges && currentUser) {
        updateFields.updatedBy = currentUser.uid;
        updateFields.updatedByName = currentUser.displayName || "Colaborador";
        updateFields.updatedByEmail = currentUser.email || "sistema@itcbr.xyz";
        updateFields.updatedAt = Timestamp.now(); // Grava a hora exata no banco
      }

      await updateDoc(docRef, updateFields);

      if (hasChanges && currentUser) {
        let detailsMsg = `Alterou parâmetros operacionais do link /${formData.slug}.`;
        if (passwordChanged) {
          detailsMsg += " Credenciais de proteção modificadas.";
        }

        await registerLog({
          action: "LINK_EDIT",
          performedBy: {
            uid: currentUser.uid,
            name: currentUser.displayName || "Colaborador",
            email: currentUser.email || "sem-email@itcbr.xyz",
          },
          targetId: formData.slug,
          details: detailsMsg,
          changes: {
            before: beforeState,
            after: afterState,
          },
        });
      }

      toast.success("Link atualizado com sucesso!");
      onSuccess();
    } catch (err) {
      console.error("❌ ERRO CRÍTICO NA GRAVAÇÃO OU AUDITORIA:", err);
      toast.error("Erro ao processar atualização do link.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full items-center justify-center py-8 font-sans text-muted-foreground text-sm">
        Carregando informações...
      </div>
    );
  }

  return (
    <form onSubmit={handleUpdate} className="space-y-5 font-sans mt-2">
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2 text-foreground">
          <Link2 className="h-4 w-4 text-itc-ciano" /> Link Curto (Fixo)
        </label>
        <Input
          disabled
          value={`itcbr.xyz/${formData.slug}`}
          className="bg-muted text-muted-foreground cursor-not-allowed border-border"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2 text-foreground">
          <Type className="h-4 w-4 text-itc-ciano" /> Identificação (Título)
        </label>
        <Input
          required
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="border-input focus-visible:ring-itc-ciano"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2 text-foreground">
          <Link2 className="h-4 w-4 text-itc-ciano" /> Destino Original
        </label>
        <Input
          type="url"
          required
          value={formData.originalUrl}
          onChange={(e) =>
            setFormData({ ...formData, originalUrl: e.target.value })
          }
          className="border-input focus-visible:ring-itc-ciano"
        />
      </div>

      <div className="space-y-4 pt-4 border-t border-border mt-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="password-protect"
            checked={isProtected}
            onCheckedChange={(checked) => setIsProtected(!!checked)}
            className="border-border data-[state=checked]:bg-itc-ciano data-[state=checked]:border-itc-ciano"
          />
          <label
            htmlFor="password-protect"
            className="text-sm font-medium leading-none cursor-pointer flex items-center gap-1.5 text-foreground"
          >
            <Lock className="h-4 w-4 text-itc-ciano" /> Exigir senha
          </label>
        </div>

        {isProtected && (
          <div className="flex flex-col gap-2 pl-5 ml-1.5 mt-2 border-l-2 border-itc-ciano/30">
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                hadPasswordInitially
                  ? "Nova senha (em branco para manter)"
                  : "Digite a senha"
              }
              className="border-input focus-visible:ring-itc-ciano text-sm h-9"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-5 mt-2 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="w-full font-sans border-border text-foreground hover:bg-accent"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSaving}
          className="w-full bg-itc-ciano hover:bg-itc-ciano800 text-white font-sans font-medium gap-2 shadow-sm"
        >
          {isSaving ? (
            "Salvando..."
          ) : (
            <>
              <Save className="h-4 w-4" /> Salvar
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
