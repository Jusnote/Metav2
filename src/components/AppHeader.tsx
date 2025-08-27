import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  Calendar,
  Play,
  Shield,
  FileText,
  Settings,
  Filter,
  Lightbulb,
  TrendingUp,
  ShoppingCart,
  Skull,
  HelpCircle,
  Plus,
  LogOut,
  UserCircle,
  ChevronDown,
  Menu,
  X,
  ChevronRight,
  Bell,
  AlertCircle,
  CheckCircle,
  Wrench
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Flashcards", url: "/flashcards", icon: Play },
  { title: "Resumos", url: "/resumos-list", icon: FileText },
  { title: "Calendário", url: "/calendar", icon: Calendar },
  { title: "Questões", url: "/questoes", icon: HelpCircle },
  { title: "Criar Questão", url: "/criar-questao", icon: Plus },
  { title: "Segurança", url: "/security", icon: Shield },
  { title: "Configurações", url: "/settings", icon: Settings },
];

const toolsItems = [
  { title: "Filtros", url: "/filters", icon: Filter },
  { title: "Insights", url: "/insights", icon: Lightbulb },
  { title: "Analytics", url: "/analytics", icon: TrendingUp },
  { title: "Marketplace", url: "/marketplace", icon: ShoppingCart },
];

export function AppHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, signOut } = useAuth();

  // Mock notifications data - replace with actual notifications context
  const notifications = {
    unread: 3,
    hasAlerts: true,
    hasSuccess: false
  };

  const getBreadcrumbs = () => {
    const pathSegments = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ title: 'Dashboard', url: '/', icon: Home }];
    
    if (pathSegments.length > 0) {
      const currentItem = navigationItems.find(item => 
        item.url === currentPath || (item.url !== '/' && currentPath.startsWith(item.url))
      ) || toolsItems.find(item => 
        item.url === currentPath || (item.url !== '/' && currentPath.startsWith(item.url))
      );
      
      if (currentItem && currentItem.url !== '/') {
        breadcrumbs.push(currentItem);
      }
    }
    
    return breadcrumbs;
  };

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const getNavClassName = (path: string) => {
    const baseClasses = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95";
    if (isActive(path)) {
      return `${baseClasses} bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700`;
    }
    return `${baseClasses} text-slate-600 hover:text-slate-800 hover:bg-slate-200/80`;
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logout realizado com sucesso!");
    } catch (error) {
      console.error("Erro no logout:", error);
      toast.error("Erro ao fazer logout");
    }
  };

  return (
    <header className="w-full bg-slate-900 shadow-lg">
      {/* Container centralizado com respiro nas laterais */}
      <div className="max-w-7xl mx-auto">
        {/* Linha Superior: Logo + Notificações + Menu do usuário */}
        <div className="flex items-center justify-between px-6 lg:px-8 py-3 bg-slate-900 rounded-b-xl">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 shadow-md">
              <Skull className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white hidden sm:block">FlashCard Scribe</span>
            <span className="text-lg font-bold text-white sm:hidden">FCS</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Notificações */}
            <div className="relative">
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0 relative hover:bg-slate-800 text-slate-300 hover:text-white">
                <Bell className="h-4 w-4" />
                {notifications.unread > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                    {notifications.unread > 9 ? '9+' : notifications.unread}
                  </span>
                )}
                {notifications.hasAlerts && (
                  <AlertCircle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-orange-500 fill-current" />
                )}
                {notifications.hasSuccess && (
                  <CheckCircle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-green-500 fill-current" />
                )}
              </Button>
            </div>

            {/* Menu Mobile */}
            <div className="md:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-slate-800 text-slate-300 hover:text-white">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <SheetHeader>
                    <SheetTitle>Menu de Navegação</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Navegação</h3>
                      {navigationItems.map((item) => (
                        <NavLink
                          key={item.title}
                          to={item.url}
                          end={item.url === "/"}
                          className={`${getNavClassName(item.url)} w-full justify-start`}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Ferramentas</h3>
                      {toolsItems.map((item) => (
                        <NavLink
                          key={item.title}
                          to={item.url}
                          className={`${getNavClassName(item.url)} w-full justify-start`}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Menu do usuário */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-3 py-2 relative hover:bg-slate-800 text-slate-300 hover:text-white">
                    <UserCircle className="h-5 w-5" />
                    <span className="text-sm hidden sm:inline truncate max-w-32">{user.email}</span>
                    <ChevronDown className="h-4 w-4" />
                    {notifications.unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem>
                    <Bell className="mr-2 h-4 w-4" />
                    <span>Notificações</span>
                    {notifications.unread > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {notifications.unread}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>Perfil</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Configurações</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Linha Inferior: Navegação principal + Ferramentas (Desktop apenas) */}
        <div className="hidden md:flex items-center justify-between px-4 lg:px-6 py-3 bg-white backdrop-blur-sm border-t border-slate-200/50 rounded-t-xl">
          {/* Navegação Principal */}
          <nav className="flex items-center gap-2">
            {navigationItems.map((item) => (
              <NavLink
                key={item.title}
                to={item.url}
                end={item.url === "/"}
                className={`${getNavClassName(item.url)} group px-3 py-2 text-sm font-medium`}
              >
                <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                <span className="transition-all duration-200">{item.title}</span>
              </NavLink>
            ))}
          </nav>

          {/* Ferramentas Dropdown */}
          <div className="flex items-center">
            <DropdownMenu open={isToolsOpen} onOpenChange={setIsToolsOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border-slate-300/60 bg-white/70 text-slate-600 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-400/80 shadow-sm">
                  <Wrench className="h-4 w-4" />
                  <span>Ferramentas</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {toolsItems.map((item) => (
                  <DropdownMenuItem key={item.title} asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 w-full cursor-pointer text-sm"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}