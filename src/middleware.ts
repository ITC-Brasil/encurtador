// src/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// O nome da função OBRIGATORIAMENTE precisa ser "middleware"
export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  // Ignora rotas de sistema, painel e arquivos estáticos
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/expired") ||
    pathname.startsWith("/protected") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Captura o slug removendo a primeira barra (ex: /qualifica-df -> qualifica-df)
  const slug = pathname.substring(1);

  if (slug.length >= 3) {
    try {
      // Consulta a nossa API interna
      const res = await fetch(`${origin}/api/validate/${slug}`, {
        // Usa cache 'no-store' para garantir que sempre cheque o status real do banco
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();

        // Roteamento baseado no status retornado (PRD Fluxo de Redirecionamento 5.3)
        if (data.status === "valid") {
          return NextResponse.redirect(new URL(data.originalUrl));
        }

        if (data.status === "expired" || data.status === "not_found") {
          return NextResponse.redirect(new URL("/expired", request.url));
        }

        if (data.status === "protected") {
          return NextResponse.redirect(
            new URL(`/protected/${slug}`, request.url),
          );
        }
      }
    } catch (error) {
      console.error("Erro no Proxy:", error);
      // Em caso de falha de rede/API, cai para a página expirada por segurança
      return NextResponse.redirect(new URL("/expired", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
