import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/hooks/useProjects";

interface ProjectSelectProps {
  value: string | null | undefined;
  onSelect: (projectId: string) => void;
  onClear: () => void;
}

export function ProjectSelect({ value, onSelect, onClear }: ProjectSelectProps) {
  const { data: projects = [] } = useProjects("tech");
  return (
    <Select
      value={value ?? "none"}
      onValueChange={(v) => (v === "none" ? onClear() : onSelect(v))}
    >
      <SelectTrigger className="h-7 text-xs w-[180px]">
        <SelectValue placeholder="Nenhum" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Nenhum</SelectItem>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
