import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table as TableIcon } from 'lucide-react';

interface TableInsertDialogProps {
  onInsertTable: (rows: number, cols: number, color: string) => void;
}

export function TableInsertDialog({ onInsertTable }: TableInsertDialogProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [selectedColor, setSelectedColor] = useState('#6B7280'); // Cinza padrão

  const tableColors = [
    { name: 'Cinza', value: '#6B7280' },
    { name: 'Azul', value: '#3B82F6' },
    { name: 'Verde', value: '#10B981' },
    { name: 'Roxo', value: '#8B5CF6' },
    { name: 'Rosa', value: '#EC4899' },
    { name: 'Laranja', value: '#F97316' },
    { name: 'Vermelho', value: '#EF4444' },
    { name: 'Amarelo', value: '#EAB308' },
  ];

  const handleInsert = () => {
    onInsertTable(rows, cols, selectedColor);
    setOpen(false);
  };

  const generateLighterColor = (color: string, alpha: number) => {
    // Convert hex to RGB and apply alpha
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Inserir tabela"
        >
          <TableIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Inserir Tabela</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Dimensões */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rows">Linhas</Label>
              <Input
                id="rows"
                type="number"
                min="1"
                max="20"
                value={rows}
                onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cols">Colunas</Label>
              <Input
                id="cols"
                type="number"
                min="1"
                max="10"
                value={cols}
                onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>

          {/* Preview da tabela */}
          <div className="space-y-2">
            <Label>Prévia</Label>
            <div className="border rounded p-2 bg-muted/30">
              <table 
                className="w-full border-collapse text-xs"
                style={{ 
                  borderColor: selectedColor,
                  border: `1px solid ${selectedColor}`
                }}
              >
                <thead>
                  <tr>
                    {Array.from({ length: cols }, (_, i) => (
                      <th 
                        key={i} 
                        className="border p-1 text-center font-medium"
                        style={{ 
                          borderColor: selectedColor,
                          backgroundColor: generateLighterColor(selectedColor, 0.2),
                          color: selectedColor
                        }}
                      >
                        Col {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rows - 1 }, (_, i) => (
                    <tr key={i}>
                      {Array.from({ length: cols }, (_, j) => (
                        <td 
                          key={j} 
                          className="border p-1 text-center"
                          style={{ 
                            borderColor: selectedColor,
                            backgroundColor: i % 2 === 0 ? 'transparent' : generateLighterColor(selectedColor, 0.1)
                          }}
                        >
                          Cel
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cores */}
          <div className="space-y-2">
            <Label>Cor da Tabela</Label>
            <div className="grid grid-cols-4 gap-2">
              {tableColors.map((color) => (
                <button
                  key={color.value}
                  className={`w-full h-10 rounded border-2 transition-all hover:scale-105 ${
                    selectedColor === color.value ? 'border-foreground' : 'border-border'
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setSelectedColor(color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInsert}>
              Inserir Tabela
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}