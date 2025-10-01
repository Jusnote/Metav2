import React, { useState } from 'react';
import { User, Trophy, Star, Flame, Target, TrendingUp } from 'lucide-react';
import { useUserProgress, Medal } from '../hooks/useUserProgress';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

interface UserAvatarProps {
  variant?: 'desktop' | 'mobile';
  showExpanded?: boolean;
}

const getMedalColor = (rarity: Medal['rarity']) => {
  switch (rarity) {
    case 'bronze': return 'bg-amber-600';
    case 'silver': return 'bg-gray-400';
    case 'gold': return 'bg-yellow-500';
    case 'platinum': return 'bg-purple-500';
    default: return 'bg-gray-400';
  }
};

const getMedalBorder = (rarity: Medal['rarity']) => {
  switch (rarity) {
    case 'bronze': return 'border-amber-600';
    case 'silver': return 'border-gray-400';
    case 'gold': return 'border-yellow-500';
    case 'platinum': return 'border-purple-500';
    default: return 'border-gray-400';
  }
};

const getLevelColor = (level: number) => {
  if (level >= 20) return 'border-purple-500 bg-purple-100';
  if (level >= 15) return 'border-yellow-500 bg-yellow-100';
  if (level >= 10) return 'border-blue-500 bg-blue-100';
  if (level >= 5) return 'border-green-500 bg-green-100';
  return 'border-gray-400 bg-gray-100';
};

