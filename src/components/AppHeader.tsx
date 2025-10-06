import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  Calendar,
  Play,
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
  Bell,
  AlertCircle,
  CheckCircle,
  Wrench,
  Code2,
  BookOpen,
  ChevronUp,
  StickyNote,
  Edit3
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { UserAvatar } from "./UserAvatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { toast } from "sonner";
import { StudyModeToggle } from "./StudyModeToggle";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: Home },
    { title: "Flashcards", url: "/flashcards", icon: Play },
  { title: "Conteúdos", url: "/documents-organization", icon: BookOpen },
  { title: "Questões", url: "/questoes", icon: HelpCircle },
];

const toolsItems = [
  { title: "Cronograma", url: "/cronograma", icon: Calendar },
  { title: "Resumos", url: "/resumos-list", icon: FileText },
  { title: "Notas", url: "/notes", icon: StickyNote },
  { title: "Criar Questão", url: "/criar-questao", icon: Plus },
  { title: "Editor Plate", url: "/plate-editor", icon: Edit3 },
  { title: "Configurações", url: "/settings", icon: Settings },
  { title: "Filtros", url: "/filters", icon: Filter },
  { title: "Insights", url: "/insights", icon: Lightbulb },
  { title: "Analytics", url: "/analytics", icon: TrendingUp },
  { title: "Marketplace", url: "/marketplace", icon: ShoppingCart },
  { title: "Playground", url: "/playground", icon: Code2 },
];

export function AppHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const location = typeof window !== 'undefined' ? useLocation() : null;
  const currentPath = location?.pathname;
  const { user, signOut } = useAuth();

  // Mock notifications data - replace with actual notifications context
  const notifications = {
    unread: 3,
    hasAlerts: true,
    hasSuccess: false
  };

  const isActive = (path: string) => {
    if (!currentPath) return false;
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const getNavClassName = (path: string) => {
    const baseClasses = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95";
    if (isActive(path)) {
      return `${baseClasses} bg-linear-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700`;
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
        <div className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-2 md:py-1 bg-slate-900 rounded-b-xl">
          {/* Espaçador esquerdo - Desktop apenas */}
          <div className="hidden md:flex flex-1"></div>
          
          {/* Logo Centralizada - Desktop apenas */}
          <div className="hidden md:flex items-center gap-2 justify-center">
            <div className="p-1.5 rounded-lg bg-linear-to-br from-blue-600 to-purple-600 shadow-md">
              <Skull className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Meta 01</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
              className="h-8 w-8 p-0 ml-2 hover:bg-slate-800 text-slate-300 hover:text-white transition-all duration-200"
              title={isHeaderCollapsed ? "Expandir header" : "Colapsar header"}
            >
              {isHeaderCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {/* Espaçador mobile para centralizar avatar */}
          <div className="md:hidden"></div>

          <div className="flex items-center gap-1 md:gap-2 md:flex-1 md:justify-end">
            {/* Notificações - Desktop apenas */}
            <div className="relative hidden md:block">
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

            {/* Barrinha antes do Avatar Mobile */}
            <div className="md:hidden w-0.5 h-8 bg-linear-to-b from-blue-500 to-purple-600 rounded-full"></div>
            
            {/* Avatar Mobile */}
            <div className="md:hidden">
              <UserAvatar variant="mobile" />
            </div>
            
            {/* Barrinha depois do Avatar Mobile */}
            <div className="md:hidden w-0.5 h-8 bg-linear-to-b from-purple-600 to-blue-500 rounded-full"></div>

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

        {/* Linha Inferior: Avatar + Toggle de Modo de Estudo (Desktop apenas) */}
        {!isHeaderCollapsed && (
          <div className="hidden md:flex items-center justify-between px-4 lg:px-6 py-3 bg-slate-900 backdrop-blur-xs border-t border-slate-700/50 rounded-t-xl transition-all duration-300 ease-in-out">
            {/* Avatar do Usuário */}
            <div className="flex items-center">
              <UserAvatar variant="desktop" />
            </div>

            {/* Toggle de Modo de Estudo e Ferramentas */}
            <div className="flex items-center gap-4 mt-24">
              <StudyModeToggle />
              
              {/* Dropdown de Ferramentas */}
              <DropdownMenu open={isToolsOpen} onOpenChange={setIsToolsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 border-slate-300"
                  >
                    <Wrench className="h-4 w-4" />
                    <span className="text-sm font-medium">Ferramentas</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {toolsItems.map((item) => (
                    <DropdownMenuItem key={item.title} asChild>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-slate-100 rounded-sm"
                        onClick={() => setIsToolsOpen(false)}
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
        )}
        
      </div>
      
      {/* Barra Laranja Divisória - Fora do container para ocupar toda a largura */}
      <div className="w-full h-1 bg-linear-to-r from-orange-400 via-orange-500 to-orange-600 shadow-xs"></div>
    </header>
  );
}