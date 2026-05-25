// src/app/api/invites/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth-guard";
import { resend } from "@/lib/resend";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  try {
    // 1. Verificar se quem está chamando é um Administrador
    const authUser = await requireAdmin(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

    // 2. Extrair e validar os dados do corpo da requisição
    const body = await request.json().catch(() => ({}));
    const email = body.email ? String(body.email).trim().toLowerCase() : "";
    const role = body.role ? String(body.role).trim() : "";

    if (!email || !role) {
      return NextResponse.json(
        { error: "E-mail e nível de permissão são obrigatórios." },
        { status: 400 },
      );
    }

    const validRoles = ["Colaborador", "Administrador"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Nível de permissão inválido." },
        { status: 400 },
      );
    }

    // 3. Verificar se já existe um usuário ativo com esse e-mail
    const existingUser = await adminDb
      .collection("users")
      .where("email", "==", email)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (!existingUser.empty) {
      return NextResponse.json(
        { error: "Já existe um colaborador ativo com este e-mail." },
        { status: 409 },
      );
    }

    // 4. Gerar token único e calcular expiração (48 horas)
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // 5. Salvar convite na coleção 'invites' do Firestore
    await adminDb.collection("invites").doc(token).set({
      token,
      email,
      role,
      createdBy: authUser.uid,
      createdAt: new Date(),
      expiresAt,
      usedAt: null,
      usedBy: null,
      isRevoked: false,
    });

    // 6. Montar o link de convite apontando para a nova rota de destino
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://itcbr.xyz";
    const inviteLink = `${baseUrl}/invite/${token}`;

    // 7. Enviar o e-mail oficial via Resend
    const { error: emailError } = await resend.emails.send({
      from: "ITC Brasil <noreply@itcbr.xyz>",
      to: email,
      subject: "Você foi convidado para o Encurtador ITC Brasil",
      html: buildEmailHtml({ inviteLink, role }),
    });

    if (emailError) {
      // Se o e-mail falhar, remove o convite criado para evitar tokens órfãos
      await adminDb.collection("invites").doc(token).delete();
      console.error("Erro ao enviar e-mail via Resend:", emailError);
      return NextResponse.json(
        { error: "Falha ao despachar o e-mail corporativo de convite." },
        { status: 500 },
      );
    }

    // 8. Retornar sucesso com o link como fallback
    return NextResponse.json(
      {
        message: "Convite enviado por e-mail com sucesso!",
        inviteLink,
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

// Função auxiliar interna para renderizar o template HTML responsivo
function buildEmailHtml({
  inviteLink,
  role,
}: {
  inviteLink: string;
  role: string;
}): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Convite — Encurtador ITC Brasil</title>
    </head>
    <body style="margin:0;padding:0;background-color:#F4F6F6;font-family:'Helvetica Neue',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F6F6;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #D8DEDE;">
              <tr>
                <td style="background-color:#008F95;padding:32px 40px;text-align:center;">
                  <p style="margin:0;font-size:13px;font-weight:600;color:#E0F4F5;letter-spacing:2px;text-transform:uppercase;">Grupo ITC Brasil</p>
                  <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;">Encurtador de Links</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:40px 40px 32px;">
                  <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#1A2020;">Você foi convidado!</h2>
                  <p style="margin:0 0 16px;font-size:15px;color:#3A4040;line-height:1.6;">
                    Você recebeu um convite para acessar o <strong>Encurtador de Links</strong> do Grupo ITC Brasil com o perfil de <strong>${role}</strong>.
                  </p>
                  <p style="margin:0 0 32px;font-size:15px;color:#3A4040;line-height:1.6;">
                    Clique no botão abaixo para aceitar o convite e vincular sua conta Google. O link é válido por <strong>48 horas</strong>.
                  </p>
                  <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                    <tr>
                      <td style="background-color:#008F95;border-radius:6px;">
                        <a href="${inviteLink}"
                           style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">
                          Aceitar Convite
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 8px;font-size:13px;color:#697272;">Se o botão não funcionar, copie e cole o link abaixo no navegador:</p>
                  <p style="margin:0;font-size:12px;color:#008F95;word-break:break-all;">${inviteLink}</p>
                </td>
              </tr>
              <tr>
                <td style="background-color:#F4F6F6;padding:20px 40px;border-top:1px solid #D8DEDE;">
                  <p style="margin:0;font-size:12px;color:#697272;line-height:1.5;text-align:center;">
                    Se você não esperava este convite, ignore este e-mail.<br/>
                    Este é um e-mail automático — não responda a esta mensagem.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
