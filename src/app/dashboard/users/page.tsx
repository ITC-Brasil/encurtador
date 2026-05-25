// src/app/dashboard/users/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  UserPlus,
  Trash2,
  ShieldCheck,
  Mail,
  User,
  Play,
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";

interface Colaborador {
  uid: string;
  name: string;
  email: string;
  role: "Administrador" | "Colaborador";
  status: "Ativo" | "Suspenso" | "Bloqueado";
  createdAt: string;
}

type OrderDirection = "asc" | "desc" | null;

export default function GestaoUsuariosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentAdminEmail, setCurrentAdminEmail] = useState<string | null>(
    null,
  );

  // Estados de ordenação estilo Data Table
  const [sortRole, setSortRole] = useState<OrderDirection>(null);
  const [sortStatus, setSortStatus] = useState<OrderDirection>(null);

  const [newUserData, setNewUserData] = useState({
    name: "",
    email: "",
    role: "Colaborador",
  });

  const cardHoverClass =
    "transition-all duration-300 hover:shadow-md hover:border-itc-ciano/30";

  const fetchColaboradores = async () => {
    try {
      const res = await fetch("/api/usuarios");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setColaboradores(data);
    } catch {
      toast.error("Não foi possível carregar os colaboradores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentAdminEmail(user.email);
      fetchColaboradores();
    });
    return () => unsubscribe();
  }, [router]);

  // CONTROLE DE ORDENAÇÃO DO DATA TABLE
  const toggleSortRole = () => {
    const nextDirection: OrderDirection =
      sortRole === "asc" ? "desc" : sortRole === "desc" ? null : "asc";
    setSortRole(nextDirection);
    setSortStatus(null);

    if (!nextDirection) {
      fetchColaboradores();
      return;
    }

    setColaboradores((prev) =>
      [...prev].sort((a, b) => {
        return nextDirection === "asc"
          ? a.role.localeCompare(b.role)
          : b.role.localeCompare(a.role);
      }),
    );
  };

  const toggleSortStatus = () => {
    const nextDirection: OrderDirection =
      sortStatus === "asc" ? "desc" : sortStatus === "desc" ? null : "asc";
    setSortStatus(nextDirection);
    setSortRole(null);

    if (!nextDirection) {
      fetchColaboradores();
      return;
    }

    setColaboradores((prev) =>
      [...prev].sort((a, b) => {
        const statusA = a.status || "Ativo";
        const statusB = b.status || "Ativo";
        return nextDirection === "asc"
          ? statusA.localeCompare(statusB)
          : statusB.localeCompare(statusA);
      }),
    );
  };

  const handleRoleChange = async (
    uid: string,
    newRole: "Administrador" | "Colaborador",
  ) => {
    try {
      const res = await fetch("/api/usuarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, role: newRole }),
      });
      if (!res.ok) throw new Error();
      setColaboradores((prev) =>
        prev.map((c) => (c.uid === uid ? { ...c, role: newRole } : c)),
      );
      toast.success("Permissão updated!");
    } catch {
      toast.error("Erro ao alterar permissão.");
    }
  };

  const handleToggleStatus = async (
    uid: string,
    currentStatus: string,
    name: string,
  ) => {
    const nextStatus =
      currentStatus === "Suspenso" || currentStatus === "Bloqueado"
        ? "Ativo"
        : "Suspenso";
    try {
      const res = await fetch("/api/usuarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, status: nextStatus }),
      });
      if (!res.ok) throw new Error();

      setColaboradores((prev) =>
        prev.map((c) => (c.uid === uid ? { ...c, status: nextStatus } : c)),
      );
      toast.success(
        nextStatus === "Suspenso"
          ? `Acesso de ${name} suspenso.`
          : `Acesso de ${name} reativado.`,
      );
    } catch {
      toast.error("Erro ao alterar status do colaborador.");
    }
  };

  const handleDeletarUsuario = async (uid: string, name: string) => {
    if (
      !confirm(
        `⚠️ ALERTA MÁXIMO:\nDeseja DELETAR DEFINITIVAMENTE o colaborador ${name}?\nEsta ação apagará a conta permanentemente.`,
      )
    )
      return;

    try {
      const res = await fetch(`/api/usuarios?uid=${uid}`, { method: "DELETE" });
      if (!res.ok) throw new Error();

      setColaboradores((prev) => prev.filter((c) => c.uid !== uid));
      toast.success(`Usuário ${name} excluído do sistema.`);
    } catch {
      toast.error("Falha ao deletar o colaborador.");
    }
  };

  const handleCreateColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const randomPassword =
        Math.random().toString(36).substring(2) + "ITC@2026!";

      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newUserData, password: randomPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao registrar usuário.");

      toast.success("Colaborador cadastrado via Google Auth!");
      setIsDialogOpen(false);
      setNewUserData({ name: "", email: "", role: "Colaborador" });
      fetchColaboradores();
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Erro no cadastro.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center font-sans font-medium text-sm text-muted-foreground bg-background">
        Carregando painel de segurança...
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto w-full font-sans transition-colors duration-300 space-y-4">
      {/* Botão Voltar ao Painel restaurado com sucesso */}
      <Button
        variant="ghost"
        onClick={() => router.push("/dashboard")}
        className="text-muted-foreground gap-2 pl-0 hover:bg-transparent font-sans text-xs w-max mb-2"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
      </Button>

      <Card className={`bg-card border-border shadow-sm ${cardHoverClass}`}>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold text-foreground font-sans">
              Equipe ITC Brasil
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-sans">
              Gerencie acessos temporários ou remova usuários permanentemente do
              ecossistema.
            </CardDescription>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-itc-ciano hover:bg-itc-ciano800 text-white font-sans text-xs font-medium gap-2 h-9 shadow-sm">
                <UserPlus className="h-4 w-4" /> Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border font-sans">
              <form onSubmit={handleCreateColaborador}>
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold font-sans">
                    Adicionar Colaborador
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-sans">
                    Os colaboradores adicionados realizarão a autenticação de
                    forma direta e segura através do Google.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 font-sans">
                      <User className="h-3.5 w-3.5 text-itc-ciano" /> Nome
                      Completo
                    </span>
                    <Input
                      required
                      value={newUserData.name}
                      onChange={(e) =>
                        setNewUserData({ ...newUserData, name: e.target.value })
                      }
                      placeholder="Ex: João Silva"
                      className="h-9 text-sm font-sans"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 font-sans">
                      <Mail className="h-3.5 w-3.5 text-itc-ciano" /> E-mail
                      Corporativo
                    </span>
                    <Input
                      type="email"
                      required
                      value={newUserData.email}
                      onChange={(e) =>
                        setNewUserData({
                          ...newUserData,
                          email: e.target.value,
                        })
                      }
                      placeholder="nome@grupoitcbrasil.com.br"
                      className="h-9 text-sm font-sans"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 font-sans">
                      <ShieldCheck className="h-3.5 w-3.5 text-itc-ciano" />{" "}
                      Nível de Permissão
                    </span>
                    <Select
                      value={newUserData.role}
                      onValueChange={(val) =>
                        setNewUserData({ ...newUserData, role: val })
                      }
                    >
                      <SelectTrigger className="h-9 text-sm font-sans">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border font-sans">
                        <SelectItem value="Colaborador">Colaborador</SelectItem>
                        <SelectItem value="Administrador">
                          Administrador
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-itc-ciano hover:bg-itc-ciano800 h-9 text-xs font-sans"
                  >
                    {isSubmitting
                      ? "Cadastrando..."
                      : "Confirmar Cadastro Corporativo"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="p-0 border-t border-border">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow className="border-b border-border">
                <TableHead className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans">
                  Colaborador
                </TableHead>
                <TableHead
                  onClick={toggleSortRole}
                  className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans cursor-pointer hover:bg-muted/30 select-none"
                >
                  <div className="flex items-center gap-1">
                    Permissão <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={toggleSortStatus}
                  className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans text-center cursor-pointer hover:bg-muted/30 select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    Status <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colaboradores.map((colab) => (
                <TableRow
                  key={colab.uid}
                  className="border-b border-border hover:bg-muted/30 transition-colors"
                >
                  <TableCell className="py-4 px-6">
                    <p className="text-sm font-normal text-muted-foreground/80 font-sans tracking-wide break-all">
                      {colab.email}
                    </p>
                  </TableCell>

                  <TableCell className="py-4 px-6">
                    <Select
                      disabled={colab.email === currentAdminEmail}
                      value={
                        colab.role === "Administrador" ||
                        colab.role === "Colaborador"
                          ? colab.role
                          : "Colaborador"
                      }
                      onValueChange={(val: "Administrador" | "Colaborador") =>
                        handleRoleChange(colab.uid, val)
                      }
                    >
                      <SelectTrigger className="w-36 border-border text-xs h-8 bg-background font-sans">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border font-sans">
                        <SelectItem
                          value="Administrador"
                          className="text-xs font-semibold"
                        >
                          Administrador
                        </SelectItem>
                        <SelectItem value="Colaborador" className="text-xs">
                          Colaborador
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="py-4 px-6 text-center">
                    <Badge
                      className={`border-none text-[10px] font-bold px-2.5 h-5 font-sans ${
                        colab.status === "Suspenso" ||
                        colab.status === "Bloqueado"
                          ? "bg-itc-erro/10 text-itc-erro hover:bg-itc-erro/10"
                          : "bg-itc-sucesso/10 text-itc-sucesso hover:bg-itc-sucesso/10"
                      }`}
                    >
                      {colab.status || "Ativo"}
                    </Badge>
                  </TableCell>

                  <TableCell className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        disabled={colab.email === currentAdminEmail}
                        onClick={() =>
                          handleToggleStatus(
                            colab.uid,
                            colab.status || "Ativo",
                            colab.name,
                          )
                        }
                        className={`text-xs font-medium h-8 px-2.5 gap-1 border-border font-sans ${
                          colab.status === "Suspenso" ||
                          colab.status === "Bloqueado"
                            ? "text-itc-sucesso hover:bg-itc-sucesso/10 hover:text-itc-sucesso border-itc-sucesso/30"
                            : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-600"
                        }`}
                      >
                        {colab.status === "Suspenso" ||
                        colab.status === "Bloqueado" ? (
                          <>
                            <Play className="h-3.5 w-3.5" /> Reativar
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5" /> Suspender
                          </>
                        )}
                      </Button>

                      <Button
                        variant="destructive"
                        disabled={colab.email === currentAdminEmail}
                        onClick={() =>
                          handleDeletarUsuario(colab.uid, colab.name)
                        }
                        className="bg-itc-erro/10 text-itc-erro hover:bg-itc-erro hover:text-white border-none font-medium text-xs gap-1 h-8 px-2.5 transition-all duration-200 font-sans"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Deletar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {colaboradores.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-xs text-muted-foreground font-medium font-sans"
                  >
                    Nenhum colaborador encontrado no banco de dados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
