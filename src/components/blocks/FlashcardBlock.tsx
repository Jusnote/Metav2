import React, { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff, Edit, Save, X, ArrowRight } from "lucide-react";

// Definir o bloco customizado de flashcard
export const FlashcardBlock = createReactBlockSpec(
  {
    type: "flashcard",
    propSchema: {
      front: {
        default: "",
        type: "string" as const,
      },
      back: {
        default: "",
        type: "string" as const,
      },
      cardType: {
        default: "traditional",
        values: ["traditional", "cloze", "true-false"] as const,
      },
      showBack: {
        default: false,
        type: "boolean" as const,
      },
      autoEdit: {
        default: false,
        type: "boolean" as const,
      },
    },
    content: "none",
  },
  {
    render: (props) => {
      const { block, editor } = props;
      const [isEditing, setIsEditing] = useState(
        block.props.autoEdit || (!block.props.front && !block.props.back)
      );
      const [editFront, setEditFront] = useState(block.props.front);
      const [editBack, setEditBack] = useState(block.props.back);
      const [showBack, setShowBack] = useState(block.props.showBack);
      const [isFlipped, setIsFlipped] = useState(false);

      const handleSave = () => {
        editor.updateBlock(block, {
          props: {
            ...block.props,
            front: editFront,
            back: editBack,
          },
        });
        setIsEditing(false);
      };

      const handleCancel = () => {
        setEditFront(block.props.front);
        setEditBack(block.props.back);
        setIsEditing(false);
      };

      const toggleShowBack = () => {
        const newShowBack = !showBack;
        setShowBack(newShowBack);
        editor.updateBlock(block, {
          props: {
            ...block.props,
            showBack: newShowBack,
          },
        });
      };

      if (isEditing) {
        return (
          <div className="relative w-full max-w-6xl bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden transition-all duration-500 animate-in fade-in-0 slide-in-from-top-2">
            {/* Header do modo de edição */}
            <div className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 backdrop-blur-sm border-b border-white/10 px-3 py-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                    title="Salvar Alterações"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path>
                      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"></path>
                      <path d="M7 3v4a1 1 0 0 0 1 1h7"></path>
                    </svg>
                  </button>
                  <button
                    onClick={handleCancel}
                    className="p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                    title="Cancelar"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18"></path>
                      <path d="m6 6 12 12"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Conteúdo do modo de edição */}
            <CardContent className="px-2 py-4 w-full">
              <div className="w-full">
                 {/* Text areas lado a lado com seta */}
                 <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start w-full">
                   <div className="w-full">
                     <Textarea
                       value={editFront}
                       onChange={(e) => setEditFront(e.target.value)}
                       className="w-full min-w-0 px-3 py-1 text-sm border border-white/20 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 transition-all duration-200 bg-white/80 backdrop-blur-sm min-h-[4rem] h-8"
                       rows={1}
                       placeholder="Digite a pergunta ou frente do flashcard..."
                       autoFocus
                     />
                   </div>
                   
                   {/* Seta elegante entre as text areas */}
                   <div className="flex justify-center items-center">
                     <div className="bg-gradient-to-r from-purple-400 to-green-400 p-1.5 rounded-md transform md:rotate-0 rotate-90">
                <ArrowRight className="w-4 h-4 text-white" />
              </div>
                   </div>
                   
                   <div className="w-full">
                     <Textarea
                       value={editBack}
                       onChange={(e) => setEditBack(e.target.value)}
                       className="w-full min-w-0 px-3 py-1 text-sm border border-white/20 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400 transition-all duration-200 bg-white/80 backdrop-blur-sm min-h-[4rem] h-8"
                       rows={1}
                       placeholder="Digite a resposta ou verso do flashcard..."
                     />
                   </div>
                 </div>
                

              </div>
            </CardContent>
          </div>
        );
      }

      return (
        <div className="relative w-full max-w-md bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-blue-500/5 backdrop-blur-sm shadow-lg hover:shadow-xl border border-white/10 hover:border-white/20 transition-all duration-500 rounded-2xl overflow-hidden group">
          {/* Efeito de shine no hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-50 transition-opacity duration-700 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"></div>
          </div>
          
          {/* Gradiente radial no hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-radial from-purple-400/20 via-pink-400/10 to-transparent"></div>
          </div>
          
          {/* Header fixo */}
          <div className="relative z-10 pb-1 backdrop-blur-sm border-b border-white/5 px-3 py-2">
            <div className="flex items-center justify-end">
              <div className="flex gap-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  className="h-7 w-7 p-0 hover:bg-white/10 rounded-md transition-all duration-300 backdrop-blur-sm"
                >
                  <Edit className="h-3.5 w-3.5 text-gray-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={toggleShowBack}
                  className="h-7 w-7 p-0 hover:bg-white/10 rounded-md transition-all duration-300 backdrop-blur-sm"
                >
                  {showBack ? <EyeOff className="h-3.5 w-3.5 text-gray-600" /> : <Eye className="h-3.5 w-3.5 text-gray-600" />}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Container do flip */}
          <CardContent 
            className="p-3 relative h-48 cursor-pointer overflow-hidden"
            style={{ perspective: '1000px' }}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div 
              className="relative w-full h-full"
              style={{
                transformStyle: 'preserve-3d'
              }}
            >
              {/* Frente do card */}
              <div 
                className={`absolute inset-0 w-full h-full rounded-xl p-4 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-blue-500/5 backdrop-blur-lg border border-white/20 shadow-inner flex flex-col justify-center transition-transform duration-700 ${
                  isFlipped ? 'rotate-y-180' : 'rotate-y-0'
                }`}
                style={{
                  backfaceVisibility: 'hidden',
                  transform: isFlipped ? 'rotateY(-180deg)' : 'rotateY(0deg)'
                }}
              >
                <div className="text-sm text-gray-700 leading-relaxed flex-1 flex items-center font-medium">{block.props.front || "Frente do cartão"}</div>
              </div>
              
              {/* Verso do card */}
              <div 
                className={`absolute inset-0 w-full h-full rounded-xl p-4 bg-gradient-to-br from-green-500/5 via-emerald-500/3 to-teal-500/5 backdrop-blur-lg border border-white/20 shadow-inner flex flex-col justify-center transition-transform duration-700 ${
                  isFlipped ? 'rotate-y-0' : 'rotate-y-180'
                }`}
                style={{
                  backfaceVisibility: 'hidden',
                  transform: isFlipped ? 'rotateY(0deg)' : 'rotateY(180deg)'
                }}
              >
                <div className="text-sm text-gray-700 leading-relaxed flex-1 flex items-center font-medium">
                   {block.props.back || "Clique para virar"}
                 </div>
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-center text-xs text-gray-600">
                    <ArrowRight className="h-3 w-3 mr-1" />
                    Clique para virar
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </div>
      );
    },
    
    toExternalHTML: (props) => {
      const { block } = props;
      return (
        <div className="flashcard-block" data-front={block.props.front} data-back={block.props.back}>
          <div className="flashcard-front">
            <strong>Frente:</strong> {block.props.front}
          </div>
          <div className="flashcard-back">
            <strong>Verso:</strong> {block.props.back}
          </div>
        </div>
      );
    },
    
    parse: (element) => {
      if (element.classList.contains("flashcard-block")) {
        const cardType = element.getAttribute("data-card-type") as "traditional" | "cloze" | "true-false" || "traditional";
        return {
          front: element.getAttribute("data-front") || "Frente do flashcard",
          back: element.getAttribute("data-back") || "Verso do flashcard",
          cardType: cardType,
          showBack: false,
        };
      }
      return undefined;
    },
  }
);