import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CarouselInsertDialogProps {
  onInsertCarousel: (images: string[]) => void;
  children: React.ReactNode;
}

export function CarouselInsertDialog({ onInsertCarousel, children }: CarouselInsertDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          setSelectedImages(prev => [...prev, base64]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (selectedImages.length > 0) {
      onInsertCarousel(selectedImages);
      setSelectedImages([]);
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    setSelectedImages([]);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inserir Carrossel de Imagens</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Upload Area */}
          <div 
            className={cn(
              "border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer transition-colors",
              "hover:border-primary hover:bg-primary/5"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Clique para selecionar imagens ou arraste e solte
            </p>
            <p className="text-xs text-muted-foreground">
              Selecione uma ou mais imagens (JPG, PNG, GIF)
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Preview das imagens selecionadas */}
          {selectedImages.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Imagens selecionadas ({selectedImages.length})</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {selectedImages.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-border"
                    />
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className={cn(
                        "absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground",
                        "flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      )}
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-1 left-1 bg-background/80 backdrop-blur-xs rounded px-1.5 py-0.5">
                      <span className="text-xs font-medium">{index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={selectedImages.length === 0}
              className="gap-2"
            >
              <ImageIcon className="h-4 w-4" />
              Inserir Carrossel ({selectedImages.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}