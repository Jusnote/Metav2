import { AuthForm } from '../components/AuthForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { AuroraBackground } from '../components/ui/aurora-background';

export default function AuthPage() {
  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden">
      <AuroraBackground />
      <Card className="relative w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_20px_60px_-12px_rgba(30,41,59,0.12),0_4px_12px_-4px_rgba(30,41,59,0.06)]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Bem-vindo de volta!</CardTitle>
          <CardDescription>Faça login ou crie uma conta para continuar.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm />
        </CardContent>
      </Card>
    </div>
  );
}
