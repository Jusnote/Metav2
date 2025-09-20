import React, { useEffect, useState } from 'react';
import { CheckCircle, Trophy, Sparkles } from 'lucide-react';

interface StudyCompletionToastProps {
  show: boolean;
  onHide: () => void;
}

export function StudyCompletionToast({ show, onHide }: StudyCompletionToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    console.log('🍞 StudyCompletionToast useEffect, show:', show, 'isVisible:', isVisible);
    
    if (show) {
      console.log('🎯 Toast deve aparecer!');
      setIsVisible(true);
      const timer = setTimeout(() => {
        console.log('⏰ Timer do toast executado, ocultando');
        setIsVisible(false);
        setTimeout(onHide, 300); // Aguardar animação de saída
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      console.log('❌ Toast não deve aparecer (show=false)');
      setIsVisible(false);
    }
  }, [show, onHide]);

  if (!show && !isVisible) {
    console.log('🚫 Toast não renderizado (show=false, isVisible=false)');
    return null;
  }

  console.log('✅ Renderizando toast, show:', show, 'isVisible:', isVisible);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
      isVisible ? 'opacity-100' : 'opacity-0'
    }`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      
      {/* Toast */}
      <div className={`relative bg-white rounded-lg shadow-2xl border-2 border-green-200 p-6 mx-4 max-w-md transform transition-all duration-300 ${
        isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
      }`}>
        {/* Header com ícones animados */}
        <div className="flex items-center justify-center mb-4">
          <div className="relative">
            <div className="absolute -inset-2 bg-green-100 rounded-full animate-ping opacity-75"></div>
            <div className="relative bg-gradient-to-r from-green-500 to-blue-500 rounded-full p-3">
              <Trophy className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>

        {/* Título */}
        <h3 className="text-xl font-bold text-center text-gray-800 mb-2 flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          Parabéns!
          <Sparkles className="h-5 w-5 text-yellow-500" />
        </h3>

        {/* Mensagem */}
        <p className="text-center text-gray-600 mb-4">
          Você concluiu com sucesso o estudo dirigido! 🎉
        </p>

        {/* Status */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Estudo Completado</span>
          </div>
        </div>

        {/* Informações adicionais */}
        <div className="text-center text-sm text-gray-500">
          O documento completo está agora visível para revisão.
        </div>

        {/* Botão de fechar */}
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onHide, 300);
          }}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Fechar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
