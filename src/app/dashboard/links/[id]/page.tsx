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
  ShieldAlert,
  Edit,
  Activity,
  MapPin,
  Smartphone,
  Sliders,
  Tag,
  Loader2,
  History,
  Calendar,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

// 🟢 Utilitário de auditoria importado
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
  updatedAt?: Timestamp | string | null; // 🟢 Adicionado para exibir data da última edição
  expiresAt?: Timestamp | string | null;
  maxClicks?: number | string;
  passwordHash?: string;
  createdByName?: string;
  updatedByName?: string;
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
  const [isToggling, setIsToggling] = useState(false); // Previne multi-clicks na pausa

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
            // fallback silencioso
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
    if (isToggling) return;
    setIsToggling(true);
    const newState = !linkData.isActive;

    try {
      const currentUser = auth.currentUser;
      const docRef = doc(db, "links", linkData.id);

      const updatePayload: Record<string, string | boolean | Timestamp> = {
        isActive: newState,
      };
      // Atualiza também os metadados de quem modificou
      if (currentUser) {
        updatePayload.updatedBy = currentUser.uid;
        updatePayload.updatedByName = currentUser.displayName || "Colaborador";
        updatePayload.updatedByEmail = currentUser.email || "sistema@itcbr.xyz";
        updatePayload.updatedAt = Timestamp.now();
      }

      await updateDoc(docRef, updatePayload);

      // 📝 DISPARO DE AUDITORIA: Registra a pausa/ativação do link
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

  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto w-full font-sans transition-colors duration-300 space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.push("/dashboard")}
        className="text-muted-foreground gap-2 pl-0 hover:bg-transparent font-sans text-xs w-max"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
      </Button>

      {/* BLOCO SUPERIOR: Identidade e Auditoria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* LADO ESQUERDO (2 Colunas): Dados de Identificação com altura perfeitamente nivelada */}
        <Card
          className={`lg:col-span-2 bg-card border-border shadow-sm flex flex-col ${cardHoverClass}`}
        >
          <CardHeader className="pb-3 pt-5 border-b border-border/40 shrink-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5 font-sans">
              <Tag className="h-3.5 w-3.5" /> Painel de Controle Operacional
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 pb-5 flex-1 flex flex-col justify-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans break-all">
                {linkData.title || "Link Sem Título"}
              </h1>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-2">
                <div className="flex items-center gap-2">
                  <Badge
                    className={`border-none text-[10px] font-bold px-2.5 py-0.5 rounded ${
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
                      className="text-amber-500 border-amber-500/30 flex items-center gap-1 bg-amber-500/10 text-[10px] px-2 py-0.5"
                    >
                      <ShieldAlert className="h-3 w-3" /> Senha Ativa
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm font-sans">
                  <span className="text-itc-ciano font-bold text-xs uppercase tracking-wider">
                    Volume de Tráfego:
                  </span>
                  <span className="text-foreground font-bold text-base bg-accent/40 px-3 py-0.5 rounded-md border border-border/40">
                    {linkData.clickCount || 0}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      cliques
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LADO DIREITO (1 Coluna Esticada): Cronologia e Auditoria */}
        <Card
          className={`lg:col-span-1 bg-card border-border shadow-sm flex flex-col ${cardHoverClass}`}
        >
          <CardHeader className="pb-3 pt-5 border-b border-border/40 shrink-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5 font-sans">
              <History className="h-3.5 w-3.5" /> Histórico & Cronologia
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 pb-5 flex-1 flex flex-col justify-center">
            <div className="space-y-4 w-full">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-itc-ciano/10 text-itc-ciano rounded-md mt-0.5">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="space-y-0.5 font-sans">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block tracking-wider">
                    Criação do Link
                  </span>
                  <span className="text-sm font-bold text-foreground block">
                    {linkData.createdByName || "Colaborador"}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" />{" "}
                    {formatarDataSegura(linkData.createdAt)}
                  </span>
                </div>
              </div>

              {linkData.updatedByName && (
                <div className="flex items-start gap-3 border-t border-border/40 pt-3">
                  <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-md mt-0.5">
                    <Edit className="h-3.5 w-3.5" />
                  </div>
                  <div className="space-y-0.5 font-sans">
                    <span className="text-[10px] text-amber-500 uppercase font-medium block tracking-wider">
                      Última Modificação
                    </span>
                    <span className="text-sm font-bold text-foreground block">
                      {linkData.updatedByName}
                    </span>
                    {/* 🟢 Agora exibe a data e hora exata da última edição e não apenas o texto */}
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                      <Calendar className="h-3 w-3" />{" "}
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

      {/* LINHA DIVISORA: Destino Original com Separador Perfeito */}
      <Card
        className={`bg-card border-border shadow-sm flex flex-col ${cardHoverClass}`}
      >
        <CardHeader className="pb-3 pt-4 border-b border-border/40">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5 font-sans">
            <Link2 className="h-3.5 w-3.5" /> Destino Corporativo Original
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-4 font-sans">
            <a
              href={linkData.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-foreground font-sans hover:text-itc-ciano font-medium truncate flex-1 block"
              title={linkData.originalUrl}
            >
              {linkData.originalUrl}
            </a>
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </CardContent>
      </Card>

      {/* GRID INFERIOR: Telemetria e Controles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Coluna de Controles e QR */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* CARD 1: Ações Operacionais */}
          <Card
            className={`bg-card border-border shadow-sm flex flex-col ${cardHoverClass}`}
          >
            <CardHeader className="pb-3 pt-4 border-b border-border/40">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5 font-sans">
                <Sliders className="h-3.5 w-3.5" /> Ações Operacionais
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditOpen(true)}
                  className="w-full gap-2 font-sans border-border text-xs h-8"
                >
                  <Edit className="h-3.5 w-3.5 text-itc-ciano" /> Configurações
                </Button>
                <Button
                  variant={linkData.isActive ? "destructive" : "default"}
                  onClick={handleToggleActive}
                  disabled={isToggling}
                  className="font-sans text-xs h-8"
                >
                  {isToggling
                    ? "Processando..."
                    : linkData.isActive
                      ? "Pausar Link"
                      : "Ativar Link"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* CARD 2: QR Code Corporativo */}
          <Card
            className={`bg-card border-border shadow-sm flex flex-col flex-1 ${cardHoverClass}`}
          >
            <CardHeader className="pb-3 pt-4 border-b border-border/40">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5 font-sans">
                <QrIcon className="h-3.5 w-3.5" /> QR Code Corporativo
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center pb-6 pt-5 px-6">
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

        {/* Coluna dos Gráficos */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* CARD 3: Histórico de Acessos */}
          <Card
            className={`bg-card border-border shadow-sm shrink-0 ${cardHoverClass}`}
          >
            <CardHeader className="pb-3 pt-4 border-b border-border/40">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-itc-ciano flex items-center gap-1.5 font-sans">
                <Activity className="h-4 w-4 text-itc-ciano" /> Histórico de
                Acessos
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 pb-6">
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

          {/* Região e Dispositivos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 items-stretch">
            {/* CARD 4: Localização */}
            <Card
              className={`bg-card border-border shadow-sm flex flex-col h-full overflow-hidden ${cardHoverClass}`}
            >
              <CardHeader className="pb-3 pt-4 border-b border-border/40">
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
                          className="bg-muted text-muted-foreground text-[10px] font-bold px-1.5 h-5"
                        >
                          {city.cliques}{" "}
                          {city.cliques === 1 ? "clique" : "cliques"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground font-sans italic">
                    Nenhuma cidade registrada.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* CARD 5: Plataforma de Acesso */}
            <Card
              className={`bg-card border-border shadow-sm flex flex-col h-full ${cardHoverClass}`}
            >
              <CardHeader className="pb-3 pt-4 border-b border-border/40">
                <CardTitle className="text-xs font-bold font-sans flex items-center gap-1.5 uppercase tracking-wider text-itc-ciano">
                  <Smartphone className="h-3.5 w-3.5" /> Plataforma de Acesso
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center space-y-3 pt-4 pb-4">
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
                // Pequeno recarregamento para trazer os novos dados
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
