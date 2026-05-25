// src/app/api/invites/use/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = body.token ? String(body.token).trim() : "";
    const usedBy = body.usedBy ? String(body.usedBy).trim() : "";

    // Validação estrita dos parâmetros obrigatórios
    if (!token || !usedBy) {
      return NextResponse.json(
        { error: "Token de acesso e UID do usuário são obrigatórios." },
        { status: 400 },
      );
    }

    const inviteRef = adminDb.collection("invites").doc(token);
    const inviteDoc = await inviteRef.get();

    // Segurança contra requisições órfãs
    if (!inviteDoc.exists) {
      return NextResponse.json(
        { error: "O convite informado não foi localizado." },
        { status: 404 },
      );
    }

    // Altera os metadados do convite consumido de forma irreversível
    await inviteRef.update({
      usedAt: new Date(),
      usedBy,
    });

    return NextResponse.json(
      { message: "Convite registrado e consumido com sucesso." },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("🔥 ERRO NO POST /api/invites/use:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao dar baixa no token." },
      { status: 500 },
    );
  }
}
