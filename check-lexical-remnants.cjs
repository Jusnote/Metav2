const fs = require('fs');
const path = require('path');

// Padrões para procurar resquícios do Lexical
const lexicalPatterns = [
  /lexical/gi,
  /@lexical/gi,
  /LexicalComposer/gi,
  /LexicalEditor/gi,
  /LexicalNode/gi,
  /LexicalCommand/gi,
  /PlaygroundApp/gi,
  /LexicalPlayground/gi,
  /StudyModePlugin/gi,
  /useLexical/gi,
  /createEditor/gi,
  /$lexicalEditor/gi,
  /EditorState/gi,
  /RootNode/gi,
  /ParagraphNode/gi,
  /TextNode/gi,
  /HeadingNode/gi,
  /ListNode/gi,
  /ListItemNode/gi,
  /QuoteNode/gi,
  /CodeNode/gi,
  /LinkNode/gi,
  /AutoLinkNode/gi,
  /HashtagNode/gi,
  /KeywordNode/gi,
  /MentionNode/gi,
  /EmojiNode/gi,
  /ExcalidrawNode/gi,
  /ImageNode/gi,
  /InlineImageNode/gi,
  /YouTubeNode/gi,
  /TweetNode/gi,
  /FigmaNode/gi,
  /EquationNode/gi,
  /StickyNode/gi,
  /CollapsibleContainerNode/gi,
  /CollapsibleContentNode/gi,
  /CollapsibleTitleNode/gi,
  /TableNode/gi,
  /TableCellNode/gi,
  /TableRowNode/gi,
  /MarkNode/gi,
  /OverflowNode/gi,
  /HorizontalRuleNode/gi,
  /LayoutContainerNode/gi,
  /LayoutItemNode/gi,
  /PageBreakNode/gi,
  /TabNode/gi,
  /TabsNode/gi
];

// Extensões de arquivo para verificar
const fileExtensions = ['.tsx', '.ts', '.jsx', '.js', '.json', '.css', '.scss'];

// Diretórios para ignorar
const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];

let foundIssues = [];

function shouldIgnoreFile(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  return ignoreDirs.some(dir => relativePath.includes(dir));
}

function checkFile(filePath) {
  if (shouldIgnoreFile(filePath)) return;
  
  const ext = path.extname(filePath);
  if (!fileExtensions.includes(ext)) return;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, lineNumber) => {
      lexicalPatterns.forEach(pattern => {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach(match => {
            foundIssues.push({
              file: path.relative(process.cwd(), filePath),
              line: lineNumber + 1,
              match: match,
              content: line.trim(),
              pattern: pattern.source
            });
          });
        }
      });
    });
  } catch (error) {
    console.error(`Erro ao ler arquivo ${filePath}:`, error.message);
  }
}

function scanDirectory(dirPath) {
  try {
    const items = fs.readdirSync(dirPath);
    
    items.forEach(item => {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!ignoreDirs.includes(item)) {
          scanDirectory(fullPath);
        }
      } else {
        checkFile(fullPath);
      }
    });
  } catch (error) {
    console.error(`Erro ao escanear diretório ${dirPath}:`, error.message);
  }
}

function generateReport() {
  console.log('\n🔍 RELATÓRIO DE RESQUÍCIOS DO LEXICAL PLAYGROUND\n');
  console.log('='.repeat(60));
  
  if (foundIssues.length === 0) {
    console.log('✅ Nenhum resquício do Lexical encontrado!');
    return;
  }
  
  console.log(`❌ Encontrados ${foundIssues.length} resquícios do Lexical:\n`);
  
  // Agrupar por arquivo
  const groupedByFile = foundIssues.reduce((acc, issue) => {
    if (!acc[issue.file]) {
      acc[issue.file] = [];
    }
    acc[issue.file].push(issue);
    return acc;
  }, {});
  
  Object.keys(groupedByFile).forEach(file => {
    console.log(`📄 ${file}`);
    console.log('-'.repeat(40));
    
    groupedByFile[file].forEach(issue => {
      console.log(`   Linha ${issue.line}: "${issue.match}"`);
      console.log(`   Contexto: ${issue.content}`);
      console.log('');
    });
  });
  
  // Resumo por tipo de padrão
  console.log('\n📊 RESUMO POR TIPO:');
  console.log('-'.repeat(30));
  
  const patternCounts = foundIssues.reduce((acc, issue) => {
    const key = issue.match.toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  
  Object.entries(patternCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([pattern, count]) => {
      console.log(`   ${pattern}: ${count} ocorrências`);
    });
  
  // Salvar relatório em arquivo
  const reportContent = JSON.stringify({
    timestamp: new Date().toISOString(),
    totalIssues: foundIssues.length,
    issues: foundIssues,
    summary: patternCounts
  }, null, 2);
  
  fs.writeFileSync('lexical-remnants-report.json', reportContent);
  console.log('\n💾 Relatório salvo em: lexical-remnants-report.json');
  
  // Gerar script de limpeza
  generateCleanupScript();
}

function generateCleanupScript() {
  const filesToCheck = [...new Set(foundIssues.map(issue => issue.file))];
  
  let cleanupScript = `#!/bin/bash
# Script de limpeza automática dos resquícios do Lexical
# Gerado automaticamente em ${new Date().toISOString()}

echo "🧹 Iniciando limpeza dos resquícios do Lexical..."

`;

  filesToCheck.forEach(file => {
    cleanupScript += `echo "Verificando: ${file}"\n`;
  });
  
  cleanupScript += `
echo "✅ Limpeza concluída!"
echo "⚠️  IMPORTANTE: Revise as alterações antes de fazer commit!"
`;

  fs.writeFileSync('cleanup-lexical.sh', cleanupScript);
  console.log('🔧 Script de limpeza gerado: cleanup-lexical.sh');
}

// Executar verificação
console.log('🚀 Iniciando verificação de resquícios do Lexical...');
console.log('📁 Escaneando diretório:', process.cwd());

scanDirectory(process.cwd());
generateReport();

console.log('\n🎯 Verificação concluída!');