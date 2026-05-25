// src/app/api/usuarios/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

// 1. LISTAR USUÁRIOS
export async function GET() {
  try {
    const snapshot = await adminDb.collection("users").get();
    const usersList = snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json(usersList, { status: 200 });
  } catch (error: unknown) {
    console.error("🔥 ERRO NO GET /api/usuarios:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// 2. CRIAR NOVO COLABORADOR
export async function POST(request: Request) {
  try {
    const { email, password, name, role } = await request.json();

    if (!email || !name) {
      return NextResponse.json(
        { error: "Dados incompletos." },
        { status: 400 },
      );
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    await adminDb
      .collection("users")
      .doc(userRecord.uid)
      .set({
        name,
        email,
        role: role || "Colaborador",
        status: "Ativo",
        createdAt: new Date().toISOString(),
      });

    return NextResponse.json({ message: "Usuário criado!" }, { status: 201 });
  } catch (error: unknown) {
    console.error("🔥 ERRO NO POST /api/usuarios:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// 3. MODIFICAR ATRIBUTOS
export async function PUT(request: Request) {
  try {
    const { uid, role, status } = await request.json();

    if (!uid) {
      return NextResponse.json({ error: "UID obrigatório." }, { status: 400 });
    }

    // Tipagem correta ao invés de 'any'
    const updateData: { role?: string; status?: string } = {};
    if (role) updateData.role = role;
    if (status) updateData.status = status;

    // Atualiza o Firestore
    await adminDb.collection("users").doc(uid).update(updateData);

    // Atualiza o Auth apenas se o status mudar
    if (status === "Suspenso") {
      await adminAuth.updateUser(uid, { disabled: true }).catch(() => null);
    } else if (status === "Ativo") {
      await adminAuth.updateUser(uid, { disabled: false }).catch(() => null);
    }

    return NextResponse.json(
      { message: "Usuário atualizado!" },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("🔥 ERRO NO PUT /api/usuarios:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// 4. DELETAR
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");

    if (!uid) {
      return NextResponse.json(
        { error: "UID é obrigatório." },
        { status: 400 },
      );
    }

    // Tenta deletar do Auth (se falhar porque não existe no auth, segue viagem para limpar o Firestore)
    await adminAuth
      .deleteUser(uid)
      .catch(() => console.log("Aviso: Usuário não existia no Auth Engine"));

    // Deleta do Firestore
    await adminDb.collection("users").doc(uid).delete();

    return NextResponse.json({ message: "Usuário removido." }, { status: 200 });
  } catch (error: unknown) {
    console.error("🔥 ERRO NO DELETE /api/usuarios:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
