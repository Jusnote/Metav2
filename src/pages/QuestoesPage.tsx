import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, Search, X, Bookmark, Clock, CheckCircle, XCircle, AlertCircle, Filter, SlidersHorizontal, Grid3X3, List, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuestoes } from "@/hooks/useQuestoes";

// Dados estáticos para demonstração
const questoesEstaticas = [
  {
    id: "Q0347900",
    disciplina: "Direito Penal",
    assunto: "MPF 2025",
    nivel: "Médio",
    prova: "MPF - Procurador da República",
    cargo: "Procurador",
    ano: 2025,
    pergunta: "O art. 4º do Código Penal estabelece: \"Considera-se praticado o crime no momento da ação ou omissão, ainda que outro seja o momento do resultado\". A partir daí, correto afirmar:",
    alternativas: [
      { letra: "A", texto: "O dispositivo trata do tempo do crime e o Código adota a teoria da atividade." },
      { letra: "B", texto: "Nos crimes permanentes a teoria da atividade não é aplicada." },
      { letra: "C", texto: "O dispositivo trata do tempo do crime e o Código adota a teoria da ubiquidade." },
      { letra: "D", texto: "O dispositivo trata do tempo do crime e o Código adota a teoria do resultado." }
    ],
    respostaCorreta: "A",
    status: "nao-resolvida"
  },
  {
    id: "Q0347901",
    disciplina: "Direito Constitucional",
    assunto: "Direitos Fundamentais",
    nivel: "Fácil",
    prova: "TRF - Juiz Federal",
    cargo: "Juiz",
    ano: 2024,
    pergunta: "Sobre os direitos fundamentais, é correto afirmar:",
    alternativas: [
      { letra: "A", texto: "São absolutos e não admitem limitações." },
      { letra: "B", texto: "Possuem eficácia horizontal e vertical." },
      { letra: "C", texto: "Aplicam-se apenas às relações entre Estado e particulares." },
      { letra: "D", texto: "Não podem ser objeto de emenda constitucional." }
    ],
    respostaCorreta: "B",
    status: "acertou"
  }
];

const filtrosDisponiveis = {
  status: ["Todas", "Resolvidas", "Não resolvidas", "Acertei", "Errei"],
  disciplinas: ["Direito Penal", "Direito Constitucional", "Direito Administrativo", "Direito Civil"],
  assuntos: ["MPF 2025", "Direitos Fundamentais", "Atos Administrativos", "Contratos"],
  bancas: ["CESPE", "FGV", "VUNESP", "FCC"],
  anos: ["2025", "2024", "2023", "2022"],
  cargos: ["Procurador", "Juiz", "Analista", "Técnico", "Auditor"],
  modalidades: ["Múltipla Escolha", "Certo/Errado"],
  dificuldades: ["Fácil", "Médio", "Difícil"]
};

