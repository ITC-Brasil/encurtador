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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. CRIAR NOVO COLABORADOR
export async function POST(request: Request) {
  try {
    const { email, password, name, role } = await request.json();

    if (!email || !password || !name) {
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
        status: "Ativo", // Inicializa ativo por padrão
        createdAt: new Date().toISOString(),
      });

    return NextResponse.json(
      { message: "Usuário criado com sucesso!" },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 3. MODIFICAR ATRIBUTOS (ROLE OU STATUS DE ATIVAÇÃO)
export async function PUT(request: Request) {
  try {
    const { uid, role, status } = await request.json();

    if (!uid) {
      return NextResponse.json({ error: "UID obrigatório." }, { status: 400 });
    }

    const updateData: any = {};
    if (role) updateData.role = role;
    if (status) updateData.status = status;

    await adminDb.collection("users").doc(uid).update(updateData);

    // Se o status foi alterado para Suspenso, desloga e bloqueia o usuário no Auth também
    if (status === "Suspenso") {
      await adminAuth.updateUser(uid, { disabled: true });
    } else if (status === "Ativo") {
      await adminAuth.updateUser(uid, { disabled: false });
    }

    return NextResponse.json(
      { message: "Usuário atualizado com sucesso!" },
      { status: 200 },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 4. DELETAR DEFINITIVAMENTE DO BANCO E DO AUTH
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

    await adminAuth.deleteUser(uid);
    await adminDb.collection("users").doc(uid).delete();

    return NextResponse.json(
      { message: "Usuário removido para sempre." },
      { status: 200 },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
