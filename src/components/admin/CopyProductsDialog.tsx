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
import { Loader as Loader2, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { copyProductsAdmin } from '@/lib/publicApi';
import { toast } from 'sonner';

const formSchema = z.object({
  sourceUserId: z.string().min(1, 'Selecione o usuário de origem'),
  targetUserId: z.string().min(1, 'Selecione o usuário de destino'),
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

interface CopyProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTargetUserId?: string;
  defaultSourceUserId?: string;
}

export function CopyProductsDialog({
  open,
  onOpenChange,
  defaultTargetUserId,
  defaultSourceUserId,
}: CopyProductsDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [copying, setCopying] = useState(false);
  const [sourceStats, setSourceStats] = useState<UserStats | null>(null);
  const [targetStats, setTargetStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceUserId: defaultSourceUserId || '',
      targetUserId: defaultTargetUserId || '',
    },
  });

  const sourceUserId = form.watch('sourceUserId');
  const targetUserId = form.watch('targetUserId');

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
      setLoadingStats(true);

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
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setCopying(true);

      console.log('🚀 Starting copy operation:', {
        sourceUserId: values.sourceUserId.substring(0, 8),
        targetUserId: values.targetUserId.substring(0, 8)
      });

      // Show progress toast for long operations
      const progressToast = toast.loading(
        'Copiando dados... Esta operação pode levar alguns minutos para muitos produtos.',
        { duration: Infinity }
      );

      try {
        // Use admin API (requires JWT)
        const result = await copyProductsAdmin(
          values.sourceUserId,
          values.targetUserId
        );

        console.log('✅ Copy operation completed:', result);

        // Dismiss progress toast
        toast.dismiss(progressToast);

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

        toast.success(`Cópia concluída com sucesso! Copiado: ${messages.join(', ')}`, {
          duration: 8000
        });

        onOpenChange(false);
        form.reset();
      } catch (innerError) {
        toast.dismiss(progressToast);
        throw innerError;
      }
    } catch (error: any) {
      console.error('❌ Error copying data:', error);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 200)
      });

      // Enhanced error handling with specific messages
      let userFriendlyMessage = 'Erro ao copiar dados';
      let errorDetails = '';

      if (error.message?.includes('Timeout') || error.message?.includes('10 minutos')) {
        userFriendlyMessage = 'A operação excedeu o tempo limite de 10 minutos. Recomendações:';
        errorDetails = '\n• Tente copiar de um usuário com menos produtos\n• Copie em lotes menores\n• Verifique a conectividade com a internet';
      } else if (error.message?.includes('conectar') || error.message?.includes('Failed to send')) {
        userFriendlyMessage = 'Problema de conexão com o servidor';
        errorDetails = '\n• Verifique sua conexão com a internet\n• Verifique se a Edge Function está deployada\n• Tente novamente em alguns minutos';
      } else if (error.message?.includes('sessão') || error.message?.includes('autenticado') || error.message?.includes('Unauthorized')) {
        userFriendlyMessage = 'Sessão expirada ou sem permissão';
        errorDetails = '\n• Faça login novamente\n• Verifique se você tem permissões de admin';
      } else if (error.message?.includes('limit') || error.message?.includes('exceed')) {
        userFriendlyMessage = 'Limite de produtos excedido';
        errorDetails = '\n• Verifique o limite do usuário de destino\n• Considere aumentar o limite antes de copiar';
      } else if (error.message?.includes('não encontrado') || error.message?.includes('not found')) {
        userFriendlyMessage = 'Usuário não encontrado';
        errorDetails = '\n• Verifique se ambos os usuários existem\n• Recarregue a página e tente novamente';
      } else if (error.message?.includes('Status:')) {
        userFriendlyMessage = `Erro no servidor: ${error.message}`;
      } else {
        userFriendlyMessage = error.message || 'Erro inesperado ao copiar dados';
        errorDetails = '\n• Verifique o console para mais detalhes\n• Entre em contato com o suporte se o problema persistir';
      }

      toast.error(userFriendlyMessage + errorDetails, {
        duration: 10000
      });
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
            Copiar Produtos e Categorias
          </DialogTitle>
          <DialogDescription>
            Copie todas as categorias e produtos de um usuário para outro.
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
                      De onde copiar os dados
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
                      Para onde copiar os dados
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
                        <span className="text-muted-foreground">Limite de produtos:</span>
                        <Badge variant="outline">{selectedTargetUser?.listing_limit}</Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {canProceed && sourceStats && targetStats && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Resumo:</strong> Serão copiados {sourceStats.categoriesCloned} categoria(s) e {sourceStats.productsCount} produto(s) 
                  para o usuário de destino. Os dados existentes serão preservados.
                </p>
              </div>
            )}

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
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Dados
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