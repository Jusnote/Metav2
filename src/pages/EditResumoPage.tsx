import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, ChevronDown, Menu, X, Hash, FileText, Save, Edit3, Eye, Bold, Italic, Underline, Heading1, Heading2, ZoomIn, ZoomOut, Plus } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { CarouselRenderer } from "@/components/CarouselRenderer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ProgressSidebar } from "@/components/ProgressSidebar";
import { ProgressMarker } from "@/hooks/useProgressMarkers";
import { useToast } from "@/hooks/use-toast";

interface Topic {
  id: string;
  title: string;
  type: 'h1' | 'h2' | 'emoji';
  level: number;
  lineNumber: number;
}

interface Resumo {
  id: string;
  title: string;
  content: string;
  disciplina: string;
  createdAt: Date;
  lastModified: Date;
}

const EditResumoPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [contentRef, setContentRef] = useState<HTMLDivElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [newResumoTitle, setNewResumoTitle] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // State para resumos
  const [resumos, setResumos] = useState<Resumo[]>([]);
  const [currentResumo, setCurrentResumo] = useState<Resumo | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mock data - disciplina e resumo baseado nos parâmetros da URL
  const disciplinaId = searchParams.get('disciplina') || 'ctb';
  const resumoId = searchParams.get('resumo') || 'disposicoes-preliminares';

  // Mock content para demonstração - agora em HTML para o editor rico
  const resumoContent = `<h1>Disposições Preliminares</h1>

<p>O Código de Trânsito Brasileiro estabelece as normas de conduta, as infrações e as penalidades aplicáveis aos usuários das vias terrestres.</p>

<h2>📋 Conceitos Básicos</h2>

<h3>📌 Sistema Nacional de Trânsito</h3>
<p>O Sistema Nacional de Trânsito é o conjunto de órgãos e entidades da União, dos Estados, do Distrito Federal e dos Municípios que tem por finalidade o exercício das atividades de planejamento, administração, normatização, pesquisa, registro e licenciamento de veículos, formação, habilitação e reciclagem de condutores, educação, engenharia, operação do sistema viário, policiamento, fiscalização, julgamento de infrações e de recursos e aplicação de penalidades.</p>

<h3>📌 Competências</h3>
<p>🔹 <strong>União</strong>: Estabelecer e fiscalizar o cumprimento de normas gerais de circulação e conduta</p>
<p>🔹 <strong>Estados</strong>: Cumprir e fazer cumprir a legislação e as normas de trânsito</p>
<p>🔹 <strong>Municípios</strong>: Planejar, projetar, regulamentar e operar o trânsito de veículos, de pedestres e de animais</p>

<h2>📋 Definições Importantes</h2>

<h3>📌 Via</h3>
<p>Superfície por onde transitam veículos, pessoas e animais, compreendendo a pista, a calçada, o acostamento, ilha e canteiro central.</p>

<h3>📌 Veículo</h3>
<p>Todo aparelho usado para o transporte de pessoas ou coisas.</p>

<p>🔹 <strong>Classificação dos veículos:</strong></p>
<ul>
<li>Veículo de tração humana</li>
<li>Veículo de tração animal</li>
<li>Veículo de propulsão humana</li>
<li>Bicicleta</li>
<li>Ciclomotor</li>
<li>Motoneta</li>
<li>Motocicleta</li>
<li>Triciclo</li>
<li>Quadriciclo</li>
<li>Automóvel</li>
<li>Microônibus</li>
<li>Ônibus</li>
<li>Bonde</li>
<li>Reboque</li>
<li>Semirreboque</li>
<li>Chassi-plataforma</li>
<li>Motor-casa</li>
</ul>

<h3>📌 Condutor</h3>
<p>Pessoa habilitada a conduzir veículo automotor.</p>

<p>⚠️ <strong>Importante</strong>: É proibida a direção de veículos automotores e elétricos por pessoa que não possua Carteira Nacional de Habilitação.</p>

<h2>📋 Princípios do Trânsito</h2>

<p>💡 <strong>Nota</strong>: O trânsito, em condições seguras, é um direito de todos e dever dos órgãos e entidades componentes do Sistema Nacional de Trânsito.</p>

<h3>📌 Prioridades</h3>
<ol>
<li><strong>Vida</strong>: A vida é o bem mais importante</li>
<li><strong>Integridade física</strong>: Preservação da integridade física e da saúde das pessoas</li>
<li><strong>Meio ambiente</strong>: Proteção do meio ambiente</li>
<li><strong>Fluidez</strong>: Fluidez do trânsito</li>
</ol>

<h3>📌 Responsabilidades</h3>
<p>🔹 Cabe aos órgãos e entidades executivos rodoviários da União, dos Estados, do Distrito Federal e dos Municípios, no âmbito de suas competências, adotar as medidas destinadas a assegurar esse direito.</p>

<p>🔹 O trânsito de veículos nas vias terrestres abertas à circulação obedecerá às normas de circulação e conduta estabelecidas neste Código, às normas emanadas do Conselho Nacional de Trânsito e a regulamentação estabelecida pelo órgão ou entidade com circunscrição sobre a via.</p>`;

  // Estado inicial do resumo
  useEffect(() => {
    const nomeFromUrl = searchParams.get('nome');
    const resumoIdFromUrl = searchParams.get('resumo');
    
    if (nomeFromUrl) {
      // Criar novo resumo com nome da URL
      const newResumo: Resumo = {
        id: `resumo-${Date.now()}`,
        title: decodeURIComponent(nomeFromUrl),
        disciplina: disciplinaId,
        content: `<h1>${decodeURIComponent(nomeFromUrl)}</h1><p>Comece a escrever seu resumo aqui...</p>`,
        createdAt: new Date(),
        lastModified: new Date()
      };
      
      setResumos([newResumo]);
      setCurrentResumo(newResumo);
      setIsEditing(true); // Iniciar em modo de edição para novos resumos
    } else if (resumoIdFromUrl) {
      // Carregar resumo salvo pelo ID
      const savedResumos = JSON.parse(localStorage.getItem('savedResumos') || '{}');
      const allSavedResumos = Object.values(savedResumos).flat() as Resumo[];
      const resumoSalvo = allSavedResumos.find((r: Resumo) => r.id === resumoIdFromUrl);
      
      if (resumoSalvo) {
        const loadedResumo: Resumo = {
          ...resumoSalvo,
          createdAt: new Date(resumoSalvo.createdAt),
          lastModified: new Date(resumoSalvo.lastModified)
        };
        
        setResumos([loadedResumo]);
        setCurrentResumo(loadedResumo);
      }
    } else {
      // Resumo existente mock
      const mockResumo: Resumo = {
        id: 'ctb-disposicoes',
        title: 'Disposições Preliminares',
        disciplina: 'Código de Trânsito Brasileiro',
        content: resumoContent,
        createdAt: new Date(),
        lastModified: new Date()
      };
      
      setResumos([mockResumo]);
      setCurrentResumo(mockResumo);
    }
  }, [searchParams]);

  // Extrair tópicos do conteúdo HTML
  const extractTopicsFromContent = (content: string): Topic[] => {
    const lines = content.split('\n');
    const topics: Topic[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Extrai títulos HTML
      if (line.startsWith('<h1>')) {
        const title = line.replace(/<\/?h1>/g, '');
        topics.push({
          id: `topic-${i}`,
          title,
          type: 'h1',
          level: 1,
          lineNumber: i
        });
      } else if (line.startsWith('<h2>')) {
        const title = line.replace(/<\/?h2>/g, '');
        topics.push({
          id: `topic-${i}`,
          title,
          type: 'h2',
          level: 2,
          lineNumber: i
        });
      } else if (line.startsWith('<h3>')) {
        const title = line.replace(/<\/?h3>/g, '');
        topics.push({
          id: `topic-${i}`,
          title,
          type: 'h2',
          level: 3,
          lineNumber: i
        });
      } 
      // Extrai tópicos com emojis (para compatibilidade com conteúdo existente)
      else if (line.includes('📋') || line.includes('📌') || line.includes('🔹')) {
        const title = line.replace(/📋|📌|🔹/g, '').replace(/<\/?[^>]+(>|$)/g, '').trim();
        if (title) {
          topics.push({
            id: `topic-${i}`,
            title,
            type: 'emoji',
            level: line.includes('📋') ? 1 : line.includes('📌') ? 2 : 3,
            lineNumber: i
          });
        }
      }
    }
    return topics;
  };

  const topics = currentResumo ? extractTopicsFromContent(currentResumo.content) : [];

  const toggleTopicExpansion = (topicId: string) => {
    setOpenTopics(prev => ({
      ...prev,
      [topicId]: !prev[topicId]
    }));
  };

  const formatContent = (content: string) => {
    return content.replace(/^# (.+$)/gm, '<h1 class="text-2xl font-bold text-foreground mb-4 mt-6">$1</h1>').replace(/^## (.+$)/gm, '<h2 class="text-xl font-semibold text-foreground mb-3 mt-5">$1</h2>').replace(/^### (.+$)/gm, '<h3 class="text-lg font-medium text-foreground mb-2 mt-4">$1</h3>').replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>').replace(/\*(.+?)\*/g, '<em class="italic">$1</em>').replace(/^• (.+$)/gm, '<li class="ml-6 mb-1">$1</li>').replace(/^(\d+\.) (.+$)/gm, '<li class="ml-6 mb-1 list-decimal">$2</li>').replace(/⚠️ \*\*(.+?)\*\*/g, '<div class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 my-4"><div class="flex items-start gap-2"><span class="text-lg">⚠️</span><div><strong class="text-destructive font-semibold">$1</strong>').replace(/💡 \*\*(.+?)\*\*/g, '<div class="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 my-4"><div class="flex items-start gap-2"><span class="text-lg">💡</span><div><strong class="text-blue-700 dark:text-blue-300 font-semibold">$1</strong>').replace(/\n\n/g, '</p><p class="mb-3 text-foreground leading-relaxed">').replace(/^(.+)$/gm, '<p class="mb-3 text-foreground leading-relaxed">$1</p>');
  };

  const handleMarkerClick = (marker: ProgressMarker) => {
    if (!contentRef) return;
    
    // Buscar pelo texto na página e fazer scroll
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      contentRef,
      NodeFilter.SHOW_TEXT,
      null as NodeFilter | null
    );
    
    let node;
    while ((node = walker.nextNode()) !== null) {
      textNodes.push(node as Text);
    }
    
    // Procurar pelo texto da marcação
    for (const textNode of textNodes) {
      if (textNode.textContent?.includes(marker.text.replace('...', ''))) {
        const element = textNode.parentElement;
        if (element) {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          
          // Destacar temporariamente o texto
          element.style.backgroundColor = 'rgb(var(--primary) / 0.1)';
          element.style.transition = 'background-color 0.3s ease';
          setTimeout(() => {
            element.style.backgroundColor = '';
          }, 2000);
          break;
        }
      }
    }
  };

  // Funções de edição
  const updateResumoContent = (content: string) => {
    if (!currentResumo) return;
    
    const updatedResumo = {
      ...currentResumo,
      content,
      lastModified: new Date()
    };
    
    setCurrentResumo(updatedResumo);
    setResumos(prev => prev.map(r => r.id === updatedResumo.id ? updatedResumo : r));
  };

  const insertText = (text: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = currentResumo?.content || "";
    
    const newContent = currentContent.substring(0, start) + text + currentContent.substring(end);
    updateResumoContent(newContent);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const formatText = (type: 'heading1' | 'heading2' | 'bold' | 'italic' | 'underline') => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    let formattedText = selectedText;
    
    switch (type) {
      case 'heading1':
        formattedText = `# ${selectedText}`;
        break;
      case 'heading2':
        formattedText = `## ${selectedText}`;
        break;
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `__${selectedText}__`;
        break;
    }
    
    if (selectedText) {
      insertText(formattedText);
    }
  };

  // Funções de inserção rápida
  const insertTitleWithEmoji = () => insertText("\n📋 Título Principal\n\n");
  const insertSubtitleWithEmoji = () => insertText("\n📌 Subtítulo\n\n");
  const insertSectionWithEmoji = () => insertText("\n🔹 Seção\n\n");
  const insertListWithEmoji = () => insertText("\n📝 Lista:\n• Item 1\n• Item 2\n• Item 3\n\n");
  const insertImportantWithEmoji = () => insertText("\n⚠️ **Importante**: \n\n");
  const insertNoteWithEmoji = () => insertText("\n💡 **Nota**: \n\n");

  const saveResumo = () => {
    if (!currentResumo) return;
    
    // Salvar no localStorage para que apareça na lista de resumos
    const savedResumos = JSON.parse(localStorage.getItem('savedResumos') || '{}');
    const disciplinaId = searchParams.get('disciplina') || currentResumo.disciplina;
    
    if (!savedResumos[disciplinaId]) {
      savedResumos[disciplinaId] = [];
    }
    
    // Verificar se já existe um resumo com o mesmo nome
    const existingIndex = savedResumos[disciplinaId].findIndex((r: Resumo) => r.title === currentResumo.title);
    
    const resumoToSave = {
      id: currentResumo.id,
      title: currentResumo.title,
      content: currentResumo.content,
      disciplina: disciplinaId,
      createdAt: currentResumo.createdAt,
      lastModified: new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
      // Atualizar resumo existente
      savedResumos[disciplinaId][existingIndex] = resumoToSave;
    } else {
      // Adicionar novo resumo
      savedResumos[disciplinaId].push(resumoToSave);
    }
    
    localStorage.setItem('savedResumos', JSON.stringify(savedResumos));
    
    toast({
      title: "Resumo salvo",
      description: "Suas alterações foram salvas com sucesso!"
    });
  };

  const createNewResumo = () => {
    if (!newResumoTitle.trim()) {
      toast({
        title: "Título obrigatório",
        description: "Por favor, insira um título para o resumo.",
        variant: "destructive"
      });
      return;
    }

    const newResumo: Resumo = {
      id: `resumo-${Date.now()}`,
      title: newResumoTitle,
      disciplina: 'Código de Trânsito Brasileiro',
      content: `<h1>${newResumoTitle}</h1><p>Comece a escrever seu resumo aqui...</p>`,
      createdAt: new Date(),
      lastModified: new Date()
    };

    setResumos(prev => [...prev, newResumo]);
    setCurrentResumo(newResumo);
    setNewResumoTitle("");
    setShowCreateForm(false);
    setIsEditing(true);
    
    toast({
      title: "Resumo criado",
      description: "Seu novo resumo foi criado com sucesso!"
    });
  };

  // Inicializar alguns tópicos como abertos - EXATAMENTE igual à StudyPage
  useEffect(() => {
    const initialOpen: Record<string, boolean> = {};
    topics.slice(0, 3).forEach(topic => {
      initialOpen[topic.id] = true;
    });
    setOpenTopics(initialOpen);
  }, []);

  return (
    <div className="h-full w-full bg-background overflow-hidden flex relative">
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left sidebar - Tópicos do Resumo - EXATAMENTE igual à StudyPage */}
        <div className={`${isSidebarExpanded ? 'w-72 absolute left-0 top-0 h-full z-40 bg-muted/95' : 'w-6 bg-muted/50'} ${isSidebarExpanded ? 'border-r' : ''} border-border flex flex-col min-h-0 transition-all duration-300 ${!isSidebarExpanded ? 'relative' : ''}`}>
          
          {/* Collapsed sidebar - thin line with expand button */}
          {!isSidebarExpanded && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsSidebarExpanded(true)} 
                className="h-12 w-8 rounded-none rounded-r-md bg-muted/80 hover:bg-muted border border-l-0 border-border text-muted-foreground hover:text-foreground"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* Expanded sidebar header */}
          {isSidebarExpanded && (
            <div className="p-3 border-b border-border shrink-0 flex items-center justify-between py-[22px]">
              <div>
                <h2 className="font-semibold text-foreground text-sm">Código de Trânsito Brasileiro</h2>
                <p className="text-xs text-muted-foreground">Disposições Preliminares</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsSidebarExpanded(false)} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Conteúdo da sidebar - só aparece quando expandida */}
          {isSidebarExpanded && (
            <>
              {/* Seção de criação/edição de resumo */}
              <div className="p-3 border-b border-border shrink-0">
                {!showCreateForm ? (
                  <div className="space-y-2">
                    <Button 
                      onClick={() => setIsEditing(!isEditing)} 
                      className={`w-full ${isEditing ? 'bg-accent' : ''}`}
                      variant={isEditing ? 'default' : 'outline-solid'}
                      size="sm"
                    >
                      {isEditing ? <Edit3 className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                      {isEditing ? 'Modo Edição' : 'Modo Visualização'}
                    </Button>
                    <Button 
                      onClick={() => setShowCreateForm(true)} 
                      variant="outline"
                      className="w-full" 
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Novo Resumo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="Título do novo resumo"
                      value={newResumoTitle}
                      onChange={(e) => setNewResumoTitle(e.target.value)}
                      className="text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          createNewResumo();
                        } else if (e.key === 'Escape') {
                          setShowCreateForm(false);
                          setNewResumoTitle("");
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <Button onClick={createNewResumo} size="sm" className="flex-1">
                        Criar
                      </Button>
                      <Button 
                        onClick={() => {
                          setShowCreateForm(false);
                          setNewResumoTitle("");
                        }} 
                        variant="outline" 
                        size="sm"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="p-3 pt-2">
                  {topics.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      Nenhum tópico encontrado
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {topics.map(topic => {
                        const isOpen = openTopics[topic.id];
                        const hasSubtopics = topics.some(t => t.level > topic.level && t.lineNumber > topic.lineNumber);
                        
                        if (topic.level === 1) {
                          return (
                            <Collapsible key={topic.id} open={isOpen} onOpenChange={() => toggleTopicExpansion(topic.id)} className="mb-2">
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" className={`w-full justify-start text-left h-auto p-2 ${selectedTopic === topic.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`} onClick={() => setSelectedTopic(topic.id)}>
                                  <div className="flex items-center gap-2 w-full">
                                    {hasSubtopics && (isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
                                    {topic.type === 'h1' && <Hash className="h-4 w-4 text-blue-500" />}
                                    {topic.type === 'emoji' && <span className="text-sm">📋</span>}
                                    <span className="font-medium text-sm truncate">{topic.title}</span>
                                  </div>
                                </Button>
                              </CollapsibleTrigger>
                              
                              {hasSubtopics && (
                                <CollapsibleContent className="ml-4 mt-1">
                                  <div className="space-y-1">
                                    {topics.filter(t => t.level === 2 && t.lineNumber > topic.lineNumber).slice(0, 5) // Limitando para não ficar muito longo
                                      .map(subtopic => (
                                        <Button key={subtopic.id} variant="ghost" size="sm" className={`w-full justify-start text-left h-auto p-2 text-xs ${selectedTopic === subtopic.id ? "bg-accent/50 text-accent-foreground" : "hover:bg-accent/30"}`} onClick={() => setSelectedTopic(subtopic.id)}>
                                          <div className="flex items-center gap-2">
                                            {subtopic.type === 'h2' && <Hash className="h-3 w-3 text-green-500" />}
                                            {subtopic.type === 'emoji' && (
                                              <span className="text-xs">
                                                {subtopic.level === 2 ? '📌' : '🔹'}
                                              </span>
                                            )}
                                            <span className="truncate text-xs">{subtopic.title}</span>
                                          </div>
                                        </Button>
                                      ))}
                                  </div>
                                </CollapsibleContent>
                              )}
                            </Collapsible>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Botão de voltar */}
          <div className="p-3 border-t border-border shrink-0">
            {isSidebarExpanded ? (
              <Button onClick={() => navigate('/resumos-list')} variant="outline" className="w-full" size="sm">
                ← Voltar à Lista
              </Button>
            ) : (
              <Button onClick={() => navigate('/resumos-list')} variant="outline" size="sm" className="w-full p-2">
                ←
              </Button>
            )}
          </div>
        </div>

        {/* Center content area - Conteúdo do Resumo - EXATAMENTE igual à StudyPage */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-border shrink-0 bg-background">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-foreground">Código de Trânsito Brasileiro - CTB</h1>
                <p className="text-sm text-muted-foreground">Disposições Preliminares</p>
              </div>
              <div className="flex items-center gap-2">

                {/* Controles gerais */}
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>

                {currentResumo && (
                  <Button variant="outline" size="sm" onClick={saveResumo}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Conteúdo do resumo com scroll próprio */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="flex justify-center px-16 py-6">
                <div className="w-full max-w-4xl">
                  {currentResumo ? (
                    isEditing ? (
                      <div className="relative">
                        {/* Editor de texto rico WYSIWYG */}
                        <RichTextEditor
                          content={currentResumo.content}
                          onChange={updateResumoContent}
                          placeholder="Digite seu resumo aqui... Use a barra de ferramentas para formatação."
                          className="min-h-[calc(100vh-300px)]"
                        />
                        
                        {/* Overlay para indicar modo de edição */}
                        <div className="absolute top-2 right-2 px-2 py-1 bg-primary/10 text-primary text-xs rounded border border-primary/20">
                          Editor Visual
                        </div>
                      </div>
                     ) : (
                       <>
                         {/* Estilos para reproduzir exatamente o editor rico - incluindo ícones dos callouts */}
                         <style>
                           {`
                             .rich-content-display {
                               font-size: 16px;
                               line-height: 1.8;
                               color: hsl(var(--foreground));
                             }
                             
                             /* Estilos para Callouts/Dicas - idêntico ao StudyPage */
                             .rich-content-display .callout,
                             .rich-content-display [data-callout] {
                               border-left: 4px solid;
                               padding: 1rem;
                               margin: 1rem 0;
                               border-radius: 0 0.5rem 0.5rem 0;
                               display: flex;
                               align-items: flex-start;
                               gap: 0.75rem;
                               position: relative;
                             }
                             
                             /* Ícones dos callouts via CSS - idêntico ao componente React */
                             .rich-content-display .callout::before,
                             .rich-content-display [data-callout]::before {
                               content: "";
                               width: 1.25rem;
                               height: 1.25rem;
                               margin-top: 0.125rem;
                               flex-shrink: 0;
                               background-size: contain;
                               background-repeat: no-repeat;
                               background-position: center;
                             }
                             
                             .rich-content-display .callout[data-type="info"]::before,
                             .rich-content-display [data-callout][data-type="info"]::before {
                               background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(59 130 246)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='m9 12 2 2 4-4'/%3E%3C/svg%3E");
                             }
                             
                             .rich-content-display .callout[data-type="warning"]::before,
                             .rich-content-display [data-callout][data-type="warning"]::before {
                               background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(245 158 11)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z'/%3E%3Cpath d='M12 9v4'/%3E%3Cpath d='m12 17 .01 0'/%3E%3C/svg%3E");
                             }
                             
                             .rich-content-display .callout[data-type="success"]::before,
                             .rich-content-display [data-callout][data-type="success"]::before {
                               background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(34 197 94)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/%3E%3Cpolyline points='22,4 12,14.01 9,11.01'/%3E%3C/svg%3E");
                             }
                             
                             .rich-content-display .callout[data-type="error"]::before,
                             .rich-content-display [data-callout][data-type="error"]::before {
                               background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(239 68 68)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='m15 9-6 6'/%3E%3Cpath d='m9 9 6 6'/%3E%3C/svg%3E");
                             }
                             
                             .rich-content-display .callout[data-type="tip"]::before,
                             .rich-content-display [data-callout][data-type="tip"]::before {
                               background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(147 51 234)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5'/%3E%3Cpath d='M9 18h6'/%3E%3Cpath d='M10 22h4'/%3E%3C/svg%3E");
                             }
                             
                             .rich-content-display .callout[data-type="note"]::before,
                             .rich-content-display [data-callout][data-type="note"]::before {
                               background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(107 114 128)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 16v-4'/%3E%3Cpath d='m12 8 .01 0'/%3E%3C/svg%3E");
                             }
                             
                             .rich-content-display .callout[data-type="info"],
                             .rich-content-display [data-callout][data-type="info"] {
                               background-color: rgb(239 246 255);
                               border-left-color: rgb(59 130 246);
                               color: rgb(30 58 138);
                             }
                             
                             .rich-content-display .callout[data-type="warning"],
                             .rich-content-display [data-callout][data-type="warning"] {
                               background-color: rgb(255 251 235);
                               border-left-color: rgb(245 158 11);
                               color: rgb(146 64 14);
                             }
                             
                             .rich-content-display .callout[data-type="success"],
                             .rich-content-display [data-callout][data-type="success"] {
                               background-color: rgb(236 253 245);
                               border-left-color: rgb(34 197 94);
                               color: rgb(20 83 45);
                             }
                             
                             .rich-content-display .callout[data-type="error"],
                             .rich-content-display [data-callout][data-type="error"] {
                               background-color: rgb(254 242 242);
                               border-left-color: rgb(239 68 68);
                               color: rgb(127 29 29);
                             }
                             
                             .rich-content-display .callout[data-type="tip"],
                             .rich-content-display [data-callout][data-type="tip"] {
                               background-color: rgb(250 245 255);
                               border-left-color: rgb(147 51 234);
                               color: rgb(88 28 135);
                             }
                             
                             .rich-content-display .callout[data-type="note"],
                             .rich-content-display [data-callout][data-type="note"] {
                               background-color: rgb(249 250 251);
                               border-left-color: rgb(107 114 128);
                               color: rgb(55 65 81);
                             }
                             
                             /* Dark mode para callouts */
                             .dark .rich-content-display .callout[data-type="info"],
                             .dark .rich-content-display [data-callout][data-type="info"] {
                               background-color: rgb(30 58 138 / 0.1);
                               color: rgb(147 197 253);
                             }
                             
                             .dark .rich-content-display .callout[data-type="info"]::before,
                             .dark .rich-content-display [data-callout][data-type="info"]::before {
                               background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(147 197 253)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='m9 12 2 2 4-4'/%3E%3C/svg%3E");
                             }
                             
                             .dark .rich-content-display .callout[data-type="warning"],
                             .dark .rich-content-display [data-callout][data-type="warning"] {
                               background-color: rgb(146 64 14 / 0.1);
                               color: rgb(253 186 116);
                             }
                             
                             .dark .rich-content-display .callout[data-type="warning"]::before,
                             .dark .rich-content-display [data-callout][data-type="warning"]::before {
                               background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(253 186 116)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z'/%3E%3Cpath d='M12 9v4'/%3E%3Cpath d='m12 17 .01 0'/%3E%3C/svg%3E");
                             }
                             
                             .dark .rich-content-display .callout[data-type="success"],
                             .dark .rich-content-display [data-callout][data-type="success"] {
                               background-color: rgb(20 83 45 / 0.1);
                               color: rgb(134 239 172);
                             }
                             
                             .dark .rich-content-display .callout[data-type="success"]::before,
                             .dark .rich-content-display [data-callout][data-type="success"]::before {
                               background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(134 239 172)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/%3E%3Cpolyline points='22,4 12,14.01 9,11.01'/%3E%3C/svg%3E");
                             }
                             
                             .dark .rich-content-display .callout[data-type="error"],
                             .dark .rich-content-display [data-callout][data-type="error"] {
                               background-color: rgb(127 29 29 / 0.1);
                               color: rgb(252 165 165);
                             }
                             
                             .dark .rich-content-display .callout[data-type="error"]::before,
                             .dark .rich-content-display [data-callout][data-type="error"]::before {
                               background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(252 165 165)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='m15 9-6 6'/%3E%3Cpath d='m9 9 6 6'/%3E%3C/svg%3E");
                             }
                             
                             .dark .rich-content-display .callout[data-type="tip"],
                             .dark .rich-content-display [data-callout][data-type="tip"] {
                               background-color: rgb(88 28 135 / 0.1);
                               color: rgb(196 181 253);
                             }
                             
                             .dark .rich-content-display .callout[data-type="tip"]::before,
                             .dark .rich-content-display [data-callout][data-type="tip"]::before {
                               background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(196 181 253)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5'/%3E%3Cpath d='M9 18h6'/%3E%3Cpath d='M10 22h4'/%3E%3C/svg%3E");
                             }
                             
                             .dark .rich-content-display .callout[data-type="note"],
                             .dark .rich-content-display [data-callout][data-type="note"] {
                               background-color: rgb(55 65 81 / 0.1);
                               color: rgb(209 213 219);
                             }
                             
                             .dark .rich-content-display .callout[data-type="note"]::before,
                             .dark .rich-content-display [data-callout][data-type="note"]::before {
                               background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(209 213 219)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 16v-4'/%3E%3Cpath d='m12 8 .01 0'/%3E%3C/svg%3E");
                             }
                           `}
                         </style>
                          <CarouselRenderer
                            ref={setContentRef}
                            content={currentResumo.content}
                            className="rich-content-display"
                          />
                       </>
                     )
                  ) : (
                    <div className="flex items-center justify-center h-full min-h-[400px]">
                      <div className="text-center space-y-4">
                        <div className="text-6xl">📚</div>
                        <h3 className="text-xl font-semibold text-foreground">Selecione ou crie um resumo</h3>
                        <p className="text-muted-foreground">
                          Escolha um resumo existente ou crie um novo para começar a editar.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Right sidebar - Progress Markers - EXATAMENTE igual à StudyPage */}
        <ProgressSidebar 
          disciplina={disciplinaId}
          resumo={resumoId}
          onMarkerClick={handleMarkerClick}
        />
      </div>
    </div>
  );
};

export default EditResumoPage;