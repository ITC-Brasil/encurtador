// src/app/api/usuarios/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth-guard"; // <-- Importação do nosso Guard

// Função auxiliar para verificar se o usuário sendo alterado/deletado é o último Admin ativo do sistema
async function isLastAdmin(targetUid: string): Promise<boolean> {
  const snapshot = await adminDb
    .collection("users")
    .where("role", "==", "Administrador")
    .where("status", "==", "Ativo")
    .get();

  // Se só houver 1 administrador ativo e o ID coincidir com o alvo, ele é o último
  if (snapshot.size <= 1 && snapshot.docs.some((doc) => doc.id === targetUid)) {
    return true;
  }
  return false;
}

// 1. LISTAR USUÁRIOS (Protegido)
export async function GET(request: Request) {
  try {
    // Barreira de Autenticação/Autorização
    const authUser = await requireAdmin(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

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

// 2. CRIAR NOVO COLABORADOR (Protegido)
export async function POST(request: Request) {
  try {
    // Barreira de Autenticação/Autorização
    const authUser = await requireAdmin(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

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
        createdAt: new Date(),
      });

    return NextResponse.json(
      { message: "Usuário criado com sucesso!" },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("🔥 ERRO NO POST /api/usuarios:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// 3. ATUALIZAR STATUS OU PERMISSÃO (Protegido + Trava contra remover último Admin)
export async function PUT(request: Request) {
  try {
    // Barreira de Autenticação/Autorização
    const authUser = await requireAdmin(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

    const { uid, role, status } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { error: "UID é obrigatório." },
        { status: 400 },
      );
    }

    // Trava de segurança: impede rebaixar ou suspender o último administrador ativo
    if (role !== "Administrador" || status === "Suspenso") {
      const isLast = await isLastAdmin(uid);
      if (isLast) {
        return NextResponse.json(
          {
            error:
              "Operação negada. O sistema precisa de pelo menos um Administrador ativo.",
          },
          { status: 400 },
        );
      }
    }

    // Tipagem explícita e segura aplicada para eliminar o erro de 'any' do ESLint
    const updateData: { role?: string; status?: string } = {};
    if (role) updateData.role = role;
    if (status) updateData.status = status;

    await adminDb.collection("users").doc(uid).update(updateData);

    if (status === "Suspenso") {
      await adminAuth.updateUser(uid, { disabled: true }).catch(() => null);
    } else if (status === "Ativo") {
      await adminAuth.updateUser(uid, { disabled: false }).catch(() => null);
    }

    return NextResponse.json(
      { message: "Usuário atualizado com sucesso!" }, // Quick win do relatório aplicado: pt-br
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("🔥 ERRO NO PUT /api/usuarios:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// 4. DELETAR COLABORADOR (Protegido + Trava contra deletar último Admin)
export async function DELETE(request: Request) {
  try {
    // Barreira de Autenticação/Autorização
    const authUser = await requireAdmin(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");

    if (!uid) {
      return NextResponse.json(
        { error: "UID é obrigatório." },
        { status: 400 },
      );
    }

    // Trava de segurança: impede deletar o último administrador ativo
    const isLast = await isLastAdmin(uid);
    if (isLast) {
      return NextResponse.json(
        {
          error:
            "Operação negada. Não é possível deletar o último Administrador ativo do sistema.",
        },
        { status: 400 },
      );
    }

    await adminAuth
      .deleteUser(uid)
      .catch(() => console.log("Aviso: Usuário não existia no Auth Engine"));

    await adminDb.collection("users").doc(uid).delete();

    return NextResponse.json(
      { message: "Usuário removido com sucesso!" },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("🔥 ERRO NO DELETE /api/usuarios:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
