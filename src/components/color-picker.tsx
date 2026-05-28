// src/components/color-picker.tsx
"use client";

import { useState } from "react";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// 🟢 Paleta Oficial ITC Brasil (Extraída do Guia de Marca v3)
const PALETA = [
  // Ciano ITC
  "#E0F4F5",
  "#A8DCE0",
  "#4BBAC0",
  "#008F95",
  "#006262",
  "#003C3F",
  // Bordô ITC
  "#F7E6EC",
  "#D4849F",
  "#8A2244",
  "#491027",
  "#2D0918",
  // Neutros
  "#D8DEDE",
  "#A5B0B0",
  "#697272",
  "#3A4040",
  "#1A2020",
  // Funcionais (Sucesso, Atenção, Erro, Info)
  "#1A7F3C",
  "#CC7A00",
  "#C0392B",
  "#1565C0",
];

/**
 * Sorteia uma cor aleatória da paleta pré-definida da ITC Brasil.
 */
export function gerarCorSugerida(): string {
  return PALETA[Math.floor(Math.random() * PALETA.length)];
}

interface ColorPickerProps {
  /** Valor atual da cor em hex (#RRGGBB) */
  value: string;
  /** Callback chamado ao mudar a cor */
  onChange: (color: string) => void;
  /** Label exibida acima do picker. Padrão: "Cor da Categoria" */
  label?: string;
  /** Desabilita o picker */
  disabled?: boolean;
}

export function ColorPicker({
  value,
  onChange,
  label = "Cor da Categoria",
  disabled = false,
}: ColorPickerProps) {
  const [textValue, setTextValue] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  // 🟢 Padrão oficial do React: Sincronizar estado derivado direto na renderização (sem useEffect)
  if (value !== prevValue) {
    setPrevValue(value);
    setTextValue(value);
  }

  // Quando o usuário digita no campo hex, valida antes de propagar
  const handleTextChange = (input: string) => {
    setTextValue(input);
    if (/^#[0-9A-Fa-f]{6}$/.test(input)) {
      onChange(input);
    }
  };

  // Quando o color picker nativo muda, sincroniza tudo
  const handlePickerChange = (input: string) => {
    setTextValue(input.toUpperCase());
    onChange(input.toUpperCase());
  };

  const handleSugerir = () => {
    const novaCor = gerarCorSugerida();
    setTextValue(novaCor);
    onChange(novaCor);
  };

  return (
    <div className="space-y-2 font-sans">
      <Label className="text-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        {/* Color picker nativo do navegador */}
        <input
          type="color"
          value={value}
          onChange={(e) => handlePickerChange(e.target.value)}
          disabled={disabled}
          className="h-10 w-14 cursor-pointer rounded-md border border-border bg-background p-1 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Seletor de cor"
        />

        {/* Campo de texto para hex manual */}
        <Input
          value={textValue}
          onChange={(e) => handleTextChange(e.target.value.toUpperCase())}
          placeholder="#008F95"
          maxLength={7}
          disabled={disabled}
          className="font-mono text-sm focus-visible:ring-itc-ciano"
        />

        {/* Botão de sugestão aleatória */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleSugerir}
          disabled={disabled}
          className="border-border hover:bg-accent text-foreground shrink-0"
          title="Sugerir cor institucional"
        >
          <Shuffle className="h-4 w-4 text-itc-ciano" />
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground font-sans">
        Selecione visualmente, cole o HEX ou sorteie uma cor institucional.
      </p>
    </div>
  );
}
