// src/components/invite-member-form.tsx
"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, ShieldCheck, Copy, Check, Link2 } from "lucide-react";
import { toast } from "sonner";

interface InviteMemberFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function InviteMemberForm({
  onSuccess,
  onCancel,
}: InviteMemberFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"Administrador" | "Colaborador">(
    "Colaborador",
  );
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim())
      return toast.error("O e-mail corporativo é obrigatório.");

    setSubmitting(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast.error("Sessão expirada. Autentique-se novamente.");
        return;
      }

      // Obtém o Token Bearer JWT para validação no requireAdmin do back-end
      const token = await currentUser.getIdToken();

      const res = await fetch("/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Falha ao gerar convite.");
      }

      toast.success("Convite corporativo gerado!");
      setGeneratedLink(data.inviteLink);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro operacional.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success("Link de convite copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Se o link já foi gerado com sucesso, exibe a tela de sucesso com o link para cópia
  if (generatedLink) {
    return (
      <div className="space-y-4 py-4 font-sans">
        <div className="p-4 bg-itc-ciano/10 rounded-lg border border-itc-ciano/20 text-center space-y-2">
          <Link2 className="h-8 w-8 text-itc-ciano mx-auto" />
          <h3 className="text-sm font-bold text-foreground">
            Convite Pronto para Envio!
          </h3>
          <p className="text-xs text-muted-foreground">
            Envie o link exclusivo abaixo para o colaborador. Ele poderá
            registrar suas credenciais corporativas com segurança.
          </p>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Link de Acesso Único
          </span>
          <div className="flex gap-2">
            <Input
              readOnly
              value={generatedLink}
              className="h-9 text-xs font-mono bg-muted text-muted-foreground focus-visible:ring-0 select-all"
            />
            <Button
              type="button"
              onClick={handleCopyLink}
              className="bg-itc-ciano hover:bg-itc-ciano800 text-white h-9 px-3 shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t border-border">
          <Button
            type="button"
            onClick={onCancel}
            className="w-full border-border text-foreground hover:bg-accent font-sans text-xs h-9"
          >
            Fechar Painel
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={handleCreateInvite}>
      <div className="space-y-4 py-4 font-sans">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-itc-ciano" /> E-mail de Destino
          </label>
          <Input
            type="email"
            required
            placeholder="colaborador@grupoitcbrasil.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 text-sm focus-visible:ring-itc-ciano border-input bg-transparent text-foreground"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-itc-ciano" /> Atribuição de
            Acesso (Role)
          </label>
          <Select
            value={role}
            onValueChange={(value: "Administrador" | "Colaborador") =>
              setRole(value)
            }
          >
            <SelectTrigger className="h-9 text-sm border-input bg-transparent text-foreground">
              <SelectValue placeholder="Selecione a permissão" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="Colaborador" className="text-xs font-sans">
                Colaborador (Gera/audita apenas links próprios)
              </SelectItem>
              <SelectItem value="Administrador" className="text-xs font-sans">
                Administrador (Controle irrestrito global)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-border text-foreground hover:bg-accent font-sans text-xs h-9"
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="bg-itc-ciano hover:bg-itc-ciano800 text-white font-medium text-xs font-sans h-9"
          disabled={submitting}
        >
          {submitting ? "Gerando Token..." : "Enviar Convite Oficial"}
        </Button>
      </DialogFooter>
    </form>
  );
}