export function UserAvatar({ variant = 'desktop', showExpanded = false }: UserAvatarProps) {
  const { user } = useAuth();
  const progress = useUserProgress();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!user) return null;

  const xpPercentage = ((progress.totalXP - (Math.pow(progress.level - 1, 2) * 100)) / 
    (Math.pow(progress.level, 2) * 100 - Math.pow(progress.level - 1, 2) * 100)) * 100;

  const UserAvatarContent = () => (
    <div className={`flex items-center gap-2.5 py-1 px-3 rounded-lg transition-all duration-200 ${
      variant === 'mobile' 
        ? 'cursor-pointer hover:bg-white/10 border-0 bg-transparent shadow-none' 
        : 'border border-slate-900 bg-slate-900 backdrop-blur-xs shadow-xs hover:shadow-md hover:bg-slate-800'
    } ${variant === 'desktop' ? 'min-w-[490px]' : ''}`}>
      {/* Avatar com nível */}
      <div className="relative shrink-0">
        <div className="w-32 h-25 rounded-lg overflow-hidden">
          <img 
            src="/avatar1.png" 
            alt="Avatar" 
            className="w-full h-full rounded-lg object-cover"
          />
        </div>
        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white ${
          getLevelColor(progress.level).split(' ')[0]
        }`}>
          {progress.level}
        </div>
      </div>

      {/* Versão mobile - informações compactas */}
      {variant === 'mobile' && (
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white truncate">
              {user.email?.split('@')[0] || 'Usuário'}
            </span>
            <Badge variant="secondary" className="text-xs">
              Nível {progress.level}
            </Badge>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-gray-300">
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-blue-500" />
              <span>{progress.totalXP} XP</span>
            </div>
            <div className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-500" />
              <span>{progress.streak || 0} dias</span>
            </div>
            {progress.medals.length > 0 && (
              <div className="flex items-center gap-1">
                <Trophy className="w-3 h-3 text-yellow-500" />
                <span>{progress.medals.length}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Informações expandidas do usuário (apenas desktop) */}
      {variant === 'desktop' && (
        <div className="flex-1 flex items-center gap-3">
          {/* Primeira seção: Informações básicas */}
          <div className="flex-[1.2] space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white truncate">
                {user.email?.split('@')[0] || 'Usuário'}
              </span>
              <Badge variant="secondary" className="text-xs">
                Nível {progress.level}
              </Badge>
            </div>
            
            {/* Barra de XP expandida */}
             <div className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Progresso XP</span>
                <span className="font-medium text-white">{Math.round(xpPercentage)}%</span>
              </div>
              <Progress value={xpPercentage} className="h-2" />
              <div className="flex justify-between text-xs text-slate-400">
                <span>{progress.totalXP} XP</span>
                <span>{progress.xpToNextLevel} para próximo nível</span>
              </div>
            </div>

            {/* Streak de dias */}
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-medium text-slate-300">
                {progress.streak || 0} dias consecutivos
              </span>
            </div>
          </div>

          {/* Divisor vertical */}
          <div className="h-16 w-px bg-slate-600 mx-1"></div>

          {/* Segunda seção: Medalhas */}
          <div className="flex-[0.8] flex items-center justify-center">
            {/* Medalhas */}
            {progress.medals.length > 0 && (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs font-medium text-slate-300">
                    {progress.medals.length} medalhas
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {progress.medals.slice(0, 6).map((medal) => (
                    <span key={medal.id} className="text-sm" title={medal.name}>
                      {medal.icon}
                    </span>
                  ))}
                  {progress.medals.length > 6 && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      +{progress.medals.length - 6}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );

  const ExpandedModal = () => (
    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-16 h-16 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold border-2 ${
              getLevelColor(progress.level)
            }`}>
              <User className="w-8 h-8" />
            </div>
            <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white border-2 border-white ${
              getLevelColor(progress.level).split(' ')[0]
            }`}>
              {progress.level}
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900">
              {user.email?.split('@')[0] || 'Usuário'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-sm">
                Nível {progress.level}
              </Badge>
              <Badge variant="outline" className="text-sm">
                {progress.totalXP} XP Total
              </Badge>
            </div>
          </div>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6">
        {/* Progresso XP */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <Star className="w-4 h-4 text-blue-500" />
              Progresso de Experiência
            </h4>
            <span className="text-sm font-medium text-blue-600">
              {Math.round(xpPercentage)}%
            </span>
          </div>
          <Progress value={xpPercentage} className="h-4" />
          <div className="flex justify-between text-sm text-gray-600">
            <span>{progress.totalXP} XP atual</span>
            <span>{progress.xpToNextLevel} XP para nível {progress.level + 1}</span>
          </div>
        </div>

        {/* Estatísticas principais */}
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            Estatísticas de Estudo
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-4 bg-linear-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="text-2xl font-bold text-orange-700">{progress.studyStreak || progress.streak || 0}</span>
              </div>
              <p className="text-sm font-medium text-orange-600">Dias Consecutivos</p>
            </div>
            <div className="text-center p-4 bg-linear-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Target className="w-5 h-5 text-blue-500" />
                <span className="text-2xl font-bold text-blue-700">{progress.cardsStudied || 0}</span>
              </div>
              <p className="text-sm font-medium text-blue-600">Cartões Estudados</p>
            </div>
          </div>
        </div>

        {/* Estatísticas adicionais */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-700">{progress.level}</div>
            <p className="text-xs text-gray-600">Nível Atual</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-700">{Math.round(xpPercentage)}%</div>
            <p className="text-xs text-gray-600">Progresso</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-700">{progress.medals.length}</div>
            <p className="text-xs text-gray-600">Medalhas</p>
          </div>
        </div>

        {/* Medalhas */}
        {progress.medals.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              Coleção de Medalhas ({progress.medals.length})
            </h4>
            <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto">
              {progress.medals.map((medal) => (
                <div key={medal.id} className={`p-3 rounded-lg border-2 ${getMedalBorder(medal.rarity)} bg-linear-to-r from-white to-gray-50 hover:shadow-md transition-shadow`}>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      <span className="text-2xl">{medal.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{medal.name}</p>
                        <Badge variant="outline" className={`text-xs ${getMedalColor(medal.rarity)} text-white border-0 capitalize`}>
                          {medal.rarity}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{medal.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              Medalhas
            </h4>
            <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <Trophy className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">Nenhuma medalha conquistada ainda</p>
              <p className="text-xs text-gray-500 mt-1">Continue estudando para desbloquear suas primeiras medalhas!</p>
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );

  if (variant === 'mobile') {
    return (
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="p-2">
            <UserAvatarContent />
          </Button>
        </DialogTrigger>
        <ExpandedModal />
      </Dialog>
    );
  }

  if (showExpanded) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" className="p-2 h-auto">
            <UserAvatarContent />
          </Button>
        </DialogTrigger>
        <ExpandedModal />
      </Dialog>
    );
  }

  return <UserAvatarContent />;
}