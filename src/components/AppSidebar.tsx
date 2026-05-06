import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Search, ShieldAlert, Settings, Users, Kanban, BarChart2, ClipboardList, LogOut, Loader2, FolderKanban, FileText } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { useWorkspace } from "@/hooks/useWorkspace";
import umodeLogo from "@/assets/umode-logo-full.png";
import umodeIcon from "@/assets/umode-icon.png";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const cxItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Demandas", url: "/demands", icon: Kanban },
  { title: "Analytics", url: "/demands/dashboard", icon: BarChart2 },
  { title: "Busca", url: "/search", icon: Search },
  { title: "Auditorias", url: "/audits", icon: ShieldAlert },
];

const techItems = [
  { title: "Dashboard", url: "/tech/dashboard", icon: BarChart2 },
  { title: "Kanban", url: "/demands", icon: Kanban },
];

const bottomItems = [
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const { activeWorkspace, setWorkspace } = useWorkspace();
  const modules = activeWorkspace === "tech" ? techItems : cxItems;

  const pautasPath = activeWorkspace === "tech"
    ? "/agendas?type=internal"
    : "/agendas?type=client";

  const sharedItems = [
    { title: "Projetos", url: "/projects", icon: FolderKanban },
    { title: "Clientes", url: "/clients", icon: Users },
    { title: "Pautas", url: pautasPath, icon: ClipboardList },
    { title: "RFIs", url: "/rfis", icon: FileText },
  ];

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => navigate("/login"),
    onError: () => {
      toast.error("Erro ao sair. Tente novamente.");
    },
  });

  const renderItem = (item: { title: string; url: string; icon: typeof FolderKanban }) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
        <NavLink
          to={item.url}
          end={item.url === "/"}
          className="hover:bg-accent/50"
          activeClassName="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className={collapsed ? "p-2" : "p-4"}>
          <div className="flex items-center gap-3">
            {collapsed ? (
              <img src={umodeIcon} alt="uMode" className="h-9 w-9 shrink-0 rounded-xl object-contain" />
            ) : (
              <img src={umodeLogo} alt="uMode CX Hub" className="h-8 object-contain" />
            )}
          </div>
        </SidebarHeader>

        {!collapsed && (
          <WorkspaceSwitcher
            active={activeWorkspace}
            onChange={(ws) => {
              setWorkspace(ws);
              if (ws === "tech") navigate("/tech/dashboard");
              else navigate("/");
            }}
          />
        )}

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{activeWorkspace === "tech" ? "TECH" : "CX Hub"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{modules.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <div className="mx-4 my-2 border-t border-border/50" />

          <SidebarGroup>
            <SidebarGroupLabel>Geral</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{sharedItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            {bottomItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.url}
                    className="hover:bg-accent/50"
                    activeClassName="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}

            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={collapsed ? "Sair" : undefined}
                onClick={() => setLogoutDialogOpen(true)}
                className="hover:bg-destructive/10 hover:text-destructive cursor-pointer"
              >
                {logoutMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                {!collapsed && <span>Sair</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja sair?</AlertDialogTitle>
            <AlertDialogDescription>
              Você será redirecionado para a tela de login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? "Saindo..." : "Sair"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}