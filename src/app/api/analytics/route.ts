// src/app/api/analytics/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { slug, userAgent, referrer, ip } = body;

    if (!slug) {
      return NextResponse.json({ error: "Slug obrigatório." }, { status: 400 });
    }

    // Leitura estrita dos cabeçalhos geográficos injetados pela infraestrutura da Vercel
    const country = request.headers.get("x-vercel-ip-country") || "BR";
    const region =
      request.headers.get("x-vercel-ip-country-region") || "Desconhecido";
    const rawCity =
      request.headers.get("x-vercel-ip-city") || "Não identificada";
    const city = decodeURIComponent(encodeURIComponent(rawCity));

    // Localiza o link correspondente pelo slug para capturar o ID do documento
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
    const currentClickCount = linkDoc.data().clickCount || 0;

    const batch = adminDb.batch();
    const newClickRef = linksRef.doc(linkId).collection("clicks").doc();

    // Gravação híbrida: salva chaves antigas e novas em paralelo para evitar quebra de contrato de dados
    const timestampSnapshot = new Date();

    batch.set(newClickRef, {
      timestamp: timestampSnapshot, // Mantido para compatibilidade com o layout antigo
      clickedAt: timestampSnapshot.toISOString(), // String ISO legível para evitar quebra no Recharts
      userAgent: userAgent || "Desconhecido",
      referrer: referrer || "Direto",
      ip: ip || "0.0.0.0",
      country,
      region,
      city, // Gravado em lowercase conforme mapeamento do Firestore
    });

    // Incrementa atomicamente o contador global de acessos
    batch.update(linksRef.doc(linkId), {
      clickCount: currentClickCount + 1,
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
