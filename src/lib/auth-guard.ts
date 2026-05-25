// src/lib/auth-guard.ts
import { adminAuth, adminDb } from "./firebase-admin";

export async function requireAdmin(
  request: Request,
): Promise<{ uid: string } | null> {
  try {
    // Extrai o token do cabeçalho 'Authorization: Bearer <token>'
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.split("Bearer ")[1];
    if (!token) return null;

    // Decodifica e valida o token JWT usando o Admin SDK
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Busca os metadados do usuário no Firestore (lado do servidor)
    const userDoc = await adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();
    const userData = userDoc.data();

    // Bloqueia se o usuário não for explicitamente um Administrador
    if (!userData || userData.role !== "Administrador") {
      return null;
    }

    return { uid: decodedToken.uid };
  } catch (error) {
    console.error("Erro na validação do Auth Guard:", error);
    return null;
  }
}
