import { GripVertical, ArrowUpDown, CheckSquare, Square } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface ListingsStatusBarProps {
  filteredProductsLength: number;
  totalProductsLength: number;
  categoryFilter: string;
  allSelected: boolean;
  selectedProductsSize: number;
  isDragMode: boolean;
  canReorder: boolean;
  isReorderModeActive: boolean;
  onSelectAll: (checked: boolean) => void;
}

export function ListingsStatusBar({
  filteredProductsLength,
  totalProductsLength,
  categoryFilter,
  allSelected,
  selectedProductsSize,
  isDragMode,
  canReorder,
  isReorderModeActive,
  onSelectAll,
}: ListingsStatusBarProps) {
  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="text-sm text-muted-foreground flex items-center gap-4">
        {/* Select All Checkbox */}
        {filteredProductsLength > 0 && !isDragMode && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onSelectAll}
              className="border-2"
            />
            <span className="text-xs">
              {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
            </span>
          </div>
        )}
        
        {filteredProductsLength} de {totalProductsLength} produtos
        {categoryFilter !== 'todas' && (
          <span className="ml-2">
            • Categoria: <Badge variant="outline">{categoryFilter}</Badge>
          </span>
        )}
      </div>
      
      {/* Reorder Mode Info */}
      {isDragMode && (
        <div className="text-xs text-primary flex items-center bg-gradient-to-r from-primary/15 to-blue-500/15 px-4 py-2 rounded-full border border-primary/40 shadow-md">
          <GripVertical className="h-3 w-3 mr-1" />
          <span className="font-medium">Reordenação Ativa</span>
          <span className="hidden sm:inline ml-1">: Arraste para qualquer posição</span>
        </div>
      )}
      
      {/* Reorder Available Info */}
      {canReorder && !isReorderModeActive && (
        <div className="text-xs text-amber-700 dark:text-amber-300 flex items-center bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 px-4 py-2 rounded-full border border-amber-200 dark:border-amber-800 shadow-md">
          <ArrowUpDown className="h-3 w-3 mr-1" />
          <span className="font-medium">Reordenação disponível</span>
          <span className="hidden sm:inline ml-1">para reorganizar produtos</span>
        </div>
      )}
    </div>
  );
}