// src/components/new-link-form.tsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  setDoc,
  Timestamp,
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import bcrypt from "bcryptjs";
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
import { Link2, ShieldCheck, Calendar, Tags } from "lucide-react";
import { toast } from "sonner";
import { registerLog } from "@/lib/audit";

interface NewLinkFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

export function NewLinkForm({ onSuccess, onCancel }: NewLinkFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [password, setPassword] = useState("");

  // 🟢 Estados das Categorias
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("none");

  // 🟢 Busca as categorias em tempo real ao abrir o modal
  useEffect(() => {
    const catRef = collection(db, "categories");
    const q = query(catRef, orderBy("name", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const catArray: Category[] = [];
        snapshot.forEach((docSnap) => {
          catArray.push({
            id: docSnap.id,
            name: docSnap.data().name,
            color: docSnap.data().color,
          });
        });
        setCategories(catArray);
      },
      (error) => {
        console.error("Erro ao buscar categorias:", error);
      },
    );

    return () => unsubscribe();
  }, []);

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
      const currentUser = auth.currentUser;

      let finalSlug = slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "");
      if (!finalSlug) finalSlug = generateRandomSlug();

      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

      // 🟢 Encontra a categoria selecionada para desnormalizar os dados
      const selectedCategory = categories.find((c) => c.id === categoryId);

      const linkPayload = {
        title: title.trim() || "Link Sem Título",
        originalUrl: originalUrl.trim(),
        slug: finalSlug,
        clickCount: 0,
        isActive: true,
        isDeleted: false,

        // 🟢 Injeção de Metadados de Categoria
        categoryId: selectedCategory ? selectedCategory.id : null,
        categoryName: selectedCategory ? selectedCategory.name : null,
        categoryColor: selectedCategory ? selectedCategory.color : null,

        createdBy: currentUser?.uid || null,
        createdByName: currentUser?.displayName || "Colaborador",
        createdByEmail: currentUser?.email || "sistema@itcbr.xyz",
        createdAt: Timestamp.now(),
        expiresAt: expiresAt ? Timestamp.fromDate(new Date(expiresAt)) : null,
        maxClicks: maxClicks ? parseInt(maxClicks, 10) : null,
        passwordHash: hashedPassword,
      };

      const slugRef = doc(db, "links", finalSlug);

      try {
        await setDoc(slugRef, linkPayload, { merge: false });

        if (currentUser) {
          await registerLog({
            action: "LINK_CREATE",
            performedBy: {
              uid: currentUser.uid,
              name: currentUser.displayName || "Colaborador",
              email: currentUser.email || "sem-email@itcbr.xyz",
            },
            targetId: finalSlug,
            details: `Criou o link curto /${finalSlug} apontando para ${originalUrl.trim()}. ${selectedCategory ? `Categoria vinculada: [${selectedCategory.name}].` : ""}`,
          });
        }

        toast.success("Link criado com sucesso!");
        onSuccess();
      } catch (error: unknown) {
        console.error(
          "❌ ERRO OPERACIONAL NO ESCOPO DE GRAVAÇÃO/AUDITORIA:",
          error,
        );

        const firebaseError = error as { code?: string };

        if (
          firebaseError?.code === "permission-denied" ||
          firebaseError?.code === "already-exists"
        ) {
          toast.error(
            "Ação recusada: Verifique se este slug já existe ou se há restrições de escrita.",
          );
          return;
        }
        throw error;
      }
    } catch (outerError: unknown) {
      console.error("❌ ERRO CRÍTICO GLOBAL NO FORMULÁRIO:", outerError);
      toast.error("Erro ao processar criação de link.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleCreateLink}>
      <div className="space-y-5 py-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Título */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Título / Identificação Interna
            </label>
            <Input
              type="text"
              placeholder="Ex: Qualifica DF"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-sans border-input bg-transparent text-foreground focus-visible:ring-itc-ciano"
            />
          </div>

          {/* 🟢 Categoria / Tag Corporativa */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Tags className="h-3.5 w-3.5 text-itc-ciano" /> Tag Corporativa
            </label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="border-input bg-transparent focus:ring-itc-ciano font-sans h-9">
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent className="font-sans">
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <p className="text-[11px] text-muted-foreground font-sans">
            Apenas letras, números, hífens e sublinhados. Deixe em branco para
            gerar aleatório.
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
