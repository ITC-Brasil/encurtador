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
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tags, Plus, Edit, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ColorPicker, gerarCorSugerida } from "@/components/color-picker";
import { LoadingSpinner } from "@/components/loading-spinner";
import { BackButton } from "@/components/back-button";
import { getCategoryBadgeStyle } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  color: string;
  createdAt?: unknown;
}

export default function TagsManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  // Estados do Modal de CRUD
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estados do Dialog de confirmação de exclusão
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteName, setPendingDeleteName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado do Formulário
  const [formData, setFormData] = useState({
    name: "",
    color: "#008F95",
  });

  const cardHoverClass =
    "transition-all duration-300 hover:shadow-md hover:border-itc-ciano/30";

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }

      // 🔒 Verifica se o usuário é Administrador
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.data()?.role !== "Administrador") {
        toast.error("Acesso restrito a administradores.");
        router.push("/dashboard");
        return;
      }

      const catRef = collection(db, "categories");
      const q = query(catRef, orderBy("name", "asc"));

      unsubscribeSnapshot = onSnapshot(
        q,
        (querySnapshot) => {
          const catArray: Category[] = [];
          querySnapshot.forEach((docSnap) => {
            catArray.push({ id: docSnap.id, ...docSnap.data() } as Category);
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
      setFormData({ name: "", color: gerarCorSugerida() });
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
        await updateDoc(doc(db, "categories", editingId), {
          name: formData.name.trim(),
          color: formData.color,
          updatedBy: currentUser?.uid,
        });
        toast.success("Categoria atualizada com sucesso!");
      } else {
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

  // 🔧 Dialog de confirmação em vez de window.confirm
  const handleDelete = (id: string, name: string) => {
    setPendingDeleteId(id);
    setPendingDeleteName(name);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "categories", pendingDeleteId));
      toast.success("Categoria excluída.");
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Falha ao excluir a categoria.");
    } finally {
      setIsDeleting(false);
      setPendingDeleteId(null);
      setPendingDeleteName("");
    }
  };

  if (loading) {
    return <LoadingSpinner label="Carregando árvore de categorias..." />;
  }

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full font-sans transition-colors duration-300 space-y-8">
      <div>
        <div className="mb-6">
          <BackButton />
        </div>

        {/* CARD PRINCIPAL */}
        <Card className={`bg-card border-border shadow-sm ${cardHoverClass}`}>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold text-foreground font-sans flex items-center gap-2">
                <Tags className="h-5 w-5 text-itc-ciano" /> Gestão de Categorias
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground font-sans">
                Crie e gerencie as tags corporativas para organizar os links da
                plataforma.
              </CardDescription>
            </div>

            <Button
              onClick={() => handleOpenModal()}
              className="bg-itc-ciano hover:bg-itc-ciano800 text-white font-sans text-xs font-medium gap-2 h-9 shadow-sm"
            >
              <Plus className="h-4 w-4" /> Nova Categoria
            </Button>
          </CardHeader>

          <CardContent className="p-0 border-t border-border">
            {categories.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground italic font-sans">
                Nenhuma categoria cadastrada no sistema.
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans w-[40%]">
                      Nome da Categoria
                    </TableHead>
                    <TableHead className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans w-[20%]">
                      Visualização
                    </TableHead>
                    <TableHead className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans w-[20%]">
                      Cor (HEX)
                    </TableHead>
                    <TableHead className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans text-right w-[20%]">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow
                      key={cat.id}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="py-4 px-6 font-medium text-foreground text-sm font-sans">
                        {cat.name}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border tracking-wider uppercase font-sans"
                          style={getCategoryBadgeStyle(cat.color)}
                        >
                          {cat.name}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <code className="font-mono text-xs text-muted-foreground">
                          {cat.color}
                        </code>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right">
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
      </div>

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

            <ColorPicker
              value={formData.color}
              onChange={(newColor) =>
                setFormData({ ...formData, color: newColor })
              }
              label="Cor de Identificação"
            />

            <DialogFooter className="border-t border-border/40 pt-4 mt-2 gap-2 sm:gap-2">
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

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-card border-border font-sans max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold text-base">
              <AlertTriangle className="h-5 w-5 text-itc-erro shrink-0" />
              Excluir Categoria?
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Você está prestes a excluir a categoria{" "}
            <span className="font-semibold text-foreground">
              &quot;{pendingDeleteName}&quot;
            </span>
            . Esta ação não pode ser desfeita.
          </p>
          <DialogFooter className="gap-2 sm:gap-2 border-t border-border pt-4 mt-2">
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={() => setIsDeleteDialogOpen(false)}
              className="border-border text-foreground text-xs h-8"
            >
              Cancelar
            </Button>
            <Button
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="bg-itc-erro hover:bg-red-700 text-white font-medium text-xs h-8"
            >
              {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
