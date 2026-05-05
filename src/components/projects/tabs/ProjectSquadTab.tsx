import { useState } from "react";
import { UserMinus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MemberAvatar } from "../MemberAvatar";
import { UserSelect } from "../UserSelect";
import {
  useProjectMembers,
  useAddProjectMember,
  useRemoveProjectMember,
} from "@/hooks/useProjects";

interface ProjectSquadTabProps {
  projectId: string;
  ownerId: string;
  isOwner: boolean;
}

export function ProjectSquadTab({
  projectId,
  ownerId,
  isOwner,
}: ProjectSquadTabProps) {
  const { data: members = [] } = useProjectMembers(projectId);
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();
  const [removeId, setRemoveId] = useState<string | null>(null);

  // Owner aparece como item virtual no topo
  const ownerInList = members.find((m) => m.user_id === ownerId);
  const others = members.filter((m) => m.user_id !== ownerId);

  return (
    <div>
      <div className="border border-border rounded-xl bg-card divide-y divide-border/50">
        {ownerInList && (
          <SquadRow
            user={ownerInList.user_profiles}
            roleLabel="Owner"
            canRemove={false}
          />
        )}
        {!ownerInList && (
          <SquadRow user={null} roleLabel="Owner" canRemove={false} />
        )}
        {others.map((m) => (
          <SquadRow
            key={m.user_id}
            user={m.user_profiles}
            roleLabel="Membro"
            canRemove={isOwner}
            onRemove={() => setRemoveId(m.user_id)}
          />
        ))}
      </div>

      {isOwner && (
        <div className="mt-3">
          <UserSelect
            placeholder="Adicionar membro ao squad..."
            exclude={[ownerId, ...members.map((m) => m.user_id)]}
            onSelect={(userId) =>
              addMember.mutate({ projectId, userId, role: "member" })
            }
          />
        </div>
      )}

      <AlertDialog
        open={!!removeId}
        onOpenChange={(o) => !o && setRemoveId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              O membro perderá acesso ao squad deste projeto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeId)
                  removeMember.mutate({ projectId, userId: removeId });
                setRemoveId(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface RowProps {
  user: { full_name: string | null; email: string | null } | null;
  roleLabel: string;
  canRemove: boolean;
  onRemove?: () => void;
}

function SquadRow({ user, roleLabel, canRemove, onRemove }: RowProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <MemberAvatar user={user} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {user?.full_name || user?.email || "Owner"}
        </p>
        <p className="text-xs text-muted-foreground">{roleLabel}</p>
      </div>
      {canRemove && (
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Remover membro"
        >
          <UserMinus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
