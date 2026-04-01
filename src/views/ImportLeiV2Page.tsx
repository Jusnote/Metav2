'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ChevronRight,
  ChevronLeft,
  TreePine,
  Eye,
  Upload,
  Download,
  Check,
  AlertTriangle,
  ChevronDown,
  Loader2,
  Wand2,
  XCircle,
} from 'lucide-react';

import type {
  ImportStep,
  LeiMetadata,
  ParseResult,
  ExportedLei,
  HierarchyNode,
  ExportedArticle,
  LawDataExport,
  StructuralItem,
} from '@/types/lei-import';
import { LEVEL_ORDER } from '@/lib/lei-parser';
import { downloadAsJson, uploadToSupabase, type UploadProgress } from '@/lib/lei-exporter';
import { parseTipTapJson, convertTipTapToExport } from '@/lib/tiptap-to-lei';
import { convertGraphQLToExported, type ConversionResult, type MapperOptions } from '@/lib/lei-graphql-mapper';
import {
  LeiIngestaoEditor,
  type LeiIngestaoEditorRef,
} from '@/components/lei-seca/lei-ingestao-editor';

// --- Constants ---

const STEPS: { key: ImportStep; label: string; icon: React.ReactNode }[] = [
  { key: 'paste', label: 'Editor', icon: <Wand2 className="h-4 w-4" /> },
  { key: 'hierarchy', label: 'Hierarquia', icon: <TreePine className="h-4 w-4" /> },
  { key: 'review', label: 'Revisar', icon: <Eye className="h-4 w-4" /> },
  { key: 'export', label: 'Exportar', icon: <Upload className="h-4 w-4" /> },
];

const DEFAULT_METADATA: LeiMetadata = {
  id: '',
  numero: '',
  nome: '',
  sigla: '',
  ementa: '',
  data_publicacao: '',
};

// --- Main Component ---

