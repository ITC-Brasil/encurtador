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
  UserPlus,
  Trash2,
  Play,
  AlertTriangle,
  ArrowUpDown,
  Clock,
  XCircle,
} from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/loading-spinner";
import { BackButton } from "@/components/back-button";
import { StatusBadge } from "@/components/status-badge";
import { InviteMemberForm } from "@/components/invite-member-form";

const PAGE_SIZE = 20;

interface Colaborador {
  uid: string;
  name: string;
  email: string;
  role: "Administrador" | "Colaborador";
  status: "Ativo" | "Suspenso" | "Bloqueado";
  createdAt: string;
}

interface ConvitePendente {
  id: string;
  email: string;
  role: string;
}

type OrderDirection = "asc" | "desc" | null;

export default function GestaoUsuariosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [convitesPendentes, setConvitesPendentes] = useState<ConvitePendente[]>(
    [],
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentAdminEmail, setCurrentAdminEmail] = useState<string | null>(
    null,
  );

  const [sortRole, setSortRole] = useState<OrderDirection>(null);
  const [sortStatus, setSortStatus] = useState<OrderDirection>(null);

  // Estados para Dialog de confirmação de deleção
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pendingDeleteUid, setPendingDeleteUid] = useState<string | null>(null);
  const [pendingDeleteName, setPendingDeleteName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados para Dialog de confirmação de revogação
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [pendingRevokeEmail, setPendingRevokeEmail] = useState<string>("");
  const [isRevoking, setIsRevoking] = useState(false);

  const cardHoverClass =
    "transition-all duration-300 hover:shadow-md hover:border-itc-ciano/30";

  const fetchColaboradores = async (
    firebaseUser?: import("firebase/auth").User | null,
  ) => {
    try {
      const currentUser = firebaseUser ?? auth.currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();

      const res = await fetch("/api/usuarios", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      setColaboradores(data);
      setCurrentPage(1);
    } catch {
      toast.error("Não foi possível carregar os colaboradores.");
    } finally {
      setLoading(false);
    }
  };

  // 🔒 fetchConvites protegido via API Route com Bearer Token
  const fetchConvites = async (
    firebaseUser?: import("firebase/auth").User | null,
  ) => {
    try {
      const currentUser = firebaseUser ?? auth.currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();

      const res = await fetch("/api/invites", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;
      const data = await res.json();
      setConvitesPendentes(data);
    } catch (error) {
      console.error("Erro ao buscar convites pendentes:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentAdminEmail(user.email);
      fetchColaboradores(user);
      fetchConvites(user);
    });
    return () => unsubscribe();
  }, [router]);

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
      [...prev].sort((a, b) =>
        nextDirection === "asc"
          ? a.role.localeCompare(b.role)
          : b.role.localeCompare(a.role),
      ),
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
      const token = await auth.currentUser?.getIdToken();

      const res = await fetch("/api/usuarios", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid, role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao alterar permissão.");
      }

      toast.success("Permissão atualizada com sucesso!");
      fetchColaboradores();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao alterar nível";
      toast.error(msg);
    }
  };

  const handleToggleStatus = async (
    uid: string,
    currentStatus: string,
    name: string,
  ) => {
    const textStatus =
      currentStatus === "Suspenso" || currentStatus === "Bloqueado"
        ? "Ativo"
        : "Suspenso";
    try {
      const token = await auth.currentUser?.getIdToken();

      const res = await fetch("/api/usuarios", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid, status: textStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao alterar status.");
      }

      toast.success(
        textStatus === "Suspenso"
          ? `Acesso de ${name} suspenso.`
          : `Acesso de ${name} reativado.`,
      );
      fetchColaboradores();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao alterar status";
      toast.error(msg);
    }
  };

  // 🔧 Abre o Dialog de confirmação em vez de window.confirm
  const handleDeletarUsuario = (uid: string, name: string) => {
    setPendingDeleteUid(uid);
    setPendingDeleteName(name);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteUid) return;
    setIsDeleting(true);
    try {
      const token = await auth.currentUser?.getIdToken();

      const res = await fetch(`/api/usuarios?uid=${pendingDeleteUid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Falha ao deletar o colaborador.");
      }

      toast.success(`Usuário ${pendingDeleteName} excluído do sistema.`);
      setIsDeleteDialogOpen(false);
      fetchColaboradores();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro na exclusão";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
      setPendingDeleteUid(null);
      setPendingDeleteName("");
    }
  };

  // 🔧 Abre o Dialog de confirmação em vez de window.confirm
  const handleRevogarConvite = (id: string, email: string) => {
    setPendingRevokeId(id);
    setPendingRevokeEmail(email);
    setIsRevokeDialogOpen(true);
  };

  const handleConfirmRevoke = async () => {
    if (!pendingRevokeId) return;
    setIsRevoking(true);
    try {
      const token = await auth.currentUser?.getIdToken();

      const res = await fetch(`/api/invites?id=${pendingRevokeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao revogar convite.");
      }

      toast.success(`Convite de ${pendingRevokeEmail} revogado com sucesso.`);
      setIsRevokeDialogOpen(false);
      fetchConvites();
    } catch (error) {
      console.error("Erro ao revogar convite:", error);
      toast.error("Erro operacional ao tentar revogar o convite.");
    } finally {
      setIsRevoking(false);
      setPendingRevokeId(null);
      setPendingRevokeEmail("");
    }
  };

  // Paginação dos colaboradores
  const totalPages = Math.ceil(colaboradores.length / PAGE_SIZE);
  const paginatedColaboradores = colaboradores.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const getPageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, 4, "ellipsis", totalPages];
    if (currentPage >= totalPages - 2)
      return [
        1,
        "ellipsis",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    return [
      1,
      "ellipsis",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "ellipsis",
      totalPages,
    ];
  };

  if (loading) {
    return <LoadingSpinner label="Carregando painel de segurança..." />;
  }

  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto w-full font-sans transition-colors duration-300 space-y-8">
      <div>
        <div className="mb-6">
          <BackButton />
        </div>

        {/* CARD PRINCIPAL: EQUIPE ATIVA */}
        <Card className={`bg-card border-border shadow-sm ${cardHoverClass}`}>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold text-foreground font-sans">
                Equipe ITC Brasil
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground font-sans">
                Gerencie acessos operacionais ou envie tokens de convite
                exclusivos para novos integrantes.
              </CardDescription>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-itc-ciano hover:bg-itc-ciano800 text-white font-sans text-xs font-medium gap-2 h-9 shadow-sm">
                  <UserPlus className="h-4 w-4" /> Convidar Integrante
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-card border-border font-sans text-foreground">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold font-sans">
                    Convidar Colaborador
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-sans">
                    Gere um link seguro de autorização. O destinatário usará
                    esse token para vincular seu Google Auth.
                  </DialogDescription>
                </DialogHeader>

                <InviteMemberForm
                  onSuccess={() => {
                    fetchColaboradores();
                    fetchConvites();
                  }}
                  onCancel={() => setIsDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent className="p-0 border-t border-border">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow className="border-b border-border hover:bg-transparent">
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
                {paginatedColaboradores.map((colab: Colaborador) => (
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
                        <SelectTrigger className="w-36 border-border text-xs h-8 bg-background font-sans text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border font-sans text-foreground">
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
                      <StatusBadge
                        active={
                          colab.status !== "Suspenso" &&
                          colab.status !== "Bloqueado"
                        }
                        inactiveLabel={colab.status || "Suspenso"}
                      />
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
                              <AlertTriangle className="h-3.5 w-3.5" />{" "}
                              Suspender
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
                      Nenhum colaborador ativo encontrado no banco de dados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-sans">
                    Página {currentPage} de {totalPages} —{" "}
                    {colaboradores.length} colaboradores
                  </p>
                  <Pagination className="w-auto mx-0">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          className={`cursor-pointer font-sans text-xs h-8 ${
                            currentPage === 1
                              ? "pointer-events-none opacity-40"
                              : ""
                          }`}
                        />
                      </PaginationItem>
                      {getPageNumbers().map((page, idx) =>
                        page === "ellipsis" ? (
                          <PaginationItem key={`e-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page as number)}
                              isActive={currentPage === page}
                              className="cursor-pointer font-sans text-xs h-8 w-8"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ),
                      )}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          className={`cursor-pointer font-sans text-xs h-8 ${
                            currentPage === totalPages
                              ? "pointer-events-none opacity-40"
                              : ""
                          }`}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CARD: CONVITES PENDENTES */}
      {convitesPendentes.length > 0 && (
        <Card className={`bg-card border-border shadow-sm ${cardHoverClass}`}>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
            <div className="space-y-1">
              <CardTitle className="text-md font-bold text-foreground font-sans flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" /> Convites Pendentes
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground font-sans">
                E-mails aguardando vinculação de segurança. Você pode revogá-los
                a qualquer momento.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0 border-t border-border">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans">
                    E-mail Convidado
                  </TableHead>
                  <TableHead className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans text-center">
                    Permissão Prévia
                  </TableHead>
                  <TableHead className="h-11 px-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans text-right">
                    Ação
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {convitesPendentes.map((convite) => (
                  <TableRow
                    key={convite.id}
                    className="border-b border-border hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="py-4 px-6">
                      <p className="text-sm font-normal text-muted-foreground/80 font-sans tracking-wide break-all">
                        {convite.email}
                      </p>
                    </TableCell>

                    <TableCell className="py-4 px-6 text-center">
                      <Badge
                        variant="outline"
                        className="text-xs border-border text-muted-foreground font-medium"
                      >
                        {convite.role}
                      </Badge>
                    </TableCell>

                    <TableCell className="py-4 px-6 text-right">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          handleRevogarConvite(convite.id, convite.email)
                        }
                        className="text-itc-erro hover:text-white hover:bg-itc-erro text-xs font-medium h-8 px-2.5 gap-1 transition-all duration-200 font-sans"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Revogar Convite
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* DIALOG: Confirmar Deleção de Usuário */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="border-border bg-card font-sans max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold text-base font-sans">
              <AlertTriangle className="h-5 w-5 text-itc-erro shrink-0" />
              Deletar Colaborador?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              Você está prestes a excluir permanentemente a conta de{" "}
              <span className="font-semibold text-foreground">
                {pendingDeleteName}
              </span>
              . Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-4 mt-2">
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

      {/* DIALOG: Confirmar Revogação de Convite */}
      <Dialog open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen}>
        <DialogContent className="border-border bg-card font-sans max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold text-base font-sans">
              <XCircle className="h-5 w-5 text-itc-erro shrink-0" />
              Revogar Convite?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              O convite enviado para{" "}
              <span className="font-semibold text-foreground">
                {pendingRevokeEmail}
              </span>{" "}
              será revogado e o link enviado perderá a validade imediatamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-4 mt-2">
            <Button
              variant="outline"
              disabled={isRevoking}
              onClick={() => setIsRevokeDialogOpen(false)}
              className="border-border text-foreground text-xs h-8"
            >
              Cancelar
            </Button>
            <Button
              disabled={isRevoking}
              onClick={handleConfirmRevoke}
              className="bg-itc-erro hover:bg-red-700 text-white font-medium text-xs h-8"
            >
              {isRevoking ? "Revogando..." : "Confirmar Revogação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
