// src/app/layout.tsx
import type { Metadata } from "next";
import { Poppins, Tenor_Sans, Space_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

// Inicialização das fontes oficiais do Grupo ITC Brasil (PRD v1.0)
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

const tenorSans = Tenor_Sans({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-display",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "itcbr.xyz — Encurtador de Links",
  description: "Painel Interno de Gerenciamento de Links — Grupo ITC Brasil",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        poppins.variable,
        tenorSans.variable,
        spaceMono.variable,
      )}
    >
      {/* bg-hero-grid aplica a textura milimetrada sutil configurada no globals.css */}
      <body className="min-h-full flex flex-col bg-hero-grid text-foreground transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}

          {/* Container global de toasts flutuantes da aplicação */}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