export default function ImportLeiV2Page() {
  const [step, setStep] = useState<ImportStep>('paste');
  const [metadata, setMetadata] = useState<LeiMetadata>(DEFAULT_METADATA);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [exportData, setExportData] = useState<ExportedLei | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [graphqlJsonError, setGraphqlJsonError] = useState<string | null>(null);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const editorRef = useRef<LeiIngestaoEditorRef>(null);

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  // Helper: build structural from allItems when not provided
  function buildStructuralFromItems(allItems: any[]): StructuralItem[] {
    const types = ['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO'];
    return allItems
      .filter((i: any) => types.includes(i.type))
      .map((item: any) => {
        let subtitle = null;
        for (let j = item.index + 1; j < Math.min(item.index + 5, allItems.length); j++) {
          const candidate = allItems[j];
          if (candidate.type !== 'NAO_IDENTIFICADO') break;
          if (!candidate.description.startsWith('(')) {
            subtitle = candidate.description;
            break;
          }
        }
        return { ...item, subtitle };
      });
  }

  // --- GraphQL JSON Import (single unified JSON) ---
  const handleGraphQLJsonImport = useCallback((jsonText: string) => {
    setGraphqlJsonError(null);
    try {
      const data = JSON.parse(jsonText);

      // Validate: must have allItems array
      if (!data.allItems || !Array.isArray(data.allItems) || data.allItems.length === 0) {
        setGraphqlJsonError('JSON invalido: deve conter o campo "allItems" com array de itens.');
        return;
      }

      // Validate item structure
      if (!data.allItems[0].codeInt64 || !data.allItems[0].type || !data.allItems[0].description) {
        setGraphqlJsonError('JSON invalido: itens devem ter codeInt64, type e description.');
        return;
      }

      // Use structural from JSON (accurate) or build from allItems (fallback)
      const hasStructural = data.structural && Array.isArray(data.structural) && data.structural.length > 0;

      const lawData: LawDataExport = {
        document: data.document || undefined,
        docId: data.document?.docId || data.docId || 0,
        extractedAt: data.extractedAt || new Date().toISOString(),
        allItems: data.allItems,
        structural: hasStructural ? data.structural : buildStructuralFromItems(data.allItems),
        stats: data.stats || {
          totalItems: data.allItems.length,
          totalStructural: hasStructural ? data.structural.length : 0,
          totalArticles: data.allItems.filter((i: any) => i.type === 'ARTIGO').length,
        },
      };

      // Auto-fill metadata from document
      setMetadata((m) => {
        const updated = { ...m };
        const doc = data.document;
        if (doc) {
          if (!updated.nome) updated.nome = doc.title || '';
          if (!updated.ementa) updated.ementa = doc.description || '';
          if (!updated.numero) updated.numero = doc.title || '';
          if (!updated.id) {
            const typeSlug = (doc.type || 'lei').toLowerCase().replace(/\s+/g, '-');
            updated.id = typeSlug + '-' + (doc.docId || Date.now());
          }
          if (!updated.data_publicacao && doc.date) {
            const d = new Date(doc.date);
            updated.data_publicacao = d.toISOString().split('T')[0];
          }
        } else if (!updated.id) {
          updated.id = 'lei-import-' + Date.now();
        }
        return updated;
      });

      // Convert to our schema
      const result = convertGraphQLToExported(lawData, metadata, {
        useStructuralSubtitles: hasStructural,
      });
      setConversionResult(result);
      setExportData(result.exportedLei);

      setStep('hierarchy');
    } catch (err) {
      setGraphqlJsonError(err instanceof Error ? err.message : 'Erro ao processar JSON');
    }
  }, [metadata]);

  // --- Step 1: Parse TipTap JSON ---
  const handleParse = useCallback(() => {
    const json = editorRef.current?.getJSON();
    if (!json) return;

    const result = parseTipTapJson(json);
    setParseResult(result);

    // Auto-generate ID from sigla if provided
    if (metadata.sigla && !metadata.id) {
      setMetadata((m) => ({ ...m, id: metadata.sigla.toLowerCase().replace(/\s+/g, '-') }));
    }

    setStep('hierarchy');
  }, [metadata.sigla, metadata.id]);

  // --- Step 2 → 3: Convert to export format ---
  const handleConvert = useCallback(() => {
    if (!parseResult) return;
    const leiId = metadata.id || 'lei';
    const data = convertTipTapToExport(parseResult, leiId);
    setExportData(data);
    setStep('review');
  }, [parseResult, metadata.id]);

  // --- Step 4: Export ---
  const handleDownload = useCallback(() => {
    if (!exportData) return;
    downloadAsJson(exportData, metadata);
  }, [exportData, metadata]);

  const [showUploadConfirm, setShowUploadConfirm] = useState(false);

  const handleUpload = useCallback(async () => {
    if (!exportData || !metadata.id) return;
    if (!showUploadConfirm) {
      setShowUploadConfirm(true);
      return;
    }
    setShowUploadConfirm(false);
    setUploadError(null);
    const result = await uploadToSupabase(exportData, metadata, setUploadProgress);
    if (!result.success) {
      setUploadError(result.error || 'Erro desconhecido');
    }
  }, [exportData, metadata, showUploadConfirm]);

  // --- Navigation ---
  const goBack = () => {
    const idx = currentStepIndex;
    if (idx > 0) setStep(STEPS[idx - 1].key);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Importar Lei</h1>
          <Badge variant="secondary" className="text-[10px]">v2 — TipTap</Badge>
        </div>
        <p className="text-muted-foreground">
          Cole o texto da lei no editor rich-text. A formatação (negrito, centralizado, indentação) é usada para detectar a estrutura.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <button
              onClick={() => {
                if (i <= currentStepIndex) setStep(s.key);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                s.key === step
                  ? 'bg-primary text-primary-foreground'
                  : i < currentStepIndex
                  ? 'bg-primary/20 text-primary cursor-pointer hover:bg-primary/30'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < currentStepIndex ? <Check className="h-3 w-3" /> : s.icon}
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 'paste' && (
        <StepEditor
          editorRef={editorRef}
          metadata={metadata}
          setMetadata={setMetadata}
          onNext={handleParse}
          onGraphQLImport={handleGraphQLJsonImport}
          graphqlJsonError={graphqlJsonError}
        />
      )}
      {step === 'hierarchy' && conversionResult && (
        <StepGraphQLReport
          result={conversionResult}
          onNext={() => setStep('review')}
          onBack={goBack}
        />
      )}
      {step === 'hierarchy' && !conversionResult && parseResult && (
        <StepHierarchy
          parseResult={parseResult}
          onNext={handleConvert}
          onBack={goBack}
        />
      )}
      {step === 'review' && exportData && (
        <StepReview
          exportData={exportData}
          parseResult={parseResult}
          onNext={() => setStep('export')}
          onBack={goBack}
          onUpdateExportData={setExportData}
        />
      )}
      {step === 'export' && exportData && (
        <StepExport
          exportData={exportData}
          metadata={metadata}
          setMetadata={setMetadata}
          uploadProgress={uploadProgress}
          uploadError={uploadError}
          showUploadConfirm={showUploadConfirm}
          onCancelUpload={() => setShowUploadConfirm(false)}
          onDownload={handleDownload}
          onUpload={handleUpload}
          onBack={goBack}
        />
      )}
    </div>
  );
}

