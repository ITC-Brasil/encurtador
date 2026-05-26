// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  // 1. Verificação do Cookie de Presença
  const authCookie = request.cookies.get("itc-auth")?.value;
  const isAuthRoute = pathname.startsWith("/login");
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/users");

  // Regra A: Tenta acessar rota protegida SEM cookie -> chuta para o login
  if (isProtectedRoute && !authCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Regra B: Tenta acessar login COM cookie -> manda direto para o dashboard
  if (isAuthRoute && authCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 2. LISTA DE EXCEÇÕES RIGOROSA: Ignora o ecossistema do painel e do sistema
  if (
    isProtectedRoute ||
    isAuthRoute ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/expired") ||
    pathname.startsWith("/protected") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // 3. O Motor do Encurtador Público (Lógica preservada)
  const slug = pathname.substring(1);

  if (slug.length >= 3) {
    try {
      const res = await fetch(`${origin}/api/validate/${slug}`, {
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();

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
      return NextResponse.redirect(new URL("/expired", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
