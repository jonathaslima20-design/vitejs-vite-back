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
import { Loader as Loader2, Copy, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Zap, Download, Image } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { simpleCopyProducts, simpleCopyProductsOnly, copyProductImages } from '@/lib/simpleCopyProducts';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';

const formSchema = z.object({
  sourceUserId: z.string().min(1, 'Selecione o usuário de origem'),
  targetUserId: z.string().min(1, 'Selecione o usuário de destino'),
  copyMode: z.enum(['products_only', 'with_images', 'images_only']).default('with_images'),
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

interface CopyProgress {
  current: number;
  total: number;
  message: string;
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
  const [progress, setProgress] = useState<CopyProgress | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceUserId: defaultSourceUserId || '',
      targetUserId: defaultTargetUserId || '',
      copyMode: 'with_images',
    },
  });

  const sourceUserId = form.watch('sourceUserId');
  const targetUserId = form.watch('targetUserId');
  const copyMode = form.watch('copyMode');

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
      setProgress({ current: 0, total: 10, message: 'Iniciando cópia...' });
      
      console.log('🚀 Iniciando cópia simples:', {
        sourceUserId: values.sourceUserId.substring(0, 8),
        targetUserId: values.targetUserId.substring(0, 8),
        copyMode: values.copyMode
      });

      // Escolher função baseada no modo de cópia
      let result;
      switch (values.copyMode) {
        case 'with_images':
          result = await simpleCopyProducts(
            values.sourceUserId, 
            values.targetUserId,
            setProgress
          );
          break;
        case 'products_only':
          result = await simpleCopyProductsOnly(
            values.sourceUserId, 
            values.targetUserId,
            setProgress
          );
          break;
        case 'images_only':
          result = await copyProductImages(
            values.sourceUserId, 
            values.targetUserId,
            setProgress
          );
          break;
        default:
          throw new Error('Modo de cópia inválido');
      }

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

        const successMessage = `Cópia concluída! Copiado: ${messages.join(', ')}`;
        if (result.skipped > 0) {
          toast.success(`${successMessage}. ${result.skipped} item(ns) ignorado(s).`);
        } else {
          toast.success(successMessage);
        }

        if (result.errors.length > 0) {
          console.warn('Erros durante a cópia:', result.errors);
          toast.warning(`${result.errors.length} erro(s) menores ocorreram. Verifique o console para detalhes.`);
        }
      } else {
        toast.error(`Cópia falhou: ${result.errors.join(', ')}`);
      }

      onOpenChange(false);
      form.reset();
      setProgress(null);
    } catch (error: any) {
      console.error('❌ Erro na cópia:', error);
      toast.error('Erro inesperado: ' + error.message);
      setProgress(null);
    } finally {
      setCopying(false);
    }
  };

  const selectedSourceUser = users.find(u => u.id === sourceUserId);
  const selectedTargetUser = users.find(u => u.id === targetUserId);
  const canProceed = sourceUserId && targetUserId && sourceUserId !== targetUserId;

  const getCopyModeDescription = (mode: string) => {
    switch (mode) {
      case 'with_images':
        return 'Copia produtos + categorias + todas as imagens fisicamente (mais completo)';
      case 'products_only':
        return 'Copia apenas produtos + categorias (ultra-rápido, sem imagens)';
      case 'images_only':
        return 'Copia apenas imagens para produtos já existentes';
      default:
        return '';
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Cópia Simples de Produtos
          </DialogTitle>
          <DialogDescription>
            Versão aprimorada para copiar produtos sem limites entre usuários.
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
                        <Badge variant="outline" className="text-green-600">
                          {selectedTargetUser?.listing_limit} (será ignorado)
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modo de Cópia */}
            <FormField
              control={form.control}
              name="copyMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modo de Cópia</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o modo de cópia" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="with_images">
                        <div className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          <div>
                            <div className="font-medium">Cópia Completa</div>
                            <div className="text-xs text-muted-foreground">
                              Produtos + Categorias + Imagens físicas
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="products_only">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          <div>
                            <div className="font-medium">Ultra-Rápida</div>
                            <div className="text-xs text-muted-foreground">
                              Apenas produtos + categorias (sem imagens)
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="images_only">
                        <div className="flex items-center gap-2">
                          <Image className="h-4 w-4" />
                          <div>
                            <div className="font-medium">Apenas Imagens</div>
                            <div className="text-xs text-muted-foreground">
                              Copia imagens para produtos existentes
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {getCopyModeDescription(field.value)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Progress Bar */}
            {copying && progress && (
              <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Progresso da Cópia
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {progress.current}/{progress.total}
                  </span>
                </div>
                <Progress 
                  value={(progress.current / progress.total) * 100} 
                  className="h-2"
                />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {progress.message}
                </p>
              </div>
            )}

            {/* Avisos importantes */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Versão Aprimorada:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>✅ Remove temporariamente o limite de produtos</li>
                  <li>✅ Copia TODOS os produtos encontrados</li>
                  <li>✅ Copia fisicamente todas as imagens (modo completo)</li>
                  <li>✅ Produtos são adicionados aos existentes</li>
                  <li>✅ Produtos copiados ficam ocultos inicialmente</li>
                  <li>✅ Progress tracking em tempo real</li>
                  <li>⚠️ Processo pode demorar para muitos produtos</li>
                </ul>
              </AlertDescription>
            </Alert>

            {copyMode === 'with_images' && sourceStats && sourceStats.productsCount > 50 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Aviso:</strong> O usuário de origem tem {sourceStats.productsCount} produtos. 
                  A cópia completa com imagens pode levar vários minutos. 
                  Considere usar o modo "Ultra-Rápida" se não precisar das imagens imediatamente.
                </AlertDescription>
              </Alert>
            )}

            {copyMode === 'images_only' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Modo Apenas Imagens:</strong> Esta opção copia imagens para produtos que já existem 
                  no usuário de destino com títulos correspondentes. Use após uma cópia "Ultra-Rápida" 
                  para adicionar as imagens posteriormente.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                  setProgress(null);
                }}
                disabled={copying}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={copying || !canProceed}
                className="flex-1"
              >
                {copying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Copiando...
                  </>
                ) : (
                  <>
                    {copyMode === 'with_images' ? (
                      <Download className="mr-2 h-4 w-4" />
                    ) : copyMode === 'products_only' ? (
                      <Zap className="mr-2 h-4 w-4" />
                    ) : (
                      <Image className="mr-2 h-4 w-4" />
                    )}
                    {copyMode === 'with_images' ? 'Cópia Completa' : 
                     copyMode === 'products_only' ? 'Cópia Ultra-Rápida' : 
                     'Copiar Apenas Imagens'}
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