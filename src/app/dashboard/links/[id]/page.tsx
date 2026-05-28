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
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EditLinkForm } from "@/components/edit-link-form";
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  QrCode as QrIcon,
  BarChart3,
  Link2,
  Edit,
  Activity,
  MapPin,
  Smartphone,
  Sliders,
  History,
  Calendar,
  User,
  Lock,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

// Utilitário de auditoria imutável
import { registerLog } from "@/lib/audit";

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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LinkDetail {
  id: string;
  slug: string;
  originalUrl: string;
  title: string;
  clickCount: number;
  isActive: boolean;
  createdAt: Timestamp | string | null;
  updatedAt?: Timestamp | string | null;
  expiresAt?: Timestamp | string | null;
  maxClicks?: number | string;
  passwordHash?: string;
  createdByName?: string;
  updatedByName?: string;

  // Metadados de categoria desnormalizados (v1.1)
  categoryId?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
}

interface ChartDataPoint {
  date: string;
  cliques: number;
}

interface CityDataPoint {
  name: string;
  cliques: number;
}

interface DeviceDataPoint {
  name: string;
  value: number;
}

function formatarDataSegura(
  dateValue: Timestamp | string | null | undefined,
): string {
  if (!dateValue) return "Não definida";
  try {
    if (dateValue && typeof (dateValue as Timestamp).toDate === "function") {
      return (dateValue as Timestamp).toDate().toLocaleString("pt-BR");
    }
    if (dateValue instanceof Date) {
      return dateValue.toLocaleString("pt-BR");
    }
    const parsedDate = new Date(dateValue as string);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toLocaleString("pt-BR");
    }
  } catch (error) {
    console.error("Erro ao formatar data:", error);
  }
  return "Data inválida";
}

