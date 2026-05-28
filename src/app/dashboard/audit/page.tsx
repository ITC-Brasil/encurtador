// src/app/dashboard/audit/page.tsx

"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDoc,
  doc,
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  FileText,
  Eye,
  Calendar,
  User,
  Link2,
  Activity,
  Info,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/loading-spinner";
import { BackButton } from "@/components/back-button";
import { TablePagination } from "@/components/table-pagination";

// TanStack Table
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

interface AuditLogData {
  id: string;
  action: "LINK_CREATE" | "LINK_UPDATE" | "LINK_EDIT" | "LINK_DELETE" | string;
  performedBy: {
    uid: string;
    name: string;
    email: string;
  };
  targetId: string;
  details: string;
  timestamp: Date;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  } | null;
}

export default function AuditPage() {
  "use no memo";

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLogData[]>([]);

  // Estados para o controle do Dialog de Detalhes
  const [selectedLog, setSelectedLog] = useState<AuditLogData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }

      // 🔒 Verifica se o usuário autenticado é Administrador
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.data()?.role !== "Administrador") {
        toast.error("Acesso restrito a administradores.");
        router.push("/dashboard");
        return;
      }

      const logsRef = collection(db, "audit_logs");
      const q = query(logsRef, orderBy("timestamp", "desc"), limit(100));

      unsubscribeSnapshot = onSnapshot(
        q,
        (querySnapshot) => {
          const logsArray: AuditLogData[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const rawTimestamp = data.timestamp;
            const parsedDate = rawTimestamp?.toDate
              ? rawTimestamp.toDate()
              : new Date(rawTimestamp || Date.now());

            logsArray.push({
              id: doc.id,
              action: data.action,
              performedBy: data.performedBy,
              targetId: data.targetId,
              details: data.details,
              timestamp: parsedDate,
              changes: data.changes || null,
            });
          });
          setLogs(logsArray);
          setLoading(false);
        },
        (error) => {
          console.error("Erro ao escutar logs de auditoria:", error);
          toast.error("Falha ao sincronizar logs de segurança.");
          setLoading(false);
        },
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [router]);

  const handleOpenDetails = (log: AuditLogData) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const columns: ColumnDef<AuditLogData>[] = [
    {
      accessorKey: "timestamp",
      header: "Data",
      cell: ({ row }) => {
        const date = row.getValue("timestamp") as Date;
        return (
          <div className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
            {date instanceof Date
              ? date.toLocaleDateString("pt-BR")
              : "Data inválida"}
          </div>
        );
      },
    },
    {
      accessorKey: "action",
      header: "Operação",
      cell: ({ row }) => {
        const action = row.getValue("action") as string;
        let badgeStyle = "bg-muted text-muted-foreground";
        let label = action;

        if (action === "LINK_CREATE") {
          badgeStyle =
            "bg-emerald-500/10 text-itc-sucesso ring-1 ring-emerald-500/20";
          label = "Criação";
        } else if (action === "LINK_UPDATE" || action === "LINK_EDIT") {
          badgeStyle =
            "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20";
          label = "Edição";
        } else if (action === "LINK_DELETE") {
          badgeStyle = "bg-red-500/10 text-itc-erro ring-1 ring-red-500/20";
          label = "Exclusão";
        }

        return (
          <Badge
            className={`border-none text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${badgeStyle}`}
          >
            {label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "performedBy.name",
      header: "Usuário",
      cell: ({ row }) => {
        const log = row.original;
        return (
          <div className="font-sans font-medium text-foreground text-xs truncate max-w-45">
            {log.performedBy?.name || "Sistema"}
          </div>
        );
      },
    },
    {
      accessorKey: "targetId",
      header: "Slug",
      cell: ({ row }) => {
        return (
          <code className="font-mono text-[12px] text-itc-ciano bg-accent/30 px-2 py-0.5 rounded border border-border/40 whitespace-nowrap truncate max-w-32 inline-block">
            /{row.getValue("targetId")}
          </code>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Detalhes</div>,
      cell: ({ row }) => {
        const log = row.original;
        return (
          <div className="text-right">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenDetails(log)}
              className="h-8 text-xs font-sans border-border hover:bg-accent text-foreground gap-1.5 inline-flex items-center whitespace-nowrap"
            >
              <Eye className="h-3.5 w-3.5 text-itc-ciano" />
              Mais Info
            </Button>
          </div>
        );
      },
    },
  ];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: logs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  if (loading) {
    return <LoadingSpinner label="Carregando trilhas de auditoria..." />;
  }

  return (
    <div className="flex-1 p-8 max-w-5xl mx-auto w-full font-sans transition-colors duration-300 space-y-6">
      <div className="mb-4">
        <BackButton />
      </div>

      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-itc-ciano" /> Trilha de
            Auditoria Imutável
          </h1>
          <p className="text-xs text-muted-foreground">
            Histórico simplificado de segurança e operações na infraestrutura
            corporativa de links.
          </p>
        </div>
      </div>

      {/* Tabela Clean */}
      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardHeader className="pb-3 pt-4 border-b border-border/40">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Registros Operacionais do
            Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground italic">
              Nenhuma ação registrada na trilha de auditoria ainda.
            </div>
          ) : (
            <div className="w-full">
              <Table className="w-full table-fixed">
                <TableHeader className="bg-accent/10">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow
                      key={headerGroup.id}
                      className="border-border hover:bg-transparent"
                    >
                      {headerGroup.headers.map((header, idx) => {
                        const widths = [
                          "w-[14%]",
                          "w-[12%]",
                          "w-[30%]",
                          "w-[24%]",
                          "w-[20%]",
                        ];
                        return (
                          <TableHead
                            key={header.id}
                            className={`text-muted-foreground font-bold text-xs h-10 px-6 ${widths[idx] || ""}`}
                          >
                            {flexRender(
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
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-border/40 hover:bg-accent/10 transition-colors h-12"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="px-6 py-2 align-middle overflow-hidden"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginação */}
              <div className="px-6 py-3 bg-card border-t border-border/40">
                <TablePagination table={table} showPageCount />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG MODAL: Detalhes Profundos e Imutáveis do Log */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-card border-border max-w-lg w-full text-foreground p-6 font-sans">
          <DialogHeader className="border-b border-border/40 pb-3">
            <DialogTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Info className="h-4 w-4 text-itc-ciano" /> Metadados Completos do
              Log
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Registro operacional e histórico gerado na infraestrutura do
              Firebase.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="py-4 space-y-4 text-xs">
              {/* Seção 1: Cronologia e Operador */}
              <div className="grid grid-cols-2 gap-4 bg-accent/20 p-3 rounded-lg border border-border/40">
                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium flex items-center gap-1 text-[11px]">
                    <Calendar className="h-3 w-3" /> Data & Hora Estrita
                  </span>
                  <span className="font-mono text-foreground font-semibold">
                    {selectedLog.timestamp.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium flex items-center gap-1 text-[11px]">
                    <User className="h-3 w-3" /> Operador Autenticado
                  </span>
                  <span
                    className="text-foreground font-semibold truncate block"
                    title={selectedLog.performedBy?.email}
                  >
                    {selectedLog.performedBy?.name}
                  </span>
                </div>
              </div>

              {/* Seção 2: Identificadores do Link */}
              <div className="space-y-3 bg-accent/10 p-3 rounded-lg border border-border/30">
                <div className="flex items-center justify-between border-b border-border/20 pb-2">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Tipo de Ação
                  </span>
                  <Badge className="border-none text-[9px] font-bold px-2 py-0.5 rounded bg-itc-ciano/10 text-itc-ciano">
                    {selectedLog.action}
                  </Badge>
                </div>

                <div className="flex items-center justify-between border-b border-border/20 pb-2">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> Slug Alvo no Servidor
                  </span>
                  <code className="font-mono text-[11px] text-itc-ciano bg-background px-2 py-0.5 rounded border border-border/40">
                    /{selectedLog.targetId}
                  </code>
                </div>

                <div className="space-y-1 pt-1">
                  <span className="text-muted-foreground block font-medium">
                    Histórico Resumido
                  </span>
                  <p className="text-foreground leading-relaxed font-normal bg-background/50 p-2 rounded border border-border/20 wrap-break-words">
                    {selectedLog.details}
                  </p>
                </div>
              </div>

              {/* Seção 3: Histórico de Alterações de Escopo */}
              {(selectedLog.action === "LINK_UPDATE" ||
                selectedLog.action === "LINK_EDIT") &&
                selectedLog.changes && (
                  <div className="space-y-2">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1">
                      <Edit className="h-3 w-3 text-amber-500" /> Modificações
                      de Estado Detectadas
                    </span>
                    <div className="grid grid-cols-1 gap-2 font-mono text-[11px] overflow-hidden">
                      <div className="bg-red-500/5 border border-red-500/20 rounded p-2 space-y-1">
                        <span className="text-itc-erro font-bold block text-[10px] uppercase border-b border-red-500/10 pb-0.5">
                          Antes
                        </span>
                        {/* 🔧 break-words whitespace-pre-wrap substituem wrap-break-word (classe inválida) */}
                        <pre className="wrap-break-words whitespace-pre-wrap text-muted-foreground max-h-30 overflow-y-auto">
                          {JSON.stringify(selectedLog.changes.before, null, 2)}
                        </pre>
                      </div>
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded p-2 space-y-1">
                        <span className="text-itc-sucesso font-bold block text-[10px] uppercase border-b border-emerald-500/10 pb-0.5">
                          Depois
                        </span>
                        <pre className="wrap-break-words whitespace-pre-wrap text-foreground max-h-30 overflow-y-auto">
                          {JSON.stringify(selectedLog.changes.after, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}

          <DialogFooter className="border-t border-border/40 pt-3">
            <Button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="bg-accent hover:bg-accent/80 text-foreground text-xs font-sans px-4 h-9"
            >
              Fechar Painel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
