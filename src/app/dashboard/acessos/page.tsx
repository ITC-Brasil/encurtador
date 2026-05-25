// src/app/dashboard/acessos/page.tsx
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
  Lock,
  User,
  Play,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { ModeToggle } from "@/components/mode-toggle";

interface Colaborador {
  uid: string;
  name: string;
  email: string;
  role: "Administrador" | "Colaborador";
  status: "Ativo" | "Suspenso" | "Bloqueado";
  createdAt: string;
}

export default function GestaoAcessosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [newUserData, setNewUserData] = useState({
    name: "",
    email: "",
    password: "",
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
    } catch (error) {
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
      fetchColaboradores();
    });
    return () => unsubscribe();
  }, [router]);

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
      toast.success("Permissão atualizada com sucesso!");
    } catch (error) {
      toast.error("Erro ao alterar permissão.");
    }
  };

  const handleToggleStatus = async (
    uid: string,
    currentStatus: string,
    name: string,
  ) => {
    // Normaliza tanto Suspenso quanto o legado Bloqueado para alternar corretamente
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
    } catch (error) {
      toast.error("Erro ao alterar status do colaborador.");
    }
  };

  const handleDeletarUsuario = async (uid: string, name: string) => {
    if (
      !confirm(
        `⚠️ ALERTA MÁXIMO:\nDeseja DELETAR DEFINITIVAMENTE o colaborador ${name}?\nEsta ação apagará a conta do Firebase Auth e do Firestore, não podendo ser desfeita.`,
      )
    )
      return;

    try {
      const res = await fetch(`/api/usuarios?uid=${uid}`, { method: "DELETE" });
      if (!res.ok) throw new Error();

      setColaboradores((prev) => prev.filter((c) => c.uid !== uid));
      toast.success(`Usuário ${name} excluído do sistema.`);
    } catch (error) {
      toast.error("Falha ao deletar o colaborador.");
    }
  };

  const handleCreateColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUserData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Colaborador cadastrado!");
      setIsDialogOpen(false);
      setNewUserData({
        name: "",
        email: "",
        password: "",
        role: "Colaborador",
      });
      fetchColaboradores();
    } catch (error: any) {
      toast.error(error.message || "Erro no cadastro.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto w-full font-sans transition-colors duration-300 space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-5">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          className="text-muted-foreground gap-2 pl-0 hover:bg-transparent font-sans"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
        </Button>
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-itc-ciano" />
          <h1 className="text-xl font-bold tracking-tight text-foreground font-display">
            Gestão de Acessos
          </h1>
          <ModeToggle />
        </div>
      </div>

      <Card className={`bg-card border-border shadow-sm ${cardHoverClass}`}>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold text-foreground">
              Equipe ITC Brasil
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Gerencie acessos temporários ou remova usuários permanentemente.
            </CardDescription>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-itc-ciano hover:bg-itc-ciano800 text-white font-sans text-xs font-medium gap-2 h-9 shadow-sm">
                <UserPlus className="h-4 w-4" /> Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-106.25 bg-card border-border">
              <form onSubmit={handleCreateColaborador}>
                <DialogHeader>
                  <DialogTitle className="font-display text-lg font-bold">
                    Adicionar Colaborador
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
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
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-itc-ciano" /> E-mail
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
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-itc-ciano" /> Senha
                      Provisória
                    </span>
                    <Input
                      type="password"
                      required
                      value={newUserData.password}
                      onChange={(e) =>
                        setNewUserData({
                          ...newUserData,
                          password: e.target.value,
                        })
                      }
                      placeholder="Mínimo 6 dígitos"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-itc-ciano" />{" "}
                      Permissão
                    </span>
                    <Select
                      value={newUserData.role}
                      onValueChange={(val) =>
                        setNewUserData({ ...newUserData, role: val })
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
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
                    className="w-full bg-itc-ciano hover:bg-itc-ciano800 h-9 text-xs"
                  >
                    {isSubmitting ? "Salvando..." : "Confirmar Cadastro"}
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
                <TableHead className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Colaborador
                </TableHead>
                <TableHead className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Permissão
                </TableHead>
                <TableHead className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">
                  Status
                </TableHead>
                <TableHead className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
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
                  <TableCell className="py-4 px-6 space-y-0.5">
                    <p className="font-bold text-foreground">{colab.name}</p>
                    <p className="text-xs font-medium text-muted-foreground font-mono break-all">
                      {colab.email}
                    </p>
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <Select
                      defaultValue={colab.role}
                      onValueChange={(val: "Administrador" | "Colaborador") =>
                        handleRoleChange(colab.uid, val)
                      }
                    >
                      <SelectTrigger className="w-full max-w-35 border-border text-xs h-8 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
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
                      className={`border-none text-[10px] font-bold px-2.5 h-5 ${
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
                      {/* BOTÃO INTERRUPTOR DE STATUS (SUSPENDER / REATIVAR) */}
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleToggleStatus(
                            colab.uid,
                            colab.status || "Ativo",
                            colab.name,
                          )
                        }
                        className={`text-xs font-medium h-8 px-2.5 gap-1 border-border ${
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

                      {/* BOTÃO DE EXCLUSÃO DEFINITIVA (AGORA TRAVADO COMO FIXO) */}
                      <Button
                        variant="destructive"
                        onClick={() =>
                          handleDeletarUsuario(colab.uid, colab.name)
                        }
                        className="bg-itc-erro/10 text-itc-erro hover:bg-itc-erro hover:text-white border-none font-medium text-xs gap-1 h-8 px-2.5 transition-all duration-200"
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
                    className="py-8 text-center text-xs text-muted-foreground font-medium"
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
