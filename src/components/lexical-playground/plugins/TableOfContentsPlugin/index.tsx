/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type {TableOfContentsEntry} from '@lexical/react/LexicalTableOfContentsPlugin';
import type {HeadingTagType} from '@lexical/rich-text';
import type {NodeKey} from 'lexical';
import type {JSX} from 'react';

import './index.css';

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {TableOfContentsPlugin as LexicalTableOfContentsPlugin} from '@lexical/react/LexicalTableOfContentsPlugin';
import {useEffect, useRef, useState} from 'react';
import * as React from 'react';
import { StudyProgressIndicator } from '../../../StudyProgressIndicator';
import { useStudyMode } from '../../../../hooks/useStudyMode';

function indent(tagName: HeadingTagType) {
  if (tagName === 'h2') {
    return 'heading2';
  } else if (tagName === 'h3') {
    return 'heading3';
  }
}

// Função para encontrar o container com scroll real
function findScrollableContainer(editorElement: HTMLElement | null): HTMLElement | null {
  if (!editorElement) return null;
  
  let current = editorElement;
  while (current && current !== document.body) {
    const computedStyle = window.getComputedStyle(current);
    const overflow = computedStyle.overflow + computedStyle.overflowY;
    
    if (overflow.includes('scroll') || overflow.includes('auto')) {
      // Verificar se realmente tem scroll
      if (current.scrollHeight > current.clientHeight) {
        console.log('📍 Container com scroll encontrado:', current.className, 'scrollHeight:', current.scrollHeight, 'clientHeight:', current.clientHeight);
        return current;
      }
    }
    current = current.parentElement;
  }
  
  return document.documentElement; // Fallback para document
}

function isHeadingAtTheTopOfThePage(element: HTMLElement, scrollContainer: HTMLElement): boolean {
  const elementRect = element.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  
  const elementRelativeY = elementRect.top - containerRect.top;
  const threshold = 50; // Margem de tolerância
  
  return elementRelativeY >= -threshold && elementRelativeY <= threshold;
}

function isHeadingAboveViewport(element: HTMLElement, scrollContainer: HTMLElement): boolean {
  const elementRect = element.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  
  const elementRelativeY = elementRect.top - containerRect.top;
  return elementRelativeY < -50;
}

function isHeadingBelowTheTopOfThePage(element: HTMLElement, scrollContainer: HTMLElement): boolean {
  const elementRect = element.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  
  const elementRelativeY = elementRect.top - containerRect.top;
  return elementRelativeY > 50;
}

