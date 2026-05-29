// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ShieldCheck } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Link2,
  MousePointerClick,
  CheckCircle,
  QrCode,
  ArrowUpDown,
  Trash2,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { getCategoryBadgeStyle } from "@/lib/utils";
import { LoadingSpinner } from "@/components/loading-spinner";
import { StatusBadge } from "@/components/status-badge";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

const PAGE_SIZE = 10;

interface LinkData {
  id: string;
  slug: string;
  originalUrl: string;
  title: string;
  clickCount: number;
  isActive: boolean;
  createdAt: string | Date;
  createdByName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
}

export default function DashboardPage() {
  "use no memo";
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({
    totalLinks: 0,
    totalClicks: 0,
    activeLinks: 0,
  });
  const [links, setLinks] = useState<LinkData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // TanStack — apenas sorting e seleção
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const userRole = userDoc.data()?.role;
        const userIsAdmin = userRole === "Administrador";
        setIsAdmin(userIsAdmin);

        const linksRef = collection(db, "links");
        const q = userIsAdmin
          ? query(
              linksRef,
              where("isDeleted", "==", false),
              orderBy("createdAt", "desc"),
            )
          : query(
              linksRef,
              where("createdBy", "==", currentUser.uid),
              where("isDeleted", "==", false),
              orderBy("createdAt", "desc"),
            );

        unsubscribeSnapshot = onSnapshot(
          q,
          (querySnapshot) => {
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
                categoryId: data.categoryId || null,
                categoryName: data.categoryName || null,
                categoryColor: data.categoryColor || null,
                createdByName: data.createdByName || null,
              });
            });

            setStats({
              totalLinks: linksArray.length,
              totalClicks: clicks,
              activeLinks: active,
            });
            setLinks(linksArray);
            setCurrentPage(1);
            setLoading(false);
          },
          (error) => {
            console.error("Erro ao escutar dados do dashboard:", error);
            toast.error("Erro ao sincronizar métricas em tempo real.");
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

  const handleOpenDeleteDialog = () => setIsConfirmDialogOpen(true);

  const handleConfirmDeleteSelected = async () => {
    const selectedIds = table
      .getFilteredSelectedRowModel()
      .rows.map((row) => row.original.id);
    if (selectedIds.length === 0) return;

    setIsDeleting(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          updateDoc(doc(db, "links", id), {
            isActive: false,
            isDeleted: true,
            deletedAt: serverTimestamp(),
          }),
        ),
      );
      toast.success(`${selectedIds.length} link(s) removido(s) do painel.`);
      setRowSelection({});
      setIsConfirmDialogOpen(false);
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
      header: "Identificação & Destino",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-col gap-1 py-0.5 max-w-70 md:max-w-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground font-sans text-sm truncate block">
                {item.title}
              </span>
              {item.categoryName && item.categoryColor && (
                <span
                  style={getCategoryBadgeStyle(item.categoryColor)}
                  className="inline-flex items-center text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded border select-none font-sans uppercase"
                >
                  {item.categoryName}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground truncate block max-w-full font-sans">
              {item.originalUrl}
            </span>
            {isAdmin && item.createdByName && (
              <span className="text-[10px] text-muted-foreground/60 font-sans flex items-center gap-1 mt-0.5">
                <ShieldCheck className="h-2.5 w-2.5 shrink-0" />
                {item.createdByName}
              </span>
            )}
          </div>
        );
      },
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
              href={`https://${shortLink}`}
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
                navigator.clipboard.writeText(`https://${shortLink}`);
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
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-accent hover:text-foreground font-semibold px-0 font-sans flex items-center gap-1"
        >
          Cliques
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
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
        const isActive = row.getValue("isActive") as boolean;
        return <StatusBadge active={isActive} inactiveLabel="Expirado" />;
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

  // TanStack gerencia apenas sorting e seleção — paginação é externa
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: links,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { sorting, rowSelection },
  });

  // Paginação manual sobre os dados já ordenados pelo TanStack
  const sortedRows = table.getRowModel().rows;
  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE);
  const paginatedRows = sortedRows.slice(
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
    return <LoadingSpinner label="Carregando painel ITC..." />;
  }

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="flex-1 space-y-8 p-8 max-w-7xl mx-auto w-full font-sans transition-colors duration-300">
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
              {isAdmin
                ? "Todos os links da equipe ITC Brasil."
                : "Links encurtados sob itcbr.xyz"}
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

      <Card className="bg-card border-border shadow-sm text-card-foreground">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-foreground font-sans">
              Links Gerenciados
            </CardTitle>
            <CardDescription className="text-muted-foreground font-sans">
              {isAdmin
                ? "Todos os links da equipe ITC Brasil."
                : "Seus encurtadores criados."}
            </CardDescription>
          </div>
          {selectedCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleOpenDeleteDialog}
              disabled={isDeleting}
              className="font-sans gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting
                ? "Excluindo..."
                : `Excluir ${selectedCount} selecionado(s)`}
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
                        {headerGroup.headers.map((header) => (
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
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.length ? (
                      paginatedRows.map((row) => (
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

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-muted-foreground font-sans">
                    {selectedCount > 0
                      ? `${selectedCount} selecionado(s) · `
                      : ""}
                    Página {currentPage} de {totalPages} — {links.length} links
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
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="border-border bg-card font-sans max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold text-base font-sans">
              <AlertTriangle className="h-5 w-5 text-itc-erro shrink-0" />
              Excluir Links Selecionados?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              Você está prestes a excluir{" "}
              <span className="font-semibold text-foreground">
                {selectedCount} link(s)
              </span>
              . Eles serão desativados e removidos do painel principal, mas o
              histórico de acessos continuará armazenado no banco para
              auditorias.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-4 mt-2">
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={() => setIsConfirmDialogOpen(false)}
              className="border-border text-foreground text-xs h-8"
            >
              Cancelar
            </Button>
            <Button
              disabled={isDeleting}
              onClick={handleConfirmDeleteSelected}
              className="bg-itc-erro hover:bg-red-600 text-white font-medium text-xs h-8"
            >
              {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
