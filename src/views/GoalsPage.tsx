import { useState } from 'react';
import { Target, Calendar, TrendingUp, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { useStudyGoals } from '@/hooks/useStudyGoals';
import { useScheduleItems } from '@/hooks/useScheduleItems';
import { GoalCreationDialog } from '@/components/goals/GoalCreationDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const GoalsPage = () => {
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const { goals, activeGoals, completedGoals, isLoading, removeGoal } = useStudyGoals();
  const { items: scheduleItems } = useScheduleItems();

  // Calcular progresso de cada meta
  const getGoalProgress = (goalId: string) => {
    const goalItems = scheduleItems.filter((item: any) => item.study_goal_id === goalId);
    const completed = goalItems.filter((item: any) => item.completed).length;
    const total = goalItems.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  };

  // Calcular dias restantes
  const getDaysRemaining = (targetDate: string) => {
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleDeleteGoal = async (goalId: string, goalTitle: string) => {
    if (confirm(`Tem certeza que deseja excluir a meta "${goalTitle}"?\n\nTodos os agendamentos relacionados também serão removidos.`)) {
      await removeGoal(goalId);
    }
  };

  const getIntensityLabel = (intensity: string) => {
    const labels = {
      light: 'Leve',
      moderate: 'Moderado',
      intensive: 'Intensivo'
    };
    return labels[intensity as keyof typeof labels] || intensity;
  };

  const getIntensityColor = (intensity: string) => {
    const colors = {
      light: 'bg-green-100 text-green-700',
      moderate: 'bg-blue-100 text-blue-700',
      intensive: 'bg-orange-100 text-orange-700'
    };
    return colors[intensity as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando metas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Target className="w-8 h-8 text-blue-600" />
                Minhas Metas de Estudo
              </h1>
              <p className="text-gray-600 mt-2">
                Gerencie seus objetivos de estudo e acompanhe seu progresso
              </p>
            </div>
            <Button
              onClick={() => setGoalDialogOpen(true)}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Target className="w-4 h-4 mr-2" />
              Nova Meta
            </Button>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Total de Metas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{goals.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Metas Ativas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{activeGoals.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Metas Concluídas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{completedGoals.length}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Metas Ativas */}
        {activeGoals.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Metas Ativas
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {activeGoals.map((goal) => {
                const progress = getGoalProgress(goal.id);
                const daysRemaining = getDaysRemaining(goal.target_date);

                return (
                  <Card key={goal.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-2">{goal.title}</CardTitle>
                          {goal.description && (
                            <CardDescription className="text-sm">{goal.description}</CardDescription>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteGoal(goal.id, goal.title)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3">
                        {/* <Badge className={getIntensityColor(goal.intensity)}>
                          {getIntensityLabel(goal.intensity)}
                        </Badge> */}
                        {goal.enable_fsrs && (
                          <Badge className="bg-purple-100 text-purple-700">
                            FSRS Ativo
                          </Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Progresso */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Progresso</span>
                          <span className="text-sm font-semibold text-blue-600">
                            {progress.completed} de {progress.total} revisões
                          </span>
                        </div>
                        <Progress value={progress.percentage} className="h-2" />
                        <p className="text-xs text-gray-500 mt-1">{progress.percentage}% concluído</p>
                      </div>

                      {/* Informações de Data */}
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">Início</p>
                            <p className="text-sm font-medium text-gray-900">
                              {format(new Date(goal.start_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">
                              {daysRemaining > 0 ? 'Faltam' : 'Concluído'}
                            </p>
                            <p className={`text-sm font-medium ${daysRemaining < 7 && daysRemaining > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                              {daysRemaining > 0 ? `${daysRemaining} dias` : format(new Date(goal.target_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Metas Concluídas */}
        {completedGoals.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Metas Concluídas
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {completedGoals.map((goal) => {
                const progress = getGoalProgress(goal.id);

                return (
                  <Card key={goal.id} className="opacity-75 hover:opacity-100 transition-opacity">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-2 line-through text-gray-600">
                            {goal.title}
                          </CardTitle>
                          {goal.description && (
                            <CardDescription className="text-sm">{goal.description}</CardDescription>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteGoal(goal.id, goal.title)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <Badge className="bg-green-100 text-green-700 w-fit">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Concluída
                      </Badge>
                    </CardHeader>

                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>{progress.total} revisões realizadas</span>
                        <span>
                          Concluída em {format(new Date(goal.target_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Estado vazio */}
        {goals.length === 0 && (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhuma meta criada ainda
            </h3>
            <p className="text-gray-600 mb-6">
              Crie sua primeira meta de estudo para começar a organizar seus estudos
            </p>
            <Button
              onClick={() => setGoalDialogOpen(true)}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Target className="w-4 h-4 mr-2" />
              Criar Primeira Meta
            </Button>
          </div>
        )}
      </div>

      <GoalCreationDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
      />
    </div>
  );
};

export default GoalsPage;
