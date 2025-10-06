import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Loader as Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface SimpleCopyProductsDialogProps {
  sourceUserId: string;
  sourceUserName: string;
  children?: React.ReactNode;
}

export function SimpleCopyProductsDialog({ 
  sourceUserId, 
  sourceUserName, 
  children 
}: SimpleCopyProductsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [targetUserEmail, setTargetUserEmail] = useState('');
  const [copyMode, setCopyMode] = useState<'all' | 'visible'>('visible');

  const handleCopyProducts = async () => {
    if (!targetUserEmail.trim()) {
      toast.error('Por favor, insira o email do usuário de destino');
      return;
    }

    setIsLoading(true);
    
    try {
      // Find target user by email
      const { data: targetUser, error: userError } = await supabase
        .from('users')
        .select('id, name')
        .eq('email', targetUserEmail.trim())
        .single();

      if (userError || !targetUser) {
        toast.error('Usuário não encontrado com este email');
        return;
      }

      // Call the copy products function
      const { data, error } = await supabase.functions.invoke('copy-products-public', {
        body: {
          sourceUserId,
          targetUserId: targetUser.id,
          copyMode
        }
      });

      if (error) {
        console.error('Error copying products:', error);
        toast.error('Erro ao copiar produtos');
        return;
      }

      const result = data;
      if (result.success) {
        toast.success(
          `${result.copiedCount} produtos copiados com sucesso para ${targetUser.name}`
        );
        setIsOpen(false);
        setTargetUserEmail('');
      } else {
        toast.error(result.error || 'Erro ao copiar produtos');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro interno do servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Copy className="h-4 w-4 mr-2" />
            Copiar Produtos
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copiar Produtos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">
              Copiando produtos de: <span className="font-bold">{sourceUserName}</span>
            </Label>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="targetEmail">Email do usuário de destino</Label>
            <Input
              id="targetEmail"
              type="email"
              placeholder="usuario@exemplo.com"
              value={targetUserEmail}
              onChange={(e) => setTargetUserEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="copyMode">Modo de cópia</Label>
            <Select value={copyMode} onValueChange={(value: 'all' | 'visible') => setCopyMode(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visible">Apenas produtos visíveis</SelectItem>
                <SelectItem value="all">Todos os produtos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCopyProducts}
              disabled={isLoading || !targetUserEmail.trim()}
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Copiar Produtos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}