// ============================================================
// Step: GraphQL Import Report
// ============================================================

function StepGraphQLReport({
  result,
  onNext,
  onBack,
}: {
  result: ConversionResult;
  onNext: () => void;
  onBack: () => void;
}) {
  const { stats, unmappedItems, structuralWarnings } = result;
  const hasIssues = unmappedItems.length > 0;

  const overallStatus = unmappedItems.length === 0
    ? 'green'
    : unmappedItems.length > 5
    ? 'red'
    : 'yellow';

  const statusColors = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  const statusLabels = {
    green: 'Perfeito',
    yellow: 'Atenção — itens para revisar',
    red: 'Problemas encontrados',
  };

  return (
    <div className="space-y-6">
      {/* Overall status */}
      <div className={`p-4 rounded-lg ${statusColors[overallStatus]}`}>
        <div className="flex items-center gap-3">
          {overallStatus === 'green' && <Check className="h-5 w-5" />}
          {overallStatus === 'yellow' && <AlertTriangle className="h-5 w-5" />}
          {overallStatus === 'red' && <XCircle className="h-5 w-5" />}
          <div>
            <div className="font-semibold text-lg">{statusLabels[overallStatus]}</div>
            <div className="text-sm opacity-80">
              {stats.totalInput} itens processados → {stats.totalArticles} artigos
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{stats.totalUniqueArticles || stats.totalArticles}</div>
            <div className="text-xs text-muted-foreground">Artigos Únicos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.totalRevoked}</div>
            <div className="text-xs text-muted-foreground">Artigos Revogados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.totalDuplicateVersions || 0}</div>
            <div className="text-xs text-muted-foreground">Versões Duplicadas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalAnnotations}</div>
            <div className="text-xs text-muted-foreground">Anotações</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{stats.totalStructural}</div>
            <div className="text-xs text-muted-foreground">Estruturais</div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary stats */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">Total itens: {stats.totalArticles} (com duplicatas)</Badge>
        <Badge variant="secondary">Itens revogados (todos): {stats.totalRevokedItems || 0}</Badge>
        <Badge variant="secondary">Metadata: {stats.totalMetadata}</Badge>
        <Badge variant="secondary">Tabelas: {stats.totalTabela}</Badge>
        <Badge variant="secondary">Pre-conteúdo: {stats.totalPreContent}</Badge>
        <Badge variant="secondary">Input total: {stats.totalInput}</Badge>
        {stats.totalStructuralWarnings > 0 && (
          <Badge variant="outline">Divergências estruturais: {stats.totalStructuralWarnings}</Badge>
        )}
      </div>

      {/* Unmapped items (flagged for review) */}
      {unmappedItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Itens para Revisão Manual ({unmappedItems.length})
            </CardTitle>
            <CardDescription>
              Estes itens foram salvos mas não puderam ser classificados automaticamente. Revise antes de confirmar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {unmappedItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs p-2 bg-muted/50 rounded">
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      [{item.index}]
                    </Badge>
                    <span className="text-muted-foreground">{item.description.substring(0, 150)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Structural warnings */}
      {structuralWarnings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              Validação Cruzada ({structuralWarnings.length} divergências)
              <Badge variant="secondary" className="text-[10px]">informativo</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              O JSON estrutural (fonte primária) difere do reconstruído automaticamente.
              Isso é esperado — significa que o estrutural tem subtítulos mais precisos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[150px]">
              <ul className="space-y-1">
                {structuralWarnings.map((w, i) => (
                  <li key={i} className="text-xs text-muted-foreground">{w}</li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Pre-content info */}
      {result.preContent.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Conteúdo Pré-Artigos ({result.preContent.length} itens)</CardTitle>
            <CardDescription className="text-xs">
              Itens antes do primeiro artigo (preâmbulo, vigência, etc.) — armazenados como metadata.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button onClick={onNext}>
          {hasIssues ? 'Continuar mesmo assim' : 'Revisar Artigos'}
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Step 1: TipTap Editor (replaces Textarea)
// ============================================================

function StepEditor({
  editorRef,
  metadata,
  setMetadata,
  onNext,
  onGraphQLImport,
  graphqlJsonError,
}: {
  editorRef: React.RefObject<LeiIngestaoEditorRef | null>;
  metadata: LeiMetadata;
  setMetadata: (v: LeiMetadata) => void;
  onNext: () => void;
  onGraphQLImport?: (jsonText: string) => void;
  graphqlJsonError?: string | null;
}) {
  const [importMode, setImportMode] = useState<'editor' | 'graphql'>('graphql');
  const [jsonText, setJsonText] = useState('');
  const [jsonStats, setJsonStats] = useState<{
    items: number; articles: number; revoked: number;
    structural: number; hasDocument: boolean; title: string;
  } | null>(null);

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const data = JSON.parse(text);
      if (data?.allItems && Array.isArray(data.allItems)) {
        setJsonStats({
          items: data.allItems.length,
          articles: data.allItems.filter((i: any) => i.type === 'ARTIGO').length,
          revoked: data.allItems.filter((i: any) => i.revoked === true).length,
          structural: data.structural?.length || 0,
          hasDocument: !!data.document,
          title: data.document?.title || '',
        });
      } else {
        setJsonStats(null);
      }
    } catch {
      setJsonStats(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Input area */}
      <div className="lg:col-span-2 space-y-3">
        {/* Mode tabs */}
        <div className="inline-flex rounded-lg border bg-muted p-0.5">
          <button
            onClick={() => setImportMode('graphql')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              importMode === 'graphql'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            GraphQL JSON
          </button>
          <button
            onClick={() => setImportMode('editor')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              importMode === 'editor'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Editor TipTap
          </button>
        </div>

        {importMode === 'graphql' ? (
          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Importar via GraphQL</CardTitle>
                <CardDescription>
                  Execute o script no console do JusBrasil e copie com:
                  <br />
                  <code className="text-xs bg-muted px-1 rounded mt-1 inline-block">copy(JSON.stringify(window._lawData, null, 2))</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={jsonText}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  placeholder='Cole o JSON aqui (resultado do copy(JSON.stringify(window._lawData, null, 2)))'
                  className="min-h-[400px] font-mono text-xs"
                />

                {jsonStats && (
                  <div className="space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary">{jsonStats.items} itens</Badge>
                      <Badge variant="secondary">{jsonStats.articles} artigos</Badge>
                      <Badge variant="secondary">{jsonStats.revoked} revogados</Badge>
                      <Badge variant="secondary">{jsonStats.structural} estruturais</Badge>
                      {jsonStats.hasDocument && <Badge className="bg-green-600">{jsonStats.title ? jsonStats.title.substring(0, 50) : 'Documento OK'}</Badge>}
                    </div>
                    {!jsonStats.structural && (
                      <p className="text-xs text-yellow-600">Sem dados estruturais — hierarquia será reconstruída por heurística.</p>
                    )}
                    {!jsonStats.hasDocument && (
                      <p className="text-xs text-yellow-600">Sem metadados do documento — preencha manualmente na lateral.</p>
                    )}
                  </div>
                )}

                {graphqlJsonError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{graphqlJsonError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Editor de Lei</CardTitle>
              <CardDescription>
                Cole o texto da lei (Ctrl+V). Use <strong>centralizado</strong> para hierarquia e <strong>negrito</strong> para labels.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px]">
                <LeiIngestaoEditor ref={editorRef as React.RefObject<LeiIngestaoEditorRef>} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Metadados</CardTitle>
            <CardDescription>Informações sobre a lei</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lei-id">ID (usado no Supabase)</Label>
              <Input
                id="lei-id"
                value={metadata.id}
                onChange={(e) => setMetadata({ ...metadata, id: e.target.value })}
                placeholder="ex: codigo-penal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lei-nome">Nome</Label>
              <Input
                id="lei-nome"
                value={metadata.nome}
                onChange={(e) => setMetadata({ ...metadata, nome: e.target.value })}
                placeholder="ex: Código Penal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lei-sigla">Sigla</Label>
              <Input
                id="lei-sigla"
                value={metadata.sigla}
                onChange={(e) => setMetadata({ ...metadata, sigla: e.target.value })}
                placeholder="ex: CP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lei-numero">Número</Label>
              <Input
                id="lei-numero"
                value={metadata.numero}
                onChange={(e) => setMetadata({ ...metadata, numero: e.target.value })}
                placeholder="ex: Decreto-Lei nº 2.848/1940"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lei-ementa">Ementa</Label>
              <Textarea
                id="lei-ementa"
                value={metadata.ementa}
                onChange={(e) => setMetadata({ ...metadata, ementa: e.target.value })}
                placeholder="ex: Código Penal."
                className="min-h-[60px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lei-data">Data de Publicação</Label>
              <Input
                id="lei-data"
                type="date"
                value={metadata.data_publicacao}
                onChange={(e) => setMetadata({ ...metadata, data_publicacao: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {!metadata.id && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              O campo ID é obrigatório para upload ao Supabase. Preencha antes de continuar.
            </AlertDescription>
          </Alert>
        )}

        {importMode === 'graphql' ? (
          <Button
            onClick={() => onGraphQLImport?.(jsonText)}
            disabled={!jsonText || !jsonStats}
            className="w-full"
          >
            Importar ({jsonStats?.articles || 0} artigos, {jsonStats?.revoked || 0} revogados)
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={onNext} className="w-full">
            Analisar Estrutura
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Step 2: Hierarchy (reused from V1 with minor label change)
// ============================================================

function StepHierarchy({
  parseResult,
  onNext,
  onBack,
}: {
  parseResult: ParseResult;
  onNext: () => void;
  onBack: () => void;
}) {
  const { resumo, hierarquia } = parseResult;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold">{resumo.totalArtigos}</div>
            <div className="text-sm text-muted-foreground">Artigos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold">{resumo.artigosRevogados}</div>
            <div className="text-sm text-muted-foreground">Revogados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold">
              {Object.values(resumo.totalHierarquia).reduce((a, b) => a + b, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Seções</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold">{resumo.warnings.length}</div>
            <div className="text-sm text-muted-foreground">Avisos</div>
          </CardContent>
        </Card>
      </div>

      {/* Hierarchy breakdown */}
      <div className="flex flex-wrap gap-2">
        {LEVEL_ORDER.map((level) => {
          const count = resumo.totalHierarquia[level];
          if (count === 0) return null;
          return (
            <Badge key={level} variant="secondary">
              {level}: {count}
            </Badge>
          );
        })}
      </div>

      {/* Warnings */}
      {resumo.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {resumo.warnings.slice(0, 10).map((w, i) => (
                <li key={i} className="text-sm">{w}</li>
              ))}
              {resumo.warnings.length > 10 && (
                <li className="text-sm text-muted-foreground">
                  ... e mais {resumo.warnings.length - 10} avisos
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Hierarchy tree */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Árvore Hierárquica</CardTitle>
          <CardDescription>
            Estrutura detectada a partir da formatação (texto centralizado = hierarquia).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <HierarchyTreeView node={hierarquia} depth={0} />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button onClick={onNext}>
          Converter para Plate.js
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// --- Hierarchy tree renderer ---

function HierarchyTreeView({ node, depth }: { node: HierarchyNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  const children = [
    ...node.partes,
    ...node.livros,
    ...node.titulos,
    ...node.subtitulos,
    ...node.capitulos,
    ...node.secoes,
    ...node.subsecoes,
  ];

  const hasChildren = children.length > 0;
  const isRoot = node.tipo === 'documento';

  if (isRoot && !hasChildren) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Nenhuma estrutura hierárquica detectada. Centralize os títulos de PARTE, TÍTULO, CAPÍTULO, etc.
      </p>
    );
  }

  if (isRoot) {
    return (
      <div className="space-y-1">
        {children.map((child, i) => (
          <HierarchyTreeView key={`${child.tipo}-${i}`} node={child} depth={depth} />
        ))}
      </div>
    );
  }

  const levelColors: Record<string, string> = {
    parte: 'text-red-600 dark:text-red-400',
    livro: 'text-orange-600 dark:text-orange-400',
    titulo: 'text-yellow-600 dark:text-yellow-400',
    subtitulo: 'text-green-600 dark:text-green-400',
    capitulo: 'text-blue-600 dark:text-blue-400',
    secao: 'text-purple-600 dark:text-purple-400',
    subsecao: 'text-pink-600 dark:text-pink-400',
  };

  return (
    <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className="flex items-center gap-1 py-0.5 text-sm hover:bg-muted/50 rounded px-1 w-full text-left"
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />
        ) : (
          <span className="w-3" />
        )}
        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${levelColors[node.tipo] || ''}`}>
          {node.tipo}
        </Badge>
        <span className="truncate">{node.titulo}</span>
      </button>
      {expanded && hasChildren && (
        <div className="border-l border-muted ml-1.5">
          {children.map((child, i) => (
            <HierarchyTreeView key={`${child.tipo}-${i}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Step 3: Review
// ============================================================

function StepReview({
  exportData,
  onNext,
  onBack,
  onUpdateExportData,
}: {
  exportData: ExportedLei;
  parseResult?: ParseResult | null;
  onNext: () => void;
  onBack: () => void;
  onUpdateExportData: (data: ExportedLei) => void;
}) {
  const [selectedTab, setSelectedTab] = useState('articles');
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [articles, setArticles] = useState<ExportedArticle[]>(exportData.artigos);

  // Detecta duplicatas apenas entre artigos vigentes
  const duplicateNums = useMemo(() => {
    const counts = new Map<string, number>();
    for (const art of articles) {
      if (art.vigente) counts.set(art.numero, (counts.get(art.numero) || 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n));
  }, [articles]);

  const hasDuplicates = duplicateNums.size > 0;

  // Marca como revogado: mantém no array (aparece no estudo), muda vigente + renomeia ID
  const markAsRevoked = useCallback((revokedIdx: number) => {
    setArticles(prev => {
      const revoked = prev[revokedIdx];
      if (!revoked || !revoked.vigente) return prev;
      const activeIdx = prev.findIndex((a, i) => a.numero === revoked.numero && i !== revokedIdx && a.vigente);
      if (activeIdx === -1) return prev;
      const active = prev[activeIdx];

      const updatedRevoked: ExportedArticle = {
        ...revoked,
        id: `${revoked.id}-rev`,
        slug: `${revoked.slug}-rev`,
        vigente: false,
      };
      const updatedActive: ExportedArticle = {
        ...active,
        revoked_versions: [
          ...active.revoked_versions,
          { plate_content: revoked.plate_content, texto_plano: revoked.texto_plano },
        ],
      };
      return prev.map((a, i) => {
        if (i === revokedIdx) return updatedRevoked;
        if (i === activeIdx) return updatedActive;
        return a;
      });
    });
  }, []);

  const handleNext = useCallback(() => {
    onUpdateExportData({ ...exportData, artigos: articles });
    onNext();
  }, [exportData, articles, onUpdateExportData, onNext]);

  return (
    <div className="space-y-6">
      {/* Duplicates warning */}
      {hasDuplicates && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{duplicateNums.size} número(s) duplicado(s):</strong>{' '}
            {[...duplicateNums].map(n => `Art. ${n}`).join(', ')}.{' '}
            Expanda cada duplicata, leia o conteúdo e clique <strong>"Marcar Revogado"</strong> no que deve ser descartado.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total" value={articles.length} />
        <StatCard label="Vigentes" value={articles.filter(a => a.vigente).length} color="text-green-600" />
        <StatCard label="Revogados" value={articles.filter(a => !a.vigente).length} color="text-red-600" />
        <StatCard label="Com Epígrafe" value={articles.filter(a => !!a.epigrafe).length} />
        <StatCard label="Duplicatas" value={duplicateNums.size} color={hasDuplicates ? 'text-yellow-600' : undefined} />
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="articles">Artigos</TabsTrigger>
          <TabsTrigger value="json">JSON Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="articles">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {articles.map((art, idx) => (
                    <ArticlePreview
                      key={idx}
                      article={art}
                      expanded={expandedArticle === String(idx)}
                      isDuplicate={duplicateNums.has(art.numero)}
                      onToggle={() =>
                        setExpandedArticle(expandedArticle === String(idx) ? null : String(idx))
                      }
                      onMarkRevoked={() => markAsRevoked(idx)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                  {JSON.stringify(articles.slice(0, 5), null, 2)}
                  {articles.length > 5 && `\n\n... e mais ${articles.length - 5} artigos`}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button onClick={handleNext} disabled={hasDuplicates}>
          {hasDuplicates
            ? `Resolva ${duplicateNums.size} duplicata(s) primeiro`
            : 'Exportar'}
          {!hasDuplicates && <ChevronRight className="h-4 w-4 ml-2" />}
        </Button>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 text-center">
        <div className={`text-2xl font-bold ${color || ''}`}>{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function ArticlePreview({
  article,
  expanded,
  isDuplicate,
  onToggle,
  onMarkRevoked,
}: {
  article: ExportedArticle;
  expanded: boolean;
  isDuplicate?: boolean;
  onToggle: () => void;
  onMarkRevoked?: () => void;
}) {
  const caput = article.plate_content[0];
  const hasSubElements = article.plate_content.length > 1;

  const isRevoked = !article.vigente;

  return (
    <div className={`px-4 py-2 ${
      isRevoked
        ? 'opacity-50 bg-muted/30 border-l-2 border-muted-foreground/30'
        : isDuplicate
        ? 'bg-yellow-50 dark:bg-yellow-950/20 border-l-2 border-yellow-500'
        : ''
    }`}>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 text-left text-sm min-w-0"
        >
          {hasSubElements ? (
            expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />
          ) : (
            <span className="w-3" />
          )}
          <span className="font-mono font-bold text-xs min-w-[80px]">
            Art. {article.numero}
          </span>
          {!article.vigente && (
            <Badge variant="destructive" className="text-[10px] px-1 py-0">Revogado</Badge>
          )}
          {isDuplicate && (
            <Badge className="text-[10px] px-1 py-0 bg-yellow-500 text-white shrink-0">Duplicado</Badge>
          )}
          {article.epigrafe && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">{article.epigrafe}</Badge>
          )}
          <span className="text-muted-foreground truncate text-xs">
            {caput?.search_text?.slice(0, 80)}...
          </span>
        </button>
        {isDuplicate && !isRevoked && onMarkRevoked && (
          <Button
            size="sm"
            variant="destructive"
            className="h-6 text-[11px] px-2 shrink-0"
            onClick={onMarkRevoked}
          >
            <XCircle className="h-3 w-3 mr-1" />
            Marcar Revogado
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 ml-8 space-y-1 border-l-2 pl-3">
          {article.plate_content.map((node, i) => (
            <div key={i} className="text-xs" style={{ paddingLeft: (node.indent || 0) * 16 }}>
              <span className="font-bold">
                {node.children[0]?.bold ? node.children[0].text : ''}
              </span>
              <span className="text-muted-foreground">
                {node.children[1]?.text || (node.children[0]?.bold ? '' : node.children[0]?.text)}
              </span>
              {node.anotacoes && (
                <span className="text-blue-500 ml-1">{node.anotacoes.join(' ')}</span>
              )}
            </div>
          ))}
          <div className="text-[10px] text-muted-foreground mt-2">
            Contexto: {article.contexto || '(sem contexto)'}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Step 4: Export
// ============================================================

function StepExport({
  exportData,
  metadata,
  setMetadata,
  uploadProgress,
  uploadError,
  showUploadConfirm,
  onCancelUpload,
  onDownload,
  onUpload,
  onBack,
}: {
  exportData: ExportedLei;
  metadata: LeiMetadata;
  setMetadata: (v: LeiMetadata) => void;
  uploadProgress: UploadProgress | null;
  uploadError: string | null;
  showUploadConfirm: boolean;
  onCancelUpload: () => void;
  onDownload: () => void;
  onUpload: () => void;
  onBack: () => void;
}) {
  const isUploading = uploadProgress !== null && uploadProgress.phase !== 'done';
  const isDone = uploadProgress?.phase === 'done';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metadata confirmation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Confirmar Metadados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>ID (obrigatório para upload)</Label>
              <Input
                value={metadata.id}
                onChange={(e) => setMetadata({ ...metadata, id: e.target.value })}
                placeholder="ex: codigo-penal"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={metadata.nome}
                onChange={(e) => setMetadata({ ...metadata, nome: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Sigla</Label>
              <Input
                value={metadata.sigla}
                onChange={(e) => setMetadata({ ...metadata, sigla: e.target.value })}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-3">
              {exportData.artigos.length} artigos serão importados.
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Baixar JSON</CardTitle>
              <CardDescription>
                Salve o arquivo localmente para backup ou uso futuro.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={onDownload} variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Baixar {metadata.sigla || 'lei'}.json
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Upload para Supabase</CardTitle>
              <CardDescription>
                Envia diretamente para o banco de dados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {uploadProgress && (
                <div className="space-y-2">
                  <Progress
                    value={
                      uploadProgress.total > 0
                        ? (uploadProgress.current / uploadProgress.total) * 100
                        : 0
                    }
                  />
                  <p className="text-xs text-muted-foreground">{uploadProgress.message}</p>
                </div>
              )}

              {uploadError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}

              {isDone && (
                <Alert>
                  <Check className="h-4 w-4" />
                  <AlertDescription className="text-green-600 font-medium">
                    {uploadProgress.message}
                  </AlertDescription>
                </Alert>
              )}

              {showUploadConfirm && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">
                      Isso vai substituir todos os artigos existentes para "{metadata.id}".
                    </p>
                    <p className="text-xs mb-3">
                      {exportData.artigos.length} artigos serão inseridos. Artigos anteriores serão removidos.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={onUpload}>
                        Confirmar Upload
                      </Button>
                      <Button size="sm" variant="outline" onClick={onCancelUpload}>
                        Cancelar
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {!showUploadConfirm && (
                <Button
                  onClick={onUpload}
                  disabled={!metadata.id || isUploading}
                  className="w-full"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : isDone ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Enviado!
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Enviar para Supabase
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-start">
        <Button variant="outline" onClick={onBack} disabled={isUploading}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    </div>
  );
}
