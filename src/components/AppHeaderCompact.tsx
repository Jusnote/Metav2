"use client";
import { useState } from "react";
import {
  Bell,
  Search,
  Settings,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
import { StudyConfigDialog } from "./StudyConfigDialog";
import { useStudyConfig } from "../hooks/useStudyConfig";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AppHeaderCompact() {
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const { config } = useStudyConfig();

  // Mock notifications
  const notifications = {
    unread: 3,
    hasAlerts: true,
  };

  // Config status
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

  return (
    <header className="h-14 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-4 flex items-center justify-between shrink-0">
      {/* Left - Search */}
      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar..."
            className={cn(
              "h-9 w-64 pl-9 pr-4 rounded-lg text-sm",
              "bg-neutral-100 dark:bg-neutral-800",
              "border border-transparent focus:border-primary",
              "text-neutral-900 dark:text-white placeholder:text-neutral-500",
              "outline-none transition-colors"
            )}
          />
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2">
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
