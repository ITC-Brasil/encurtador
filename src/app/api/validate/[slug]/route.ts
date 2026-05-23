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
} from "firebase/firestore";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    // Busca o link no Firestore pelo slug (RF-01.4)
    const linksRef = collection(db, "links");
    const q = query(linksRef, where("slug", "==", slug));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }

    const linkDoc = snapshot.docs[0];
    const data = linkDoc.data();
    const linkId = linkDoc.id;

    // Regra 1: Inativo manualmente
    if (!data.isActive) {
      return NextResponse.json({ status: "expired" }, { status: 200 });
    }

    // Regra 2: Expiração por Data (RF-03.1)
    if (data.expiresAt) {
      const expirationDate = data.expiresAt.toDate();
      if (new Date() > expirationDate) {
        return NextResponse.json({ status: "expired" }, { status: 200 });
      }
    }

    // Regra 3: Expiração por Limite de Cliques (RF-03.2)
    if (data.maxClicks !== null && data.clickCount >= data.maxClicks) {
      return NextResponse.json({ status: "expired" }, { status: 200 });
    }

    // Regra 4: Proteção por Senha (RF-04.1)
    if (data.passwordHash) {
      return NextResponse.json({ status: "protected" }, { status: 200 });
    }

    // Sucesso: Se passou por tudo, o link é válido!
    // Aqui incrementamos o contador de cliques assincronamente para não atrasar o redirecionamento
    updateDoc(doc(db, "links", linkId), {
      clickCount: increment(1),
    }).catch((err) => console.error("Erro ao incrementar clique:", err));

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
