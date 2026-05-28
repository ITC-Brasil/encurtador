// src/app/api/unlock/[slug]/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { password } = body;

    // --- PROTEÇÃO CONTRA FORÇA BRUTA (RATE LIMITING) ---
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const attemptKey = `${slug}_${ip}`;
    const attemptRef = adminDb.collection("passwordAttempts").doc(attemptKey);
    const attemptSnap = await attemptRef.get();

    if (attemptSnap.exists) {
      const attemptData = attemptSnap.data()!;
      if (
        attemptData.blockedUntil &&
        new Date() < attemptData.blockedUntil.toDate()
      ) {
        return NextResponse.json(
          { success: false, error: "Muitas tentativas. Aguarde 15 minutos." },
          { status: 429 },
        );
      }
    }

    // --- BUSCA O LINK VIA ADMIN SDK ---
    const linksRef = adminDb.collection("links");
    const snapshot = await linksRef.where("slug", "==", slug).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json(
        { success: false, error: "Link não encontrado." },
        { status: 404 },
      );
    }

    const linkDoc = snapshot.docs[0];
    const data = linkDoc.data();

    // --- VALIDAÇÃO DA SENHA CRIPTOGRAFADA (BCRYPT) ---
    const isValid = await bcrypt.compare(password, data.passwordHash);

    if (!isValid) {
      const currentCount = attemptSnap.exists
        ? (attemptSnap.data()!.count ?? 0)
        : 0;
      const newCount = currentCount + 1;
      const blockedUntil =
        newCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await attemptRef.set(
        { count: newCount, blockedUntil, updatedAt: new Date() },
        { merge: true },
      );

      return NextResponse.json(
        { success: false, error: "Senha incorreta. Tente novamente." },
        { status: 401 },
      );
    }

    // --- SUCESSO: LIMPA O CONTADOR E REGISTRA O CLIQUE ---
    await attemptRef.set(
      { count: 0, blockedUntil: null, updatedAt: new Date() },
      { merge: true },
    );

    // 🔧 FieldValue.increment — atômico, sem risco em cliques simultâneos
    await linksRef.doc(linkDoc.id).update({
      clickCount: FieldValue.increment(1),
    });

    return NextResponse.json(
      { success: true, originalUrl: data.originalUrl },
      { status: 200 },
    );
  } catch (error) {
    console.error("Erro na API de desbloqueio:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno ao validar credenciais." },
      { status: 500 },
    );
  }
}
