'use client';

import { useState } from "react";
import { Button } from "../ui/button";
import { ArrowLeft, FileText, ChevronRight } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import dynamic from 'next/dynamic';
import { Toaster } from "sonner";
import { usePlateDocuments } from "@/hooks/usePlateDocuments";

// Carregar o PlateEditor apenas no client-side
const PlateEditor = dynamic(
  () => import("../plate-editor").then((mod) => ({ default: mod.PlateEditor })),
  { ssr: false }
);

export default function PlateEditorPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const documentIdFromUrl = searchParams.get('doc');
  const subtopicIdFromUrl = searchParams.get('subtopic');
  const subtopicTitleFromUrl = searchParams.get('title');
  const [currentDocId, setCurrentDocId] = useState<string | null>(documentIdFromUrl);

  const { getDocument } = usePlateDocuments();
  const currentDocument = currentDocId ? getDocument(currentDocId) : null;

  // Quando um novo documento é criado, atualizar a URL
  const handleDocumentCreate = (newDocId: string) => {
    setCurrentDocId(newDocId);
    const params: Record<string, string> = { doc: newDocId };
    if (subtopicIdFromUrl) params.subtopic = subtopicIdFromUrl;
    if (subtopicTitleFromUrl) params.title = subtopicTitleFromUrl;
    setSearchParams(params);
  };

  // Determinar para onde voltar
  const handleBack = () => {
    if (subtopicIdFromUrl) {
      // Se veio de um subtópico, voltar para Documents Organization
      navigate('/documents-organization');
    } else {
      // Senão, voltar uma página
      navigate(-1);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex flex-col gap-2 p-4 max-w-7xl mx-auto w-full">
          {/* Barra superior */}
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">
                    {currentDocument?.title || 'Novo Documento'}
                  </h1>
                  <p className="text-sm text-muted-foreground">Editor rico com IA e plugins avançados</p>
                </div>
              </div>
            </div>

            {/* Criar novo documento */}
            {!subtopicIdFromUrl && (
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentDocId(null);
                  setSearchParams({});
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Novo Documento
              </Button>
            )}
          </div>

          {/* Breadcrumb - Apenas se veio de um subtópico */}
          {subtopicTitleFromUrl && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button
                onClick={() => navigate('/documents-organization')}
                className="hover:text-foreground transition-colors"
              >
                Organização
              </button>
              <ChevronRight className="h-4 w-4" />
              <span className="font-medium text-foreground">
                {decodeURIComponent(subtopicTitleFromUrl)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <PlateEditor
          documentId={currentDocId}
          onDocumentCreate={handleDocumentCreate}
          subtopicId={subtopicIdFromUrl}
          subtopicTitle={subtopicTitleFromUrl ? decodeURIComponent(subtopicTitleFromUrl) : undefined}
        />
      </div>

      <Toaster />
    </div>
  );
}

