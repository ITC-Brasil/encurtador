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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

// Importações do Recharts e Componentes Customizados
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
import { EditLinkForm } from "@/components/edit-link-form";

interface LinkDetail {
  id: string;
  slug: string;
  originalUrl: string;
  title: string;
  clickCount: number;
  isActive: boolean;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  maxClicks?: number;
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

export default function LinkDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [loading, setLoading] = useState(true);
  const [linkData, setLinkData] = useState<LinkDetail | null>(null);

  // Estados dos Modais e Analytics
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [topCities, setTopCities] = useState<CityDataPoint[]>([]);
  const [deviceData, setDeviceData] = useState<DeviceDataPoint[]>([]);

  // Efeito hover premium idêntico para todos os cards
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
          toast.error("Link não encontrado.");
          router.push("/dashboard");
          return;
        }

        const data = docSnap.data();
        setLinkData({ id: docSnap.id, ...data } as LinkDetail);

        const clicksRef = collection(db, "links", resolvedParams.id, "clicks");
        const q = query(clicksRef, orderBy("timestamp", "asc"));
        const clicksSnap = await getDocs(q);

        const groupedDates: Record<string, number> = {};
        const groupedCities: Record<string, number> = {};
        let mobileCount = 0;
        let desktopCount = 0;

        clicksSnap.forEach((doc) => {
          const clickData = doc.data();

          if (clickData.timestamp) {
            const dateObj = clickData.timestamp.toDate();
            const dateStr = format(dateObj, "dd/MM", { locale: ptBR });
            groupedDates[dateStr] = (groupedDates[dateStr] || 0) + 1;
          }

          let rawCity = "Não identificada";
          try {
            rawCity = clickData.city
              ? decodeURIComponent(clickData.city)
              : "Não identificada";
          } catch {
            rawCity = clickData.city || "Não identificada";
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

        const formattedChart = Object.keys(groupedDates).map((key) => ({
          date: key,
          cliques: groupedDates[key],
        }));
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
              name: "Celular",
              value: Math.round((mobileCount / totalClicksRecorded) * 100),
            },
            {
              name: "Computador",
              value: Math.round((desktopCount / totalClicksRecorded) * 100),
            },
          ]);
        } else {
          setDeviceData([]);
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes:", error);
        toast.error("Falha ao carregar informações.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, resolvedParams.id]);

  const shortUrl = linkData ? `itcbr.xyz/${linkData.slug}` : "";
  const fullShortUrl = `https://itcbr.xyz/${linkData?.slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl);
    toast.success("Link copiado!");
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
    } catch {
      toast.error("Erro ao alterar o status do link.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center font-sans text-muted-foreground bg-background">
        Carregando painel de inteligência...
      </div>
    );
  }

  if (!linkData) return null;

  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto w-full font-sans transition-colors duration-300 space-y-4">
      <Button
        variant="ghost"
        onClick={() => router.push("/dashboard")}
        className="text-muted-foreground gap-2 pl-0 hover:bg-transparent font-sans text-xs w-max mb-2"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
      </Button>

      {/* Card de Identidade do Link */}
      <Card className={`bg-card border-border shadow-sm ${cardHoverClass}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-itc-ciano" /> Título do Link
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-display">
              {linkData.title}
            </h1>
            <div className="flex items-center gap-2 pt-1">
              <Badge
                variant={linkData.isActive ? "default" : "destructive"}
                className={
                  linkData.isActive
                    ? "bg-itc-sucesso/10 text-itc-sucesso hover:bg-itc-sucesso/20 border-none px-2.5"
                    : "bg-itc-erro/10 text-itc-erro hover:bg-itc-erro/20 border-none px-2.5"
                }
              >
                {linkData.isActive ? "Ativo" : "Desativado"}
              </Badge>
              {linkData.passwordHash && (
                <Badge
                  variant="outline"
                  className="text-itc-atencao border-itc-atencao/50 flex items-center gap-1 bg-amber-500/10"
                >
                  <ShieldAlert className="h-3 w-3" /> Protegido por Senha
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid Layout Principal Unificado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* ================= COLUNA ESQUERDA (OPERACIONAL) ================= */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card
            className={`bg-card border-border shadow-sm h-25.5 flex flex-col justify-center shrink-0 ${cardHoverClass}`}
          >
            <CardHeader className="pb-1 pt-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-itc-ciano" /> Destino
                Original
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-0">
              <a
                href={linkData.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-foreground font-sans hover:text-itc-ciano flex items-center gap-1.5 break-all font-medium"
              >
                {linkData.originalUrl}
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
            </CardContent>
          </Card>

          <Card
            className={`bg-card border-border shadow-sm h-35 flex flex-col justify-center shrink-0 ${cardHoverClass}`}
          >
            <CardHeader className="pb-1 pt-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-itc-ciano" /> Controle do
                Link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-0">
              <p className="text-xs text-muted-foreground font-sans">
                Modifique os parâmetros operacionais.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {/* AQUI ESTÁ A ÚNICA MUDANÇA: O DIALOG ENVOLVENDO O BOTÃO */}
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full gap-2 font-sans border-border text-xs h-8"
                    >
                      <Edit className="h-3.5 w-3.5" /> Editar Configs
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold font-display">
                        Editar Configurações
                      </DialogTitle>
                      <DialogDescription className="font-sans text-muted-foreground text-sm">
                        Altere o destino ou identificação. O QR Code atual
                        continuará funcionando.
                      </DialogDescription>
                    </DialogHeader>
                    {/* Renderização Limpa do Componente */}
                    <EditLinkForm
                      linkId={resolvedParams.id}
                      onSuccess={() => {
                        setIsEditOpen(false);
                        window.location.reload(); // Recarrega a página para atualizar o Título/URL na hora
                      }}
                      onCancel={() => setIsEditOpen(false)}
                    />
                  </DialogContent>
                </Dialog>

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
            className={`bg-card border-border shadow-sm flex flex-col justify-between flex-1 min-h-80 ${cardHoverClass}`}
          >
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <QrIcon className="h-3.5 w-3.5 text-itc-ciano" /> QR Code
                Corporativo
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-5 px-6 flex flex-col items-center flex-1 justify-between">
              <div className="bg-white p-3 rounded-xl shadow-inner border border-border">
                <QRCodeSVG
                  id="qr-code-svg"
                  value={fullShortUrl}
                  size={140}
                  level="H"
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>

              <div className="w-full space-y-3 mt-2">
                <div className="flex items-center gap-2 p-2 rounded bg-muted/50 border border-border">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-mono text-foreground truncate flex-1">
                    {shortUrl}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleCopy}
                    variant="default"
                    className="w-full gap-2 bg-itc-ciano hover:bg-itc-ciano800 font-sans shadow-sm text-xs h-8"
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

        {/* ================= COLUNA DIREITA (ANALYTICS) ================= */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
            <Card
              className={`bg-card border-border shadow-sm h-25.5 flex flex-col justify-center ${cardHoverClass}`}
            >
              <CardHeader className="pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-itc-ciano" /> Cliques
                  Acumulados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-sans text-foreground">
                  {linkData.clickCount}
                </div>
              </CardContent>
            </Card>

            <Card
              className={`bg-card border-border shadow-sm h-25.5 flex flex-col justify-center ${cardHoverClass}`}
            >
              <CardHeader className="pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-itc-ciano" /> Data de
                  Criação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold font-sans text-foreground">
                  {linkData.createdAt?.toDate
                    ? new Intl.DateTimeFormat("pt-BR").format(
                        linkData.createdAt.toDate(),
                      )
                    : "—"}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card
            className={`bg-card border-border shadow-sm shrink-0 ${cardHoverClass}`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-itc-ciano" /> Histórico de
                Acessos
              </CardTitle>
              <CardDescription className="font-sans text-xs text-muted-foreground">
                Volume de cliques distribuído por dia
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {chartData.length > 0 ? (
                <div className="h-40 w-full">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minHeight={160}
                    minWidth={0}
                  >
                    <LineChart
                      data={chartData}
                      margin={{ top: 5, right: 15, left: -25, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#333"
                        opacity={0.15}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="#888888"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        dy={8}
                      />
                      <YAxis
                        stroke="#888888"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                          fontSize: "12px",
                        }}
                        itemStyle={{ color: "#00D1B2", fontWeight: "bold" }}
                        labelStyle={{ fontWeight: "bold" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cliques"
                        name="Cliques"
                        stroke="#00D1B2"
                        strokeWidth={2.5}
                        dot={{
                          r: 3.5,
                          strokeWidth: 1.5,
                          fill: "hsl(var(--background))",
                        }}
                        activeDot={{ r: 5, strokeWidth: 0, fill: "#00D1B2" }}
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

          {chartData.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 items-stretch">
              <Card
                className={`bg-card border-border shadow-sm flex flex-col h-full overflow-hidden ${cardHoverClass}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold font-sans flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-itc-ciano" />{" "}
                    Localização (Top Cidades)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-1 flex-1 overflow-y-auto">
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
                </CardContent>
              </Card>

              <Card
                className={`bg-card border-border shadow-sm flex flex-col h-full justify-between ${cardHoverClass}`}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
