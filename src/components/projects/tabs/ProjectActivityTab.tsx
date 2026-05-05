import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FolderPlus,
  UserPlus,
  Link2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  useProject,
  useProjectMembers,
  useProjectDemands,
} from "@/hooks/useProjects";

interface ProjectActivityTabProps {
  projectId: string;
}

interface ActivityEvent {
  id: string;
  icon: LucideIcon;
  description: string;
  at: string;
}

export function ProjectActivityTab({ projectId }: ProjectActivityTabProps) {
  const { data: project } = useProject(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: demands = [] } = useProjectDemands(projectId);

  if (!project) return null;

  const events: ActivityEvent[] = [];

  events.push({
    id: `created-${project.id}`,
    icon: FolderPlus,
    description: "Projeto criado",
    at: project.created_at,
  });

  members.forEach((m) =>
    events.push({
      id: `member-${m.id}`,
      icon: UserPlus,
      description: `${
        m.user_profiles?.full_name || m.user_profiles?.email || "Usuário"
      } adicionado ao squad`,
      at: m.added_at,
    }),
  );

  demands.forEach((d) =>
    events.push({
      id: `demand-${d.id}`,
      icon: Link2,
      description: `Demanda vinculada: ${d.title}`,
      at: d.created_at,
    }),
  );

  if (project.cancelled_at) {
    events.push({
      id: `cancelled-${project.id}`,
      icon: XCircle,
      description: "Projeto cancelado",
      at: project.cancelled_at,
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="border border-border rounded-xl bg-card divide-y divide-border/50">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Sem atividade ainda.
        </p>
      ) : (
        events.map((e) => {
          const Icon = e.icon;
          return (
            <div key={e.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{e.description}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(e.at), "dd MMM yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
