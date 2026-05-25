// src/app/api/invites/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth-guard";
import { randomBytes } from "crypto";

// 1. LISTAR CONVITES ENVIADOS (Protegido para Admin)
export async function GET(request: Request) {
  // DEBUG TEMPORÁRIO — remover após resolver
  const authHeader = request.headers.get("Authorization");
  console.log("🔍 AUTH HEADER:", authHeader?.substring(0, 40));
  try {
    const authUser = await requireAdmin(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

    const snapshot = await adminDb
      .collection("invites")
      .orderBy("createdAt", "desc")
      .get();

    const invitesList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(invitesList, { status: 200 });
  } catch (error: unknown) {
    console.error("🔥 ERRO NO GET /api/invites:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// 2. GERAR NOVO CONVITE DE ACESSO (Protegido para Admin)
export async function POST(request: Request) {
  try {
    const authUser = await requireAdmin(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

    // Leitura resiliente do corpo da requisição
    const body = await request.json().catch(() => ({}));
    const email = body.email ? String(body.email).trim().toLowerCase() : "";
    const role = body.role ? String(body.role).trim() : "";

    // Validação explícita pós-tratamento de strings
    if (!email || !role) {
      return NextResponse.json(
        { error: "E-mail e nível de permissão são obrigatórios." },
        { status: 400 },
      );
    }

    // Verifica se o e-mail já possui um convite pendente ativo
    const existingInvite = await adminDb
      .collection("invites")
      .where("email", "==", email)
      .where("status", "==", "Pendente")
      .get();

    if (!existingInvite.empty) {
      return NextResponse.json(
        { error: "Já existe um convite pendente para este e-mail." },
        { status: 400 },
      );
    }

    // Gera um token criptográfico seguro e único de 32 caracteres hexadecimais
    const token = randomBytes(16).toString("hex");

    // Define expiração padrão para 7 dias a partir de hoje
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitePayload = {
      email,
      role,
      token,
      status: "Pendente",
      createdBy: authUser.uid,
      createdAt: new Date(),
      expiresAt: expiresAt,
    };

    // Salva o convite usando o token como ID único do documento
    await adminDb.collection("invites").doc(token).set(invitePayload);

    return NextResponse.json(
      {
        message: "Convite gerado com sucesso!",
        inviteLink: `http://localhost:3000/register?token=${token}`,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("🔥 ERRO NO POST /api/invites:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
