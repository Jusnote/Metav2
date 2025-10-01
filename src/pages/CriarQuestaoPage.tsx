import React from 'react';
import { CriarQuestaoForm } from '@/components/CriarQuestaoForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CriarQuestaoPage() {
  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" asChild className="mr-2">
            <Link to="/questoes">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Criar Nova Questão</h1>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <CriarQuestaoForm />
      </div>
    </div>
  );
}

