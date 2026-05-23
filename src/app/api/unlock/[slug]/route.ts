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
} from "firebase/firestore";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { password } = body;

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

    // Valida a senha exata
    if (data.passwordHash !== password) {
      return NextResponse.json(
        { success: false, error: "Senha incorreta. Tente novamente." },
        { status: 401 },
      );
    }

    // Sucesso: Incrementa o clique e devolve a URL de destino
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
