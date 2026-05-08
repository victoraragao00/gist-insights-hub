import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface UserOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

export function MultiAssigneeFilter({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["user_profiles_active_for_filter"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .eq("active", true)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as UserOption[];
    },
  });

  const byId = useMemo(() => {
    const m = new Map<string, UserOption>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-9 justify-between font-normal", className)}
        >
          <span className="flex items-center gap-1.5 truncate">
            <Users className="h-3.5 w-3.5 shrink-0" />
            {value.length === 0 ? (
              <span className="text-muted-foreground">Pessoas</span>
            ) : value.length === 1 ? (
              <span className="truncate">
                {byId.get(value[0])?.full_name ?? byId.get(value[0])?.email ?? "1 pessoa"}
              </span>
            ) : (
              <span>{value.length} pessoas</span>
            )}
          </span>
          {value.length > 0 ? (
            <X
              className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
            />
          ) : (
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-64" align="start">
        <Command>
          <CommandInput placeholder="Buscar pessoa..." />
          <CommandList>
            <CommandEmpty>Nenhum usuário</CommandEmpty>
            <CommandGroup>
              {users.map((u) => {
                const checked = value.includes(u.id);
                return (
                  <CommandItem
                    key={u.id}
                    value={`${u.full_name ?? ""} ${u.email ?? ""}`}
                    onSelect={() => toggle(u.id)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{u.full_name ?? u.email}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {value.length > 0 && (
          <div className="border-t border-border p-2 flex flex-wrap gap-1">
            {value.map((id) => {
              const u = byId.get(id);
              return (
                <Badge key={id} variant="secondary" className="text-xs gap-1">
                  {u?.full_name ?? u?.email ?? id.slice(0, 6)}
                  <button onClick={() => toggle(id)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
