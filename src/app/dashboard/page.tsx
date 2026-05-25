// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Link2,
  MousePointerClick,
  CheckCircle,
  QrCode,
  ArrowUpDown,
  Trash2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

// TanStack Table Imports
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

interface LinkData {
  id: string;
  slug: string;
  originalUrl: string;
  title: string;
  clickCount: number;
  isActive: boolean;
  createdAt: string | Date;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalLinks: 0,
    totalClicks: 0,
    activeLinks: 0,
  });
  const [links, setLinks] = useState<LinkData[]>([]);

  // Estados do Data Table
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        fetchDashboardData(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchDashboardData = async (userId: string) => {
    try {
      const linksRef = collection(db, "links");
      const q = query(
        linksRef,
        where("createdBy", "==", userId),
        orderBy("createdAt", "desc"),
      );
      const querySnapshot = await getDocs(q);

      let clicks = 0;
      let active = 0;
      const linksArray: LinkData[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        clicks += data.clickCount || 0;
        if (data.isActive) active++;

        linksArray.push({
          id: doc.id,
          slug: data.slug,
          originalUrl: data.originalUrl,
          title: data.title || "Sem título",
          clickCount: data.clickCount || 0,
          isActive: data.isActive,
          createdAt: data.createdAt,
        });
      });

      setStats({
        totalLinks: querySnapshot.size,
        totalClicks: clicks,
        activeLinks: active,
      });
      setLinks(linksArray);
    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
      toast.error("Erro ao sincronizar métricas com o Firestore.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    const selectedIds = table
      .getFilteredSelectedRowModel()
      .rows.map((row) => row.original.id);
    if (selectedIds.length === 0) return;

    if (
      !confirm(
        `Tem certeza que deseja excluir ${selectedIds.length} link(s)? Essa ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await Promise.all(
        selectedIds.map((id) => deleteDoc(doc(db, "links", id))),
      );
      toast.success(`${selectedIds.length} link(s) excluído(s) com sucesso.`);
      setRowSelection({});
      fetchDashboardData(user!.uid);
    } catch (error) {
      console.error("Erro ao deletar links:", error);
      toast.error("Falha ao excluir os links selecionados.");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<LinkData>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Selecionar todos"
          className="translate-y-0.5 border-border data-[state=checked]:bg-itc-ciano data-[state=checked]:border-itc-ciano"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Selecionar linha"
          className="translate-y-0.5 border-border data-[state=checked]:bg-itc-ciano data-[state=checked]:border-itc-ciano"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "title",
      header: "Identificação",
      cell: ({ row }) => (
        <div className="font-medium text-foreground font-sans">
          {row.getValue("title")}
        </div>
      ),
    },
    {
      accessorKey: "slug",
      header: "Link Curto",
      cell: ({ row }) => {
        const slug = row.getValue("slug") as string;
        const shortLink = `itcbr.xyz/${slug}`;

        return (
          <div className="flex items-center gap-2">
            <a
              href={`/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans font-medium text-itc-ciano text-sm hover:underline"
            >
              {shortLink}
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(shortLink);
                toast.success("Link copiado com sucesso!");
              }}
              className="h-6 w-6 rounded-md text-muted-foreground hover:text-itc-ciano hover:bg-itc-ciano/10 transition-colors"
              title="Copiar link"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        );
      },
    },
    {
      accessorKey: "clickCount",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-accent hover:text-foreground font-semibold px-0 font-sans flex items-center gap-1"
          >
            Cliques
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="font-sans font-semibold text-foreground">
          {row.getValue("clickCount")}
        </div>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.getValue("isActive");
        return isActive ? (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-itc-sucesso ring-1 ring-emerald-500/20 font-sans">
            Ativo
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-itc-erro ring-1 ring-red-500/20 font-sans">
            Expirado
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Ações</div>,
      cell: ({ row }) => {
        const link = row.original;
        return (
          <div className="text-right">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/dashboard/links/${link.id}`)}
              className="text-muted-foreground hover:text-itc-ciano hover:bg-itc-ciano/10 font-sans"
            >
              <QrCode className="h-4 w-4 mr-1" /> Detalhes
            </Button>
          </div>
        );
      },
    },
  ];

  // Correção do ESLint: Ignorando o aviso incompatível do React Compiler com o TanStack Table
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: links,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
    },
  });

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center font-sans text-muted-foreground bg-background">
        Carregando painel ITC...
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-8 p-8 max-w-7xl mx-auto w-full font-sans transition-colors duration-300">
      {/* Grid de Cards de Métricas com Efeito de Hover e Movimento */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border shadow-sm text-card-foreground transition-all duration-300 hover:shadow-md hover:border-itc-ciano/40 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground font-sans">
              Total de Links
            </CardTitle>
            <Link2 className="h-4 w-4 text-itc-ciano" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-sans text-foreground">
              {stats.totalLinks}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-sans">
              Links encurtados sob itcbr.xyz
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm text-card-foreground transition-all duration-300 hover:shadow-md hover:border-itc-ciano/40 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground font-sans">
              Cliques Acumulados
            </CardTitle>
            <MousePointerClick className="h-4 w-4 text-itc-ciano" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-sans text-foreground">
              {stats.totalClicks}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-sans">
              Rastreamento total de acessos
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm text-card-foreground transition-all duration-300 hover:shadow-md hover:border-itc-ciano/40 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground font-sans">
              Links Ativos
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-itc-ciano" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-sans text-foreground">
              {stats.activeLinks}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-sans">
              Redirecionando em tempo real
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table de Links */}
      <Card className="bg-card border-border shadow-sm text-card-foreground">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-foreground font-sans">
              Links Gerenciados
            </CardTitle>
            <CardDescription className="text-muted-foreground font-sans">
              Seus encurtadores criados.
            </CardDescription>
          </div>

          {Object.keys(rowSelection).length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="font-sans gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting
                ? "Excluindo..."
                : `Excluir ${Object.keys(rowSelection).length} selecionado(s)`}
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {links.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground font-sans">
              Nenhum link criado ainda. Clique em &quot;Novo Link&quot; para
              começar!
            </div>
          ) : (
            <div className="space-y-4">
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
                          data-state={row.getIsSelected() && "selected"}
                          className="border-border hover:bg-accent/50 data-[state=selected]:bg-accent/80 transition-colors"
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
                          className="h-24 text-center"
                        >
                          Nenhum resultado encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Controles de Paginação */}
              <div className="flex items-center justify-between px-2">
                <div className="text-sm text-muted-foreground font-sans">
                  {table.getFilteredSelectedRowModel().rows.length} de{" "}
                  {table.getFilteredRowModel().rows.length} linha(s)
                  selecionada(s).
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="font-sans border-border"
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="font-sans border-border"
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
