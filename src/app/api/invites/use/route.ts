// src/app/api/invites/use/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    // 🔒 AUTENTICAÇÃO: verifica se quem está consumindo o convite é o próprio usuário autenticado
    const authHeader = request.headers.get("Authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split("Bearer ")[1]
      : null;

    if (!idToken) {
      return NextResponse.json(
        { error: "Token de autenticação ausente." },
        { status: 401 },
      );
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { error: "Token de autenticação inválido ou expirado." },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const token = body.token ? String(body.token).trim() : "";
    const usedBy = body.usedBy ? String(body.usedBy).trim() : "";

    if (!token || !usedBy) {
      return NextResponse.json(
        { error: "Token de convite e UID do usuário são obrigatórios." },
        { status: 400 },
      );
    }

    // 🔒 Garante que o UID do body bate com o do token JWT
    // Impede que alguém invalide o convite de outro usuário
    if (decodedToken.uid !== usedBy) {
      return NextResponse.json(
        { error: "UID não corresponde ao usuário autenticado." },
        { status: 403 },
      );
    }

    const inviteRef = adminDb.collection("invites").doc(token);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
      return NextResponse.json(
        { error: "O convite informado não foi localizado." },
        { status: 404 },
      );
    }

    // 🔧 != cobre tanto null quanto undefined — mais robusto que !== null
    const inviteData = inviteDoc.data()!;
    if (inviteData.usedAt != null) {
      return NextResponse.json(
        { error: "Este convite já foi utilizado." },
        { status: 410 },
      );
    }

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
