# Encurtador de URLs Corporativo — ITC Brasil v2.0

Sistema enterprise de encurtamento de links, rastreamento de acessos e inteligência de dados voltado para materiais operacionais, carretas (ex: Qualifica DF) e campanhas estratégicas do **Grupo ITC Brasil**.

A aplicação centraliza toda a inteligência de tráfego sob o domínio institucional `itcbr.xyz`, oferecendo uma experiência unificada e em tempo real para administradores e colaboradores.

---

## 🚀 Demonstração da Interface Unificada

O ecossistema foi projetado com foco em máxima eficiência operacional (UX) e conformidade estrita com as regras de build do Next.js e ESLint.

- **Painel de Controle Centralizado:** Métricas globais agregadas e controle absoluto do tráfego.
- **Modal Interativo Enterprise:** Criação instantânea de encurtadores com regras complexas de governança direto na visão principal.
- **Tabela de Dados Inteligente:** Listagem avançada com ações em lote e manipulação imediata de links.

---

## 🛠️ Stack Tecnológica & Ecossistema

O projeto utiliza o estado da arte do ecossistema React e Next.js para entregar performance serverless estável e segura:

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Client Components e API Routes).
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/) (Tipagem estrita, livre de poluição por tipo `any`).
- **Banco de Dados & Auth:** [Firebase Suite](https://firebase.google.com/) (Firestore Client SDK + Firebase Auth).
- **Infraestrutura Serverless:** [Firebase Admin SDK](https://firebase.google.com/docs/admin) (Controle seguro em rotas backend).
- **Design System & UI:** [Shadcn UI](https://ui.shadcn.com/) baseado em [Tailwind CSS](https://tailwindcss.com/).
- **Gerenciamento de Tabelas:** [TanStack Table v8](https://tanstack.com/table/v8) (Manipulação massiva de estados e paginação).
- **Visualização de Dados:** [Recharts](https://recharts.org/) (Gráficos responsivos de séries temporais).
- **Utilitários:** `lucide-react` (Ícones), `sonner` (Notificações Toast), `qrcode.react` (Geração de QR Codes vetoriais).

---

## 🎯 Recursos e Funcionalidades Principais

### 1. Dashboard de Controle Centralizado (`/dashboard`)

- **Métricas em Tempo Real:** Sincronização direta via client-side Firestore para exibição do Total de Links, Cliques Acumulados globais e Links Ativos em tempo real.
- **Ações Avançadas de Layout:** Cards com micro-interações de movimento e efeitos premium de hover sutil (`border-itc-ciano/40`).

### 2. Modal Integrado de Criação Rápida (`Dialog`)

O fluxo de criação foi unificado em um componente de diálogo sobreposto, eliminando redirecionamentos lentos de página e mantendo o contexto do operador:

- **Campos Avançados:**
  - _Identificação Interna:_ Título descritivo do material ou campanha.
  - _URL de Destino:_ Validação estrita de protocolos corporativos (`http://` ou `https://`).
  - _Slug Customizável:_ Máscara higienizada automaticamente contra caracteres inválidos. Geração automática de hash aleatório de 6 caracteres caso mantido em branco.
  - _Regras de Expiração:_ Bloqueio por data/hora limite via inputs temporais.
  - _Limite de Volumetria:_ Teto máximo de cliques aceitos antes da invalidação automática do link.
  - _Camada de Proteção:_ Injeção de senhas de acesso para blindar materiais confidenciais ou restritos.

### 3. Tabela Dinâmica Corporativa (`TanStack Table`)

- **Controles de Grid:** Paginação nativa, ordenação reativa por volume de cliques e seleção múltipla por caixas de checagem.
- **Botão Copiar Cirúrgico:** Injeção de botão de cópia rápida na coluna do link encurtado, copiando o endereço formatado (`itcbr.xyz/slug`) para a área de transferência com retorno em toast instantâneo.
- **Ações em Massa:** Exclusão segura em lote de múltiplos registros com confirmação em tela e limpeza em cascata no banco de dados.

### 4. Inteligência e Analytics de Links (`/dashboard/links/[id]`)

Ao acessar os detalhes de um encurtador específico, o sistema monta um panorama de inteligência de tráfego:

- **Histórico de Evolução:** Gráficos de linhas responsivos com agrupamento temporal diário de acessos.
- **Geolocalização:** Mapeamento dinâmico das Top Cidades de origem dos cliques.
- **Plataforma de Acesso:** Gráficos percentuais de distribuição de tráfego entre dispositivos móveis (Celular) e computadores (Desktop).
- **QR Code Dinâmico:** Renderização vetorial instantânea do link gerado com suporte para download direto em formato PNG de alta resolução para uso em materiais impressos ou frotas de carretas.

### 5. Gestão Segura de Equipe (`/api/usuarios`)

Endpoint administrativo centralizado construído com Firebase Admin SDK para automação de governança interna:

- `GET`: Lista todos os usuários registrados cruzando instâncias do banco de dados.
- `POST`: Cria novos colaboradores simultaneamente no Firebase Authentication e injeta os metadados na coleção customizada de usuários do Firestore.
- `PUT`: Atualiza cargos e manipula o status de acesso do usuário (Sincronização reativa: ao marcar um usuário como **Suspenso**, o Auth Engine desabilita a conta imediatamente, impedindo logins ativos).
- `DELETE`: Remove instâncias do usuário de maneira limpa em cascata de ambos os ambientes do Firebase.

---

## 🔒 Governança e Blindagem de Infraestrutura

Para garantir estabilidade contínua no ecossistema serverless da **Vercel**, a camada de conexão com o banco de dados foi blindada no arquivo `src/lib/firebase-admin.ts`:

1.  **Prevenção de Inicializações Duplicadas:** Implementação da checagem estrutural `if (!admin.apps.length)` para neutralizar quebras causadas pelo mecanismo de _Fast Refresh_ do Next.js em ambiente de desenvolvimento e builds de produção.
2.  **Seguro contra Erros de Sintaxe da Chave Privada:** Tratamento automático de quebras de linha invisíveis em chaves criptográficas exportadas via painéis de variáveis de ambiente do provedor através do método `.replace(/\\\\n/g, "\\n")`.

---

## ⚙️ Configuração das Variáveis de Ambiente (`.env`)

Para o correto funcionamento do ecossistema, certifique-se de que as chaves abaixo estejam configuradas tanto no seu arquivo `.env.local` quanto no painel de **Environment Variables** do projeto na Vercel:

# --- FIREBASE CLIENT CONFIG (DASHBOARD & AUTH FRONT-END) ---

NEXT_PUBLIC_FIREBASE_API_KEY=seu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=seu_app_id

# --- FIREBASE ADMIN SDK CONFIG (ROTAS DE API INTERNAS / BACKEND) ---

FIREBASE_PROJECT_ID=seu_project_id
FIREBASE_CLIENT_EMAIL=seu_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nSuaChaveAqui...\\n-----END PRIVATE KEY-----\"
