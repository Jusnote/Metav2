import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xmtleqquivcukwgdexhc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdGxlcXF1aXZjdWt3Z2RleGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMjk5OTcsImV4cCI6MjA2ODgwNTk5N30.7_MFUfXszXysh0kFrezS_i5kjcnvMqKJZlhoCEsX58E'
);

const { data, error } = await supabase
  .from('leis')
  .select('id, nome, sigla, total_artigos')
  .order('nome');

if (error) {
  console.error('Erro:', error.message);
} else if (!data || data.length === 0) {
  console.log('Nenhuma lei encontrada na tabela.');
} else {
  console.log(`${data.length} lei(s) encontrada(s):\n`);
  data.forEach(l => {
    console.log(`  id: ${l.id}  |  nome: ${l.nome}  |  sigla: ${l.sigla}  |  artigos: ${l.total_artigos}`);
  });
}
