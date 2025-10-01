import React from 'react';
import { CheckCircle, Clock, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SyncStatus {
  pending: number;
  syncing: boolean;
  lastSync?: Date;
  error?: string;
}

interface SyncStatusIndicatorProps {
  syncStatus: SyncStatus;
  onForceSync?: () => void;
  className?: string;
}

export function SyncStatusIndicator({ 
  syncStatus, 
  onForceSync, 
  className = "" 
}: SyncStatusIndicatorProps) {
  const { pending, syncing, lastSync, error } = syncStatus;

  const getStatusInfo = () => {
    if (error) {
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        color: 'destructive' as const,
        text: 'Erro de sincronização',
        description: error
      };
    }

    if (syncing) {
      return {
        icon: <Clock className="h-4 w-4 animate-spin" />,
        color: 'secondary' as const,
        text: 'Sincronizando...',
        description: `Salvando ${pending} nota(s)`
      };
    }

    if (pending > 0) {
      return {
        icon: <WifiOff className="h-4 w-4" />,
        color: 'outline' as const,
        text: `${pending} pendente(s)`,
        description: 'Notas aguardando sincronização'
      };
    }

    return {
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'default' as const,
      text: 'Sincronizado',
      description: lastSync 
        ? `Última sincronização: ${lastSync.toLocaleTimeString()}`
        : 'Todas as notas estão sincronizadas'
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 ${className}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">
              <Badge 
                variant={statusInfo.color}
                className="flex items-center gap-1"
              >
                {statusInfo.icon}
                <span className="text-xs">{statusInfo.text}</span>
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{statusInfo.description}</p>
          </TooltipContent>
        </Tooltip>

        {(pending > 0 || error) && onForceSync && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={onForceSync}
                disabled={syncing}
                className="h-6 px-2"
              >
                <Wifi className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Forçar sincronização</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