export default function LinkDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);

  const [linkData, setLinkData] = useState<LinkDetail | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  // Estados do Analytics
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [topCities, setTopCities] = useState<CityDataPoint[]>([]);
  const [deviceData, setDeviceData] = useState<DeviceDataPoint[]>([]);

  const cardHoverClass =
    "transition-all duration-300 hover:shadow-md hover:border-itc-ciano/30 hover:-translate-y-0.5";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }

      try {
        const docRef = doc(db, "links", resolvedParams.id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          toast.error("O link solicitado não foi encontrado.");
          router.push("/dashboard");
          return;
        }

        const data = docSnap.data();
        setLinkData({ id: docSnap.id, ...data } as LinkDetail);

        const clicksRef = collection(db, "links", resolvedParams.id, "clicks");
        const clicksSnap = await getDocs(clicksRef);

        const groupedDates: Record<string, number> = {};
        const groupedCities: Record<string, number> = {};
        let mobileCount = 0;
        let desktopCount = 0;

        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = format(d, "dd/MM", { locale: ptBR });
          groupedDates[dateStr] = 0;
        }

        clicksSnap.forEach((doc) => {
          const clickData = doc.data();

          const rawTimestamp = clickData.timestamp || clickData.clickedAt;
          if (rawTimestamp) {
            let dateObj: Date;
            if (typeof rawTimestamp.toDate === "function") {
              dateObj = rawTimestamp.toDate();
            } else {
              dateObj = new Date(rawTimestamp);
            }

            if (!isNaN(dateObj.getTime())) {
              const dateStr = format(dateObj, "dd/MM", { locale: ptBR });
              groupedDates[dateStr] = (groupedDates[dateStr] || 0) + 1;
            }
          }

          let rawCity = clickData.city || clickData.City || "Não identificada";
          try {
            rawCity = decodeURIComponent(rawCity);
          } catch {
            // fallback
          }

          if (!rawCity || rawCity === "null" || rawCity === "undefined") {
            rawCity = "Não identificada";
          }
          // 🔧 Correção: incremento direto sem lógica de chave condicional que causava
          // reclassificação incorreta de cidades com contador ainda zerado (falsy)
          groupedCities[rawCity] = (groupedCities[rawCity] || 0) + 1;

          const ua = clickData.userAgent || "";
          if (
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
              ua,
            )
          ) {
            mobileCount++;
          } else {
            desktopCount++;
          }
        });

        const formattedChart = Object.keys(groupedDates)
          .map((key) => ({
            date: key,
            cliques: groupedDates[key],
          }))
          .sort((a, b) => {
            const [dayA, monthA] = a.date.split("/").map(Number);
            const [dayB, monthB] = b.date.split("/").map(Number);
            return monthA !== monthB ? monthA - monthB : dayA - dayB;
          });
        setChartData(formattedChart);

        const formattedCities = Object.keys(groupedCities)
          .map((key) => ({
            name: key,
            cliques: groupedCities[key],
          }))
          .sort((a, b) => b.cliques - a.cliques)
          .slice(0, 5);
        setTopCities(formattedCities);

        const totalClicksRecorded = mobileCount + desktopCount;
        if (totalClicksRecorded > 0) {
          setDeviceData([
            {
              name: "Dispositivos Móveis",
              value: Math.round((mobileCount / totalClicksRecorded) * 100),
            },
            {
              name: "Computadores/Desktop",
              value: Math.round((desktopCount / totalClicksRecorded) * 100),
            },
          ]);
        } else {
          setDeviceData([]);
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes analíticos:", error);
        toast.error("Falha ao carregar informações de telemetria.");
      }
    });

    return () => unsubscribe();
  }, [router, resolvedParams.id]);

  if (!linkData) return null;

  const shortUrl = `itcbr.xyz/${linkData.slug}`;
  const fullShortUrl = `https://itcbr.xyz/${linkData.slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullShortUrl);
    toast.success("Link encurtador copiado!");
  };

  // 🟢 Download em formato PNG (Rasterizado)
  const handleDownloadQR = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx?.drawImage(img, 0, 0, 300, 300);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `qrcode-${linkData.slug}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
      toast.success("Imagem PNG exportada com sucesso!"); // 🟢 Notificação padronizada inserida aqui
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  // 🟢 NOVO: Download em formato SVG Vetorial (Impressões Grandes/Carretas/Banners)
  const handleDownloadSVG = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement("a");
    downloadLink.download = `qrcode-${linkData.slug}.svg`;
    downloadLink.href = svgUrl;
    downloadLink.click();

    URL.revokeObjectURL(svgUrl);
    toast.success("Vetor SVG exportado para impressões em grande escala!");
  };

  const handleToggleActive = async () => {
    if (isToggling) return;
    setIsToggling(true);
    const newState = !linkData.isActive;

    try {
      const currentUser = auth.currentUser;
      const docRef = doc(db, "links", linkData.id);

      const updatePayload: Record<string, string | boolean | Timestamp> = {
        isActive: newState,
      };
      if (currentUser) {
        updatePayload.updatedBy = currentUser.uid;
        updatePayload.updatedByName = currentUser.displayName || "Colaborador";
        updatePayload.updatedByEmail = currentUser.email || "sistema@itcbr.xyz";
        updatePayload.updatedAt = Timestamp.now();
      }

      await updateDoc(docRef, updatePayload);

      if (currentUser) {
        await registerLog({
          action: "LINK_EDIT",
          performedBy: {
            uid: currentUser.uid,
            name: currentUser.displayName || "Colaborador",
            email: currentUser.email || "sem-email@itcbr.xyz",
          },
          targetId: linkData.slug,
          details: `O link /${linkData.slug} foi ${newState ? "ativado (retomou o tráfego)" : "pausado (tráfego suspenso)"}.`,
          changes: {
            before: {
              status: linkData.isActive
                ? "Operacional (Ativo)"
                : "Suspenso (Pausado)",
            },
            after: {
              status: newState ? "Operacional (Ativo)" : "Suspenso (Pausado)",
            },
          },
        });
      }

      setLinkData({
        ...linkData,
        isActive: newState,
        updatedByName: currentUser?.displayName || "Colaborador",
        updatedAt: Timestamp.now(),
      });

      toast.success(
        `O link foi ${newState ? "ativado" : "suspenso"} com sucesso.`,
      );
    } catch {
      toast.error("Erro operacional ao alterar o status do link.");
    } finally {
      setIsToggling(false);
    }
  };

  const getCategoryBadgeStyle = (hexColor: string) => {
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
      borderColor: `rgba(${r}, ${g}, ${b}, 0.35)`,
      color: hexColor,
    };
  };

  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto w-full font-sans transition-colors duration-300 space-y-6">
      {/* BARRA SUPERIOR DE CONTEXTO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="space-y-1">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="text-muted-foreground gap-2 pl-0 hover:bg-transparent font-sans text-xs w-max"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao Painel Geral
          </Button>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
            Análise do Link Encurtado
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            className="border-border text-foreground text-xs font-sans h-9 gap-1.5"
          >
            <Edit className="h-3.5 w-3.5 text-muted-foreground" /> Modificar
            Link
          </Button>
          <Button
            onClick={handleCopy}
            className="bg-itc-ciano hover:bg-itc-ciano800 text-white text-xs font-sans h-9 gap-1.5 shadow-sm"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar Curto
          </Button>
        </div>
      </div>

      {/* 🔮 INTERFACE COM 3 CARDS PARALELOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* CARD 1: Parametrização Operacional */}
        <Card
          className={`bg-card border-border shadow-sm flex flex-col justify-between h-48 ${cardHoverClass}`}
        >
          <CardHeader className="pb-0 pt-0 h-12 flex items-center border-b border-border/40 shrink-0">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5 font-sans w-full">
              <Sliders className="h-3.5 w-3.5" /> Parametrização Operacional
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div
                className="text-base font-bold text-foreground font-sans break-all line-clamp-1"
                title={linkData.title}
              >
                {linkData.title}
              </div>

              <Badge
                className={`border-none text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  linkData.isActive
                    ? "bg-itc-sucesso/10 text-itc-sucesso"
                    : "bg-itc-erro/10 text-itc-erro"
                }`}
              >
                {linkData.isActive ? "Ativo" : "Pausado"}
              </Badge>

              {linkData.passwordHash && (
                <Badge
                  variant="outline"
                  className="text-amber-500 border-amber-500/30 flex items-center gap-0.5 bg-amber-500/10 text-[10px] px-2.5 py-0.5 uppercase tracking-wider rounded-full"
                >
                  <Lock className="h-2.5 w-2.5" /> Com Senha
                </Badge>
              )}
            </div>

            <div>
              {linkData.categoryName && linkData.categoryColor ? (
                <span
                  style={getCategoryBadgeStyle(linkData.categoryColor)}
                  className="inline-flex items-center text-[10px] font-bold tracking-wide px-2.5 py-0.5 rounded-full border select-none font-sans uppercase"
                >
                  {linkData.categoryName}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border/40 uppercase font-sans">
                  Sem Tag
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: Volume de Tráfego Monumental */}
        <Card
          className={`bg-card border-border shadow-sm flex flex-col justify-between h-48 ${cardHoverClass}`}
        >
          <CardHeader className="pb-0 pt-0 h-12 flex items-center border-b border-border/40 shrink-0">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5 font-sans w-full">
              <Activity className="h-3.5 w-3.5" /> Volume de Tráfego
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center items-start">
            <div className="text-5xl font-extrabold font-sans text-foreground tracking-tighter break-all select-all leading-none">
              {(linkData.clickCount || 0).toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground mt-3 font-sans">
              Cliques redirecionados com sucesso
            </p>
          </CardContent>
        </Card>

        {/* CARD 3: QR Code de Acesso */}
        <Card className="bg-card border-border shadow-sm flex flex-col h-48 transition-all duration-300 hover:shadow-md hover:border-itc-ciano/30 hover:-translate-y-0.5">
          <CardHeader className="pb-0 pt-0 h-12 flex items-center border-b border-border/40 shrink-0">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5 font-sans w-full">
              <QrIcon className="h-3.5 w-3.5" /> QR Code de Acesso
            </CardTitle>
          </CardHeader>

          <CardContent className="grow flex items-center justify-center p-4 h-[calc(100%-3rem)] min-h-0 gap-4">
            {/* Box do QR Code Vetorial */}
            <div className="bg-white p-1.5 rounded-md border border-border/40 shadow-inner flex items-center justify-center h-24 w-24 shrink-0">
              <QRCodeSVG
                id="qr-code-svg"
                value={fullShortUrl}
                size={256}
                level="H"
                fgColor="#000000"
                bgColor="#ffffff"
                className="w-full h-full"
              />
            </div>

            {/* Painel de Downloads */}
            <div className="flex flex-col gap-1.5 justify-center w-full min-w-0">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-0.5">
                Download:
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadQR}
                className="h-7 px-3 text-[11px] font-sans border-border text-foreground gap-1.5 w-full hover:bg-accent"
              >
                <Download className="h-3 w-3 text-muted-foreground" />
                Baixar PNG
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSVG}
                className="h-7 px-3 text-[11px] font-sans border-border text-foreground gap-1.5 w-full hover:bg-accent"
              >
                <Download className="h-3 w-3 text-muted-foreground" />
                Baixar SVG
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CARD HORIZONTAL: itcbr.xyz / Roteamento Padronizado */}
      <Card className={`bg-card border-border shadow-sm ${cardHoverClass}`}>
        <CardHeader className="pb-2 pt-3 border-b border-border/40">
          <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5 font-sans">
            <Link2 className="h-3.5 w-3.5" /> itcbr.xyz / Roteamento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 grid gap-4 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/60">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              Endereço Reduzido
            </span>
            <div className="flex items-center gap-2">
              <a
                href={`https://...`}
                onClick={(e) => {
                  e.preventDefault();
                  handleCopy();
                }}
                className="text-base font-bold text-itc-ciano hover:underline font-sans break-all"
              >
                {shortUrl}
              </a>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>
          </div>

          <div className="space-y-1 pt-3 md:pt-0 md:pl-5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              URL Original de Destino
            </span>
            <div className="flex items-center justify-between gap-2">
              <a
                href={linkData.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-itc-ciano hover:underline font-sans block break-all truncate line-clamp-1 flex-1"
                title={linkData.originalUrl}
              >
                {linkData.originalUrl}
              </a>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO CENTRAL: Gráfico de Tráfego & Cronologia Completa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Gráfico Temporal (2 Colunas) */}
        <Card className="lg:col-span-2 bg-card border-border shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-2 pt-0 h-12 flex items-center border-b border-border/40">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5 font-sans">
              <BarChart3 className="h-4 w-4" /> Curva de Acessos Recentes
              (Últimos 7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-56 pt-4 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 15, left: -25, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  opacity={0.15}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  dy={8}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "8px",
                    color: "var(--foreground)",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cliques"
                  name="Cliques"
                  stroke="#008F95"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, strokeWidth: 1.5, fill: "var(--background)" }}
                  activeDot={{ r: 5, strokeWidth: 0, fill: "#008F95" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cronologia & Auditoria Operacional (1 Coluna) */}
        <Card
          className={`bg-card border-border shadow-sm flex flex-col justify-between ${cardHoverClass}`}
        >
          <CardHeader className="pb-2 pt-0 h-12 flex items-center border-b border-border/40 shrink-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5 font-sans">
              <History className="h-3.5 w-3.5" /> Histórico & Cronologia
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 pb-4 flex-1 flex flex-col justify-center">
            <div className="space-y-4 w-full">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-itc-ciano/10 text-itc-ciano rounded-md mt-0.5 shrink-0">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="space-y-0.5 font-sans min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block tracking-wider">
                    Criação do Link
                  </span>
                  <span className="text-sm font-bold text-foreground block truncate">
                    {linkData.createdByName || "Colaborador"}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 truncate">
                    <Calendar className="h-3 w-3 shrink-0" />{" "}
                    {formatarDataSegura(linkData.createdAt)}
                  </span>
                </div>
              </div>

              {linkData.updatedByName && (
                <div className="flex items-start gap-3 border-t border-border/40 pt-3">
                  <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-md mt-0.5 shrink-0">
                    <Edit className="h-3.5 w-3.5" />
                  </div>
                  <div className="space-y-0.5 font-sans min-w-0">
                    <span className="text-[10px] text-amber-500 uppercase font-medium block tracking-wider">
                      Última Modificação
                    </span>
                    <span className="text-sm font-bold text-foreground block truncate">
                      {linkData.updatedByName}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-0.5 truncate">
                      <Calendar className="h-3 w-3 shrink-0" />{" "}
                      {linkData.updatedAt
                        ? formatarDataSegura(linkData.updatedAt)
                        : "Alterações recentes"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GRID INFERIOR: Telemetria Geográfica, Dispositivos e Controles Operacionais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* status / Controle de Fluxo */}
        <Card
          className={`lg:col-span-1 bg-card border-border shadow-sm flex flex-col justify-between ${cardHoverClass}`}
        >
          <CardHeader className="pb-3 pt-0 h-12 flex items-center border-b border-border/40">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5 font-sans">
              <Sliders className="h-3.5 w-3.5" /> status / Controle de Fluxo
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 pb-5 flex-1 flex flex-col justify-center">
            <div className="flex flex-col gap-3 w-full">
              <Button
                variant={linkData.isActive ? "destructive" : "default"}
                onClick={handleToggleActive}
                disabled={isToggling}
                className="font-sans text-xs h-9 w-full shadow-sm flex items-center justify-center gap-2"
              >
                {isToggling ? (
                  "Processando..."
                ) : linkData.isActive ? (
                  <>
                    <PauseCircle className="h-4 w-4" /> Suspender
                    Redirecionamento (Pausar)
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4" /> Ativar Redirecionamento
                    (Retomar)
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center font-sans">
                Pausar o link redirecionará os visitantes temporariamente para
                uma tela de aviso interna da ITC Brasil.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Localização Geográfica */}
        <Card
          className={`bg-card border-border shadow-sm flex flex-col h-full overflow-hidden ${cardHoverClass}`}
        >
          <CardHeader className="pb-3 pt-0 h-12 flex items-center border-b border-border/40">
            <CardTitle className="text-xs font-bold font-sans flex items-center gap-1.5 uppercase tracking-wider text-itc-ciano">
              <MapPin className="h-3.5 w-3.5" /> Localização (Top Cidades)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pt-4 pb-4">
            {topCities.length > 0 ? (
              <div className="space-y-2.5">
                {topCities.map((city, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between font-sans"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-3">
                        {index + 1}.
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        {city.name}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-accent/40 text-muted-foreground text-[10px] font-bold px-1.5 h-5 border border-border/30"
                    >
                      {city.cliques} {city.cliques === 1 ? "clique" : "cliques"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground font-sans italic py-2">
                Nenhuma telemetria de geolocalização detectada.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Plataforma de Acesso */}
        <Card
          className={`bg-card border-border shadow-sm flex flex-col h-full justify-between ${cardHoverClass}`}
        >
          <CardHeader className="pb-3 pt-0 h-12 flex items-center border-b border-border/40">
            <CardTitle className="text-xs font-bold font-sans flex items-center gap-1.5 uppercase tracking-wider text-itc-ciano">
              <Smartphone className="h-3.5 w-3.5" /> Plataforma de Acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center space-y-3.5 pt-4 pb-4">
            {deviceData.length > 0 ? (
              deviceData.map((device, index) => (
                <div key={index} className="space-y-1 font-sans">
                  <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                    <span>{device.name}</span>
                    <span className="font-bold text-foreground">
                      {device.value}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden border border-border/20">
                    <div
                      className="h-full bg-itc-ciano transition-all duration-500 rounded-full"
                      style={{ width: `${device.value}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground font-sans italic py-2">
                Aguardando tráfego de dispositivos.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MODAL DE EDIÇÃO */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-card border-border max-w-md w-full">
          <DialogTitle className="text-sm font-bold font-sans uppercase text-muted-foreground tracking-wider">
            Modificar Parâmetros do Link
          </DialogTitle>
          <div className="pt-2">
            <EditLinkForm
              linkId={linkData.id}
              onSuccess={() => {
                setIsEditOpen(false);
                window.location.reload();
              }}
              onCancel={() => setIsEditOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
