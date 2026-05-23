# itcbr.xyz — Encurtador de Links Corporativo

Plataforma de alta performance para encurtamento de URLs, geração de QR Codes dinâmicos e rastreamento de acessos do **Grupo ITC Brasil**. Desenvolvido com foco em latência reduzida (<300ms) executado na Edge Network.

## 🚀 Tecnologias

- **Framework:** Next.js 16 (App Router) com compilador Turbopack ativo.
- **Estilização:** Tailwind CSS v4 com suporte nativo a Dark Mode.
- **Componentes:** shadcn/ui (Radix Primitives) + TanStack Data Table v8.
- **Banco de Dados & Autenticação:** Firebase v10 (Firestore Database & Google OAuth).
- **Roteamento de Borda:** Next.js Edge Proxy (`proxy.ts`).

## 🛠️ Arquitetura de Redirecionamento

O redirecionamento é interceptado em nível de CDN através do arquivo `src/proxy.ts`, que dispara chamadas assíncronas para a API Route `/api/validate/[slug]`. Isso garante que links protegidos por senha, expirados por data ou limite de cliques sejam validados em milissegundos antes do carregamento da árvore de renderização do cliente.
