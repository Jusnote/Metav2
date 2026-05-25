import { AuthForm } from '../components/AuthForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export default function SignupPage() {
  return (
    <div className="flex items-center justify-center min-h-svh bg-muted p-6 md:p-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Crie sua conta</CardTitle>
          <CardDescription>Preencha seus dados para começar.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm defaultTab="signup" />
        </CardContent>
      </Card>
    </div>
  );
}
