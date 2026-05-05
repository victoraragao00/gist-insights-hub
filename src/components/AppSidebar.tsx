import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Search, ShieldAlert, Settings, Users, Kanban, BarChart2, ClipboardList, LogOut, Loader2, FolderKanban, Calendar } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { useWorkspace } from "@/hooks/useWorkspace";
import umodeLogo from "@/assets/umode-logo-full.png";
import umodeIcon from "@/assets/umode-icon.png";
import { useLocation } from "react-router-dom";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const cxItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clientes", url: "/clients", icon: Users },
  { title: "Demandas", url: "/demands", icon: Kanban },
  { title: "Analytics de Demandas", url: "/demands/dashboard", icon: BarChart2 },
  { title: "Pautas", url: "/agendas", icon: ClipboardList },
  { title: "Busca", url: "/search", icon: Search },
  { title: "Auditorias", url: "/audits", icon: ShieldAlert },
];

const techItems = [
  { title: "Kanban", url: "/demands", icon: Kanban },
  { title: "Projetos", url: "/projects", icon: FolderKanban },
  { title: "Dashboard TECH", url: "/tech/dashboard", icon: BarChart2 },
  { title: "Pautas Internas", url: "/agendas?type=internal", icon: Calendar },
];

const bottomItems = [
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const { activeWorkspace, setWorkspace } = useWorkspace();
  const modules = activeWorkspace === "tech" ? techItems : cxItems;

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
          <WorkspaceSwitcher active={activeWorkspace} onChange={setWorkspace} />
        )}

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{activeWorkspace === "tech" ? "TECH" : "Módulos"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {modules.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={collapsed ? item.title : undefined}
                    >
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
                ))}
              </SidebarMenu>
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