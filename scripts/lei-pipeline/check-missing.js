import { readFileSync } from 'fs';

const index = JSON.parse(readFileSync('D:/leis/_index.json', 'utf-8'));
const extracted = JSON.parse(readFileSync('D:/leis/_extracted.json', 'utf-8'));
const extractedSet = new Set(extracted.map(String));

const missing = index.filter(e => !extractedSet.has(String(e.docId)));
console.log('Leis não extraídas:', missing.length);
missing.forEach(m => {
  console.log('  docId:', m.docId);
  console.log('  título:', m.titulo);
  console.log('  tipo:', m.tipo);
  console.log('  url:', m.url);
  console.log();
});
