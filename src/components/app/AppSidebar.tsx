import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Inbox,
  Send,
  GitBranch,
  Plug,
  Settings,
  ChevronsUpDown,
  LogOut,
  Shield,
  Check,
  Blocks,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/brand/Logo";
import {
  useCurrentOrg,
  useCurrentUser,
  useOrganizations,
  setCurrentOrg,
} from "@/lib/tenant/mock";

const WORKSPACE = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Campaigns", url: "/app/campaigns", icon: Send },
  { title: "Leads", url: "/app/leads", icon: Users },
  { title: "Inbox", url: "/app/inbox", icon: Inbox },
  { title: "Sales", url: "/app/sales", icon: GitBranch },
];

const TOOLS = [
  { title: "Integrations", url: "/app/integrations", icon: Plug },
  { title: "Builder", url: "/app/builder", icon: Blocks, badge: "Beta" },
];

const ADMIN = [
  { title: "Settings", url: "/app/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const org = useCurrentOrg();
  const orgs = useOrganizations();
  const user = useCurrentUser();

  const isActive = (url: string) =>
    url === "/app" ? pathname === "/app" : pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 pt-3">
        <Link to="/app" className="flex items-center gap-2 px-1.5 py-1">
          <Logo tone="light" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.7rem] uppercase tracking-wider text-sidebar-foreground/50">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {WORKSPACE.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.7rem] uppercase tracking-wider text-sidebar-foreground/50">
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {TOOLS.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                      {item.badge && (
                        <Badge
                          variant="secondary"
                          className="ml-auto bg-brand-soft text-brand border-transparent text-[0.6rem] px-1.5 py-0 font-medium"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.7rem] uppercase tracking-wider text-sidebar-foreground/50">
            Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {user.isMaster && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/master")}>
                    <Link to="/master">
                      <Shield className="h-4 w-4" />
                      <span>Master</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {ADMIN.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-sidebar-accent transition-colors">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                {org.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-sidebar-foreground">
                  {org.name}
                </div>
                <div className="truncate text-xs text-sidebar-foreground/60">
                  Plano {org.plan}
                </div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-64">
            <DropdownMenuLabel>Trocar organização</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {orgs.map((o) => (
              <DropdownMenuItem
                key={o.id}
                onClick={() => setCurrentOrg(o.id)}
                className="flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-medium">{o.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.membersCount} membros · {o.plan}
                  </div>
                </div>
                {o.id === org.id && <Check className="h-4 w-4 text-brand" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/login" className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Sair
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
