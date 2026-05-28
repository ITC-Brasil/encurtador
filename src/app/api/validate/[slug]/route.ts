// src/app/api/validate/[slug]/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    // 1. Captura de metadados da Vercel Edge — repassados ao motor de analytics
    const userAgent = request.headers.get("user-agent") || "Desconhecido";
    const referrer = request.headers.get("referer") || "Direto";

    // 2. Busca o link no banco via Admin SDK (correto para API Routes server-side)
    const linksRef = adminDb.collection("links");
    const snapshot = await linksRef.where("slug", "==", slug).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }

    const linkDoc = snapshot.docs[0];
    const data = linkDoc.data();

    // 3. Exclusão lógica (Soft Delete) — antes do isActive
    if (data.isDeleted) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }

    // 4. Desativação manual (RF-03.1)
    if (!data.isActive) {
      return NextResponse.json({ status: "expired" }, { status: 410 });
    }

    // 5. Expiração por data (RF-03.2)
    if (data.expiresAt) {
      const now = new Date();
      const expirationDate = data.expiresAt.toDate();
      if (now > expirationDate) {
        return NextResponse.json({ status: "expired" }, { status: 410 });
      }
    }

    // 6. Limite de cliques (RF-03.3)
    if (data.maxClicks && data.maxClicks > 0) {
      if (data.clickCount >= data.maxClicks) {
        return NextResponse.json({ status: "expired" }, { status: 410 });
      }
    }

    // 7. Proteção por senha (RF-04.1)
    if (data.passwordHash) {
      return NextResponse.json({ status: "protected" }, { status: 200 });
    }

    // 8. Link válido — delega o registro do clique ao motor de analytics
    // Fire-and-forget: não bloqueia o redirecionamento aguardando o registro
    const { origin } = new URL(request.url);
    fetch(`${origin}/api/analytics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Repassa todos os headers geográficos da Vercel para o motor de analytics
        "x-analytics-secret": process.env.ANALYTICS_SECRET ?? "",
        "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
        "x-vercel-ip-country": request.headers.get("x-vercel-ip-country") ?? "",
        "x-vercel-ip-country-region":
          request.headers.get("x-vercel-ip-country-region") ?? "",
        "x-vercel-ip-city": request.headers.get("x-vercel-ip-city") ?? "",
        "user-agent": userAgent,
      },
      body: JSON.stringify({ slug, userAgent, referrer }),
    }).catch((err) =>
      console.error("Erro ao registrar clique no motor de analytics:", err),
    );

    return NextResponse.json(
      { status: "valid", originalUrl: data.originalUrl },
      { status: 200 },
    );
  } catch (error) {
    console.error("Erro na API de validação:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
