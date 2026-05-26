// src/app/api/validate/[slug]/route.ts
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
  addDoc,
} from "firebase/firestore";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    // 1. Captura de Metadados da Vercel Edge
    const country =
      request.headers.get("x-vercel-ip-country") || "Desconhecido";
    const city = request.headers.get("x-vercel-ip-city") || "Desconhecida";
    const userAgent = request.headers.get("user-agent") || "Desconhecido";

    // 2. Busca o link no banco
    const linksRef = collection(db, "links");
    const q = query(linksRef, where("slug", "==", slug));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }

    const linkDoc = snapshot.docs[0];
    const data = linkDoc.data();
    const linkId = linkDoc.id;

    // 3. Regra de Segurança: Exclusão Lógica (Soft Delete)
    // Fica antes do isActive para garantir que retorne 404 se foi deletado.
    if (data.isDeleted) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }

    // 4. Regra 1: Desativação Manual (RF-03.1)
    if (!data.isActive) {
      return NextResponse.json({ status: "expired" }, { status: 410 });
    }

    // 5. Regra 2: Expiração por Data (RF-03.2)
    if (data.expiresAt) {
      const now = new Date();
      const expirationDate = data.expiresAt.toDate();
      if (now > expirationDate) {
        return NextResponse.json({ status: "expired" }, { status: 410 });
      }
    }

    // 6. Regra 3: Limite de Cliques (RF-03.3)
    if (data.maxClicks && data.maxClicks > 0) {
      if (data.clickCount >= data.maxClicks) {
        return NextResponse.json({ status: "expired" }, { status: 410 });
      }
    }

    // 7. Regra 4: Proteção por Senha (RF-04.1)
    if (data.passwordHash) {
      return NextResponse.json({ status: "protected" }, { status: 200 });
    }

    // 8. Sucesso: Registra o Clique e os Metadados simultaneamente
    const updateCountPromise = updateDoc(doc(db, "links", linkId), {
      clickCount: increment(1),
    });

    const registerMetadataPromise = addDoc(
      collection(db, "links", linkId, "clicks"),
      {
        timestamp: new Date(),
        country,
        city,
        userAgent,
      },
    );

    // Executa as duas operações no banco em paralelo para não gerar lentidão
    await Promise.all([updateCountPromise, registerMetadataPromise]);

    return NextResponse.json(
      {
        status: "valid",
        originalUrl: data.originalUrl,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Erro na API de validação:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
