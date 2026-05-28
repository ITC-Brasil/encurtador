// src/app/api/analytics/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
  try {
    // 🔒 AUTENTICAÇÃO: verifica segredo interno para barrar chamadas externas
    const secret = request.headers.get("x-analytics-secret");
    if (!secret || secret !== process.env.ANALYTICS_SECRET) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { slug, userAgent, referrer } = body;

    if (!slug) {
      return NextResponse.json({ error: "Slug obrigatório." }, { status: 400 });
    }

    // 🔒 IP sempre lido do cabeçalho do servidor — nunca do body do cliente
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "0.0.0.0";

    // Leitura dos cabeçalhos geográficos injetados pela Vercel Edge
    const country = request.headers.get("x-vercel-ip-country") || "BR";
    const region =
      request.headers.get("x-vercel-ip-country-region") || "Desconhecido";
    const rawCity =
      request.headers.get("x-vercel-ip-city") || "Não identificada";

    // 🔧 Decode correto: apenas decodeURIComponent — encode+decode é no-op
    const city = (() => {
      try {
        return decodeURIComponent(rawCity);
      } catch {
        return rawCity;
      }
    })();

    // Localiza o link pelo slug
    const linksRef = adminDb.collection("links");
    const snapshot = await linksRef.where("slug", "==", slug).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "Link não localizado." },
        { status: 404 },
      );
    }

    const linkDoc = snapshot.docs[0];
    const linkId = linkDoc.id;

    const batch = adminDb.batch();
    const newClickRef = linksRef.doc(linkId).collection("clicks").doc();

    const timestampSnapshot = new Date();

    batch.set(newClickRef, {
      timestamp: timestampSnapshot,
      clickedAt: timestampSnapshot.toISOString(),
      userAgent: userAgent || "Desconhecido",
      referrer: referrer || "Direto",
      ip,
      country,
      region,
      city,
    });

    // 🔧 FieldValue.increment — atômico, sem risco de perda em cliques simultâneos
    batch.update(linksRef.doc(linkId), {
      clickCount: FieldValue.increment(1),
    });

    await batch.commit();
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("🔥 ERRO NO MOTOR DE ANALYTICS:", error);
    return NextResponse.json(
      { error: "Erro interno de gravação analítica." },
      { status: 500 },
    );
  }
}
