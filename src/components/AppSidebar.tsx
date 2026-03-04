import { LayoutDashboard, ShieldAlert, Settings, Users, MessageSquare } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useClient } from "@/context/ClientContext";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const modules = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clientes", url: "/clients", icon: Users },
  { title: "Interações", url: "/interactions", icon: MessageSquare },
  { title: "Auditorias", url: "/audits", icon: ShieldAlert },
];

const bottomItems = [
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const { clients, selectedClient, setSelectedClient } = useClient();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
            H
          </div>
          {!collapsed && (
            <div>
              <h2 className="text-sm font-bold tracking-tight text-foreground">Hub Central</h2>
              <p className="text-xs text-muted-foreground">Integrações & Analytics</p>
            </div>
          )}
        </div>

        {/* Client selector */}
        {!collapsed && clients.length > 0 && (
          <div className="mt-3">
            <Select
              value={selectedClient?.id ?? ""}
              onValueChange={(val) => {
                const client = clients.find((c) => c.id === val);
                if (client) setSelectedClient(client);
              }}
            >
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="Selecionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modules.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-accent/50"
                      activeClassName="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isActive(item.url) ? "bg-primary-foreground/20" : "bg-accent"}`}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      {!collapsed && <span className="ml-1">{item.title}</span>}
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
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
