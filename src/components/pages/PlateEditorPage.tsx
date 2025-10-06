'use client';

import { Button } from "../ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import dynamic from 'next/dynamic';
import { Toaster } from "sonner";

// Carregar o PlateEditor apenas no client-side
const PlateEditor = dynamic(
  () => import("../plate-editor").then((mod) => ({ default: mod.PlateEditor })),
  { ssr: false }
);

export default function PlateEditorPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4 p-4 max-w-7xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Editor Plate</h1>
            <p className="text-sm text-muted-foreground">Editor rico com IA e plugins avançados</p>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <PlateEditor />
      </div>

      <Toaster />
    </div>
  );
}

