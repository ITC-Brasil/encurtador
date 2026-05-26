// src/app/api/analytics/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, userAgent, referrer, ip } = body;

    if (!slug) {
      return NextResponse.json(
        { error: "Slug não fornecido" },
        { status: 400 },
      );
    }

    // 🕵️‍♂️ Captura Inteligente de Localização Nativa da Infraestrutura Vercel
    // Em desenvolvimento (localhost) esses cabeçalhos não existem, então aplicamos fallbacks amigáveis
    const country = request.headers.get("x-vercel-ip-country") || "BR";
    const region = request.headers.get("x-vercel-ip-country-region") || "SP";
    const rawCity = request.headers.get("x-vercel-ip-city") || "São Paulo";

    // Corrige codificação de caracteres especiais vindos do cabeçalho HTTP
    const city = decodeURIComponent(encodeURIComponent(rawCity));

    // 1. Localiza o documento do link correspondente pelo slug para descobrir o ID numérico/idDoc
    const linksRef = adminDb.collection("links");
    const snapshot = await linksRef.where("slug", "==", slug).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "Link não encontrado" },
        { status: 404 },
      );
    }

    const linkDoc = snapshot.docs[0];
    const linkId = linkDoc.id;

    // 2. Transação Atômica: Salva o log na subcoleção e incrementa o contador global de cliques
    const batch = adminDb.batch();

    // Referência do novo documento de clique dentro da subcoleção aninhada
    const newClickRef = linksRef.doc(linkId).collection("clicks").doc();

    batch.set(newClickRef, {
      clickedAt: FieldValue.serverTimestamp(), // Chave unificada para o Recharts temporal
      userAgent,
      referrer,
      ip,
      country,
      region,
      city,
    });

    // Incrementa o contador rápido de cliques do card principal
    batch.update(linksRef.doc(linkId), {
      clickCount: FieldValue.increment(1),
    });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro crítico no motor de Analytics:", error);
    return NextResponse.json(
      { error: "Falha interna de gravação analítica" },
      { status: 500 },
    );
  }
}
