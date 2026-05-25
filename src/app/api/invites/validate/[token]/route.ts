// src/app/api/invites/validate/[token]/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    // 1. Busca o convite pelo token (que é o ID do documento)
    const inviteDoc = await adminDb.collection("invites").doc(token).get();

    // Token não existe na base de dados
    if (!inviteDoc.exists) {
      return NextResponse.json(
        { valid: false, error: "Convite não localizado no sistema." },
        { status: 404 },
      );
    }

    const invite = inviteDoc.data()!;

    // 2. Token foi revogado manualmente pelo administrador
    if (invite.isRevoked) {
      return NextResponse.json(
        {
          valid: false,
          error: "Este convite de acesso foi revogado pela administração.",
        },
        { status: 410 },
      );
    }

    // 3. Token já foi consumido por um colaborador
    if (invite.usedAt !== null) {
      return NextResponse.json(
        {
          valid: false,
          error:
            "Este convite já foi utilizado para ativar uma conta corporativa.",
        },
        { status: 410 },
      );
    }

    // 4. Token extrapolou a janela de validade de 48 horas
    const now = new Date();
    const expiresAt = invite.expiresAt.toDate();
    if (now > expiresAt) {
      return NextResponse.json(
        {
          valid: false,
          error: "Este convite expirou (janela de validade de 48h excedida).",
        },
        { status: 410 },
      );
    }

    // Token totalmente válido — retorna email e role pré-definidos para o front-end
    return NextResponse.json(
      {
        valid: true,
        email: invite.email,
        role: invite.role,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("🔥 ERRO NO GET /api/invites/validate:", error);
    return NextResponse.json(
      {
        valid: false,
        error: "Erro interno do servidor ao validar o token corporativo.",
      },
      { status: 500 },
    );
  }
}
