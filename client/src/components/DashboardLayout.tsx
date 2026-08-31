import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  Package,
  Calculator,
  Layers,
  ShoppingBag,
  Users,
  Settings,
  LogOut,
  PanelLeft,
  Warehouse,
  BarChart3,
  Heart,
  ExternalLink,
  Store,
  ClipboardList,
  CreditCard,
  Tag,
  ShoppingCart,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { BrandSymbol } from "./BrandLogo";
import { Button } from "./ui/button";
import { PERMISSIONS, hasPermission } from "@shared/permissions";

type MenuItem = { icon: LucideIcon; label: string; path: string; permission?: import("@shared/permissions").PermissionKey };
type MenuModule = { label: string; adminOnly?: boolean; items: MenuItem[] };

const menuModules: MenuModule[] = [
  {
    label: "Início",
    items: [{ icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", permission: PERMISSIONS.DASHBOARD }],
  },
  {
    label: "Produtos",
    items: [
      { icon: Package, label: "Produtos", path: "/produtos", permission: PERMISSIONS.PRODUCTS },
      { icon: ShoppingBag, label: "Quase Zero", path: "/produtos", permission: PERMISSIONS.PRODUCTS },
      { icon: Warehouse, label: "Estoque", path: "/estoque", permission: PERMISSIONS.INVENTORY },
      { icon: Layers, label: "Entrada", path: "/lotes", permission: PERMISSIONS.INVENTORY },
    ],
  },
  {
    label: "B2B Ideal Prime",
    items: [{ icon: Building2, label: "Operação B2B", path: "/b2b-admin", permission: PERMISSIONS.B2B_OPERATIONS }],
  },
  {
    label: "Vendas",
    items: [
      { icon: ClipboardList, label: "Pedidos", path: "/pedidos", permission: PERMISSIONS.SALES },
      { icon: Heart, label: "Desejos", path: "/desejos-admin", permission: PERMISSIONS.SALES },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { icon: Calculator, label: "Simulações", path: "/simulacoes", permission: PERMISSIONS.PRICING },
      { icon: ShoppingCart, label: "Cotações", path: "/cotacoes", permission: PERMISSIONS.PRICING },
      {
        icon: BarChart3,
        label: "Gestão de Cotações",
        path: "/cotacoes-gestao",
        permission: PERMISSIONS.PRICING,
      },
      { icon: BarChart3, label: "Relatórios", path: "/relatorios", permission: PERMISSIONS.REPORTS },
    ],
  },
  {
    label: "Administração",
    adminOnly: true,
    items: [
      { icon: Users, label: "Usuários", path: "/usuarios", permission: PERMISSIONS.USERS },
      { icon: Tag, label: "Categorias", path: "/categorias", permission: PERMISSIONS.SETTINGS },
      { icon: Users, label: "Vendedores", path: "/vendedores", permission: PERMISSIONS.USERS },
      { icon: Settings, label: "Configurações", path: "/configuracoes", permission: PERMISSIONS.SETTINGS },
      {
        icon: CreditCard,
        label: "Pagamento",
        path: "/configuracoes-pagamento",
        permission: PERMISSIONS.SETTINGS,
      },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full">
          <h1 className="text-2xl font-semibold tracking-tight text-center">
            Acesso restrito
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Faça login para acessar o painel administrativo.
          </p>
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
            size="lg"
            className="w-full"
          >
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - left;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH)
        setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const activeLabel =
    menuModules
      .flatMap(module => module.items)
      .find(
        item => location === item.path || location.startsWith(item.path + "/")
      )?.label ?? "Menu";

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b">
            <div className="flex items-center gap-3 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none shrink-0"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-md overflow-hidden shrink-0 bg-transparent flex items-center justify-center">
                    <BrandSymbol className="h-full w-full" />
                  </div>
                  <span className="font-semibold tracking-tight truncate text-sm">
                    Ideal Prime
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-1 overflow-y-auto py-2">
            {menuModules.map((module, moduleIndex) => {
              if (module.adminOnly && !isAdmin) return null;
              const visibleItems = module.items.filter((item) =>
                item.permission ? hasPermission(user?.permissions, item.permission, user?.role) : true,
              );
              if (!visibleItems.length) return null;
              return (
                <div key={module.label} className="space-y-1">
                  {!isCollapsed ? (
                    <div className="px-4 pb-1 pt-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {module.label}
                      </span>
                    </div>
                  ) : moduleIndex > 0 ? (
                    <div className="mx-4 my-2 border-t" />
                  ) : null}
                  <SidebarMenu className="gap-0.5 px-2">
                    {visibleItems.map(item => {
                      const isActive =
                        location === item.path ||
                        location.startsWith(item.path + "/");
                      return (
                        <SidebarMenuItem key={`${module.label}-${item.label}`}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => setLocation(item.path)}
                            tooltip={item.label}
                            className="h-9 w-full whitespace-nowrap font-normal"
                          >
                            <item.icon
                              className={`h-4 w-4 shrink-0 ${
                                isActive ? "text-primary" : ""
                              }`}
                            />
                            <span className="min-w-0 truncate">
                              {item.label}
                            </span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </div>
              );
            })}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t">
            <a
              href="/vitrine"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-accent/60 transition-colors w-full text-sm font-medium mb-1 ${isCollapsed ? "justify-center" : ""}`}
              title="Ver Vitrine Pública"
            >
              <Store className="h-4 w-4 text-primary shrink-0" />
              {!isCollapsed && (
                <span className="flex-1 truncate text-primary">
                  Ver Vitrine
                </span>
              )}
              {!isCollapsed && (
                <ExternalLink className="h-3 w-3 text-primary opacity-60" />
              )}
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors w-full text-left focus:outline-none">
                  <Avatar className="h-8 w-8 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "-"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {user?.email || "-"}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLocation("/configuracoes")}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation("/configuracoes-pagamento")}
                  className="cursor-pointer"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Configurações de Pagamento
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (!isCollapsed) setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        <div className="flex border-b h-14 items-center gap-2 bg-background/95 px-4 backdrop-blur sticky top-0 z-40 justify-between">
          <div className="flex items-center gap-2">
            {isMobile && <SidebarTrigger className="h-9 w-9 rounded-lg" />}
            {!isMobile && (
              <SidebarTrigger className="h-8 w-8 rounded-md text-muted-foreground" />
            )}
            <span className="text-muted-foreground text-sm hidden sm:inline">
              /
            </span>
            <span className="font-medium text-sm">{activeLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/vitrine"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/5 transition-colors"
            >
              <Store className="h-3.5 w-3.5" />
              Ver Vitrine
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          </div>
        </div>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
