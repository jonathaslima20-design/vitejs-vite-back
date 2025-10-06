import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { simpleCopyProducts, simpleCopyProductsOnly } from '@/lib/simpleCopyProducts';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';

const formSchema = z.object({
  sourceUserId: z.string().min(1, 'Selecione o usuário de origem'),
  targetUserId: z.string().min(1, 'Selecione o usuário de destino'),
  copyImages: z.boolean().default(false),
});

interface User {
  id: string;
  name: string;
  email: string;
  listing_limit: number;
}

interface UserStats {
  categoriesCount: number;
  productsCount: number;
}

interface SimpleCopyProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTargetUserId?: string;
  defaultSourceUserId?: string;
}

export function SimpleCopyProductsDialog({
  open,
  onOpenChange,
  defaultTargetUserId,
  defaultSourceUserId,
}: SimpleCopyProductsDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [copying, setCopying] = useState(false);
  const [sourceStats, setSourceStats] = useState<UserStats | null>(null);
  const [targetStats, setTargetStats] = useState<UserStats | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceUserId: defaultSourceUserId || '',
      targetUserId: defaultTargetUserId || '',
      copyImages: false,
    },
  });

  const sourceUserId = form.watch('sourceUserId');
  const targetUserId = form.watch('targetUserId');
  const copyImages = form.watch('copyImages');

  useEffect(() => {
    if (open) {
      fetchUsers();
      if (defaultTargetUserId) {
        form.setValue('targetUserId', defaultTargetUserId);
      }
      if (defaultSourceUserId) {
        form.setValue('sourceUserId', defaultSourceUserId);
      }
    }
  }, [open, defaultTargetUserId, defaultSourceUserId]);

  useEffect(() => {
    if (sourceUserId) {
      fetchUserStats(sourceUserId, 'source');
    } else {
      setSourceStats(null);
    }
  }, [sourceUserId]);

  useEffect(() => {
    if (targetUserId) {
      fetchUserStats(targetUserId, 'target');
    } else {
      setTargetStats(null);
    }
  }, [targetUserId]);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, listing_limit')
        .order('name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchUserStats = async (userId: string, type: 'source' | 'target') => {
    try {
      const { count: categoriesCount } = await supabase
        .from('user_product_categories')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const stats = {
        categoriesCount: categoriesCount || 0,
        productsCount: productsCount || 0,
      };

      if (type === 'source') {
        setSourceStats(stats);
      } else {
        setTargetStats(stats);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setCopying(true);
      
      console.log('🚀 Iniciando cópia simples:', {
        sourceUserId: values.sourceUserId.substring(0, 8),
        targetUserId: values.targetUserId.substring(0, 8),
        copyImages: values.copyImages
      });

      // Escolher função baseada na opção de imagens
      const result = values.copyImages 
        ? await simpleCopyProducts(values.sourceUserId, values.targetUserId)
        : await simpleCopyProductsOnly(values.sourceUserId, values.targetUserId);

      console.log('✅ Resultado da cópia:', result);

      if (result.success) {
        const messages = [];
        if (result.categoriesCloned > 0) {
          messages.push(`${result.categoriesCloned} categoria(s)`);
        }
        if (result.productsCloned > 0) {
          messages.push(`${result.productsCloned} produto(s)`);
        }
        if (result.imagesCloned > 0) {
          messages.push(`${result.imagesCloned} imagem(ns)`);
        }

        toast.success(`Cópia concluída! Copiado: ${messages.join(', ')}`);

        if (result.errors.length > 0) {
          toast.warning(`Alguns itens tiveram problemas: ${result.errors.length} erro(s)`);
        }
      } else {
        toast.error(`Cópia falhou: ${result.errors.join(', ')}`);
      }

      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      console.error('❌ Erro na cópia:', error);
      toast.error('Erro inesperado: ' + error.message);
    } finally {
      setCopying(false);
    }
  };

  const selectedSourceUser = users.find(u => u.id === sourceUserId);
  const selectedTargetUser = users.find(u => u.id === targetUserId);
  const canProceed = sourceUserId && targetUserId && sourceUserId !== targetUserId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Cópia Simples de Produtos
          </DialogTitle>
          <DialogDescription>
            Versão simplificada para copiar produtos rapidamente entre usuários.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sourceUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuário de Origem</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={loadingUsers}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o usuário de origem" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem
                            key={user.id}
                            value={user.id}
                            disabled={user.id === targetUserId}
                          >
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      De onde copiar os produtos
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="targetUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuário de Destino</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={loadingUsers}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o usuário de destino" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem
                            key={user.id}
                            value={user.id}
                            disabled={user.id === sourceUserId}
                          >
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Para onde copiar os produtos
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {canProceed && (sourceStats || targetStats) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                    Origem: {selectedSourceUser?.name}
                  </h4>
                  {sourceStats && (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Categorias:</span>
                        <Badge variant="secondary">{sourceStats.categoriesCount}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Produtos:</span>
                        <Badge variant="secondary">{sourceStats.productsCount}</Badge>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    Destino: {selectedTargetUser?.name}
                  </h4>
                  {targetStats && (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Categorias atuais:</span>
                        <Badge variant="secondary">{targetStats.categoriesCount}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Produtos atuais:</span>
                        <Badge variant="secondary">{targetStats.productsCount}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Limite:</span>
                        <Badge variant="outline">{selectedTargetUser?.listing_limit}</Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Opção de copiar imagens */}
            <FormField
              control={form.control}
              name="copyImages"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Copiar Imagens
                    </FormLabel>
                    <FormDescription>
                      {field.value 
                        ? 'Copia as referências das imagens (mais rápido, compartilha arquivos)'
                        : 'Apenas produtos e categorias (ultra-rápido)'
                      }
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Avisos importantes */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Versão Simplificada:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>Copia até 50 produtos por operação</li>
                  <li>Produtos são adicionados aos existentes (não substitui)</li>
                  <li>Imagens são referenciadas (não duplicadas fisicamente)</li>
                  <li>Processo mais rápido e confiável</li>
                  <li>Produtos copiados ficam ocultos inicialmente</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                }}
                disabled={copying}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={copying || !canProceed}
              >
                {copying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Copiando...
                  </>
                ) : (
                  <>
                    {copyImages ? (
                      <Copy className="mr-2 h-4 w-4" />
                    ) : (
                      <Zap className="mr-2 h-4 w-4" />
                    )}
                    {copyImages ? 'Copiar com Imagens' : 'Cópia Ultra-Rápida'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}