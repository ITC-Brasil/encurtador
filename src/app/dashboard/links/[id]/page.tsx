// src/app/dashboard/links/[id]/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  Edit,
  Activity,
  Smartphone,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import { ModeToggle } from "@/components/mode-toggle";
import { QRCodeSVG } from "qrcode.react";

// Importações do Recharts
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface LinkData {
  title: string;
  originalUrl: string;
  slug: string;
  userId: string;
  clickCount: number;
  maxClicks?: number | string;
  passwordHash?: string | null;
  createdAt: Timestamp | string | null; // <-- Removido 'any'
  expiresAt?: Timestamp | string | null; // <-- Removido 'any'
}

interface ClickLog {
  clickedAt: Timestamp | string | null; // <-- Removido 'any'
  userAgent: string;
  ip?: string;
  referrer?: string;
}

interface ChartPoint {
  name: string;
  "Cliques Coletados": number;
}

interface DevicePoint {
  name: string;
  value: number;
}

// Helper seguro para formatar Timestamps do Firestore, Strings ISO ou instâncias de Date
function formatarDataSegura(
  dateValue: Timestamp | string | null | undefined,
): string {
  if (!dateValue) return "Não definida";

  try {
    // Se for um Timestamp nativo do Firestore (.toDate existe)
    if (dateValue && typeof (dateValue as Timestamp).toDate === "function") {
      return (dateValue as Timestamp).toDate().toLocaleString("pt-BR");
    }
    // Se já for uma instância de Date
    if (dateValue instanceof Date) {
      return dateValue.toLocaleString("pt-BR");
    }
    // Se for string (ex: ISOString de cadastros antigos) ou número epoch
    const parsedDate = new Date(dateValue as string);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toLocaleString("pt-BR");
    }
  } catch (error) {
    console.error("Erro ao formatar data de forma segura:", error);
  }

  return "Data inválida";
}

