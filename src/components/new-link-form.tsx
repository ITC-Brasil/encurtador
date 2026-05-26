// src/components/new-link-form.tsx
"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import bcrypt from "bcryptjs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Link2, ShieldCheck, Calendar } from "lucide-react";
import { toast } from "sonner";
import { registerLog } from "@/lib/audit";
import { User } from "firebase/auth";

interface NewLinkFormProps {
  user: User | null; // <-- Recebe o user completo para metadados de auditoria
  onSuccess: () => void;
  onCancel: () => void;
}

export function NewLinkForm({ user, onSuccess, onCancel }: NewLinkFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [password, setPassword] = useState("");

  const generateRandomSlug = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalUrl) return toast.error("A URL de destino é obrigatória.");
    if (!originalUrl.startsWith("http"))
      return toast.error("A URL deve começar com http:// ou https://");

    setSubmitting(true);
    try {
      let finalSlug = slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "");
      if (!finalSlug) finalSlug = generateRandomSlug();

      // Hash da senha (se existir) com 10 rounds de salt
      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

      const linkPayload = {
        title: title.trim() || "Link Sem Título",
        originalUrl: originalUrl.trim(),
        slug: finalSlug,
        clickCount: 0,
        isActive: true,
        isDeleted: false, // 🟢 Correção: Garante conformidade imediata com a query da Dashboard
        createdBy: user?.uid || null,
        createdAt: Timestamp.now(),
        expiresAt: expiresAt ? Timestamp.fromDate(new Date(expiresAt)) : null,
        maxClicks: maxClicks ? parseInt(maxClicks, 10) : null,
        passwordHash: hashedPassword,
      };

      // --- SOLUÇÃO CONTRA RACE CONDITION (ATOMICIDADE NATIVA) ---
      const slugRef = doc(db, "links", finalSlug);

      try {
        // Usa a atomicidade do Firestore definindo o slug como Document ID
        await setDoc(slugRef, linkPayload, { merge: false });

        // 📝 DISPARO DE AUDITORIA: Registra a trilha imutável no sistema
        if (user) {
          await registerLog({
            action: "LINK_CREATE",
            performedBy: {
              uid: user.uid,
              name: user.displayName || "Colaborador",
              email: user.email || "sem-email@itcbr.xyz",
            },
            targetId: finalSlug,
            details: `Criou o link curto /${finalSlug} apontando para ${originalUrl.trim()}`,
          });
        }

        toast.success("Link criado com sucesso!");
        onSuccess();
      } catch (error: unknown) {
        const firebaseError = error as { code?: string };

        if (
          firebaseError?.code === "permission-denied" ||
          firebaseError?.code === "already-exists"
        ) {
          toast.error("Este slug já está em uso.");
          return;
        }
        throw error;
      }
    } catch {
      toast.error("Erro ao criar link.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleCreateLink}>
      <div className="space-y-5 py-4">
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
            Apenas letras, números, hífens e sublinhados. Deixe em branco para
            gerar código aleatório.
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
              <Calendar className="h-3 w-3 text-muted-foreground" /> Expira em
              (Data/Hora)
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
              <Link2 className="h-3 w-3 text-muted-foreground" /> Limite Máximo
              de Cliques
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
            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Proteger
            por Senha de Acesso
          </label>
          <Input
            type="password"
            placeholder="Digite uma senha para visitantes externos"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="font-sans border-input bg-transparent text-foreground focus-visible:ring-itc-ciano"
          />
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
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
          {submitting ? "Gravando..." : "Gerar Link Curto"}
        </Button>
      </DialogFooter>
    </form>
  );
}
