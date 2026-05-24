// src/app/dashboard/users/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  where,
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
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  ShieldCheck,
  UserX,
  UserCheck,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { ModeToggle } from "@/components/mode-toggle";

// TanStack Table Imports
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

interface UserData {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
}

export default function UsersManagementPage() {
  const router = useRouter();
  const [currentUserData, setCurrentUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [usersList, setUsersList] = useState<UserData[]>([]);

  const [sorting, setSorting] = useState<SortingState>([]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    displayName: "",
    role: "collaborator",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", user.email));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const uData = {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data(),
          } as UserData;
          if (uData.role !== "admin") {
            toast.error(
              "Acesso negado. Apenas administradores podem gerenciar usuários.",
            );
            router.push("/dashboard");
            return;
          }
          setCurrentUserData(uData);
          fetchUsers();
        } else {
          router.push("/login");
        }
      } catch (error) {
        console.error("Erro ao validar admin:", error);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersArray: UserData[] = [];
      querySnapshot.forEach((doc) => {
        usersArray.push({ id: doc.id, ...doc.data() } as UserData);
      });
      setUsersList(usersArray);
    } catch (error) {
      toast.error("Erro ao carregar lista de usuários.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.displayName)
      return toast.error("Preencha todos os campos.");

    setIsSubmitting(true);
    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", newUser.email),
      );
      const exist = await getDocs(q);
      if (!exist.empty) {
        toast.error("Este e-mail já está cadastrado.");
        setIsSubmitting(false);
        return;
      }

      await addDoc(collection(db, "users"), {
        email: newUser.email,
        displayName: newUser.displayName,
        role: newUser.role,
        isActive: true,
        createdAt: new Date(),
      });

      toast.success("Usuário convidado com sucesso!");
      setIsAddOpen(false);
      setNewUser({ email: "", displayName: "", role: "collaborator" });
      fetchUsers();
    } catch (error) {
      toast.error("Erro ao adicionar usuário.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "users", userId), { isActive: !currentStatus });
      toast.success(`Acesso ${!currentStatus ? "liberado" : "revogado"}.`);
      fetchUsers();
    } catch (error) {
      toast.error("Erro ao alterar status.");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      toast.success("Nível de permissão atualizado.");
      fetchUsers();
    } catch (error) {
      toast.error("Erro ao alterar permissão.");
    }
  };

  // Definição das Colunas do Data Table
  const columns: ColumnDef<UserData>[] = [
    {
      accessorKey: "displayName",
      header: "Colaborador",
      cell: ({ row }) => (
        <div className="flex flex-col font-sans">
          <span className="font-medium text-foreground">
            {row.original.displayName}
          </span>
          <span className="text-sm text-muted-foreground">
            {row.original.email}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-accent hover:text-foreground font-semibold px-0 font-sans flex items-center gap-1"
        >
          Permissão
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const u = row.original;
        return (
          <Select
            value={u.role}
            onValueChange={(val) => handleRoleChange(u.id, val)}
            disabled={currentUserData?.id === u.id}
          >
            <SelectTrigger className="w-35 h-8 text-xs font-sans">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="font-sans">
              <SelectItem value="collaborator">Colaborador</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-accent hover:text-foreground font-semibold px-0 font-sans flex items-center gap-1"
        >
          Status
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const isActive = row.original.isActive;
        return (
          <Badge
            variant={isActive ? "default" : "destructive"}
            className={
              isActive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-none shadow-none"
                : "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border-none shadow-none"
            }
          >
            {isActive ? "Ativo" : "Bloqueado"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => (
        <div className="text-right font-semibold font-sans text-muted-foreground">
          Ações
        </div>
      ),
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="text-right">
            <Button
              size="sm"
              className={`font-sans gap-2 text-white shadow-sm transition-colors ${
                u.isActive
                  ? "bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              }`}
              onClick={() => handleToggleStatus(u.id, u.isActive)}
              disabled={currentUserData?.id === u.id}
            >
              {u.isActive ? (
                <>
                  <UserX className="h-4 w-4" /> Revogar
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" /> Reativar
                </>
              )}
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: usersList,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center font-sans text-muted-foreground">
        Validando credenciais de administrador...
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto w-full font-sans transition-colors duration-300 space-y-6">
      {/* Topbar */}
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="text-muted-foreground pl-0 hover:bg-transparent font-sans"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-itc-ciano" /> Gestão de Acessos
          </h1>
        </div>
        <ModeToggle />
      </div>

      <Card className="bg-card border-border shadow-sm text-card-foreground">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-foreground font-sans">
              Equipe ITC Brasil
            </CardTitle>
            <CardDescription className="text-muted-foreground font-sans">
              Gerencie quem pode acessar o sistema e criar encurtadores.
            </CardDescription>
          </div>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-itc-ciano hover:bg-itc-ciano800 text-white font-medium gap-2 shadow-sm font-sans">
                <Plus className="h-4 w-4" /> Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-106.25 font-sans border-border bg-card">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  Convidar Colaborador
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Adicione o e-mail Google da pessoa. Ela poderá logar
                  instantaneamente após a inclusão.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddUser} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Nome de Exibição
                  </label>
                  <Input
                    required
                    placeholder="Ex: João Silva"
                    value={newUser.displayName}
                    onChange={(e) =>
                      setNewUser({ ...newUser, displayName: e.target.value })
                    }
                    className="border-input"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    E-mail corporativo (Google)
                  </label>
                  <Input
                    type="email"
                    required
                    placeholder="joao@itcbrasil.com.br"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    className="border-input"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Nível de Acesso
                  </label>
                  <Select
                    value={newUser.role}
                    onValueChange={(val) =>
                      setNewUser({ ...newUser, role: val })
                    }
                  >
                    <SelectTrigger className="border-input">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="collaborator">
                        Colaborador (Pode criar links)
                      </SelectItem>
                      <SelectItem value="admin">
                        Administrador (Acesso total)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter className="pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddOpen(false)}
                    className="border-border"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-itc-ciano text-white hover:bg-itc-ciano800 shadow-sm"
                  >
                    {isSubmitting ? "Salvando..." : "Adicionar Acesso"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader className="bg-accent/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="border-border hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead
                          key={header.id}
                          className="text-muted-foreground font-semibold font-sans"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-border hover:bg-accent/50 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Nenhum colaborador encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
