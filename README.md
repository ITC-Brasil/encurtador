# Encurtador de URLs Corporativo — ITC Brasil

Sistema enterprise de encurtamento de links, rastreamento de acessos e inteligência de dados voltado para materiais operacionais, carretas e campanhas estratégicas do **Grupo ITC Brasil**.

A aplicação centraliza toda a inteligência de tráfego sob o domínio institucional `itcbr.xyz`, oferecendo uma experiência unificada e em tempo real para administradores e colaboradores, com acesso controlado por convite e trilha de auditoria imutável.

---

## 🛠️ Stack Tecnológica

| Camada              | Tecnologia                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Framework           | [Next.js 16](https://nextjs.org/) — App Router, API Routes, Edge Middleware                    |
| Linguagem           | [TypeScript](https://www.typescriptlang.org/) — tipagem estrita                                |
| Banco de Dados      | [Firebase Firestore](https://firebase.google.com/) — Client SDK + Admin SDK                    |
| Autenticação        | [Firebase Authentication](https://firebase.google.com/) — OAuth Google com sistema de convites |
| E-mail Transacional | [Resend](https://resend.com/) — envio automático de convites via `noreply@itcbr.xyz`           |
| Design System       | [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)                 |
| Tabelas             | [TanStack Table v8](https://tanstack.com/table/v8) — sorting e seleção em lote                 |
| Gráficos            | [Recharts](https://recharts.org/) — séries temporais de cliques                                |
| Segurança de Senhas | [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — hash de senhas de links protegidos          |
| Deploy              | [Vercel](https://vercel.com/) — Edge Network + CI/CD via GitHub                                |

---

## 🎯 Funcionalidades

### Dashboard Principal (`/dashboard`)

- Métricas em tempo real via `onSnapshot` do Firestore: total de links, cliques acumulados e links ativos
- Visibilidade por role: administradores veem todos os links da equipe com identificação do criador; colaboradores veem apenas os próprios
- Criação rápida de links via modal integrado na Navbar
- Exclusão segura em lote com confirmação via Dialog
- Paginação com shadcn `Pagination` — números de página, ellipsis, Anterior/Próximo

### Criação e Gestão de Links

- Slug customizável com geração aleatória (fallback automático, apenas lowercase)
- Unicidade atômica garantida via `setDoc` com `merge: false` — slug é o ID do documento
- Expiração por data/hora ou por número máximo de cliques
- Proteção por senha com hash bcrypt — rate limiting de 5 tentativas por 15 minutos
- Tags/categorias com color picker da paleta institucional ITC
- Soft delete — links removidos preservam histórico de analytics para auditoria
- QR Code vetorial com download em PNG e SVG

### Analytics de Links (`/dashboard/links/[id]`)

- Gráfico temporal de cliques agrupados por dia — Recharts
- Geolocalização por país e cidade via headers Vercel Edge (`x-vercel-ip-country`, `x-vercel-ip-city`)
- Distribuição por dispositivo: Mobile, Desktop e Tablet (User-Agent)
- Registro assíncrono (fire-and-forget) — não bloqueia o redirecionamento do visitante
- Contagem atômica com `FieldValue.increment(1)` — sem perda de cliques em acessos simultâneos

### Sistema de Acesso por Convite

- Acesso fechado: nenhuma conta pode autenticar sem convite válido, independente do domínio
- Admin gera token único com prazo de expiração; link enviado manualmente por e-mail
- E-mail automático disparado via Resend ao criar o convite, remetente `noreply@itcbr.xyz`
- Convidado clica no link, autentica com conta Google, documento criado em `users/{uid}`
- ID do documento sempre é o UID do Firebase Auth — compatibilidade garantida com `auth-guard`
- Revogação de convites pendentes com soft delete na coleção `invites`

### Gestão de Usuários (`/dashboard/users`)

- Listagem de colaboradores com `StatusBadge` visual e ícones de status
- Promoção/rebaixamento de role (Administrador ↔ Colaborador)
- Suspensão e reativação com sincronização no Firebase Auth (`disabled: true/false`)
- Proteção contra remover ou rebaixar o último administrador ativo
- Confirmações destrutivas via Dialog shadcn/ui — sem `window.confirm`

### Trilha de Auditoria Imutável (`/dashboard/audit`)

- Registro de todas as ações críticas: criação, edição e exclusão de links
- Diff de antes/depois para edições — campos `changes.before` e `changes.after`
- Acesso restrito a administradores com verificação server-side de role
- Paginação shadcn com ellipsis para listas longas

---

## 🔒 Segurança

- **APIs protegidas por Bearer Token:** todos os endpoints sensíveis verificam o JWT via `adminAuth.verifyIdToken()` antes de executar qualquer operação
- **`auth-guard.ts`:** helper centralizado que valida token e verifica `role: "Administrador"` no Firestore
- **Senhas de links:** armazenadas com `bcrypt.hash(password, 10)` — nunca em texto plano
- **Rate limiting:** coleção `passwordAttempts` no Firestore bloqueia por 15 minutos após 5 tentativas incorretas
- **IP sempre do servidor:** lido de `x-forwarded-for` — nunca aceito do body da requisição
- **`ANALYTICS_SECRET`:** header interno protege o endpoint de analytics contra inflação artificial de cliques
- **Cookie anti-flicker:** `itc-auth` com `SameSite=Strict`, condicional `Secure` (apenas em `https://`)
- **Acesso fechado por convite:** bloqueio universal — nenhuma conta Google sem convite válido acessa o sistema

---

## 🗄️ Modelo de Dados (Firestore)

```
links/{slug}
  ├── slug, originalUrl, title
  ├── clickCount, isActive, isDeleted
  ├── passwordHash (bcrypt), expiresAt, maxClicks
  ├── categoryId, categoryName, categoryColor
  ├── createdBy, createdByName, createdAt
  └── clicks/{clickId}
        ├── timestamp, country, city
        ├── device, userAgent, referrer

users/{uid}
  ├── name, email, displayName, photoURL
  ├── role (Administrador | Colaborador)
  ├── status (Ativo | Suspenso), isActive

invites/{token}
  ├── email, role, createdBy
  ├── expiresAt, usedAt, usedBy
  └── isRevoked

audit_logs/{id}
  ├── action (LINK_CREATE | LINK_EDIT | LINK_DELETE)
  ├── performedBy { uid, name, email }
  ├── targetId (slug), details, timestamp
  └── changes { before, after }

passwordAttempts/{slug_ip}
  ├── count, blockedUntil, updatedAt
```

---

## 🌐 Fluxo de Redirecionamento

```
Visitante acessa itcbr.xyz/[slug]
  → Edge Middleware (middleware.ts)
    → GET /api/validate/[slug] (Admin SDK)
      → isDeleted?  → 404 /expired
      → isActive?   → 410 /expired
      → expiresAt?  → 410 /expired
      → maxClicks?  → 410 /expired
      → passwordHash? → /protected/[slug]
      → válido: HTTP 302 → originalUrl
                + POST /api/analytics (fire-and-forget)
```

---

## ⚙️ Variáveis de Ambiente

Configure no `.env.local` e no painel de **Environment Variables** da Vercel:

```bash
# Firebase Client (front-end)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK (API Routes)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSuaChaveAqui...\n-----END PRIVATE KEY-----\n"

# Resend — e-mail de convites
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Analytics — protege endpoint contra inflação de cliques
# Gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ANALYTICS_SECRET=

# URL base da aplicação
NEXT_PUBLIC_APP_URL=https://itcbr.xyz
```

> **Atenção:** a `FIREBASE_PRIVATE_KEY` deve estar entre aspas duplas com `\n` literais — não quebras de linha reais.

---

## 🚀 Instalação e Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Build de produção
npm run build
```

---

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── api/
│   │   ├── analytics/          # Motor de registro de cliques
│   │   ├── invites/            # CRUD de convites + validação de token
│   │   ├── unlock/[slug]/      # Validação de senha com rate limiting
│   │   ├── usuarios/           # Gestão de usuários (Admin SDK)
│   │   └── validate/[slug]/    # Motor de redirecionamento
│   ├── dashboard/
│   │   ├── audit/              # Trilha de auditoria imutável
│   │   ├── links/[id]/         # Analytics detalhado por link
│   │   └── users/              # Gestão de equipe e convites
│   ├── invite/[token]/         # Ativação de conta via convite
│   ├── login/                  # Autenticação Google OAuth
│   ├── protected/[slug]/       # Tela de senha para links protegidos
│   └── expired/                # Página branded de link expirado
├── components/
│   ├── ui/                     # shadcn/ui
│   ├── back-button.tsx
│   ├── color-picker.tsx
│   ├── edit-link-form.tsx
│   ├── google-icon.tsx
│   ├── invite-member-form.tsx
│   ├── loading-spinner.tsx
│   ├── navbar.tsx
│   ├── new-link-form.tsx
│   ├── status-badge.tsx
│   └── table-pagination.tsx
└── lib/
    ├── audit.ts                # Helper de registro de audit logs
    ├── auth-guard.ts           # Verificação de token JWT + role admin
    ├── firebase-admin.ts       # Admin SDK (server-side)
    ├── firebase.ts             # Client SDK (front-end)
    ├── resend.ts               # Cliente Resend
    └── utils.ts                # getCategoryBadgeStyle, cn()
```

---

_Grupo ITC Brasil — Gerência de Tecnologia · `itcbr.xyz`_
