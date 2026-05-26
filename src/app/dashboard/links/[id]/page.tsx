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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  Clock,
  Link2,
  ShieldAlert,
  Edit,
  Activity,
  MapPin,
  Smartphone,
  Sliders,
  Tag,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
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
  expiresAt?: Timestamp | string | null;
  maxClicks?: number | string;
  passwordHash?: string;
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

  const [loading, setLoading] = useState(true);
  const [linkData, setLinkData] = useState<LinkDetail | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

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
            // Mantém a string bruta caso falhe o parse
          }

          if (!rawCity || rawCity === "null" || rawCity === "undefined") {
            rawCity = "Não identificada";
          }
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
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, resolvedParams.id]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center font-sans text-xs font-medium text-muted-foreground bg-background">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-itc-ciano" />
          <span>Buscando inteligência e mapas de tráfego corporativo...</span>
        </div>
      </div>
    );
  }

  if (!linkData) return null;

  const shortUrl = `itcbr.xyz/${linkData.slug}`;
  const fullShortUrl = `https://itcbr.xyz/${linkData.slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullShortUrl);
    toast.success("Link encurtador copiado para a área de transferência!");
  };

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
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleToggleActive = async () => {
    const newState = !linkData.isActive;
    try {
      const docRef = doc(db, "links", linkData.id);
      await updateDoc(docRef, { isActive: newState });
      setLinkData({ ...linkData, isActive: newState });
      toast.success(
        `O link foi ${newState ? "ativado" : "suspenso"} com sucesso.`,
      );
    } catch {
      toast.error("Erro operacional ao alterar o status do link.");
    }
  };

  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto w-full font-sans transition-colors duration-300 space-y-4">
      <Button
        variant="ghost"
        onClick={() => router.push("/dashboard")}
        className="text-muted-foreground gap-2 pl-0 hover:bg-transparent font-sans text-xs w-max mb-2"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
      </Button>

      <Card className={`bg-card border-border shadow-sm ${cardHoverClass}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-itc-ciano" /> Título do Link
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans break-all">
              {linkData.title || "Link Sem Título"}
            </h1>
            <div className="flex items-center gap-2 pt-1">
              <Badge
                className={`border-none text-[10px] font-bold px-2.5 py-0.5 rounded ${
                  linkData.isActive
                    ? "bg-itc-sucesso/10 text-itc-sucesso"
                    : "bg-itc-erro/10 text-itc-erro"
                }`}
              >
                {linkData.isActive ? "Ativo" : "Desativado"}
              </Badge>
              {linkData.passwordHash && (
                <Badge
                  variant="outline"
                  className="text-amber-500 border-amber-500/30 flex items-center gap-1 bg-amber-500/10 text-[10px] px-2 py-0.5"
                >
                  <ShieldAlert className="h-3 w-3" /> Protegido por Senha
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* ================= COLUNA ESQUERDA ================= */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* TRAVA GEOMÉTRICA 1: Altura fixa h-28 */}
          <Card
            className={`bg-card border-border shadow-sm flex flex-col shrink-0 h-28 ${cardHoverClass}`}
          >
            <CardHeader className="pb-0 pt-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-itc-ciano" /> Destino
                Original
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center pb-4">
              <div className="flex items-center gap-1.5 w-full">
                <a
                  href={linkData.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-foreground font-sans hover:text-itc-ciano font-medium truncate flex-1 min-w-0"
                  title={linkData.originalUrl}
                >
                  {linkData.originalUrl}
                </a>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={`bg-card border-border shadow-sm flex flex-col shrink-0 ${cardHoverClass}`}
          >
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-itc-ciano" /> Controle do
                Link
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center space-y-3 pb-4">
              <p className="text-xs text-muted-foreground font-sans">
                Modifique os parâmetros operacionais.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditOpen(true)}
                  className="w-full gap-2 font-sans border-border text-xs h-8"
                >
                  <Edit className="h-3.5 w-3.5 text-itc-ciano" /> Editar Configs
                </Button>
                <Button
                  variant={linkData.isActive ? "destructive" : "default"}
                  onClick={handleToggleActive}
                  className="font-sans text-xs h-8"
                >
                  {linkData.isActive ? "Pausar Link" : "Ativar Link"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`bg-card border-border shadow-sm flex flex-col flex-1 ${cardHoverClass}`}
          >
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <QrIcon className="h-3.5 w-3.5 text-itc-ciano" /> QR Code
                Corporativo
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center pb-6 px-6">
              <div className="bg-white p-3 rounded-xl shadow-inner border border-border mt-2">
                <QRCodeSVG
                  id="qr-code-svg"
                  value={fullShortUrl}
                  size={140}
                  level="H"
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>
              <div className="w-full space-y-3 mt-6">
                <div className="flex items-center gap-2 p-2 rounded bg-muted/50 border border-border">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-sans text-foreground truncate flex-1 select-all">
                    {shortUrl}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleCopy}
                    className="w-full gap-2 bg-itc-ciano hover:bg-itc-ciano800 font-sans shadow-sm text-xs h-8 text-white"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar Link
                  </Button>
                  <Button
                    onClick={handleDownloadQR}
                    variant="outline"
                    className="w-full gap-2 font-sans border-border text-xs h-8"
                  >
                    <Download className="h-3.5 w-3.5" /> Baixar QR
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ================= COLUNA DIREITA ================= */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
            {/* TRAVA GEOMÉTRICA 1: Altura fixa h-28 */}
            <Card
              className={`bg-card border-border shadow-sm flex flex-col h-28 ${cardHoverClass}`}
            >
              <CardHeader className="pb-0 pt-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-itc-ciano" /> Cliques
                  Acumulados
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center pb-4">
                <div className="text-2xl font-bold font-sans text-foreground">
                  {linkData.clickCount || 0}
                </div>
              </CardContent>
            </Card>

            {/* TRAVA GEOMÉTRICA 1: Altura fixa h-28 */}
            <Card
              className={`bg-card border-border shadow-sm flex flex-col h-28 ${cardHoverClass}`}
            >
              <CardHeader className="pb-0 pt-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-itc-ciano" /> Data de
                  Criação
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center pb-4">
                <div className="text-sm font-semibold font-sans text-foreground">
                  {formatarDataSegura(linkData.createdAt)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card
            className={`bg-card border-border shadow-sm shrink-0 ${cardHoverClass}`}
          >
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-itc-ciano" /> Histórico de
                Acessos
              </CardTitle>
              <CardDescription className="font-sans text-xs text-muted-foreground">
                Volume de cliques distribuído por dia
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-6">
              {chartData.length > 0 ? (
                <div className="h-40 w-full">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minHeight={160}
                  >
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
                        dot={{
                          r: 3.5,
                          strokeWidth: 1.5,
                          fill: "var(--background)",
                        }}
                        activeDot={{ r: 5, strokeWidth: 0, fill: "#008F95" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-36 border border-dashed border-border rounded-lg bg-muted/10">
                  <BarChart3 className="h-6 w-6 text-muted-foreground mb-1.5 opacity-40" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Aguardando os primeiros cliques para gerar inteligência
                    temporal.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 items-stretch">
            {/* TRAVA GEOMÉTRICA 3: h-full para esticar até o fim da coluna */}
            <Card
              className={`bg-card border-border shadow-sm flex flex-col h-full overflow-hidden ${cardHoverClass}`}
            >
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-xs font-bold font-sans flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-itc-ciano" /> Localização
                  (Top Cidades)
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto pt-2 pb-4">
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
                          className="bg-muted text-muted-foreground text-[10px] font-bold px-1.5 h-5"
                        >
                          {city.cliques}{" "}
                          {city.cliques === 1 ? "clique" : "cliques"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground font-sans italic pt-2">
                    Nenhuma cidade registrada.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* TRAVA GEOMÉTRICA 3: h-full para esticar até o fim da coluna */}
            <Card
              className={`bg-card border-border shadow-sm flex flex-col h-full ${cardHoverClass}`}
            >
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-xs font-bold font-sans flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                  <Smartphone className="h-3.5 w-3.5 text-itc-ciano" />{" "}
                  Plataforma de Acesso
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center space-y-3 pt-2 pb-4">
                {deviceData.length > 0 ? (
                  deviceData.map((device, index) => (
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
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground font-sans italic">
                    Nenhum dispositivo detectado.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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
