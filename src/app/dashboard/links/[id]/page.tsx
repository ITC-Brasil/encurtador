// src/app/dashboard/links/[id]/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  QrCode as QrIcon,
  BarChart3,
  Clock,
  Link2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { ModeToggle } from "@/components/mode-toggle";
import { QRCodeSVG } from "qrcode.react";

interface LinkDetail {
  id: string;
  slug: string;
  originalUrl: string;
  title: string;
  clickCount: number;
  isActive: boolean;
  createdAt: any;
  expiresAt?: any;
  maxClicks?: number;
  passwordHash?: string;
}

export default function LinkDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [loading, setLoading] = useState(true);
  const [linkData, setLinkData] = useState<LinkDetail | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }

      try {
        const docRef = doc(db, "links", resolvedParams.id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setLinkData({ id: docSnap.id, ...data } as LinkDetail);
        } else {
          toast.error("Link não encontrado.");
          router.push("/dashboard");
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes:", error);
        toast.error("Falha ao carregar informações do banco de dados.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, resolvedParams.id]);

  const shortUrl = linkData ? `itcbr.xyz/${linkData.slug}` : "";
  const fullShortUrl = `http://localhost:3000/${linkData?.slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl);
    toast.success("Link copiado para a área de transferência!");
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = `qrcode-${linkData?.slug}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleToggleActive = async () => {
    if (!linkData) return;

    const newState = !linkData.isActive;
    try {
      const docRef = doc(db, "links", linkData.id);
      await updateDoc(docRef, { isActive: newState });

      setLinkData({ ...linkData, isActive: newState });
      toast.success(
        `O link foi ${newState ? "ativado" : "desativado"} com sucesso.`,
      );
    } catch (error) {
      toast.error("Erro ao alterar o status do link.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center font-sans text-muted-foreground bg-background">
        Carregando detalhes...
      </div>
    );
  }

  if (!linkData) return null;

  return (
    <div className="flex-1 p-8 max-w-5xl mx-auto w-full font-sans transition-colors duration-300 space-y-6">
      {/* Header de Navegação */}
      <div className="flex items-center justify-between border-b border-border pb-5">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          className="text-muted-foreground hover:text-foreground gap-2 pl-0 hover:bg-transparent font-sans"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
        </Button>
        <ModeToggle />
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Coluna Esquerda: Informações Principais */}
        <div className="flex-1 space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-display">
              {linkData.title}
            </h1>
            <div className="flex items-center gap-3">
              <Badge
                variant={linkData.isActive ? "default" : "destructive"}
                className={
                  linkData.isActive
                    ? "bg-itc-sucesso/10 text-itc-sucesso hover:bg-itc-sucesso/20 border-none"
                    : "bg-itc-erro/10 text-itc-erro hover:bg-itc-erro/20 border-none"
                }
              >
                {linkData.isActive ? "Ativo" : "Desativado Manualmente"}
              </Badge>
              {linkData.passwordHash && (
                <Badge
                  variant="outline"
                  className="text-itc-atencao border-itc-atencao/50 flex items-center gap-1"
                >
                  <ShieldAlert className="h-3 w-3" /> Protegido
                </Badge>
              )}
            </div>
          </div>

          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground font-sans uppercase tracking-wider">
                Destino Original
              </CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={linkData.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg text-foreground font-sans hover:text-itc-ciano flex items-center gap-2 break-all"
              >
                {linkData.originalUrl}
                <ExternalLink className="h-4 w-4 shrink-0" />
              </a>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground font-sans">
                  Cliques Acumulados
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-itc-ciano" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-sans text-foreground">
                  {linkData.clickCount}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground font-sans">
                  Criado em
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-medium font-sans text-foreground">
                  {linkData.createdAt?.toDate
                    ? new Intl.DateTimeFormat("pt-BR").format(
                        linkData.createdAt.toDate(),
                      )
                    : "Data indisponível"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ações Administrativas */}
          <Card className="bg-card border-border shadow-sm border-l-4 border-l-itc-ciano">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground font-sans">
                  Controle de Acesso
                </p>
                <p className="text-xs text-muted-foreground font-sans">
                  Pausar ou reativar redirecionamento temporariamente.
                </p>
              </div>
              <Button
                variant={linkData.isActive ? "destructive" : "default"}
                onClick={handleToggleActive}
                className="font-sans"
              >
                {linkData.isActive ? "Desativar Link" : "Reativar Link"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita: QR Code Simples (Sem Logo) */}
        <div className="w-full md:w-80 space-y-6">
          <Card className="bg-card border-border shadow-sm overflow-hidden">
            <div className="bg-itc-ciano/5 border-b border-border p-4 text-center">
              <QrIcon className="h-6 w-6 text-itc-ciano mx-auto mb-2" />
              <h3 className="font-semibold text-foreground font-sans">
                QR Code Corporativo
              </h3>
            </div>
            <CardContent className="p-6 flex flex-col items-center justify-center space-y-6">
              <div className="bg-white p-4 rounded-xl shadow-inner border border-border">
                {/* QR Code Simples e Limpo sem imageSettings */}
                <QRCodeSVG
                  id="qr-code-svg"
                  value={fullShortUrl}
                  size={180}
                  level="H"
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>

              <div className="w-full space-y-3">
                <div className="flex items-center gap-2 p-2 rounded bg-muted/50 border border-border">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-mono text-foreground truncate flex-1">
                    {shortUrl}
                  </span>
                </div>

                <div className="flex gap-2 w-full">
                  <Button
                    onClick={handleCopy}
                    variant="default"
                    className="flex-1 gap-2 bg-itc-ciano hover:bg-itc-ciano800 font-sans shadow-sm"
                  >
                    <Copy className="h-4 w-4" /> Copiar
                  </Button>
                  <Button
                    onClick={handleDownloadQR}
                    variant="outline"
                    className="flex-1 gap-2 font-sans border-border"
                  >
                    <Download className="h-4 w-4" /> Baixar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
