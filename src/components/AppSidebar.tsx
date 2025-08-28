import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Home,
  Calendar,
  Play,
  Shield,
  FileText,
  Menu,
  Settings,
  Filter,
  Lightbulb,
  TrendingUp,
  ShoppingCart,
  Skull,
  HelpCircle,
  Plus,
  LogOut,
  UserCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Cronograma", url: "/cronograma", icon: Calendar },
  { title: "Flashcards", url: "/flashcards", icon: Play },
  { title: "Resumos", url: "/resumos-list", icon: FileText },
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

export function AppSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const getNavClassName = (path: string) => {
    return isActive(path)
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "hover:bg-sidebar-accent/50 text-sidebar-foreground";
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logout realizado com sucesso!");
    } catch (error) {
      toast.error("Erro ao fazer logout.");
    }
  };

  return (
    <TooltipProvider>
      <div 
        className="fixed left-0 top-0 bg-sidebar border-r border-sidebar-border w-20 hover:w-60 transition-all duration-300 group h-screen flex flex-col z-50"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center justify-center">
              <div className="p-2 rounded-lg bg-sidebar-primary">
                <Skull className="h-6 w-6 text-sidebar-primary-foreground" />
              </div>
            </div>
          </div>

          {/* Main Navigation */}
          <div className="flex-1">
            <div className="p-2">
              <div className="text-sidebar-foreground/60 text-xs font-medium mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-3">
                Navegação
              </div>
              <div className="space-y-1 px-2">
                {navigationItems.map((item) => (
                  <div key={item.title}>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === "/"}
                          className={`${getNavClassName(item.url)} flex items-center py-2 rounded-lg transition-colors group/item w-full group-hover:gap-3 group-hover:px-3 group-hover:justify-start justify-center`}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden whitespace-nowrap">{item.title}</span>
                        </NavLink>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="group-hover:hidden">
                        <p>{item.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </div>

            {/* Tools */}
            <div className="p-2">
              <div className="text-sidebar-foreground/60 text-xs font-medium mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-3">
                Ferramentas
              </div>
              <div className="space-y-1 px-2">
                {toolsItems.map((item) => (
                  <div key={item.title}>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <NavLink
                          to={item.url}
                          className={`${getNavClassName(item.url)} flex items-center py-2 rounded-lg transition-colors group/item w-full group-hover:gap-3 group-hover:px-3 group-hover:justify-start justify-center`}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden whitespace-nowrap">{item.title}</span>
                        </NavLink>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="group-hover:hidden">
                        <p>{item.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* User Info and Logout */}
          {user && (
            <div className="p-2 border-t border-sidebar-border mt-auto">
              <div className="flex items-center justify-center group-hover:justify-start gap-3 px-3 py-2 rounded-lg text-sidebar-foreground">
                <UserCircle className="h-5 w-5 flex-shrink-0" />
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden whitespace-nowrap">
                  {user.email}
                </span>
              </div>
              <Button
                variant="ghost"
                className="w-full flex items-center justify-center group-hover:justify-start gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/50"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5 flex-shrink-0" />
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden whitespace-nowrap">Sair</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