export default function LinkDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id: linkId } = use(params);

  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<LinkData | null>(null);
  const [clickLogs, setClickLogs] = useState<ClickLog[]>([]);

  // Estados dos gráficos/estatísticas processadas com tipagem explícita (Removido 'any[]')
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [deviceData, setDeviceData] = useState<DevicePoint[]>([]);

  const cardHoverClass =
    "transition-all duration-300 hover:shadow-md hover:border-itc-ciano/30";

  // MUDANÇA ARQUITETURAL: Movendo funções auxiliares para cima do useEffect para evitar erros de ciclo de vida e mutabilidade
  const processChartData = (logs: ClickLog[]) => {
    const tracking: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      tracking[
        d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
      ] = 0;
    }

    logs.forEach((log) => {
      if (!log.clickedAt) return;
      let dateObj: Date;
      if (typeof (log.clickedAt as Timestamp).toDate === "function") {
        dateObj = (log.clickedAt as Timestamp).toDate();
      } else {
        dateObj = new Date(log.clickedAt as string);
      }
      const key = dateObj.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      if (tracking[key] !== undefined) {
        tracking[key]++;
      }
    });

    const formatted: ChartPoint[] = Object.keys(tracking).map((key) => ({
      name: key,
      "Cliques Coletados": tracking[key],
    }));
    setChartData(formatted);
  };

  const processDeviceData = (logs: ClickLog[]) => {
    let mobile = 0;
    let desktop = 0;

    logs.forEach((log) => {
      const ua = (log.userAgent || "").toLowerCase();
      if (
        ua.includes("mobi") ||
        ua.includes("android") ||
        ua.includes("iphone")
      ) {
        mobile++;
      } else {
        desktop++;
      }
    });

    const total = mobile + desktop || 1;
    const formatted: DevicePoint[] = [
      {
        name: "Dispositivos Móveis",
        value: Math.round((mobile / total) * 100),
      },
      {
        name: "Computadores/Desktop",
        value: Math.round((desktop / total) * 100),
      },
    ];
    setDeviceData(formatted);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const linkDocRef = doc(db, "links", linkId);
        const linkSnapshot = await getDoc(linkDocRef);

        if (!linkSnapshot.exists()) {
          toast.error("O link solicitado não existe no sistema.");
          router.push("/dashboard");
          return;
        }

        const data = linkSnapshot.data() as LinkData;
        setLink(data);

        const logsRef = collection(db, "links", linkId, "clicks");
        const logsQuery = query(logsRef, orderBy("clickedAt", "desc"));
        const logsSnapshot = await getDocs(logsQuery);

        const logs = logsSnapshot.docs.map((d) => d.data() as ClickLog);
        setClickLogs(logs);

        processChartData(logs);
        processDeviceData(logs);
      } catch (err: unknown) {
        console.error(err);
        toast.error("Erro de conexão ao ler os metadados do link.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [linkId, router]);

  const handleCopy = () => {
    if (!link) return;
    const shortUrl = `https://itcbr.xyz/${link.slug}`;
    navigator.clipboard.writeText(shortUrl);
    toast.success(
      "Link encurtado copiado com https:// para a área de transferência!",
    );
  };

  const handleToggleActive = async () => {
    if (!link) return;
    try {
      const linkDocRef = doc(db, "links", linkId);
      await updateDoc(linkDocRef, {
        maxClicks: "",
        expiresAt: null,
      });
      toast.success("Limitações limpas. O link está ativo novamente!");
      window.location.reload();
    } catch {
      toast.error("Erro ao alterar parâmetros do link.");
    }
  };

  const downloadQRCode = () => {
    const svg = document.getElementById("itc-qr-code");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `qrcode-${link?.slug || "link"}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center font-sans font-medium text-sm text-muted-foreground bg-background">
        Buscando telemetria e análise do link curto...
      </div>
    );
  }

  if (!link) return null;

  const isExpired = link.expiresAt
    ? (typeof (link.expiresAt as Timestamp).toDate === "function"
        ? (link.expiresAt as Timestamp).toDate()
        : new Date(link.expiresAt as string)) < new Date()
    : false;

  const hasReachedMaxClicks =
    link.maxClicks && Number(link.maxClicks) > 0
      ? link.clickCount >= Number(link.maxClicks)
      : false;

  const isLinkActive = !isExpired && !hasReachedMaxClicks;

  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto w-full font-sans transition-colors duration-300 space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          className="text-muted-foreground gap-2 pl-0 hover:bg-transparent text-xs"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao Console
        </Button>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button
            onClick={() => router.push(`/dashboard/links/${linkId}/edit`)}
            size="sm"
            variant="outline"
            className="border-border text-xs gap-1.5 h-8 font-sans"
          >
            <Edit className="h-3.5 w-3.5 text-itc-ciano" /> Modificar
            Configurações
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground font-sans break-all">
            {link.title || "Link Sem Título"}
          </h1>
          <Badge
            className={`border-none text-[10px] font-bold px-2 py-0.5 rounded ${
              isLinkActive
                ? "bg-itc-sucesso/10 text-itc-sucesso"
                : "bg-itc-erro/10 text-itc-erro"
            }`}
          >
            {isLinkActive
              ? "Ativo e Redirecionando"
              : "Link Bloqueado / Inativo"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground font-sans">
          Mapeamento analítico e auditoria de tráfego para campanhas da ITC
          Brasil.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className={`bg-card border-border shadow-sm ${cardHoverClass}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold font-sans flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                <Link2 className="h-3.5 w-3.5 text-itc-ciano" /> URLs de
                Roteamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 font-sans">
              <div className="p-3 bg-muted/40 rounded-lg border border-border/60 flex items-center justify-between gap-4">
                <div className="space-y-0.5 overflow-hidden">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                    Link Encurtador ITC
                  </span>
                  <p className="text-sm font-semibold text-itc-ciano truncate font-mono select-all">
                    itcbr.xyz/{link.slug}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCopy}
                    className="h-8 w-8 hover:bg-itc-ciano/10 hover:text-itc-ciano text-muted-foreground"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      window.open(`https://itcbr.xyz/${link.slug}`, "_blank")
                    }
                    className="h-8 w-8 hover:bg-itc-ciano/10 hover:text-itc-ciano text-muted-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                  Destino Original de Redirecionamento
                </span>
                <p className="text-xs text-foreground/80 bg-muted/20 p-2.5 rounded border border-border/40 font-mono break-all select-all">
                  {link.originalUrl}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-card border-border shadow-sm ${cardHoverClass}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold font-sans flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5 text-itc-ciano" /> Histórico
                de Acessos Recentes
              </CardTitle>
              <CardDescription className="text-xs font-sans">
                Acessos distribuídos ao longo dos últimos 7 dias de veiculação
                ativa.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 h-64 font-sans">
              {clickLogs.length === 0 ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-xs text-muted-foreground font-medium">
                  Nenhum clique registrado para este link curto até o momento.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      opacity={0.5}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="var(--muted-foreground)"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={10}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        fontSize: 12,
                        borderRadius: 6,
                        fontFamily: "sans-serif",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Cliques Coletados"
                      stroke="#00E5FF"
                      strokeWidth={2.5}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            className={`bg-card border-border shadow-sm flex flex-col ${cardHoverClass}`}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold font-sans flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                <QrIcon className="h-3.5 w-3.5 text-itc-ciano" /> QR Code
                Impresso / Mídia Offline
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-1 pb-6 space-y-4 font-sans">
              <div className="p-4 bg-white rounded-xl shadow-inner border border-muted/60">
                <QRCodeSVG
                  id="itc-qr-code"
                  value={`https://itcbr.xyz/${link.slug}`}
                  size={140}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={downloadQRCode}
                className="w-full text-xs gap-1.5 h-8 border-border"
              >
                <Download className="h-3.5 w-3.5" /> Baixar Imagem PNG (High
                Quality)
              </Button>
            </CardContent>
          </Card>

          <Card className={`bg-card border-border shadow-sm ${cardHoverClass}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold font-sans flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                <Sliders className="h-3.5 w-3.5 text-itc-ciano" /> Regras Ativas
                & Auditoria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 font-sans text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                  Cliques Acumulados
                </span>
                <span className="font-bold text-foreground text-sm bg-muted/60 px-2 py-0.5 rounded font-mono">
                  {link.clickCount || 0}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                  Limite de Cliques
                </span>
                <span className="font-semibold text-foreground">
                  {link.maxClicks && Number(link.maxClicks) > 0
                    ? `${link.maxClicks} cliques`
                    : "Sem limite"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Data
                  de Criação
                </span>
                <span className="font-medium text-foreground">
                  {formatarDataSegura(link.createdAt)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Data
                  de Expiração
                </span>
                <span
                  className={`font-medium ${isExpired ? "text-itc-erro font-bold" : "text-foreground"}`}
                >
                  {formatarDataSegura(link.expiresAt)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                  Proteção de Acesso
                </span>
                <Badge
                  className={`border-none text-[9px] font-bold rounded px-1.5 py-0.5 ${
                    link.passwordHash
                      ? "bg-amber-500/10 text-amber-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {link.passwordHash
                    ? "Requer Senha (Hash Ativo)"
                    : "Acesso Aberto"}
                </Badge>
              </div>

              {!isLinkActive && (
                <div className="pt-2">
                  <Button
                    onClick={handleToggleActive}
                    className="w-full bg-itc-ciano hover:bg-itc-ciano800 text-white text-xs font-semibold h-8"
                  >
                    Forçar Reativação do Link
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {clickLogs.length > 0 && (
            <Card
              className={`bg-card border-border shadow-sm flex flex-col ${cardHoverClass}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold font-sans flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                  <Smartphone className="h-3.5 w-3.5 text-itc-ciano" />{" "}
                  Plataforma de Acesso
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 pb-4 flex flex-col justify-center flex-1 space-y-3">
                {deviceData.map((device, index) => (
                  <div key={index} className="space-y-1 font-sans">
                    <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                      <span>{device.name}</span>
                      <span className="font-bold text-foreground">
                        {device.value}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-itc-ciano transition-all duration-500 rounded-full"
                        style={{ width: `${device.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
