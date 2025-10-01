import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuestaoForm } from '@/hooks/useQuestaoForm';
import { useQuestoes } from '@/hooks/useQuestoes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export const CriarQuestaoForm: React.FC = () => {
  const navigate = useNavigate();
  const { createQuestao } = useQuestoes();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    questao,
    alternativas,
    errors,
    handleQuestaoChange,
    handleAlternativaChange,
    handleAlternativaCorretaChange,
    adicionarAlternativa,
    removerAlternativa,
    validarFormulario,
    prepararDadosParaSalvar,
    resetarFormulario
  } = useQuestaoForm();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validarFormulario()) {
      toast.error('Por favor, corrija os erros no formulário.');
      return;
    }

    try {
      setIsSubmitting(true);
      const { questao: questaoData, alternativas: alternativasData } = prepararDadosParaSalvar();
      
      await createQuestao(questaoData, alternativasData);
      
      toast.success('Questão criada com sucesso!');
      resetarFormulario();
      navigate('/questoes');
    } catch (error) {
      console.error('Erro ao criar questão:', error);
      toast.error('Ocorreu um erro ao criar a questão. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="titulo" className="text-base font-semibold">
            Título da Questão
          </Label>
          <Input
            id="titulo"
            value={questao.titulo}
            onChange={(e) => handleQuestaoChange('titulo', e.target.value)}
            placeholder="Ex: Princípios do Direito Constitucional"
            className={errors.questao?.titulo ? 'border-red-500' : ''}
          />
          {errors.questao?.titulo && (
            <p className="text-sm text-red-500 mt-1">{errors.questao.titulo}</p>
          )}
        </div>

        <div>
          <Label htmlFor="enunciado" className="text-base font-semibold">
            Enunciado
          </Label>
          <Textarea
            id="enunciado"
            value={questao.enunciado}
            onChange={(e) => handleQuestaoChange('enunciado', e.target.value)}
            placeholder="Digite o texto da questão..."
            className={`min-h-[120px] ${errors.questao?.enunciado ? 'border-red-500' : ''}`}
          />
          {errors.questao?.enunciado && (
            <p className="text-sm text-red-500 mt-1">{errors.questao.enunciado}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="disciplina" className="text-base font-semibold">
              Disciplina
            </Label>
            <Input
              id="disciplina"
              value={questao.disciplina}
              onChange={(e) => handleQuestaoChange('disciplina', e.target.value)}
              placeholder="Ex: Direito Constitucional"
              className={errors.questao?.disciplina ? 'border-red-500' : ''}
            />
            {errors.questao?.disciplina && (
              <p className="text-sm text-red-500 mt-1">{errors.questao.disciplina}</p>
            )}
          </div>

          <div>
            <Label htmlFor="assunto" className="text-base font-semibold">
              Assunto
            </Label>
            <Input
              id="assunto"
              value={questao.assunto}
              onChange={(e) => handleQuestaoChange('assunto', e.target.value)}
              placeholder="Ex: Direitos Fundamentais"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="banca" className="text-base font-semibold">
              Banca
            </Label>
            <Input
              id="banca"
              value={questao.banca}
              onChange={(e) => handleQuestaoChange('banca', e.target.value)}
              placeholder="Ex: CESPE, FGV, VUNESP"
            />
          </div>

          <div>
            <Label htmlFor="ano" className="text-base font-semibold">
              Ano
            </Label>
            <Input
              id="ano"
              type="number"
              value={questao.ano || ''}
              onChange={(e) => handleQuestaoChange('ano', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Ex: 2024"
              min="1990"
              max="2030"
            />
          </div>

          <div>
            <Label htmlFor="cargo" className="text-base font-semibold">
              Cargo
            </Label>
            <Input
              id="cargo"
              value={questao.cargo}
              onChange={(e) => handleQuestaoChange('cargo', e.target.value)}
              placeholder="Ex: Procurador, Juiz, Analista"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="modalidade" className="text-base font-semibold">
              Modalidade
            </Label>
            <Select
              value={questao.modalidade}
              onValueChange={(value) => handleQuestaoChange('modalidade', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a modalidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multipla_escolha">Múltipla Escolha</SelectItem>
                <SelectItem value="verdadeiro_falso">Verdadeiro ou Falso</SelectItem>
                <SelectItem value="dissertativa">Dissertativa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="dificuldade" className="text-base font-semibold">
              Dificuldade
            </Label>
            <Select
              value={questao.dificuldade}
              onValueChange={(value) => handleQuestaoChange('dificuldade', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a dificuldade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fácil">Fácil</SelectItem>
                <SelectItem value="Médio">Médio</SelectItem>
                <SelectItem value="Difícil">Difícil</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="nivel" className="text-base font-semibold">
              Nível de Dificuldade
            </Label>
            <Select
              value={questao.nivel}
              onValueChange={(value) => handleQuestaoChange('nivel', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fácil">Fácil</SelectItem>
                <SelectItem value="Médio">Médio</SelectItem>
                <SelectItem value="Difícil">Difícil</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="tipo" className="text-base font-semibold">
            Tipo de Questão
          </Label>
          <Select
            value={questao.tipo}
            onValueChange={(value) => handleQuestaoChange('tipo', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multipla_escolha">Múltipla Escolha</SelectItem>
              <SelectItem value="verdadeiro_falso">Verdadeiro ou Falso</SelectItem>
              <SelectItem value="dissertativa">Dissertativa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {questao.tipo === 'multipla_escolha' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Alternativas</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={adicionarAlternativa}
                disabled={alternativas.length >= 5}
              >
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>

            {errors.alternativas && (
              <p className="text-sm text-red-500">{errors.alternativas}</p>
            )}

            <div className="space-y-3">
              {alternativas.map((alternativa, index) => (
                <Card key={index} className={`border ${alternativa.correta ? 'border-green-500' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 pt-1">
                        <RadioGroup
                          value={alternativa.correta ? index.toString() : undefined}
                          onValueChange={() => handleAlternativaCorretaChange(index)}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value={index.toString()} id={`alternativa-${index}`} />
                            <Label htmlFor={`alternativa-${index}`} className="font-bold">
                              {alternativa.letra}
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <div className="grow">
                        <Textarea
                          value={alternativa.texto}
                          onChange={(e) => handleAlternativaChange(index, e.target.value)}
                          placeholder={`Digite o texto da alternativa ${alternativa.letra}...`}
                          className="min-h-[80px]"
                        />
                      </div>
                      <div className="shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removerAlternativa(index)}
                          disabled={alternativas.length <= 2}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate('/questoes')}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Questão'
          )}
        </Button>
      </div>
    </form>
  );
};

