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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader as Loader2, Copy, CircleAlert as AlertCircle, CircleCheck as CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { copyProductsPublic, copyProductsAdmin } from '@/lib/publicApi';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  sourceUserId: z.string().min(1, 'Selecione o usuário de origem'),
  targetUserId: z.string().min(1, 'Selecione o usuário de destino'),
  cloneCategories: z.boolean(),
  cloneProducts: z.boolean(),
  mergeStrategy: z.enum(['merge', 'replace']),
  usePublicApi: z.boolean().default(false),
  apiKey: z.string().optional(),
}).refine((data) => data.cloneCategories || data.cloneProducts, {
  message: 'Selecione pelo menos uma opção (Categorias ou Produtos)',
  path: ['cloneCategories'],
}).refine((data) => !data.usePublicApi || (data.usePublicApi && data.apiKey), {
  message: 'API Key é obrigatória quando usar API pública',
  path: ['apiKey'],
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
      cloneCategories: true,
      cloneProducts: true,
      mergeStrategy: 'merge',
      usePublicApi: false,
      apiKey: '',
    },
  });

  const sourceUserId = form.watch('sourceUserId');
  const targetUserId = form.watch('targetUserId');
  const cloneCategories = form.watch('cloneCategories');
  const cloneProducts = form.watch('cloneProducts');
  const mergeStrategy = form.watch('mergeStrategy');
  const usePublicApi = form.watch('usePublicApi');

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

      let result;

      if (values.usePublicApi && values.apiKey) {
        // Use public API
        result = await copyProductsPublic(
          values.apiKey,
          values.sourceUserId,
          values.targetUserId,
          {
            cloneCategories: values.cloneCategories,
            cloneProducts: values.cloneProducts,
            mergeStrategy: values.mergeStrategy,
          }
        );
      } else {
        // Use admin API (requires JWT)
        result = await copyProductsAdmin(
          values.sourceUserId,
          values.targetUserId,
          {
            cloneCategories: values.cloneCategories,
            cloneProducts: values.cloneProducts,
            mergeStrategy: values.mergeStrategy,
          }
        );
      }

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

      toast.success(`Cópia concluída com sucesso! Copiado: ${messages.join(', ')}`);

      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      console.error('Error copying data:', error);
      toast.error('Erro ao copiar dados: ' + error.message);
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
            Copie categorias e produtos de um usuário para outro. Escolha a estratégia de mesclagem adequada.
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

            <div className="space-y-4">
              <FormLabel>O que deseja copiar?</FormLabel>

              <FormField
                control={form.control}
                name="cloneCategories"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Categorias</FormLabel>
                      <FormDescription>
                        Copiar todas as categorias do usuário de origem
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cloneProducts"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Produtos e Imagens</FormLabel>
                      <FormDescription>
                        Copiar todos os produtos com suas respectivas imagens
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="mergeStrategy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estratégia de Mesclagem</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="merge">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <div>
                            <div className="font-medium">Mesclar (Recomendado)</div>
                            <div className="text-xs text-muted-foreground">
                              Adiciona novos itens sem remover os existentes
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="replace">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                          <div>
                            <div className="font-medium">Substituir</div>
                            <div className="text-xs text-muted-foreground">
                              Remove todos os dados existentes antes de copiar
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {mergeStrategy === 'merge'
                      ? 'Os dados serão adicionados aos existentes. Categorias duplicadas serão ignoradas.'
                      : 'ATENÇÃO: Todos os dados do usuário de destino serão removidos antes da cópia!'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* API Method Selection */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <FormField
                control={form.control}
                name="usePublicApi"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Usar API Pública</FormLabel>
                      <FormDescription>
                        Use a API pública com chave de API em vez da autenticação JWT (recomendado para automação)
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {usePublicApi && (
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key</FormLabel>
                      <FormControl>
                        <Input 
                          type="password"
                          placeholder="Digite a API Key para autenticação"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Chave de API necessária para usar a função pública
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {mergeStrategy === 'replace' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção!</strong> A estratégia "Substituir" irá deletar permanentemente todos os
                  {cloneCategories && ' categorias'}
                  {cloneCategories && cloneProducts && ' e'}
                  {cloneProducts && ' produtos'}
                  {' '}existentes do usuário de destino. Esta ação não pode ser desfeita.
                </AlertDescription>
              </Alert>
            )}

            {canProceed && cloneProducts && sourceStats && targetStats && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {mergeStrategy === 'merge' ? (
                    <>
                      O usuário de destino tem {targetStats.productsCount} produto(s) e receberá mais {sourceStats.productsCount}.
                      Total após a cópia: {targetStats.productsCount + sourceStats.productsCount} produtos.
                    </>
                  ) : (
                    <>
                      Todos os {targetStats.productsCount} produto(s) existentes serão removidos e substituídos por {sourceStats.productsCount} novo(s) produto(s).
                    </>
                  )}
                </AlertDescription>
              </Alert>
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
                disabled={copying || !canProceed || (!cloneCategories && !cloneProducts)}
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