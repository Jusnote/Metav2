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

function TableOfContentsList({
  tableOfContents,
}: {
  tableOfContents: Array<TableOfContentsEntry>;
}): JSX.Element {
  const [selectedKey, setSelectedKey] = useState('');
  const selectedIndex = useRef(0);
  const [editor] = useLexicalComposerContext();

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
      const viewportBottom = viewportTop + window.innerHeight;
      
      let selectedHeadingIndex = 0;
      let bestScore = -Infinity;
      
      for (let i = 0; i < tableOfContents.length; i++) {
        const heading = editor.getElementByKey(tableOfContents[i][0]);
        if (heading) {
          const rect = heading.getBoundingClientRect();
          const elementTop = window.scrollY + rect.top;
          const elementBottom = window.scrollY + rect.bottom;
          
          // Verificar se está visível no viewport
          const isVisible = elementBottom > viewportTop && elementTop < viewportBottom;
          
          // Calcular score: mais próximo do topo = score maior
          let score = 0;
          if (isVisible) {
            if (elementTop <= viewportTop) {
              // Header está acima do viewport, mas visível
              score = 1000 - (viewportTop - elementTop);
            } else {
              // Header está abaixo do topo do viewport
              score = 1000 - (elementTop - viewportTop);
            }
          }
          
          console.log(`📍 Header ${i} (${heading.textContent?.substring(0, 20)}): 
            top: ${elementTop.toFixed(1)}px, 
            bottom: ${elementBottom.toFixed(1)}px,
            viewport: ${viewportTop.toFixed(1)}px - ${viewportBottom.toFixed(1)}px,
            visível: ${isVisible}, score: ${score.toFixed(1)}`);
          
          if (score > bestScore) {
            bestScore = score;
            selectedHeadingIndex = i;
          }
        }
      }
      
      // Atualizar seleção apenas se mudou
      if (selectedIndex.current !== selectedHeadingIndex) {
        selectedIndex.current = selectedHeadingIndex;
        const selectedHeadingKey = tableOfContents[selectedHeadingIndex][0];
        console.log('✅ Selecionando header:', selectedHeadingKey, 'índice:', selectedHeadingIndex, 'score:', bestScore.toFixed(1));
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

  return (
    <div className="table-of-contents">
      <ul className="headings">
        {tableOfContents.map(([key, text, tag], index) => {
          const isSelected = selectedKey === key;
          console.log(`🎨 Header ${index} (${text?.substring(0, 20)}): key=${key}, selectedKey=${selectedKey}, isSelected=${isSelected}`);
          
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
}

export default function TableOfContentsPlugin() {
  return (
    <LexicalTableOfContentsPlugin>
      {(tableOfContents) => {
        return <TableOfContentsList tableOfContents={tableOfContents} />;
      }}
    </LexicalTableOfContentsPlugin>
  );
}
