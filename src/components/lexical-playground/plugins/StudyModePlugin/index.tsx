/**
 * Plugin para controlar visibilidade progressiva do conteúdo no modo estudo dirigido
 * Usa uma abordagem híbrida: Lexical nodes + DOM direto para elementos decoradores
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $isElementNode } from 'lexical';
import { $isHeadingNode } from '@lexical/rich-text';
import { useEffect, useRef } from 'react';
import { useStudyMode } from '@/hooks/useStudyMode';

export default function StudyModePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const { isStudyModeEnabled, currentSectionIndex } = useStudyMode();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Limpar timeout anterior se existir
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Função para processar visibilidade (híbrida: Lexical + DOM)
    const processVisibility = () => {
      // Parte 1: Processar nós do Lexical
      editor.update(() => {
        const root = $getRoot();
        
        console.log('🎯 StudyModePlugin: processando visibilidade, modo ativo:', isStudyModeEnabled, 'seção atual:', currentSectionIndex);
        
        // Função para limpar todas as classes primeiro
        function cleanAllNodes(node: any) {
          if ($isElementNode(node)) {
            const element = editor.getElementByKey(node.getKey());
            if (element) {
              element.classList.remove('study-mode-hidden');
              element.removeAttribute('data-study-section');
            }
            
            // Processar filhos recursivamente
            const children = node.getChildren();
            children.forEach(cleanAllNodes);
          }
        }
        
        // Se modo estudo não está ativo, mostrar todo conteúdo
        if (!isStudyModeEnabled) {
          console.log('📖 Modo estudo desativado, mostrando todo conteúdo');
          const children = root.getChildren();
          children.forEach(cleanAllNodes);
          
          // Também limpar estilos CSS globais
          setTimeout(() => {
            const style = document.getElementById('study-mode-styles');
            if (style) {
              style.remove();
            }
          }, 0);
          return;
        }

        // Se modo estudo está ativo, aplicar visibilidade progressiva
        console.log('📚 Modo estudo ativo, aplicando visibilidade progressiva');
        
        // Primeiro, limpar todas as classes
        const children = root.getChildren();
        children.forEach(cleanAllNodes);
        
        // Encontrar todos os H1s e suas posições
        const h1Positions: { index: number; nodeIndex: number; node: any }[] = [];
        
        children.forEach((node, nodeIndex) => {
          if ($isHeadingNode(node) && node.getTag() === 'h1') {
            h1Positions.push({
              index: h1Positions.length, // Índice da seção H1 (0, 1, 2...)
              nodeIndex: nodeIndex, // Posição no array de children
              node: node
            });
            console.log(`📍 H1 encontrado na posição ${nodeIndex}, seção ${h1Positions.length - 1}:`, node.getTextContent());
          }
        });

        console.log(`📊 Total de seções H1: ${h1Positions.length}, mostrando seção: ${currentSectionIndex}`);

        if (h1Positions.length === 0) {
          console.log('⚠️ Nenhum H1 encontrado, mostrando todo conteúdo');
          return;
        }

        // Determinar quais nós pertencem à seção atual
        const currentH1 = h1Positions.find(h1 => h1.index === currentSectionIndex);
        
        if (!currentH1) {
          console.log(`⚠️ Seção ${currentSectionIndex} não encontrada`);
          return;
        }

        const nextH1 = h1Positions.find(h1 => h1.index === currentSectionIndex + 1);
        
        const startIndex = currentH1.nodeIndex;
        const endIndex = nextH1 ? nextH1.nodeIndex : children.length;
        
        console.log(`📑 Seção ${currentSectionIndex}: nós ${startIndex} até ${endIndex - 1}`);

        // Marcar nós com data-attributes e aplicar visibilidade
        children.forEach((node, nodeIndex) => {
          function processNodeAndChildren(n: any, sectionIndex: number) {
            if ($isElementNode(n)) {
              const element = editor.getElementByKey(n.getKey());
              if (element) {
                // Marcar com data-attribute para identificar seção
                element.setAttribute('data-study-section', sectionIndex.toString());
                
                // Se o nó não está na seção atual, ocultar
                if (nodeIndex < startIndex || nodeIndex >= endIndex) {
                  element.classList.add('study-mode-hidden');
                  console.log(`🚫 Ocultando nó ${nodeIndex} (seção ${sectionIndex}, atual: ${currentSectionIndex})`);
                } else {
                  console.log(`👁️ Mostrando nó ${nodeIndex} (seção ${sectionIndex}, atual: ${currentSectionIndex})`);
                }
              }
              
              // Processar filhos
              const children = n.getChildren();
              children.forEach(child => processNodeAndChildren(child, sectionIndex));
            }
          }
          
          // Determinar a qual seção este nó pertence
          let belongsToSection = -1;
          for (let i = h1Positions.length - 1; i >= 0; i--) {
            if (nodeIndex >= h1Positions[i].nodeIndex) {
              belongsToSection = h1Positions[i].index;
              break;
            }
          }
          
          processNodeAndChildren(node, belongsToSection);
        });

        console.log(`✅ Visibilidade Lexical aplicada para seção ${currentSectionIndex}`);
      });
      
      // Parte 2: Aplicar CSS global e debug DOM
      setTimeout(() => {
        const editorElement = editor.getRootElement();
        if (!editorElement) {
          console.log('❌ Editor root element não encontrado');
          return;
        }

        console.log('🔍 DEBUG: Editor element:', editorElement);

        // Remover estilos anteriores
        const existingStyle = document.getElementById('study-mode-styles');
        if (existingStyle) {
          existingStyle.remove();
        }

        if (isStudyModeEnabled) {
          // DEBUG: Listar todos os elementos no editor
          console.log('🔍 DEBUG: Todos os elementos no editor:');
          const allElements = editorElement.querySelectorAll('*');
          allElements.forEach((el, idx) => {
            const tagName = el.tagName.toLowerCase();
            const classes = el.className;
            const dataSection = el.getAttribute('data-study-section');
            const isYoutube = tagName === 'iframe' && (el as HTMLIFrameElement).src?.includes('youtube');
            
            if (isYoutube || tagName === 'h1' || dataSection) {
              console.log(`  ${idx}: <${tagName}> classes:"${classes}" data-section:"${dataSection}" ${isYoutube ? '🎥 YOUTUBE' : ''}`);
            }
          });

          // Buscar todos os elementos com data-study-section
          const elementsWithSection = editorElement.querySelectorAll('[data-study-section]');
          const sectionsFound = new Set<string>();
          
          console.log(`🔍 DEBUG: Encontrados ${elementsWithSection.length} elementos com data-study-section`);
          
          elementsWithSection.forEach((element, idx) => {
            const section = element.getAttribute('data-study-section');
            const tagName = element.tagName.toLowerCase();
            console.log(`  ${idx}: <${tagName}> seção: ${section}`);
            if (section) sectionsFound.add(section);
          });
          
          console.log('🎨 Aplicando CSS para seções encontradas:', Array.from(sectionsFound));

          // Função helper para associar elementos decoradores às seções
          function associateElementToSection(element: Element, elementType: string, idx: number) {
            // Estratégia 1: Buscar parent com data-study-section
            let parent = element.closest('[data-study-section]');
            let parentSection = parent?.getAttribute('data-study-section');
            
            // Estratégia 2: Se não encontrou, buscar por posição no DOM
            if (!parentSection) {
              console.log(`🔍 ${elementType} ${idx}: parent não encontrado, buscando por posição...`);
              
              // Encontrar todos os H1s no DOM
              const h1Elements = Array.from(editorElement.querySelectorAll('h1'));
              
              // Verificar a posição do elemento em relação aos H1s
              const allElements = Array.from(editorElement.querySelectorAll('*'));
              const elementIndex = allElements.indexOf(element);
              
              console.log(`🔍 ${elementType} está na posição DOM: ${elementIndex}`);
              
              for (let i = h1Elements.length - 1; i >= 0; i--) {
                const h1Index = allElements.indexOf(h1Elements[i]);
                const h1Section = h1Elements[i].getAttribute('data-study-section');
                
                if (elementIndex > h1Index && h1Section) {
                  parentSection = h1Section;
                  console.log(`✅ ${elementType} pertence à seção ${h1Section} (após H1 na posição ${h1Index})`);
                  break;
                }
              }
            }
            
            console.log(`  ${idx}: ${elementType}, parent section: ${parentSection}`);
            
            // Forçar data-attribute no elemento
            if (parentSection) {
              element.setAttribute('data-study-section', parentSection);
              console.log(`🏷️ Marcado ${elementType} com data-study-section="${parentSection}"`);
            } else {
              console.log(`⚠️ Não foi possível determinar a seção do ${elementType} ${idx}`);
            }
          }

          // Buscar especificamente por iframes do YouTube
          const youtubeIframes = editorElement.querySelectorAll('iframe[src*="youtube"]');
          console.log(`🎥 DEBUG: Encontrados ${youtubeIframes.length} iframes do YouTube:`);
          youtubeIframes.forEach((iframe, idx) => {
            associateElementToSection(iframe, 'YouTube iframe', idx);
          });

          // Buscar por Horizontal Rules (HR)
          const horizontalRules = editorElement.querySelectorAll('hr');
          console.log(`📏 DEBUG: Encontrados ${horizontalRules.length} horizontal rules:`);
          horizontalRules.forEach((hr, idx) => {
            associateElementToSection(hr, 'Horizontal Rule', idx);
          });

          // Buscar por Page Breaks (podem ter classes específicas)
          const pageBreaks = editorElement.querySelectorAll('.page-break, [data-lexical-page-break], .PageBreak__hr');
          console.log(`📄 DEBUG: Encontrados ${pageBreaks.length} page breaks:`);
          pageBreaks.forEach((pageBreak, idx) => {
            associateElementToSection(pageBreak, 'Page Break', idx);
          });

          // Buscar por outros elementos decoradores comuns
          const decoratorElements = editorElement.querySelectorAll('figure, .embed-block, [data-lexical-decorator]');
          console.log(`🎨 DEBUG: Encontrados ${decoratorElements.length} elementos decoradores:`);
          decoratorElements.forEach((decorator, idx) => {
            if (!decorator.getAttribute('data-study-section')) {
              associateElementToSection(decorator, 'Decorator Element', idx);
            }
          });
          
          // Criar estilos CSS mais específicos
          const style = document.createElement('style');
          style.id = 'study-mode-styles';
          
          let cssRules = '';
          
          // Ocultar todas as seções exceto a atual
          sectionsFound.forEach(section => {
            if (parseInt(section) !== currentSectionIndex) {
              cssRules += `[data-study-section="${section}"] { display: none !important; }\n`;
              cssRules += `[data-study-section="${section}"] * { display: none !important; }\n`;
            }
          });
          
          // Regras específicas para elementos decoradores
          sectionsFound.forEach(section => {
            if (parseInt(section) !== currentSectionIndex) {
              cssRules += `iframe[data-study-section="${section}"] { display: none !important; }\n`;
              cssRules += `hr[data-study-section="${section}"] { display: none !important; }\n`;
              cssRules += `.page-break[data-study-section="${section}"] { display: none !important; }\n`;
              cssRules += `[data-lexical-page-break][data-study-section="${section}"] { display: none !important; }\n`;
              cssRules += `.PageBreak__hr[data-study-section="${section}"] { display: none !important; }\n`;
              cssRules += `figure[data-study-section="${section}"] { display: none !important; }\n`;
              cssRules += `.embed-block[data-study-section="${section}"] { display: none !important; }\n`;
              cssRules += `[data-lexical-decorator][data-study-section="${section}"] { display: none !important; }\n`;
            }
          });
          
          style.textContent = cssRules;
          document.head.appendChild(style);
          
          console.log(`🎨 CSS aplicado:`, cssRules);
          console.log(`🎯 Mostrando apenas seção ${currentSectionIndex}`);
        } else {
          console.log('📖 Modo estudo desativado, removendo estilos CSS');
        }
      }, 200); // Delay maior para garantir que elementos decoradores foram renderizados
    };

    // Executar imediatamente
    processVisibility();

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [editor, isStudyModeEnabled, currentSectionIndex]);

  return null;
}
