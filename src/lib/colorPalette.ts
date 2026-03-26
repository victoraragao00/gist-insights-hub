// ── Centralized color palette for the CX Hub ──
// Single source of truth — never duplicate these in pages/components.

export const TONE_CONFIG: Record<string, { label: string; className: string }> = {
  ok: { label: "✓ Ok", className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
  atencao: { label: "⚠ Atenção", className: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400" },
  alerta: { label: "🔶 Alerta", className: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400" },
  critico: { label: "🔴 Crítico", className: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" },
};

// For Recharts chart configs (ChartContainer)
export const TONE_CHART_COLORS: Record<string, { label: string; color: string }> = {
  ok: { label: "Ok", color: "hsl(160, 84%, 39%)" },
  atencao: { label: "Atenção", color: "hsl(48, 96%, 53%)" },
  alerta: { label: "Alerta", color: "hsl(25, 95%, 53%)" },
  critico: { label: "Crítico", color: "hsl(0, 84%, 60%)" },
};

// For Recharts Bar fill colors (stacked bar charts)
export const TONE_BAR_COLORS = {
  ok: "hsl(160, 84%, 39%)",
  atencao: "hsl(48, 96%, 53%)",
  alerta: "hsl(25, 95%, 53%)",
  critico: "hsl(0, 84%, 60%)",
} as const;

export const PRIORITY_CHART_COLORS: Record<string, string> = {
  urgent: "hsl(0, 84%, 60%)",
  high: "hsl(25, 95%, 53%)",
  medium: "hsl(48, 96%, 53%)",
  low: "hsl(160, 84%, 39%)",
};

export const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export const SCORE_BUCKET_COLORS = {
  ok: "hsl(160, 84%, 39%)",
  atencao: "hsl(48, 96%, 53%)",
  alerta: "hsl(25, 95%, 53%)",
  critico: "hsl(0, 84%, 60%)",
} as const;

// SatisfactionPicker — only color + label (icons stay in component)
export const SATISFACTION_CONFIG = [
  { value: 1, label: "Muito insatisfeito", color: "text-red-500 hover:text-red-600" },
  { value: 2, label: "Insatisfeito", color: "text-orange-500 hover:text-orange-600" },
  { value: 3, label: "Neutro", color: "text-yellow-500 hover:text-yellow-600" },
  { value: 4, label: "Satisfeito", color: "text-emerald-500 hover:text-emerald-600" },
  { value: 5, label: "Muito satisfeito", color: "text-emerald-600 hover:text-emerald-700" },
] as const;
