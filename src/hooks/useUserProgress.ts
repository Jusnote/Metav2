import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export interface Medal {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt?: Date;
  rarity: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface UserProgress {
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  totalXP: number;
  medals: Medal[];
  studyStreak: number;
  cardsStudied: number;
  perfectAnswers: number;
}

const MEDALS_DATA: Medal[] = [
  {
    id: 'first-study',
    name: 'Primeiro Estudo',
    description: 'Complete seu primeiro estudo',
    icon: '🎯',
    rarity: 'bronze'
  },
  {
    id: 'streak-7',
    name: 'Semana Dedicada',
    description: 'Estude por 7 dias consecutivos',
    icon: '🔥',
    rarity: 'silver'
  },
  {
    id: 'cards-100',
    name: 'Centurião',
    description: 'Estude 100 cartões',
    icon: '💯',
    rarity: 'silver'
  },
  {
    id: 'perfect-50',
    name: 'Perfeccionista',
    description: 'Acerte 50 cartões perfeitamente',
    icon: '⭐',
    rarity: 'gold'
  },
  {
    id: 'level-10',
    name: 'Veterano',
    description: 'Alcance o nível 10',
    icon: '🏆',
    rarity: 'gold'
  },
  {
    id: 'streak-30',
    name: 'Mestre da Consistência',
    description: 'Estude por 30 dias consecutivos',
    icon: '👑',
    rarity: 'platinum'
  }
];

function calculateLevel(totalXP: number): number {
  // Fórmula: Level = floor(sqrt(totalXP / 100))
  return Math.floor(Math.sqrt(totalXP / 100)) + 1;
}

function calculateXPForLevel(level: number): number {
  // XP necessário para alcançar um nível específico
  return Math.pow(level - 1, 2) * 100;
}

function calculateXPToNextLevel(currentXP: number, level: number): number {
  const nextLevelXP = calculateXPForLevel(level + 1);
  return nextLevelXP - currentXP;
}

export function useUserProgress(): UserProgress {
  const { user } = useAuth();
  const [progress, setProgress] = useState<UserProgress>({
    level: 1,
    currentXP: 0,
    xpToNextLevel: 100,
    totalXP: 0,
    medals: [],
    studyStreak: 0,
    cardsStudied: 0,
    perfectAnswers: 0
  });

  // Simular dados do usuário (em produção, viria do Supabase)
  useEffect(() => {
    if (!user) return;

    // Simular dados salvos no localStorage para demonstração
    const savedProgress = localStorage.getItem(`user-progress-${user.id}`);
    
    if (savedProgress) {
      const parsed = JSON.parse(savedProgress);
      const level = calculateLevel(parsed.totalXP);
      const xpToNextLevel = calculateXPToNextLevel(parsed.totalXP, level);
      
      setProgress({
        ...parsed,
        level,
        xpToNextLevel,
        medals: checkAndAwardMedals(parsed)
      });
    } else {
      // Dados iniciais para demonstração
      const initialData = {
        level: 3,
        currentXP: 450,
        totalXP: 450,
        xpToNextLevel: calculateXPToNextLevel(450, 3),
        medals: [],
        studyStreak: 5,
        cardsStudied: 87,
        perfectAnswers: 23
      };
      
      const updatedData = {
        ...initialData,
        medals: checkAndAwardMedals(initialData)
      };
      
      setProgress(updatedData);
      localStorage.setItem(`user-progress-${user.id}`, JSON.stringify(updatedData));
    }
  }, [user]);

  function checkAndAwardMedals(data: Partial<UserProgress>): Medal[] {
    const earnedMedals: Medal[] = [];
    
    MEDALS_DATA.forEach(medal => {
      let earned = false;
      
      switch (medal.id) {
        case 'first-study':
          earned = (data.cardsStudied || 0) > 0;
          break;
        case 'streak-7':
          earned = (data.studyStreak || 0) >= 7;
          break;
        case 'cards-100':
          earned = (data.cardsStudied || 0) >= 100;
          break;
        case 'perfect-50':
          earned = (data.perfectAnswers || 0) >= 50;
          break;
        case 'level-10':
          earned = (data.level || 1) >= 10;
          break;
        case 'streak-30':
          earned = (data.studyStreak || 0) >= 30;
          break;
      }
      
      if (earned) {
        earnedMedals.push({
          ...medal,
          earnedAt: new Date()
        });
      }
    });
    
    return earnedMedals;
  }

  return progress;
}