export default function QuestoesPage() {
  const [filtrosAtivos, setFiltrosAtivos] = useState<string[]>([]);
  const [mostrarFiltros, setMostrarFiltros] = useState(true);
  const [statusSelecionado, setStatusSelecionado] = useState("Todas");
  const [respostasSelecionadas, setRespostasSelecionadas] = useState<{[key: string]: string}>({});
  const [questoesPorPagina, setQuestoesPorPagina] = useState("10");
  const [visualizacao, setVisualizacao] = useState<"grid" | "list">("list");
  const { questoes: questoesUsuario, loading, error, deleteQuestao } = useQuestoes();
  
  // Combinar questões estáticas com questões do usuário
  const todasQuestoes = [
    ...questoesUsuario.map(q => ({
      id: q.id,
      disciplina: q.disciplina || "Sem disciplina",
      assunto: q.assunto || "Sem assunto",
      nivel: q.nivel || "Médio",
      banca: q.banca || "",
      cargo: q.cargo || "",
      ano: q.ano || new Date(q.created_at).getFullYear(),
      pergunta: q.enunciado,
      alternativas: q.alternativas?.map(alt => ({
        letra: alt.letra,
        texto: alt.texto
      })) || [],
      respostaCorreta: q.alternativas?.find(alt => alt.correta)?.letra || "A",
      status: "nao-resolvida",
      tipo: "usuario",
      questaoOriginal: q
    })),
    ...questoesEstaticas.map(q => ({
      ...q,
      tipo: "estatica"
    }))
  ];
  
  // Filtros individuais
  const [palavraChave, setPalavraChave] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [assunto, setAssunto] = useState("");
  const [banca, setBanca] = useState("");
  const [ano, setAno] = useState("");
  const [cargo, setCargo] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [dificuldade, setDificuldade] = useState("");

  const adicionarFiltro = (filtro: string) => {
    if (!filtrosAtivos.includes(filtro)) {
      setFiltrosAtivos([...filtrosAtivos, filtro]);
    }
  };

  const removerFiltro = (filtro: string) => {
    setFiltrosAtivos(filtrosAtivos.filter(f => f !== filtro));
  };

  const selecionarResposta = (questaoId: string, alternativa: string) => {
    setRespostasSelecionadas({
      ...respostasSelecionadas,
      [questaoId]: alternativa
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "acertou":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "errou":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "resolvida":
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-accent/10">
      {/* Header da Página */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-xs sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Sistema de Questões
              </h1>
              <div className="text-sm text-muted-foreground">
                {todasQuestoes.length} questões disponíveis • Filtragem avançada
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Botão de Criar Nova Questão */}
              <Button asChild variant="default" size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-lg">
                <Link to="/criar-questao">
                  <Plus className="h-4 w-4" />
                  Criar Questão
                </Link>
              </Button>
              
              {/* Controles de Visualização */}
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                <Button
                  variant={visualizacao === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setVisualizacao("list")}
                  className="h-8 w-8 p-0"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={visualizacao === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setVisualizacao("grid")}
                  className="h-8 w-8 p-0"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Toggle de Filtros */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                className="gap-2 bg-card/50 hover:bg-card"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {mostrarFiltros ? "Ocultar Filtros" : "Mostrar Filtros"}
              </Button>
              
              {/* Botão de Busca Principal */}
              <Button size="sm" className="gap-2 bg-primary hover:bg-primary-hover shadow-lg">
                <Search className="h-4 w-4" />
                Buscar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Seção de Filtros Aprimorada */}
        {mostrarFiltros && (
          <Card className="mb-8 shadow-lg bg-card/60 backdrop-blur-xs border-border/50 overflow-hidden">
            <CardHeader className="pb-4 bg-linear-to-r from-muted/20 to-accent/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Filtros Avançados</h2>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  {filtrosAtivos.length} filtros ativos
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Botões de Status com Design Melhorado */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-muted-foreground">Status das Questões</Label>
                <div className="flex flex-wrap gap-2">
                  {filtrosDisponiveis.status.map((status) => (
                    <Button
                      key={status}
                      variant={statusSelecionado === status ? "default" : "outline-solid"}
                      size="sm"
                      onClick={() => setStatusSelecionado(status)}
                      className={`transition-all duration-200 ${
                        statusSelecionado === status 
                          ? "shadow-md scale-105" 
                          : "hover:scale-102 hover:shadow-xs"
                      }`}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Grid de Filtros Reorganizado */}
              <div className="space-y-4">
                <Label className="text-sm font-medium text-muted-foreground">Filtros Específicos</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por palavra-chave..."
                      value={palavraChave}
                      onChange={(e) => setPalavraChave(e.target.value)}
                      className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                  
                  <Select value={disciplina} onValueChange={setDisciplina}>
                    <SelectTrigger className="bg-background/50 border-border/50 focus:border-primary/50">
                      <SelectValue placeholder="Selecionar Disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      {filtrosDisponiveis.disciplinas.map((disc) => (
                        <SelectItem key={disc} value={disc}>{disc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={assunto} onValueChange={setAssunto}>
                    <SelectTrigger className="bg-background/50 border-border/50 focus:border-primary/50">
                      <SelectValue placeholder="Selecionar Assunto" />
                    </SelectTrigger>
                    <SelectContent>
                      {filtrosDisponiveis.assuntos.map((ass) => (
                        <SelectItem key={ass} value={ass}>{ass}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={banca} onValueChange={setBanca}>
                    <SelectTrigger className="bg-background/50 border-border/50 focus:border-primary/50">
                      <SelectValue placeholder="Selecionar Banca" />
                    </SelectTrigger>
                    <SelectContent>
                      {filtrosDisponiveis.bancas.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={ano} onValueChange={setAno}>
                    <SelectTrigger className="bg-background/50 border-border/50 focus:border-primary/50">
                      <SelectValue placeholder="Selecionar Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {filtrosDisponiveis.anos.map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={cargo} onValueChange={setCargo}>
                    <SelectTrigger className="bg-background/50 border-border/50 focus:border-primary/50">
                      <SelectValue placeholder="Selecionar Cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {filtrosDisponiveis.cargos.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={modalidade} onValueChange={setModalidade}>
                    <SelectTrigger className="bg-background/50 border-border/50 focus:border-primary/50">
                      <SelectValue placeholder="Modalidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {filtrosDisponiveis.modalidades.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={dificuldade} onValueChange={setDificuldade}>
                    <SelectTrigger className="bg-background/50 border-border/50 focus:border-primary/50">
                      <SelectValue placeholder="Dificuldade" />
                    </SelectTrigger>
                    <SelectContent>
                      {filtrosDisponiveis.dificuldades.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button variant="outline" className="gap-2 bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700">
                    <Bookmark className="h-4 w-4" />
                    Meu Caderno
                  </Button>
                </div>
              </div>

              {/* Filtros Ativos */}
              {filtrosAtivos.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Filtros Aplicados</Label>
                  <div className="flex flex-wrap gap-2">
                    {filtrosAtivos.map((filtro) => (
                      <Badge key={filtro} variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors">
                        {filtro}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => removerFiltro(filtro)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Seção das Questões com Layout Moderno */}
        <div className="space-y-6">
          {/* Barra de Resultados */}
          <div className="flex items-center justify-between py-4 px-6 bg-card/40 rounded-lg border border-border/50 backdrop-blur-xs">
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium">
                <span className="text-primary font-semibold">{todasQuestoes.length}</span>
                <span className="text-muted-foreground"> questões encontradas</span>
              </div>
              <div className="h-4 w-px bg-border"></div>
              <div className="text-xs text-muted-foreground">
                Exibindo {questoesPorPagina} por página
              </div>
            </div>
            
            <Select value={questoesPorPagina} onValueChange={setQuestoesPorPagina}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="20">20</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cards de Questões Unificadas */}
          <div className={visualizacao === "grid" ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "space-y-6"}>
            {loading ? (
              <div className="text-center py-8">Carregando questões...</div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">Erro: {error}</div>
            ) : todasQuestoes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhuma questão encontrada. Crie sua primeira questão!</div>
            ) : (
              todasQuestoes.map((questao) => (
              <Card key={questao.id} className="group hover:shadow-xl transition-all duration-300 bg-card/60 backdrop-blur-xs border-border/50 hover:border-primary/30 overflow-hidden">
                <CardHeader className="pb-3 relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-primary via-primary/60 to-primary/30"></div>
                  
                  <div className="flex justify-between items-start pt-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-xs bg-muted/50">
                          {questao.tipo === "usuario" ? questao.id.substring(0, 8).toUpperCase() : questao.id}
                        </Badge>
                        {getStatusIcon(questao.status)}
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-primary">
                          {questao.disciplina}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {questao.assunto}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right space-y-2">
                      <Badge 
                        variant={questao.nivel === "Fácil" ? "secondary" : questao.nivel === "Médio" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {questao.nivel}
                      </Badge>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {(questao.banca || questao.cargo) && (
                            <p className="text-xs text-muted-foreground">
                              {questao.banca}{questao.banca && questao.cargo && " - "}{questao.cargo}
                            </p>
                          )}
                          {questao.ano && (
                            <p className="text-xs text-muted-foreground">{questao.ano}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-5">
                  <div className="prose prose-sm max-w-none">
                    <p className="text-foreground leading-relaxed font-medium">
                      {questao.pergunta}
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {questao.alternativas.map((alternativa) => (
                      <div 
                        key={alternativa.letra} 
                        className={`group/alt p-3 rounded-lg border border-border/50 cursor-pointer transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 ${
                          respostasSelecionadas[questao.id] === alternativa.letra 
                            ? "border-primary bg-primary/10 shadow-xs" 
                            : ""
                        }`}
                        onClick={() => selecionarResposta(questao.id, alternativa.letra)}
                      >
                        <Label 
                          htmlFor={`${questao.id}-${alternativa.letra}`}
                          className="flex items-start gap-3 cursor-pointer w-full"
                        >
                          <div className="flex items-center gap-3 shrink-0">
                            <Checkbox
                              id={`${questao.id}-${alternativa.letra}`}
                              checked={respostasSelecionadas[questao.id] === alternativa.letra}
                              onCheckedChange={() => selecionarResposta(questao.id, alternativa.letra)}
                              className="mt-0.5"
                            />
                            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-semibold transition-colors ${
                              respostasSelecionadas[questao.id] === alternativa.letra
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border group-hover/alt:border-primary/50"
                            }`}>
                              {alternativa.letra}
                            </div>
                          </div>
                          <span className="text-sm leading-relaxed flex-1 pt-1">
                            {alternativa.texto}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-border/50">
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary">
                      <Bookmark className="h-4 w-4" />
                      Adicionar ao Caderno
                    </Button>
                    <div className="flex gap-2">
                      {questao.tipo === "usuario" && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 text-destructive hover:text-destructive"
                          onClick={() => deleteQuestao(questao.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      )}
                      <Button size="sm" className="gap-2 bg-primary hover:bg-primary-hover shadow-md">
                        <CheckCircle className="h-4 w-4" />
                        Responder
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

