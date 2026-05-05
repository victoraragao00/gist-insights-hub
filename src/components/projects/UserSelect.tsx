import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUsers } from "@/hooks/useUsers";

interface UserSelectProps {
  placeholder?: string;
  exclude?: string[];
  onSelect: (userId: string) => void;
}

export function UserSelect({
  placeholder = "Selecionar usuário...",
  exclude = [],
  onSelect,
}: UserSelectProps) {
  const { data: users = [] } = useUsers();
  const available = users.filter(
    (u) => u.active && !exclude.includes(u.user_id),
  );
  return (
    <Select value="" onValueChange={(v) => v && onSelect(v)}>
      <SelectTrigger className="h-9 text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {available.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            Nenhum usuário disponível
          </div>
        ) : (
          available.map((u) => (
            <SelectItem key={u.user_id} value={u.user_id}>
              {u.full_name || u.email}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
