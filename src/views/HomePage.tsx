
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Brain, 
  TrendingUp, 
  Target, 
  BookOpen,
  Play,
  Calendar,
  FileText,
  Zap,
  Award
} from 'lucide-react';
import { SSRSafeNavLink } from '../components/SSRSafeNavLink';

export default function HomePage() {
  return (
    <div className="bg-background">
      <div className="max-w-5xl mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo à plataforma EagleCode. Gerencie seus projetos e acompanhe seu progresso.
          </p>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flashcards Ativos</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">127</div>
            <p className="text-xs text-muted-foreground">
              +12% desde o mês passado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessões de Estudo</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
            <p className="text-xs text-muted-foreground">
              Esta semana
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Acerto</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87%</div>
            <p className="text-xs text-muted-foreground">
              +2.1% desde ontem
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Decks Criados</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">
              Todos os temas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Acesso Rápido - Flashcards
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Acesse sua plataforma de flashcards completa com todas as funcionalidades de estudo e criação de decks.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="flex-1">
                <SSRSafeNavLink to="/flashcards" className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Abrir Flashcards
                </SSRSafeNavLink>
              </Button>
              <Button variant="outline" asChild>
                <SSRSafeNavLink to="/flashcards?mode=study">
                  <Target className="h-4 w-4 mr-2" />
                  Modo Estudo
                </SSRSafeNavLink>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Repetição Espaçada</Badge>
              <Badge variant="secondary">Multi-formato</Badge>
              <Badge variant="secondary">Estatísticas</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Deck "Vocabulário Inglês" atualizado</p>
                  <p className="text-xs text-muted-foreground">2 horas atrás</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Sessão de estudo concluída</p>
                  <p className="text-xs text-muted-foreground">5 horas atrás</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-warning rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">25 cards para revisar</p>
                  <p className="text-xs text-muted-foreground">1 dia atrás</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Calendário</h3>
                <p className="text-sm text-muted-foreground">Organize sua agenda de estudos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-lg">
                <FileText className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Projetos</h3>
                <p className="text-sm text-muted-foreground">Gerencie seus projetos de estudo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-lg">
                <Award className="h-6 w-6 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Conquistas</h3>
                <p className="text-sm text-muted-foreground">Acompanhe seu progresso</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
