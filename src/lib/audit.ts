// src/lib/audit.ts
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  FieldValue,
} from "firebase/firestore";

export type AuditAction =
  | "LINK_CREATE"
  | "LINK_EDIT"
  | "LINK_DELETE"
  | "LINK_RESTORE"
  | "INVITE_SEND"
  | "INVITE_REVOKE"
  | "USER_ROLE_CHANGE";

export type FirestorePrimitive = string | number | boolean | null;

export interface AuditLog {
  action: AuditAction;
  performedBy: {
    uid: string;
    name: string;
    email: string;
  };
  targetId: string;
  details: string;
  changes?: {
    before: Record<string, FirestorePrimitive>;
    after: Record<string, FirestorePrimitive>;
  };
  createdAt?: FieldValue; // <-- Corrigido aqui: trocado 'any' pelo tipo real do Firestore
}

/**
 * Registra uma ação crítica na trilha de auditoria imutável do sistema.
 */
export async function registerLog(log: AuditLog): Promise<void> {
  try {
    const auditCollection = collection(db, "audit_logs");
    await addDoc(auditCollection, {
      ...log,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Falhas no log não devem derrubar a operação principal do usuário,
    // mas precisam ser capturadas no console do servidor.
    console.error("Falha crítica ao gravar log de auditoria:", error);
  }
}
