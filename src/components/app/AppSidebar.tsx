import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Inbox,
  Send,
  Plug,
  Settings,
  ChevronsUpDown,
  LogOut,
  Shield,
  Blocks,
  KanbanSquare,
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
import { signOut, useAuthSession, useIsMaster } from "@/lib/auth";
import { getMyContext, getLeadsNeedingReviewCount } from "@/lib/tenant.functions";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  badge?: string;
};

const WORKSPACE: NavItem[] = [
  { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", url: "/dashboard/leads", icon: Users },
  { title: "Pipeline", url: "/dashboard/pipeline", icon: KanbanSquare, badge: "Em breve" },
  { title: "Campanhas", url: "/dashboard/campaigns", icon: Send },
  { title: "Caixa de entrada", url: "/dashboard/inbox", icon: Inbox },
];

const TOOLS: NavItem[] = [
  { title: "Integrações", url: "/dashboard/integrations", icon: Plug },
  { title: "Builder", url: "/dashboard/builder", icon: Blocks, badge: "Beta" },
];

const ADMIN: NavItem[] = [{ title: "Configurações", url: "/dashboard/settings", icon: Settings }];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const { data: isMaster } = useIsMaster(user?.id);
  const fetchContext = useServerFn(getMyContext);
  const fetchReviewCount = useServerFn(getLeadsNeedingReviewCount);
  const { data: tenantContext } = useQuery({
    enabled: !!user,
    queryKey: ["tenant", "context"],
    queryFn: () => fetchContext(),
  });
  const { data: reviewCount } = useQuery({
    enabled: !!user,
    queryKey: ["leads-needing-review-count"],
    queryFn: () => fetchReviewCount(),
    refetchInterval: 60_000,
  });
  const reviewBadge = reviewCount?.count && reviewCount.count > 0 ? String(reviewCount.count) : null;

  const isActive = (url: string) =>
    url === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(url);

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "Sua conta";
  const organizationName = tenantContext?.organization?.name ?? "Sem organização ativa";
  const roleLabel = tenantContext?.isMaster
    ? "Master admin"
    : tenantContext?.role === "company_admin"
      ? "Admin da organização"
      : tenantContext?.role === "user"
        ? "Agente"
        : "Membro";
  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 pt-3">
        <Link to="/dashboard" className="flex items-center gap-2 px-1.5 py-1">
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
              {WORKSPACE.map((item) => {
                const badge = item.url === "/dashboard/leads" && reviewBadge ? reviewBadge : item.badge;
                const badgeTone = item.url === "/dashboard/leads" && reviewBadge
                  ? "bg-amber-500/15 text-amber-700"
                  : "bg-muted text-muted-foreground";
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                        {badge && (
                          <Badge
                            variant="secondary"
                            className={cn("ml-auto border-transparent text-[0.6rem] px-1.5 py-0 font-medium", badgeTone)}
                          >
                            {badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.7rem] uppercase tracking-wider text-sidebar-foreground/50">
            Ferramentas
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
            Administração
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isMaster && (
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
                {initials || "·"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-sidebar-foreground">
                  {displayName}
                </div>
                <div className="truncate text-xs text-sidebar-foreground/60">
                  {organizationName}
                </div>
                <div className="truncate text-[11px] text-sidebar-foreground/45">
                  {roleLabel}
                </div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-64">
            <DropdownMenuLabel>Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
