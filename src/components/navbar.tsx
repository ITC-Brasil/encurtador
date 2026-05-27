// src/components/navbar.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link"; // 🟢 Importado Link do Next.js para a logo
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { Link2, Plus, LogOut, Users, ShieldCheck } from "lucide-react"; // 🟢 ShieldCheck adicionado
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { NewLinkForm } from "@/components/new-link-form";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Define o título da página baseado na rota
  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname === "/dashboard/audit") return "Auditoria do Sistema"; // 🟢 Título para a Auditoria
    if (pathname.includes("/links/")) return "Detalhes do Link";
    if (pathname === "/dashboard/users") return "Gestão de Usuários";
    return "Painel";
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);

    // 🔐 DESTRUIÇÃO DO COOKIE DE PRESENÇA
    // Força a expiração do cookie para o passado (1970) para bloquear o Middleware
    document.cookie =
      "itc-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict; Secure";

    toast.success("Sessão encerrada.");
    router.push("/login");
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
        {/* ESQUERDA: Logo e Título */}
        <div className="flex items-center">
          {/* 🟢 Logo transformada em Link clicável */}
          <Link
            href="/dashboard"
            className="flex items-center border-r border-border/40 pr-5 mr-5 h-8 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <Image
              src="/images/logo-light.png"
              alt="ITC Brasil"
              width={140}
              height={36}
              priority
              className="dark:hidden w-auto h-8 object-contain"
            />
            <Image
              src="/images/logo-dark.png"
              alt="ITC Brasil"
              width={140}
              height={36}
              priority
              className="hidden dark:block w-auto h-8 object-contain"
            />
          </Link>
          <h2 className="text-xl font-bold tracking-tight font-display text-foreground">
            {getPageTitle()}
          </h2>
        </div>

        {/* DIREITA: Ações e User */}
        <div className="flex items-center gap-4">
          <ModeToggle />

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-itc-ciano hover:bg-itc-ciano800 text-white font-sans font-medium gap-2 px-5 shadow-sm">
                <Plus className="h-4 w-4" /> Novo Link
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl bg-card border-border font-sans max-h-[90vh] overflow-y-auto">
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

              <NewLinkForm
                user={user}
                onSuccess={() => {
                  setIsDialogOpen(false);
                }}
                onCancel={() => setIsDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-11 w-11 rounded-full border border-border overflow-hidden"
              >
                <Avatar className="h-11 w-11">
                  <AvatarImage
                    src={user?.photoURL || ""}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-itc-ciano/10 text-itc-ciano font-bold font-sans">
                    {user?.displayName?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-64 border-border font-sans mt-2"
              align="end"
            >
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold leading-none text-foreground">
                    Olá, {user?.displayName || "Usuário"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground mt-1">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />

              {/* 🟢 Novo botão de Auditoria agrupado com os itens de gestão */}
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/audit")}
                className="cursor-pointer gap-2 font-medium py-2.5"
              >
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />{" "}
                Auditoria do Sistema
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => router.push("/dashboard/users")}
                className="cursor-pointer gap-2 font-medium py-2.5"
              >
                <Users className="h-4 w-4 text-muted-foreground" /> Gestão de
                Usuários
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleLogout}
                className="text-itc-erro focus:text-itc-erro focus:bg-itc-erro/10 cursor-pointer gap-2 font-medium py-2.5 border-t border-border mt-1"
              >
                <LogOut className="h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
