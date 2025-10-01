import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Star, ChevronUp, ChevronDown } from "lucide-react";

interface ResumoSalvo {
  title: string;
  content?: string;
  id?: string;
}

interface Disciplina {
  id: string;
  name: string;
  icon?: React.ComponentType;
  subtitle?: string;
  count?: string | number;
  isFavorite?: boolean;
  resumos: string[];
}
const ResumosListPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDisciplina, setSelectedDisciplina] = useState<string | null>(null);
  const [currentThumbnailIndex, setCurrentThumbnailIndex] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [resumoName, setResumoName] = useState("");
  const [resumosSalvos, setResumosSalvos] = useState<Record<string, ResumoSalvo[]>>({});
  const [selectedDisciplinaForCreation, setSelectedDisciplinaForCreation] = useState<string>("");

  // Mock data - disciplinas
  const disciplinas: Disciplina[] = [{
    id: "favoritos",
    name: "Favoritos",
    icon: Star,
    count: 0,
    isFavorite: true,
    resumos: []
  }, {
    id: "ctb",
    name: "Código de Trânsito Brasileiro - CTB",
    subtitle: "Lei nº 9.503/97",
    count: "14 resumos, 0 concluídos",
    resumos: ["Disposições preliminares", "Normas gerais de circulação e conduta", "Condução de veículos por motoristas profissionais", "Pedestres e condutores de veículos não motorizados", "Cidadão", "Educação para o trânsito", "Sinalização de trânsito", "Engenharia de tráfego, operação, fiscalização e policiamento ostensivo de trânsito", "Veículos (Vol. 1)", "Veículos (Vol. 2)", "Veículos (Vol. 3)", "Veículos em circulação internacional", "Registro de veículos", "Licenciamento", "Condução de escolares"]
  }, {
    id: "administrativo",
    name: "Direito Administrativo",
    count: "14 resumos, 0 concluídos",
    resumos: ["Princípios da Administração Pública", "Organização Administrativa", "Atos Administrativos", "Processo Administrativo", "Licitações e Contratos", "Serviços Públicos", "Responsabilidade Civil do Estado"]
  }, {
    id: "constitucional",
    name: "Direito Constitucional",
    count: "24 resumos, 0 concluídos",
    resumos: ["Teoria Geral da Constituição", "Direitos e Garantias Fundamentais", "Organização do Estado", "Organização dos Poderes", "Controle de Constitucionalidade"]
  }, {
    id: "penal",
    name: "Direito Penal",
    count: "38 resumos, 0 concluídos",
    resumos: ["Teoria Geral do Crime", "Crimes contra a Pessoa", "Crimes contra o Patrimônio", "Crimes contra a Administração Pública"]
  }, {
    id: "processual-penal",
    name: "Direito Processual Penal",
    count: "10 resumos, 0 concluídos",
    resumos: ["Inquérito Policial", "Ação Penal", "Processo e Procedimento", "Prisões e Medidas Cautelares"]
  }, {
    id: "direitos-humanos",
    name: "Direitos Humanos",
    count: "7 resumos, 0 concluídos",
    resumos: ["Teoria Geral dos Direitos Humanos", "Sistema Internacional de Proteção", "Sistema Interamericano de Proteção"]
  }, {
    id: "fisica",
    name: "Física",
    count: "15 resumos, 0 concluídos",
    resumos: ["Mecânica", "Termologia", "Óptica", "Eletricidade"]
  }, {
    id: "informatica",
    name: "Informática",
    count: "8 resumos, 0 concluídos",
    resumos: ["Hardware e Software", "Sistemas Operacionais", "Redes de Computadores", "Segurança da Informação"]
  }, {
    id: "legislacao-extravagante",
    name: "Legislação Extravagante",
    count: "16 resumos, 0 concluídos",
    resumos: ["Lei de Improbidade Administrativa", "Lei de Acesso à Informação", "Marco Civil da Internet"]
  }, {
    id: "portugues",
    name: "Língua Portuguesa (Português)",
    count: "32 resumos, 0 concluídos",
    resumos: ["Morfologia", "Sintaxe", "Semântica", "Interpretação de Textos"]
  }, {
    id: "matematica",
    name: "Matemática",
    count: "18 resumos, 0 concluídos",
    resumos: ["Aritmética", "Álgebra", "Geometria", "Estatística"]
  }, {
    id: "redacao-oficial",
    name: "Redação Oficial",
    count: "5 resumos, 0 concluídos",
    resumos: ["Correspondência Oficial", "Manual de Redação da Presidência", "Normas Técnicas"]
  }];

  // Mock thumbnails data
  const thumbnails = ["LEGAIS", "PF AGENTE", "PF ESCRIVA", "LELE OFICIAL", "INVESTIGAD", "OFICIAL BAR", "POLICIA CIV", "CFO PMDF", "PRF", "POLICIA CIVIL", "POLICIA MILITAR", "ESCRIVÃO POL", "POLICIA MILITAR", "POLICIA PENAL", "AGENTE IMP", "SD PMTO DEV", "POLICIAL FMT", "CB BOMBEIROS", "SOLDADO IB", "AGENTE PEN"];
  
  // Carregar resumos salvos do localStorage
  useEffect(() => {
    const savedResumos = localStorage.getItem('savedResumos');
    if (savedResumos) {
      setResumosSalvos(JSON.parse(savedResumos) as Record<string, ResumoSalvo[]>);
    }
  }, []);

  const getResumosDaDisciplina = () => {
    if (!selectedDisciplina) return [];
    const disciplina = disciplinas.find((d: Disciplina) => d.id === selectedDisciplina);
    const resumosMock = disciplina?.resumos || [];
    const resumosSalvosDisciplina = resumosSalvos[selectedDisciplina] || [];
    
    // Combinar resumos mock com resumos salvos
    const todosResumos = [
      ...resumosMock,
      ...resumosSalvosDisciplina.map((r: ResumoSalvo) => r.title)
    ];
    
    return todosResumos;
  };
  const handleDisciplinaClick = (disciplinaId: string) => {
    setSelectedDisciplina(selectedDisciplina === disciplinaId ? null : disciplinaId);
  };
  const handleCommencar = (topico: string) => {
    // Verificar se é um resumo salvo
    const resumosSalvosDisciplina = resumosSalvos[selectedDisciplina!] || [];
    const resumoSalvo = resumosSalvosDisciplina.find(r => r.title === topico);
    
    if (resumoSalvo) {
      // Se é um resumo salvo, abrir na página de estudo (não de edição)
      navigate(`/study?disciplina=${selectedDisciplina}&resumo=${resumoSalvo.id}`);
    } else {
      // Se é um resumo mock, ir para a página de estudo
      navigate(`/study?disciplina=${selectedDisciplina}&resumo=${encodeURIComponent(topico.toLowerCase().replace(/\s+/g, '-'))}`);
    }
  };

  const handleCreateResumo = () => {
    if (resumoName && selectedDisciplinaForCreation) {
      setIsDialogOpen(false);
      setResumoName("");
      setSelectedDisciplinaForCreation("");
      navigate(`/resumos?disciplina=${selectedDisciplinaForCreation}&nome=${encodeURIComponent(resumoName)}`);
    }
  };

  // Calcula quantos thumbnails cabem na tela verticalmente (considerando altura de 64px + gap de 8px cada)
  const thumbnailsPerView = Math.floor((window.innerHeight - 200) / 72); // 200px para headers/margins, 72px por thumbnail
  const maxIndex = Math.max(0, thumbnails.length - thumbnailsPerView);
  const needsNavigation = thumbnails.length > thumbnailsPerView;
  const handlePrevious = () => {
    setCurrentThumbnailIndex(Math.max(0, currentThumbnailIndex - 1));
  };
  const handleNext = () => {
    setCurrentThumbnailIndex(Math.min(maxIndex, currentThumbnailIndex + 1));
  };
  const visibleThumbnails = needsNavigation ? thumbnails.slice(currentThumbnailIndex, currentThumbnailIndex + thumbnailsPerView) : thumbnails;
  return <div className="h-full w-full bg-background overflow-hidden flex">
      {/* Left thumbnails bar */}
      <div className="w-24 border-r border-border bg-muted/30 shrink-0 flex flex-col">
        <div className="flex flex-col items-center h-full py-[60px]">
          {needsNavigation && <Button variant="ghost" size="sm" onClick={handlePrevious} disabled={currentThumbnailIndex === 0} className="h-8 w-8 p-0 mb-2">
              <ChevronUp className="h-4 w-4" />
            </Button>}
          
          <div className="flex-1 overflow-hidden">
            <div className="flex flex-col gap-2 items-center">
              {visibleThumbnails.map((thumb: string, index: number) => <div key={needsNavigation ? currentThumbnailIndex + index : index} className="shrink-0 w-20 h-16 bg-muted border border-border rounded-lg flex items-center justify-center text-xs font-medium text-center leading-tight p-2">
                  {thumb}
                </div>)}
            </div>
          </div>
          
          {needsNavigation && <Button variant="ghost" size="sm" onClick={handleNext} disabled={currentThumbnailIndex >= maxIndex} className="h-8 w-8 p-0 mt-2">
              <ChevronDown className="h-4 w-4" />
            </Button>}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar - Disciplinas */}
        <div className="w-96 bg-muted/50 border-r border-border flex flex-col min-h-0">
          <div className="p-3 border-b border-border shrink-0 py-[2px]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-foreground text-sm">Disciplinas</h2>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-2 py-1">
                    + Criar
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Criar Novo Resumo</DialogTitle>
                    <DialogDescription>
                      Preencha as informações abaixo para criar um novo resumo.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="resumo-name">Nome do Resumo</Label>
                      <Input
                        id="resumo-name"
                        value={resumoName}
                        onChange={(e) => setResumoName(e.target.value)}
                        placeholder="Digite o nome do resumo"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="disciplina-select">Disciplina</Label>
                      <Select value={selectedDisciplinaForCreation} onValueChange={setSelectedDisciplinaForCreation}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma disciplina" />
                        </SelectTrigger>
                        <SelectContent>
                          {disciplinas.filter(d => !d.isFavorite).map((disciplina: Disciplina) => (
                            <SelectItem key={disciplina.id} value={disciplina.id}>
                              {disciplina.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateResumo} disabled={!resumoName || !selectedDisciplinaForCreation}>
                      Criar Resumo
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 pt-0 px-[15.5px]">
              {disciplinas.map((disciplina: Disciplina) => <div key={disciplina.id} className={`mb-2 cursor-pointer hover:bg-accent/50 p-2 rounded-lg transition-colors ${disciplina.isFavorite ? 'border-b border-border pb-2 mb-3' : ''} ${selectedDisciplina === disciplina.id ? 'bg-accent' : ''}`} onClick={() => handleDisciplinaClick(disciplina.id)}>
                  <div className="flex items-center gap-2 mb-1">
                    {disciplina.isFavorite && <Star className="h-3 w-3 text-yellow-500" />}
                    <span className="font-medium text-xs">{disciplina.name}</span>
                  </div>
                  {disciplina.subtitle && <div className="text-xs text-muted-foreground mb-1">{disciplina.subtitle}</div>}
                  {disciplina.count && <div className="text-xs text-muted-foreground">{disciplina.count}</div>}
                </div>)}
            </div>
          </ScrollArea>
        </div>

        {/* Right content area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Search bar */}
          <div className="p-3 border-b border-border shrink-0 py-[8px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Digite para pesquisar" value={searchTerm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} className="pl-10 h-8" />
            </div>
          </div>

          {/* Topics list */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-3">
                {selectedDisciplina ? <div className="space-y-2">
                    {getResumosDaDisciplina().map((resumo: string, index: number) => <div key={index} className="flex items-center justify-between py-1 border-b border-border last:border-b-0">
                        <span className="text-sm font-medium">{resumo}</span>
                        <Button onClick={() => handleCommencar(resumo)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1 text-xs rounded">
                          COMEÇAR
                        </Button>
                      </div>)}
                  </div> : <div className="text-center text-muted-foreground mt-8">
                    <p className="text-sm">Selecione uma disciplina para ver os resumos disponíveis</p>
                  </div>}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

    </div>;
};
export default ResumosListPage;