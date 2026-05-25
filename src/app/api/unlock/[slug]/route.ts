// src/app/api/unlock/[slug]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  increment,
  getDoc,
  setDoc,
} from "firebase/firestore";
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
    // Cria uma chave única baseada no IP do usuário e no slug do link
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const attemptKey = `${slug}_${ip}`;
    const attemptRef = doc(db, "passwordAttempts", attemptKey);
    const attemptSnap = await getDoc(attemptRef);

    if (attemptSnap.exists()) {
      const attemptData = attemptSnap.data();
      // Se tiver data de bloqueio e ela for no futuro, rejeita o acesso
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

    // Busca o link no banco
    const linksRef = collection(db, "links");
    const q = query(linksRef, where("slug", "==", slug));
    const snapshot = await getDocs(q);

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
      // Se a senha for inválida, aumenta o contador de erros
      const currentCount = attemptSnap.exists() ? attemptSnap.data().count : 0;
      const newCount = currentCount + 1;

      // Se errar 5 vezes seguidas (count >= 4), bloqueia por 15 minutos
      const blockedUntil =
        newCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await setDoc(
        attemptRef,
        {
          count: newCount,
          blockedUntil,
          updatedAt: new Date(),
        },
        { merge: true },
      );

      return NextResponse.json(
        { success: false, error: "Senha incorreta. Tente novamente." },
        { status: 401 },
      );
    }

    // --- SUCESSO: LIMPA O CONTADOR DE ERROS E LIBERA O LINK ---
    await setDoc(
      attemptRef,
      {
        count: 0,
        blockedUntil: null,
        updatedAt: new Date(),
      },
      { merge: true },
    );

    await updateDoc(doc(db, "links", linkDoc.id), {
      clickCount: increment(1),
    });

    return NextResponse.json(
      {
        success: true,
        originalUrl: data.originalUrl,
      },
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
