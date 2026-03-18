"use client";
import { useState } from "react";
import {
  Settings,
  Bell,
  AlertCircle,
  CheckCircle,
  UserCircle,
  ChevronDown,
  LogOut,
  Search,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
import { toast } from "sonner";
import { StudyModeToggle } from "./StudyModeToggle";
import { StudyConfigDialog } from "./StudyConfigDialog";
import { useStudyConfig } from "../hooks/useStudyConfig";
import { cn } from "@/lib/utils";

export function AppHeaderFull() {
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const { user, signOut } = useAuth();
  const { config } = useStudyConfig();

  // Mock notifications data
  const notifications = {
    unread: 3,
    hasAlerts: true,
  };

  // Mock user level data
  const userLevel = {
    level: 12,
    xp: 2450,
    xpToNext: 3000,
    streak: 7,
  };

  const getConfigStatus = () => {
    if (!config) return { percentage: 0, color: "red", label: "Não configurado" };

    const completedSections = config.metadata?.completedSections || [];
    const weights = { essential: 40, times: 20, preferences: 20, goals: 20 };
    const sections = ["essential", "times", "preferences", "goals"] as const;

    let total = 0;
    sections.forEach((section) => {
      if (completedSections.includes(section)) {
        total += weights[section];
      }
    });

    if (total === 0) return { percentage: 0, color: "red", label: "Não configurado" };
    if (total < 100) return { percentage: total, color: "yellow", label: `${total}% configurado` };
    return { percentage: 100, color: "green", label: "Configuração completa" };
  };

  const configStatus = getConfigStatus();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logout realizado com sucesso!");
    } catch (error) {
      console.error("Erro no logout:", error);
      toast.error("Erro ao fazer logout");
    }
  };

  const xpPercentage = (userLevel.xp / userLevel.xpToNext) * 100;

  return (
    <header className="w-full border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
      <div className="flex items-center justify-between px-4 md:px-6 py-3">
        {/* Left - Search */}
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar..."
              className={cn(
                "h-10 w-64 pl-10 pr-4 rounded-xl text-sm",
                "bg-neutral-100 dark:bg-neutral-800",
                "border border-transparent focus:border-primary",
                "text-neutral-900 dark:text-white placeholder:text-neutral-500",
                "outline-none transition-colors"
              )}
            />
          </div>
        </div>

        {/* Center - Study Mode Toggle */}
        <div className="flex items-center">
          <StudyModeToggle />
        </div>

        {/* Right - User Info, Level, Actions */}
        <div className="flex items-center gap-3">
          {/* Level Badge */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">LV</span>
                  <span className="text-sm font-bold text-purple-700 dark:text-purple-300">{userLevel.level}</span>
                </div>
                <div className="w-16 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${xpPercentage}%` }}
                  />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="space-y-1">
                <p className="font-semibold">Nível {userLevel.level}</p>
                <p className="text-xs text-muted-foreground">{userLevel.xp} / {userLevel.xpToNext} XP</p>
                <p className="text-xs text-orange-500">🔥 {userLevel.streak} dias de streak</p>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Streak Badge */}
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">{userLevel.streak}</span>
          </div>

          {/* Config Status */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9"
                onClick={() => setShowConfigDialog(true)}
              >
                <Settings
                  className={cn(
                    "h-4 w-4",
                    configStatus.color === "green" && "text-green-500"
                  )}
                />
                {configStatus.color === "red" && (
                  <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                )}
                {configStatus.color === "yellow" && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-yellow-500 rounded-full text-[8px] text-white font-bold flex items-center justify-center">
                    {configStatus.percentage}
                  </span>
                )}
                {configStatus.color === "green" && (
                  <CheckCircle className="absolute -top-0.5 -right-0.5 h-3 w-3 text-green-500 fill-white" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{configStatus.label}</p>
            </TooltipContent>
          </Tooltip>

          {/* Notifications */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Bell className="h-4 w-4" />
                {notifications.unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                    {notifications.unread > 9 ? "9+" : notifications.unread}
                  </span>
                )}
                {notifications.hasAlerts && (
                  <AlertCircle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-orange-500 fill-current" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Notificações</p>
            </TooltipContent>
          </Tooltip>

          {/* User Menu */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 py-1.5 h-auto">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      {user.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-sm font-medium truncate max-w-24">
                      {user.email?.split("@")[0]}
                    </span>
                    <span className="text-xs text-muted-foreground">Premium</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem>
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Config Dialog */}
      <StudyConfigDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        onComplete={() => {
          toast.success("Configuração salva com sucesso!");
        }}
      />
    </header>
  );
}
