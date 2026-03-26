import { useState } from "react";
import { Smile, Meh, Frown, ThumbsDown, Skull } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const SATISFACTION_OPTIONS = [
  { value: 1, icon: Skull, label: "Muito insatisfeito", color: "text-red-500 hover:text-red-600" },
  { value: 2, icon: Frown, label: "Insatisfeito", color: "text-orange-500 hover:text-orange-600" },
  { value: 3, icon: Meh, label: "Neutro", color: "text-yellow-500 hover:text-yellow-600" },
  { value: 4, icon: Smile, label: "Satisfeito", color: "text-emerald-500 hover:text-emerald-600" },
  { value: 5, icon: Smile, label: "Muito satisfeito", color: "text-emerald-600 hover:text-emerald-700" },
];

interface SatisfactionPickerProps {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function SatisfactionPicker({ value, onChange, disabled }: SatisfactionPickerProps) {
  return (
    <div className="flex items-center gap-2">
      {SATISFACTION_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isSelected = value === opt.value;
        return (
          <Tooltip key={opt.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(opt.value)}
                className={cn(
                  "p-1.5 rounded-md transition-all duration-150",
                  isSelected
                    ? `${opt.color} bg-muted scale-110`
                    : `text-muted-foreground/40 hover:${opt.color}`,
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon className={cn("h-6 w-6", isSelected && "fill-current")} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {opt.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {value && (
        <span className="text-xs text-muted-foreground ml-1">{value}/5</span>
      )}
    </div>
  );
}

export function SatisfactionDisplay({ score }: { score: number | null }) {
  if (!score) return <span className="text-muted-foreground text-xs">—</span>;
  const opt = SATISFACTION_OPTIONS.find((o) => o.value === score);
  if (!opt) return <span className="text-xs">{score}/5</span>;
  const Icon = opt.icon;
  return (
    <span className={cn("inline-flex items-center gap-1", opt.color)}>
      <Icon className="h-4 w-4" />
      <span className="text-xs">{score}/5</span>
    </span>
  );
}
