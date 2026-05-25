// src/app/dashboard/page.tsx
/* eslint-disable @next/next/no-img-element */
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
  addDoc,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  Link2,
  MousePointerClick,
  CheckCircle,
  Plus,
  LogOut,
  QrCode,
  ArrowUpDown,
  Trash2,
  Users,
  ShieldCheck,
  Calendar,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { ModeToggle } from "@/components/mode-toggle";

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
  // Correção do ESLint: Tipagem correta do Firebase User no lugar do 'any'
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados do Modal de Novo Link (Movidos da página /links/new)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [password, setPassword] = useState("");

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

  const handleLogout = async () => {
    await auth.signOut();
    toast.success("Sessão encerrada com segurança.");
    router.push("/login");
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

  // Funções trazidas do /links/new
  const generateRandomSlug = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!originalUrl) {
      toast.error("A URL de destino é obrigatória.");
      return;
    }

    if (
      !originalUrl.startsWith("http://") &&
      !originalUrl.startsWith("https://")
    ) {
      toast.error("A URL deve começar com http:// ou https://");
      return;
    }

    setSubmitting(true);

    let finalSlug = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    if (!finalSlug) {
      finalSlug = generateRandomSlug();
    }

    if (finalSlug.length < 3) {
      toast.error("O slug customizado deve conter pelo menos 3 caracteres.");
      setSubmitting(false);
      return;
    }

    try {
      const linksRef = collection(db, "links");
      const q = query(linksRef, where("slug", "==", finalSlug));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        toast.error("Este link curto (slug) já está em uso na base da ITC.");
        setSubmitting(false);
        return;
      }

      // Correção do ESLint: Removido ': any'
      const linkPayload = {
        title: title.trim() || "Link Sem Título",
        originalUrl: originalUrl.trim(),
        slug: finalSlug,
        clickCount: 0,
        isActive: true,
        createdBy: user!.uid,
        createdAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxClicks: maxClicks ? parseInt(maxClicks, 10) : null,
        passwordHash: password ? password : null,
      };

      await addDoc(collection(db, "links"), linkPayload);

      toast.success(`Sucesso! itcbr.xyz/${finalSlug} foi criado.`);

      // Limpa formulário e fecha o modal
      setTitle("");
      setOriginalUrl("");
      setSlug("");
      setExpiresAt("");
      setMaxClicks("");
      setPassword("");
      setIsDialogOpen(false);

      // Atualiza a tabela
      fetchDashboardData(user!.uid);
    } catch (error) {
      console.error("Erro ao criar link:", error);
      toast.error("Falha ao salvar o encurtador no banco.");
    } finally {
      setSubmitting(false);
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
      {/* Topbar / Header Institucional */}
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex h-10 w-auto items-center border-r border-border pr-6">
            <img
              src="/images/logo-light.png"
              alt="ITC Brasil"
              className="h-full w-auto object-contain dark:hidden"
            />
            <img
              src="/images/logo-dark.png"
              alt="ITC Brasil"
              className="h-full w-auto object-contain hidden dark:block"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <ModeToggle />

          {/* DIALOG INCORPORANDO O CÓDIGO DA PÁGINA NEW */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-itc-ciano hover:bg-itc-ciano800 text-white font-medium gap-2 shadow-sm font-sans">
                <Plus className="h-4 w-4" /> Novo Link
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl bg-card border-border font-sans max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreateLink}>
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-foreground font-display flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-itc-ciano" /> Criar Novo Link
                    Curto
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground font-sans">
                    Encurte URLs para materiais, carretas ou campanhas do Grupo
                    ITC Brasil.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Título / Identificação Interna
                    </label>
                    <Input
                      type="text"
                      placeholder="Ex: Formulário de Inscrição — Carreta 04 (Qualifica DF)"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="font-sans border-input bg-transparent text-foreground focus-visible:ring-itc-ciano"
                    />
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
                    <p className="text-xs text-muted-foreground font-sans">
                      Apenas letras, números, hífens e sublinhados. Deixe em
                      branco para gerar código aleatório.
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
                        <Calendar className="h-3 w-3 text-muted-foreground" />{" "}
                        Expira em (Data/Hora)
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
                        <Link2 className="h-3 w-3 text-muted-foreground" />{" "}
                        Limite Máximo de Cliques
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
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />{" "}
                      Proteger por Senha de Acesso
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
                    onClick={() => setIsDialogOpen(false)}
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
                    {submitting
                      ? "Gravando no Firestore..."
                      : "Gerar Link Curto"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full border border-border hover:bg-accent focus-visible:ring-itc-ciano"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={user?.photoURL || undefined}
                    alt={user?.displayName || "Usuário"}
                  />
                  <AvatarFallback className="bg-itc-ciano/10 text-itc-ciano font-bold font-sans">
                    {user?.displayName?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 border-border"
              align="end"
              forceMount
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-foreground font-sans">
                    Olá, {user?.displayName}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground font-sans">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />

              <DropdownMenuItem
                onClick={() => router.push("/dashboard/users")}
                className="cursor-pointer flex items-center gap-2 font-sans font-medium"
              >
                <Users className="h-4 w-4" /> Gestão de Equipe
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleLogout}
                className="text-itc-erro focus:text-itc-erro focus:bg-itc-erro/10 cursor-pointer flex items-center gap-2 font-sans font-medium"
              >
                <LogOut className="h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
            <CheckCircle className="h-4 w-4 text-itc-sucesso" />
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
