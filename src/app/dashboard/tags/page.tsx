// src/app/dashboard/tags/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tags, Plus, Loader2, ArrowLeft, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

// 🟢 Importação do nosso Color Picker diretamente da raiz de components
import { ColorPicker, gerarCorSugerida } from "@/components/color-picker";

interface Category {
  id: string;
  name: string;
  color: string;
  createdAt?: unknown;
}

// Função auxiliar do manual para calcular a opacidade das Badges
function hexToRgba(hex: string, alpha: number): string {
  // Fallback caso venha algo corrompido
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return `rgba(0, 143, 149, ${alpha})`;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function TagsManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  // Estados do Modal de CRUD
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estado do Formulário
  const [formData, setFormData] = useState({
    name: "",
    color: "#008F95",
  });

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        const catRef = collection(db, "categories");
        const q = query(catRef, orderBy("name", "asc"));

        unsubscribeSnapshot = onSnapshot(
          q,
          (querySnapshot) => {
            const catArray: Category[] = [];
            querySnapshot.forEach((doc) => {
              catArray.push({ id: doc.id, ...doc.data() } as Category);
            });
            setCategories(catArray);
            setLoading(false);
          },
          (error) => {
            console.error("Erro ao escutar categorias:", error);
            toast.error("Falha ao sincronizar as categorias.");
            setLoading(false);
          },
        );
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [router]);

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingId(category.id);
      setFormData({ name: category.name, color: category.color });
    } else {
      setEditingId(null);
      setFormData({ name: "", color: gerarCorSugerida() }); // Cor institucional aleatória
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error("O nome é obrigatório.");

    setIsSaving(true);
    try {
      const currentUser = auth.currentUser;
      const catRef = collection(db, "categories");

      if (editingId) {
        // Atualiza categoria existente
        await updateDoc(doc(db, "categories", editingId), {
          name: formData.name.trim(),
          color: formData.color,
          updatedBy: currentUser?.uid,
        });
        toast.success("Categoria atualizada com sucesso!");
      } else {
        // Cria nova categoria
        await addDoc(catRef, {
          name: formData.name.trim(),
          color: formData.color,
          createdBy: currentUser?.uid,
          createdAt: serverTimestamp(),
        });
        toast.success("Categoria criada com sucesso!");
      }

      setIsModalOpen(false);
    } catch (error) {
      console.error("Erro ao salvar categoria:", error);
      toast.error("Ocorreu um erro ao salvar a categoria.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir a categoria "${name}"? Essa ação não pode ser desfeita.`,
      )
    )
      return;

    try {
      await deleteDoc(doc(db, "categories", id));
      toast.success("Categoria excluída.");
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Falha ao excluir a categoria.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center font-sans text-xs font-medium text-muted-foreground bg-background">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-itc-ciano" />
          <span>Carregando árvore de categorias...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full font-sans transition-colors duration-300 space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.push("/dashboard")}
        className="text-muted-foreground gap-2 pl-0 hover:bg-transparent font-sans text-xs w-max mb-1"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
      </Button>

      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Tags className="h-6 w-6 text-itc-ciano" /> Gestão de Categorias
          </h1>
          <p className="text-xs text-muted-foreground">
            Crie e gerencie as tags corporativas para organizar os links da
            plataforma.
          </p>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="bg-itc-ciano hover:bg-itc-ciano800 text-white font-sans font-medium gap-2 shadow-sm h-9"
        >
          <Plus className="h-4 w-4" /> Nova Categoria
        </Button>
      </div>

      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardHeader className="pb-3 pt-4 border-b border-border/40">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5">
            Árvore de Etiquetas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {categories.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground italic">
              Nenhuma categoria cadastrada no sistema.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-accent/10">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-[40%] text-muted-foreground font-bold text-xs h-10 px-6">
                    Nome da Categoria
                  </TableHead>
                  <TableHead className="w-[20%] text-muted-foreground font-bold text-xs h-10 px-6">
                    Visualização
                  </TableHead>
                  <TableHead className="w-[20%] text-muted-foreground font-bold text-xs h-10 px-6">
                    Cor (HEX)
                  </TableHead>
                  <TableHead className="w-[20%] text-right text-muted-foreground font-bold text-xs h-10 px-6">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow
                    key={cat.id}
                    className="border-border/40 hover:bg-accent/10 transition-colors h-14"
                  >
                    <TableCell className="px-6 font-medium text-foreground text-sm">
                      {cat.name}
                    </TableCell>
                    <TableCell className="px-6">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border tracking-wider uppercase font-sans"
                        style={{
                          backgroundColor: hexToRgba(cat.color, 0.15),
                          color: cat.color,
                          borderColor: hexToRgba(cat.color, 0.4),
                        }}
                      >
                        {cat.name}
                      </span>
                    </TableCell>
                    <TableCell className="px-6">
                      <code className="font-mono text-xs text-muted-foreground">
                        {cat.color}
                      </code>
                    </TableCell>
                    <TableCell className="px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenModal(cat)}
                          className="h-8 w-8 text-muted-foreground hover:text-itc-ciano hover:bg-itc-ciano/10"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cat.id, cat.name)}
                          className="h-8 w-8 text-muted-foreground hover:text-itc-erro hover:bg-itc-erro/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de CRUD */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md w-full font-sans">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Tags className="h-5 w-5 text-itc-ciano" />
              {editingId ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label
                htmlFor="catName"
                className="text-foreground text-sm font-medium"
              >
                Nome da Categoria
              </Label>
              <Input
                id="catName"
                autoFocus
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ex: Comercial, Vendas, RH..."
                className="border-input focus-visible:ring-itc-ciano"
                required
              />
            </div>

            {/* Injeção do nosso Componente Personalizado */}
            <ColorPicker
              value={formData.color}
              onChange={(newColor) =>
                setFormData({ ...formData, color: newColor })
              }
              label="Cor de Identificação"
            />

            <DialogFooter className="border-t border-border/40 pt-4 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
                className="border-border text-foreground hover:bg-accent font-sans text-xs h-9 px-4"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-itc-ciano hover:bg-itc-ciano800 text-white font-sans font-medium h-9 px-4 shadow-sm"
              >
                {isSaving ? "Salvando..." : "Salvar Categoria"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