// Componente horizontal para o header
function HorizontalTableOfContents({
  tableOfContents,
  studyModeData,
  selectedKey,
  onScrollToNode
}: {
  tableOfContents: Array<TableOfContentsEntry>;
  studyModeData: any;
  selectedKey: string;
  onScrollToNode: (key: NodeKey, index: number) => void;
}): JSX.Element {
  const isStudyModeEnabled = studyModeData?.isStudyModeEnabled || false;
  const currentSectionIndex = studyModeData?.currentSectionIndex || 0;
  const completedSections = studyModeData?.completedSections || [];

  return (
    <div className="flex items-center gap-3">
      {/* Indicador de progresso ultra-compacto */}
      {isStudyModeEnabled && (
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 rounded border border-blue-200">
          <span className="text-xs font-medium text-blue-800">{completedSections.length}/{tableOfContents.length}</span>
          <div className="flex gap-0.5">
            {Array.from({ length: Math.min(tableOfContents.length, 4) }).map((_, index) => {
              const isCompleted = completedSections.length > index;
              const isCurrent = index === currentSectionIndex;
              return (
                <div
                  key={index}
                  className={`w-1.5 h-1.5 rounded-full ${
                    isCompleted ? 'bg-green-500' : isCurrent ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Navegação horizontal compacta */}
      <div className="flex items-center gap-1 overflow-x-auto flex-1">
        {tableOfContents.slice(0, 6).map(([key, text, tag], index) => {
          const isSelected = selectedKey === key;
  return (
            <button
              key={key}
              onClick={() => onScrollToNode(key, index)}
              className={`px-2 py-0.5 text-xs rounded whitespace-nowrap transition-colors ${
                isSelected 
                  ? 'bg-blue-100 text-blue-700 font-medium' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tag.toUpperCase()} {('' + text).length > 12 ? text.substring(0, 12) + '...' : text}
            </button>
          );
        })}
        {tableOfContents.length > 6 && (
          <span className="text-xs text-gray-400 px-1">+{tableOfContents.length - 6}</span>
        )}
      </div>
    </div>
  );
}

function TableOfContentsList({
  tableOfContents,
  studyModeData
}: {
  tableOfContents: Array<TableOfContentsEntry>;
  studyModeData: {
    isStudyModeEnabled: boolean;
    currentSectionIndex: number;
    completedSections: string[];
  } | null;
}): JSX.Element {
  const [selectedKey, setSelectedKey] = useState('');
  const selectedIndex = useRef(0);
  const [editor] = useLexicalComposerContext();
  
  // Dados do modo estudo vindos como props
  const isStudyModeEnabled = studyModeData?.isStudyModeEnabled || false;
  const currentSectionIndex = studyModeData?.currentSectionIndex || 0;
  const completedSections = studyModeData?.completedSections || [];
  
  
  

  function scrollToNode(key: NodeKey, currIndex: number) {
    editor.getEditorState().read(() => {
      const domElement = editor.getElementByKey(key);
      if (domElement !== null) {
        domElement.scrollIntoView({behavior: 'smooth', block: 'center'});
        setSelectedKey(key);
        selectedIndex.current = currIndex;
      }
    });
  }

  useEffect(() => {
    const editorRootElement = editor.getRootElement();
    const scrollContainer = findScrollableContainer(editorRootElement);
    
    console.log('🎯 Container de scroll detectado:', scrollContainer?.className || 'document');
    
    function scrollCallback() {
      console.log('🔍 TableOfContents scroll callback triggered');
      
      if (tableOfContents.length === 0) {
        return;
      }
      
        // Usar viewport da janela como referência
        const viewportTop = window.scrollY;
        const viewportHeight = window.innerHeight;
        const viewportBottom = viewportTop + viewportHeight;
        const viewportCenter = viewportTop + viewportHeight / 2;
        
        let selectedHeadingIndex = 0;
        let bestDistance = Infinity;
        let hasVisibleHeader = false;
        
        // Primeiro: verificar se há algum header visível
        for (let i = 0; i < tableOfContents.length; i++) {
          const heading = editor.getElementByKey(tableOfContents[i][0]);
          if (heading) {
            const rect = heading.getBoundingClientRect();
            const elementTop = window.scrollY + rect.top;
            const elementBottom = window.scrollY + rect.bottom;
            
            // Se o header está visível na tela
            if (elementTop < viewportBottom && elementBottom > viewportTop) {
              hasVisibleHeader = true;
              const elementCenter = elementTop + rect.height / 2;
              const distanceFromCenter = Math.abs(elementCenter - viewportCenter);
              
              if (distanceFromCenter < bestDistance) {
                bestDistance = distanceFromCenter;
                selectedHeadingIndex = i;
              }
              console.log(`👀 Header ${i} VISÍVEL (${heading.textContent?.substring(0, 20)}), distância do centro: ${distanceFromCenter.toFixed(1)}`);
            }
          }
        }
        
        // Se não há header visível, encontrar o mais próximo
        if (!hasVisibleHeader) {
          bestDistance = Infinity;
          
          for (let i = 0; i < tableOfContents.length; i++) {
            const heading = editor.getElementByKey(tableOfContents[i][0]);
            if (heading) {
              const rect = heading.getBoundingClientRect();
              const elementTop = window.scrollY + rect.top;
              const elementCenter = elementTop + rect.height / 2;
              
              // Calcular distância absoluta do centro do viewport
              const distanceFromViewport = Math.abs(elementCenter - viewportCenter);
              
              if (distanceFromViewport < bestDistance) {
                bestDistance = distanceFromViewport;
                selectedHeadingIndex = i;
              }
              
              const status = elementTop < viewportTop ? 'ACIMA' : 'ABAIXO';
              console.log(`${status === 'ACIMA' ? '⬆️' : '⬇️'} Header ${i} ${status} (${heading.textContent?.substring(0, 20)}), distância: ${distanceFromViewport.toFixed(1)}`);
            }
          }
        }
        
        console.log(`🎯 ${hasVisibleHeader ? 'Header visível' : 'Header mais próximo'}: ${selectedHeadingIndex} (distância: ${bestDistance.toFixed(1)})`);
      
      // Atualizar seleção apenas se mudou
      if (selectedIndex.current !== selectedHeadingIndex) {
        selectedIndex.current = selectedHeadingIndex;
        const selectedHeadingKey = tableOfContents[selectedHeadingIndex][0];
        console.log('✅ Selecionando header:', selectedHeadingKey, 'índice:', selectedHeadingIndex);
        console.log('🔑 selectedKey atual:', selectedKey, 'novo:', selectedHeadingKey, 'são iguais?', selectedKey === selectedHeadingKey);
        setSelectedKey(selectedHeadingKey);
      } else {
        console.log('🔄 Mesmo header já selecionado, não atualizando');
      }
    }
    
    let timerId: ReturnType<typeof setTimeout>;

    function debounceFunction(func: () => void, delay: number) {
      clearTimeout(timerId);
      timerId = setTimeout(func, delay);
    }

    function onScroll(): void {
      debounceFunction(scrollCallback, 10);
    }

    // Escutar scroll em todos os elementos possíveis
    document.addEventListener('scroll', onScroll, { passive: true });
    
    if (scrollContainer && scrollContainer !== document.documentElement) {
      scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    }
    
    // Escutar scroll em todos os elementos pais com scroll
    const allScrollableElements = document.querySelectorAll('*');
    allScrollableElements.forEach(element => {
      const computedStyle = window.getComputedStyle(element);
      const overflow = computedStyle.overflow + computedStyle.overflowY + computedStyle.overflowX;
      if (overflow.includes('scroll') || overflow.includes('auto')) {
        if (element.scrollHeight > element.clientHeight) {
          element.addEventListener('scroll', onScroll, { passive: true });
        }
      }
    });
    
    // Executar callback inicial para detectar header atual
    scrollCallback();
    
    // Adicionar um listener para detectar mudanças no DOM
    const observer = new MutationObserver(() => {
      debounceFunction(scrollCallback, 50);
    });
    
    if (editorRootElement) {
      observer.observe(editorRootElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }
    
    return () => {
      document.removeEventListener('scroll', onScroll);
      
      if (scrollContainer && scrollContainer !== document.documentElement) {
        scrollContainer.removeEventListener('scroll', onScroll);
      }
      
      // Remover listeners de todos os elementos scrolláveis
      allScrollableElements.forEach(element => {
        element.removeEventListener('scroll', onScroll);
      });
      
      observer.disconnect();
    };
  }, [tableOfContents, editor]);

  // NOVA LÓGICA: Sempre renderizar na posição atual (entre toolbar e editor)
  // O portal para o header foi desabilitado para usar a nova posição
  
  return (
    <HorizontalTableOfContents
      tableOfContents={tableOfContents}
      studyModeData={studyModeData}
      selectedKey={selectedKey}
      onScrollToNode={scrollToNode}
    />
  );

  // Código antigo para renderização vertical (não usado mais)
  /*
  return (
    <div className="table-of-contents" style={{flexDirection: 'column', height: 'auto', minHeight: '300px'}}>
      <StudyProgressIndicator
        totalSections={tableOfContents.length}
        currentSectionIndex={currentSectionIndex}
        completedSections={completedSections}
        isStudyModeEnabled={isStudyModeEnabled}
      />
      
      <ul className="headings">
        {tableOfContents.map(([key, text, tag], index) => {
          const isSelected = selectedKey === key;
          
          if (index === 0) {
            return (
              <div 
                className={`normal-heading-wrapper ${
                  isSelected ? 'selected-heading-wrapper' : ''
                }`} 
                key={key}>
                <div
                  className={`first-heading ${isSelected ? 'selected-heading' : ''}`}
                  onClick={() => scrollToNode(key, index)}
                  role="button"
                  tabIndex={0}>
                  {('' + text).length > 20
                    ? text.substring(0, 20) + '...'
                    : text}
                </div>
                <br />
              </div>
            );
          } else {
            return (
              <div
                className={`normal-heading-wrapper ${
                  isSelected ? 'selected-heading-wrapper' : ''
                }`}
                key={key}>
                <div
                  onClick={() => scrollToNode(key, index)}
                  role="button"
                  className={indent(tag)}
                  tabIndex={0}>
                  <li
                    className={`normal-heading ${
                      isSelected ? 'selected-heading' : ''
                    }
                    `}>
                    {('' + text).length > 27
                      ? text.substring(0, 27) + '...'
                      : text}
                  </li>
                </div>
              </div>
            );
          }
        })}
      </ul>
    </div>
  );
  */
}

export default function TableOfContentsPlugin({ studyModeData }: { studyModeData?: any }) {
  
  return (
    <LexicalTableOfContentsPlugin>
      {(tableOfContents) => {
        return <TableOfContentsWrapper tableOfContents={tableOfContents} studyModeData={studyModeData} />;
      }}
    </LexicalTableOfContentsPlugin>
  );
}

// Wrapper para usar o hook useStudyMode fora do contexto do TableOfContents
function TableOfContentsWrapper({
  tableOfContents,
  studyModeData
}: {
  tableOfContents: Array<TableOfContentsEntry>;
  studyModeData?: any;
}) {
  
  return (
    <TableOfContentsList 
      tableOfContents={tableOfContents} 
      studyModeData={studyModeData}
    />
  );
}
