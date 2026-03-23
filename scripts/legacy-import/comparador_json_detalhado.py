#!/usr/bin/env python3
"""
Comparador detalhado de JSONs de legislação.
Compara cada linha, cada campo, cada elemento entre dois arquivos JSON.
Estrutura esperada: { lei: {...}, artigos: [...] }
"""

import json
import sys
import re
import html
from pathlib import Path
from typing import Any, Dict, List, Optional
from collections import defaultdict

# Configurar encoding para Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


class ComparadorJSON:
    def __init__(self, arquivo_original: str, arquivo_importado: str):
        self.arquivo_original = arquivo_original
        self.arquivo_importado = arquivo_importado
        self.diferencas = []
        self.estatisticas = defaultdict(int)

    def carregar_json(self, caminho: str) -> Dict:
        """Carrega um arquivo JSON."""
        with open(caminho, 'r', encoding='utf-8') as f:
            return json.load(f)

    def comparar(self) -> Dict:
        """Executa a comparação completa."""
        print("=" * 80)
        print("COMPARADOR DETALHADO DE JSONS - LEGISLACAO")
        print("=" * 80)
        print(f"\nOriginal:  {self.arquivo_original}")
        print(f"Importado: {self.arquivo_importado}")
        print()

        original = self.carregar_json(self.arquivo_original)
        importado = self.carregar_json(self.arquivo_importado)

        # Comparar metadados da lei
        self._comparar_lei(original.get('lei', {}), importado.get('lei', {}))

        # Comparar artigos
        self._comparar_artigos(
            original.get('artigos', []),
            importado.get('artigos', [])
        )

        return self._gerar_relatorio()

    def _comparar_lei(self, original: Dict, importado: Dict):
        """Compara os metadados da lei."""
        campos = ['id', 'nome', 'numero', 'ementa', 'data']

        print("\n" + "=" * 60)
        print("METADADOS DA LEI")
        print("=" * 60)

        for campo in campos:
            val_orig = original.get(campo)
            val_imp = importado.get(campo)

            if val_orig != val_imp:
                self.diferencas.append({
                    'tipo': 'lei_metadado',
                    'campo': campo,
                    'original': val_orig,
                    'importado': val_imp
                })
                self.estatisticas['lei_diferencas'] += 1
                print(f"\n[DIFF] Campo: {campo}")
                print(f"   Original:  {val_orig}")
                print(f"   Importado: {val_imp}")
            else:
                print(f"[OK] {campo}: {str(val_orig)[:60]}{'...' if val_orig and len(str(val_orig)) > 60 else ''}")

        # Comparar estrutura
        self._comparar_estrutura(
            original.get('estrutura', []),
            importado.get('estrutura', [])
        )

    def _comparar_estrutura(self, original: List, importado: List):
        """Compara a estrutura hierárquica (títulos, capítulos, etc)."""
        print("\n" + "-" * 40)
        print("ESTRUTURA HIERARQUICA")
        print("-" * 40)

        # Contar por tipo
        def contar_tipos(estrutura: List) -> Dict[str, int]:
            contagem = defaultdict(int)
            for item in estrutura:
                contagem[item.get('tipo', 'desconhecido')] += 1
            return dict(contagem)

        tipos_orig = contar_tipos(original)
        tipos_imp = contar_tipos(importado)

        print(f"\nOriginal:  {len(original)} itens - {tipos_orig}")
        print(f"Importado: {len(importado)} itens - {tipos_imp}")

        if tipos_orig != tipos_imp:
            self.diferencas.append({
                'tipo': 'estrutura_contagem',
                'original': tipos_orig,
                'importado': tipos_imp
            })
            self.estatisticas['estrutura_diferencas'] += 1

    def _comparar_artigos(self, original: List, importado: List):
        """Compara os artigos."""
        print("\n" + "=" * 60)
        print("ARTIGOS")
        print("=" * 60)
        print(f"\nTotal Original:  {len(original)} artigos")
        print(f"Total Importado: {len(importado)} artigos")

        self.estatisticas['artigos_original'] = len(original)
        self.estatisticas['artigos_importado'] = len(importado)

        # Criar índices por slug
        idx_original = {a.get('slug'): a for a in original}
        idx_importado = {a.get('slug'): a for a in importado}

        slugs_original = set(idx_original.keys())
        slugs_importado = set(idx_importado.keys())

        # Slugs apenas no original
        apenas_original = slugs_original - slugs_importado
        if apenas_original:
            print(f"\n[APENAS ORIGINAL] {len(apenas_original)} artigos:")
            for slug in sorted(apenas_original)[:20]:
                art = idx_original[slug]
                print(f"   - {slug}: {art.get('epigrafe', 'Sem epigrafe')[:50]}")
                self.diferencas.append({
                    'tipo': 'artigo_faltando_importado',
                    'slug': slug,
                    'numero': art.get('numero'),
                    'epigrafe': art.get('epigrafe')
                })
            if len(apenas_original) > 20:
                print(f"   ... e mais {len(apenas_original) - 20}")
            self.estatisticas['artigos_apenas_original'] = len(apenas_original)

        # Slugs apenas no importado
        apenas_importado = slugs_importado - slugs_original
        if apenas_importado:
            print(f"\n[APENAS IMPORTADO] {len(apenas_importado)} artigos:")
            for slug in sorted(apenas_importado)[:20]:
                art = idx_importado[slug]
                print(f"   + {slug}: {art.get('epigrafe', 'Sem epigrafe')[:50]}")
                self.diferencas.append({
                    'tipo': 'artigo_novo_importado',
                    'slug': slug,
                    'numero': art.get('numero'),
                    'epigrafe': art.get('epigrafe')
                })
            if len(apenas_importado) > 20:
                print(f"   ... e mais {len(apenas_importado) - 20}")
            self.estatisticas['artigos_apenas_importado'] = len(apenas_importado)

        # Artigos em comum - comparar conteúdo
        slugs_comuns = slugs_original & slugs_importado
        print(f"\n[EM COMUM] {len(slugs_comuns)} artigos")
        self.estatisticas['artigos_comuns'] = len(slugs_comuns)

        artigos_diferentes = 0
        for slug in sorted(slugs_comuns):
            art_orig = idx_original[slug]
            art_imp = idx_importado[slug]

            diferencas = self._comparar_artigo(slug, art_orig, art_imp)
            if diferencas:
                artigos_diferentes += 1

        self.estatisticas['artigos_diferentes'] = artigos_diferentes
        print(f"\n[DIFERENTES] {artigos_diferentes} artigos com diferencas de conteudo")

    def _comparar_artigo(self, slug: str, original: Dict, importado: Dict) -> List[Dict]:
        """Compara dois artigos em detalhe."""
        diferencas = []

        # Campos a comparar (exceto plate_content que é especial)
        campos = ['numero', 'epigrafe', 'texto_plano', 'search_text', 'vigente', 'contexto', 'path']

        for campo in campos:
            val_orig = original.get(campo)
            val_imp = importado.get(campo)

            # Normalizar para comparação
            if isinstance(val_orig, str) and isinstance(val_imp, str):
                val_orig_norm = self._normalizar_texto(val_orig)
                val_imp_norm = self._normalizar_texto(val_imp)

                if val_orig_norm != val_imp_norm:
                    diff = {
                        'tipo': 'artigo_campo_diferente',
                        'slug': slug,
                        'campo': campo,
                        'original': val_orig[:200] if val_orig else None,
                        'importado': val_imp[:200] if val_imp else None
                    }
                    diferencas.append(diff)
                    self.diferencas.append(diff)
            elif val_orig != val_imp:
                diff = {
                    'tipo': 'artigo_campo_diferente',
                    'slug': slug,
                    'campo': campo,
                    'original': val_orig,
                    'importado': val_imp
                }
                diferencas.append(diff)
                self.diferencas.append(diff)

        # Comparar plate_content em detalhe
        pc_orig = original.get('plate_content', [])
        pc_imp = importado.get('plate_content', [])

        pc_diffs = self._comparar_plate_content(slug, pc_orig, pc_imp)
        diferencas.extend(pc_diffs)

        if diferencas:
            print(f"\n   [DIFF] {slug}:")
            for d in diferencas[:5]:
                if d['tipo'] == 'artigo_campo_diferente':
                    print(f"      - {d['campo']}")
                elif d['tipo'] == 'plate_content_quantidade':
                    print(f"      - plate_content: {d['original']} vs {d['importado']} blocos")
                elif d['tipo'] == 'plate_content_slug_diferente':
                    print(f"      - bloco slug diferente: {d.get('original_slug')} vs {d.get('importado_slug')}")
            if len(diferencas) > 5:
                print(f"      ... e mais {len(diferencas) - 5} diferencas")

        return diferencas

    def _comparar_plate_content(self, artigo_slug: str, original: List, importado: List) -> List[Dict]:
        """Compara o plate_content de um artigo."""
        diferencas = []

        if len(original) != len(importado):
            diff = {
                'tipo': 'plate_content_quantidade',
                'artigo_slug': artigo_slug,
                'original': len(original),
                'importado': len(importado)
            }
            diferencas.append(diff)
            self.diferencas.append(diff)

        # Comparar bloco por bloco
        for i, (bloco_orig, bloco_imp) in enumerate(zip(original, importado)):
            bloco_diffs = self._comparar_bloco(artigo_slug, i, bloco_orig, bloco_imp)
            diferencas.extend(bloco_diffs)

        return diferencas

    def _comparar_bloco(self, artigo_slug: str, idx: int, original: Dict, importado: Dict) -> List[Dict]:
        """Compara dois blocos do plate_content."""
        diferencas = []

        # Comparar slug
        slug_orig = original.get('slug', '')
        slug_imp = importado.get('slug', '')

        if slug_orig != slug_imp:
            diff = {
                'tipo': 'plate_content_slug_diferente',
                'artigo_slug': artigo_slug,
                'indice': idx,
                'original_slug': slug_orig,
                'importado_slug': slug_imp
            }
            diferencas.append(diff)
            self.diferencas.append(diff)

        # Comparar search_text (o texto real)
        texto_orig = original.get('search_text', '')
        texto_imp = importado.get('search_text', '')

        texto_orig_norm = self._normalizar_texto(texto_orig)
        texto_imp_norm = self._normalizar_texto(texto_imp)

        if texto_orig_norm != texto_imp_norm:
            diff = {
                'tipo': 'plate_content_texto_diferente',
                'artigo_slug': artigo_slug,
                'bloco_slug': slug_orig or slug_imp,
                'indice': idx,
                'original': texto_orig[:150] if texto_orig else None,
                'importado': texto_imp[:150] if texto_imp else None
            }
            diferencas.append(diff)
            self.diferencas.append(diff)

        # Comparar children recursivamente
        children_orig = original.get('children', [])
        children_imp = importado.get('children', [])

        if len(children_orig) != len(children_imp):
            diff = {
                'tipo': 'plate_content_children_quantidade',
                'artigo_slug': artigo_slug,
                'bloco_slug': slug_orig or slug_imp,
                'original': len(children_orig),
                'importado': len(children_imp)
            }
            diferencas.append(diff)
            self.diferencas.append(diff)

        for j, (child_orig, child_imp) in enumerate(zip(children_orig, children_imp)):
            diferencas.extend(
                self._comparar_bloco(artigo_slug, j, child_orig, child_imp)
            )

        return diferencas

    def _normalizar_texto(self, texto: str) -> str:
        """Normaliza texto para comparação."""
        if not texto:
            return ""

        # Decodificar HTML entities
        texto = html.unescape(texto)

        # Normalizar espaços (múltiplos espaços -> um)
        texto = ' '.join(texto.split())

        # Remover espaços antes de pontuação
        texto = re.sub(r'\s+([.,;:!?)])', r'\1', texto)
        texto = re.sub(r'([(])\s+', r'\1', texto)

        # Normalizar hífen/travessão
        texto = texto.replace('–', '-').replace('—', '-')

        # Normalizar aspas
        texto = texto.replace('"', '"').replace('"', '"')
        texto = texto.replace(''', "'").replace(''', "'")

        # Remover referências de alteração legislativa
        # Ex: "(Redação dada pela Lei nº 14.344, de 2022)"
        texto = re.sub(r'\s*\([Rr]eda[çc][ãa]o.*?\)', '', texto)
        texto = re.sub(r'\s*\([Ii]nclu[ií]d.*?\)', '', texto)
        texto = re.sub(r'\s*\([Aa]crescid.*?\)', '', texto)

        return texto.strip()

    def _gerar_relatorio(self) -> Dict:
        """Gera o relatório final."""
        print("\n" + "=" * 80)
        print("RESUMO FINAL")
        print("=" * 80)

        total_diferencas = len(self.diferencas)

        print(f"\n{'='*40}")
        print("ESTATISTICAS")
        print(f"{'='*40}")
        print(f"   Artigos original:       {self.estatisticas['artigos_original']}")
        print(f"   Artigos importado:      {self.estatisticas['artigos_importado']}")
        print(f"   Artigos apenas original:{self.estatisticas.get('artigos_apenas_original', 0)}")
        print(f"   Artigos apenas importado:{self.estatisticas.get('artigos_apenas_importado', 0)}")
        print(f"   Artigos em comum:       {self.estatisticas.get('artigos_comuns', 0)}")
        print(f"   Artigos com diferencas: {self.estatisticas.get('artigos_diferentes', 0)}")
        print(f"   Total de diferencas:    {total_diferencas}")

        if total_diferencas == 0:
            print("\n" + "=" * 40)
            print("OS ARQUIVOS SAO IDENTICOS!")
            print("=" * 40)
        else:
            print("\n" + "=" * 40)
            print(f"OS ARQUIVOS TEM {total_diferencas} DIFERENCAS")
            print("=" * 40)

            # Agrupar diferenças por tipo
            por_tipo = defaultdict(list)
            for d in self.diferencas:
                por_tipo[d['tipo']].append(d)

            print("\nPor tipo de diferenca:")
            for tipo, lista in sorted(por_tipo.items()):
                print(f"   {tipo}: {len(lista)}")

        return {
            'estatisticas': dict(self.estatisticas),
            'diferencas': self.diferencas,
            'identicos': total_diferencas == 0
        }

    def salvar_relatorio(self, caminho: str):
        """Salva o relatório em arquivo JSON."""
        resultado = self.comparar()

        # Limitar tamanho para não criar arquivo gigante
        resultado_salvar = {
            'estatisticas': resultado['estatisticas'],
            'identicos': resultado['identicos'],
            'total_diferencas': len(resultado['diferencas']),
            'diferencas': resultado['diferencas'][:1000]  # Limitar a 1000
        }

        with open(caminho, 'w', encoding='utf-8') as f:
            json.dump(resultado_salvar, f, ensure_ascii=False, indent=2)

        print(f"\nRelatorio JSON salvo em: {caminho}")

        # Salvar HTML
        self._salvar_html(caminho.replace('.json', '.html'), resultado)

        return resultado

    def _salvar_html(self, caminho: str, resultado: Dict):
        """Salva relatório em formato HTML."""
        stats = resultado['estatisticas']

        html_content = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Comparacao de JSONs - Legislacao</title>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; background: #1a1a2e; color: #eee; }}
        h1, h2, h3 {{ color: #00d9ff; }}
        .stats {{ background: #16213e; padding: 20px; border-radius: 8px; margin: 20px 0; display: flex; flex-wrap: wrap; gap: 20px; }}
        .stat {{ text-align: center; min-width: 120px; }}
        .stat-value {{ font-size: 2em; font-weight: bold; color: #00d9ff; }}
        .stat-label {{ color: #888; font-size: 0.9em; }}
        .stat-value.error {{ color: #ff6b6b; }}
        .stat-value.success {{ color: #4ecdc4; }}
        .diff {{ background: #1f1f3a; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #ff6b6b; }}
        .diff-type {{ color: #ff6b6b; font-weight: bold; font-size: 0.9em; }}
        .diff-slug {{ color: #4ecdc4; font-size: 1.1em; margin: 5px 0; }}
        .diff-content {{ background: #2d2d44; padding: 10px; margin: 5px 0; border-radius: 4px; font-family: monospace; white-space: pre-wrap; word-break: break-all; }}
        .original {{ border-left: 3px solid #ff6b6b; }}
        .importado {{ border-left: 3px solid #4ecdc4; }}
        .filter-bar {{ background: #16213e; padding: 15px; border-radius: 8px; margin: 20px 0; }}
        input, select {{ padding: 8px 12px; border-radius: 4px; border: 1px solid #333; background: #1a1a2e; color: #eee; margin: 5px; }}
        input:focus, select:focus {{ outline: none; border-color: #00d9ff; }}
        .hidden {{ display: none; }}
    </style>
</head>
<body>
    <h1>Comparacao de JSONs - Legislacao</h1>

    <div class="stats">
        <div class="stat">
            <div class="stat-value">{stats.get('artigos_original', 0)}</div>
            <div class="stat-label">Artigos Original</div>
        </div>
        <div class="stat">
            <div class="stat-value">{stats.get('artigos_importado', 0)}</div>
            <div class="stat-label">Artigos Importado</div>
        </div>
        <div class="stat">
            <div class="stat-value error">{stats.get('artigos_apenas_original', 0)}</div>
            <div class="stat-label">Apenas Original</div>
        </div>
        <div class="stat">
            <div class="stat-value error">{stats.get('artigos_apenas_importado', 0)}</div>
            <div class="stat-label">Apenas Importado</div>
        </div>
        <div class="stat">
            <div class="stat-value">{stats.get('artigos_comuns', 0)}</div>
            <div class="stat-label">Em Comum</div>
        </div>
        <div class="stat">
            <div class="stat-value error">{stats.get('artigos_diferentes', 0)}</div>
            <div class="stat-label">Com Diferencas</div>
        </div>
        <div class="stat">
            <div class="stat-value {'success' if resultado['identicos'] else 'error'}">{len(resultado['diferencas'])}</div>
            <div class="stat-label">Total Diferencas</div>
        </div>
    </div>

    <h2>{'ARQUIVOS IDENTICOS!' if resultado['identicos'] else 'Diferencas Encontradas'}</h2>

    <div class="filter-bar">
        <input type="text" id="filter" placeholder="Filtrar por slug ou artigo..." onkeyup="filterDiffs()">
        <select id="typeFilter" onchange="filterDiffs()">
            <option value="">Todos os tipos</option>
            <option value="artigo_faltando_importado">Artigo faltando no importado</option>
            <option value="artigo_novo_importado">Artigo novo no importado</option>
            <option value="artigo_campo_diferente">Campo diferente</option>
            <option value="plate_content_quantidade">Qtd blocos diferente</option>
            <option value="plate_content_texto_diferente">Texto diferente</option>
        </select>
    </div>

    <div id="diffs">
"""

        # Limitar a 500 diferenças no HTML
        for diff in resultado['diferencas'][:500]:
            tipo = diff.get('tipo', '')
            slug = diff.get('slug', diff.get('artigo_slug', diff.get('bloco_slug', '')))

            html_content += f"""
        <div class="diff" data-type="{tipo}" data-slug="{slug}">
            <div class="diff-type">{tipo}</div>
            <div class="diff-slug">{slug}</div>
"""
            if 'campo' in diff:
                html_content += f'            <div><strong>Campo:</strong> {diff["campo"]}</div>\n'

            if 'original' in diff and diff['original'] is not None:
                orig = html.escape(str(diff['original']))
                html_content += f'            <div class="diff-content original"><strong>Original:</strong> {orig}</div>\n'

            if 'importado' in diff and diff['importado'] is not None:
                imp = html.escape(str(diff['importado']))
                html_content += f'            <div class="diff-content importado"><strong>Importado:</strong> {imp}</div>\n'

            html_content += "        </div>\n"

        if len(resultado['diferencas']) > 500:
            html_content += f"<p>... e mais {len(resultado['diferencas']) - 500} diferencas (ver JSON)</p>"

        html_content += """
    </div>

    <script>
        function filterDiffs() {
            const text = document.getElementById('filter').value.toLowerCase();
            const type = document.getElementById('typeFilter').value;
            const diffs = document.querySelectorAll('.diff');

            diffs.forEach(diff => {
                const slug = (diff.dataset.slug || '').toLowerCase();
                const diffType = diff.dataset.type;

                const matchText = !text || slug.includes(text);
                const matchType = !type || diffType === type;

                diff.classList.toggle('hidden', !(matchText && matchType));
            });
        }
    </script>
</body>
</html>
"""

        with open(caminho, 'w', encoding='utf-8') as f:
            f.write(html_content)

        print(f"Relatorio HTML salvo em: {caminho}")


def main():
    base_dir = Path(__file__).parent.parent
    arquivo_original = base_dir / "public" / "codigp_v2.json"
    arquivo_importado = base_dir / "public" / "data" / "codigo_penal_v2.json"

    if not arquivo_original.exists():
        print(f"Arquivo original nao encontrado: {arquivo_original}")
        return

    if not arquivo_importado.exists():
        print(f"Arquivo importado nao encontrado: {arquivo_importado}")
        return

    comparador = ComparadorJSON(str(arquivo_original), str(arquivo_importado))
    relatorio_path = base_dir / "scripts" / "relatorio_comparacao.json"
    comparador.salvar_relatorio(str(relatorio_path))


if __name__ == "__main__":
    main()
