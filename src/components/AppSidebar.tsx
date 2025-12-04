import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
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
  Code2,
  StickyNote,
  Edit3
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { usePlateDocuments } from "../hooks/usePlateDocuments";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useMemo } from "react";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: Home },
    { title: "Flashcards", url: "/flashcards", icon: Play },
  { title: "Resumos", url: "/resumos-list", icon: FileText },
  { title: "Questões", url: "/questoes", icon: HelpCircle },
  { title: "Criar Questão", url: "/criar-questao", icon: Plus },

  { title: "Configurações", url: "/settings", icon: Settings },
];

const toolsItems = [
  { title: "Cronograma", url: "/cronograma", icon: Calendar },
  { title: "Notas", url: "/notes", icon: StickyNote },
  { title: "Editor Plate", url: "/plate-editor", icon: Edit3 },
  { title: "Filtros", url: "/filters", icon: Filter },
  { title: "Insights", url: "/insights", icon: Lightbulb },
  { title: "Analytics", url: "/analytics", icon: TrendingUp },
  { title: "Marketplace", url: "/marketplace", icon: ShoppingCart },
  { title: "Playground", url: "/playground", icon: Code2 },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = typeof window !== 'undefined' ? useLocation() : null;
  const currentPath = location?.pathname;
  const { user, signOut } = useAuth();
  const { documents } = usePlateDocuments();

  // Pegar os 5 documentos mais recentes
  const recentDocuments = useMemo(() => {
    return [...documents]
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())
      .slice(0, 5);
  }, [documents]);

  const isActive = (path: string) => {
    if (!currentPath) return false;
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
                          <item.icon className="h-5 w-5 shrink-0" />
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
                          <item.icon className="h-5 w-5 shrink-0" />
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

            {/* Recent Documents */}
            {recentDocuments.length > 0 && (
              <div className="p-2">
                <div className="text-sidebar-foreground/60 text-xs font-medium mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-3">
                  Recentes
                </div>
                <div className="space-y-1 px-2">
                  {recentDocuments.map((doc) => (
                    <div key={doc.id}>
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => navigate(`/plate-editor?doc=${doc.id}`)}
                            className="hover:bg-sidebar-accent/50 text-sidebar-foreground flex items-center py-2 rounded-lg transition-colors group/item w-full group-hover:gap-3 group-hover:px-3 group-hover:justify-start justify-center"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden whitespace-nowrap text-ellipsis text-sm">
                              {doc.title}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="group-hover:hidden max-w-xs">
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.updated_at || doc.created_at || 0).toLocaleDateString('pt-BR')}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Info and Logout */}
          {user && (
            <div className="p-2 border-t border-sidebar-border mt-auto">
              <div className="flex items-center justify-center group-hover:justify-start gap-3 px-3 py-2 rounded-lg text-sidebar-foreground">
                <UserCircle className="h-5 w-5 shrink-0" />
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden whitespace-nowrap">
                  {user.email}
                </span>
              </div>
              <Button
                variant="ghost"
                className="w-full flex items-center justify-center group-hover:justify-start gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/50"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden whitespace-nowrap">Sair</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

