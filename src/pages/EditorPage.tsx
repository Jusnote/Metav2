import React from 'react';
import LexicalPlaygroundComponent from '../components/LexicalPlaygroundComponent';

export default function EditorPage() {
  const handleSave = (content: string) => {
    console.log('Conteúdo salvo:', content);
    // Implementar lógica de salvamento aqui
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-xs border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                📝 Editor de Flashcards
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleSave('')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                💾 Salvar
              </button>
              <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                👁️ Visualizar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-xs border">
          {/* Lexical Playground Component */}
          <div className="rounded-lg overflow-auto">
            <LexicalPlaygroundComponent />
          </div>
        </div>
      </main>
    </div>
  );
}
