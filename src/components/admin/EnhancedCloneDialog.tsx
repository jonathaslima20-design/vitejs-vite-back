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
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Copy, AlertTriangle, CheckCircle, Info, Zap, Image } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cloneUserDataAdmin, validateCloneOperation, quickCloneProducts, fullCloneProducts, type CloneOptions, type CloneProgress } from '@/lib/cloneApi';

const formSchema = z.object({
  sourceUserId: z.string().min(1, 'Selecione o usuário de origem'),
  targetUserId: z.string().min(1, 'Selecione o usuário de destino'),
  cloneCategories: z.boolean(),
  cloneProducts: z.boolean(),
  mergeStrategy: z.enum(['merge', 'replace']),
  copyImages: z.boolean(),
  maxProducts: z.number().min(1).max(1000).optional(),
}).refine((data) => data.cloneCategories || data.cloneProducts, {
  message: 'Selecione pelo menos uma opção (Categorias ou Produtos)',
  path: ['cloneCategories'],
});

interface User {
  id: string;
  name: string;
  email: string;
  listing_limit: number;
}

interface EnhancedCloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTargetUserId?: string;
  defaultSourceUserId?: string;
}

export function EnhancedCloneDialog({
  open,
  onOpenChange,
  defaultTargetUserId,
  defaultSourceUserId,
}: EnhancedCloneDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [progress, setProgress] = useState<CloneProgress | null>(null);
  const [validation, setValidation] = useState<any>(null);
  const [loadingValidation, setLoadingValidation] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceUserId: defaultSourceUserId || '',
      targetUserId: defaultTargetUserId || '',
      cloneCategories: true,
      cloneProducts: true,
      mergeStrategy: 'merge',
      copyImages: true,
      maxProducts: 100,
    },
  });

  const sourceUserId = form.watch('sourceUserId');
  const targetUserId = form.watch('targetUserId');
  const cloneCategories = form.watch('cloneCategories');
  const cloneProducts = form.watch('cloneProducts');
  const mergeStrategy = form.watch('mergeStrategy');
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
    if (sourceUserId && targetUserId && sourceUserId !== targetUserId) {
      validateOperation();
    } else {
      setValidation(null);
    }
  }, [sourceUserId, targetUserId, cloneCategories, cloneProducts, mergeStrategy]);

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

  const validateOperation = async () => {
    try {
      setLoadingValidation(true);
      
      const options: CloneOptions = {
        cloneCategories,
        cloneProducts,
        mergeStrategy,
        copyImages
      };

      const validationResult = await validateCloneOperation(sourceUserId, targetUserId, options);
      setValidation(validationResult);
    } catch (error) {
      console.error('Error validating operation:', error);
    } finally {
      setLoadingValidation(false);
    }
  };

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setCloning(true);
      setProgress({ current: 0, total: 10, message: 'Iniciando...', percentage: 0 });

      const options: CloneOptions = {
        cloneCategories: values.cloneCategories,
        cloneProducts: values.cloneProducts,
        mergeStrategy: values.mergeStrategy,
        copyImages: values.copyImages,
        maxProducts: values.maxProducts
      };

      const result = await cloneUserDataAdmin(
        values.sourceUserId,
        values.targetUserId,
        options,
        setProgress
      );

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

        toast.success(`Clonagem concluída! Copiado: ${messages.join(', ')}`, {
          duration: 8000
        });

        if (result.errors.length > 0) {
          console.warn('⚠️ Clone completed with warnings:', result.errors);
          toast.warning(`${result.errors.length} avisos durante a clonagem. Verifique o console.`);
        }

        onOpenChange(false);
        form.reset();
      } else {
        throw new Error(result.errors.join('; ') || 'Falha na clonagem');
      }

    } catch (error: any) {
      console.error('❌ Clone operation failed:', error);
      toast.error(error.message || 'Erro na clonagem');
    } finally {
      setCloning(false);
      setProgress(null);
    }
  };

  const handleQuickClone = async () => {
    if (!sourceUserId || !targetUserId) return;

    try {
      setCloning(true);
      setProgress({ current: 0, total: 10, message: 'Clonagem rápida...', percentage: 0 });

      const result = await quickCloneProducts(sourceUserId, targetUserId, setProgress);

      if (result.success) {
        toast.success(`Clonagem rápida concluída! ${result.productsCloned} produtos copiados (sem imagens)`);
        onOpenChange(false);
      } else {
        throw new Error(result.errors.join('; '));
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro na clonagem rápida');
    } finally {
      setCloning(false);
      setProgress(null);
    }
  };

  const selectedSourceUser = users.find(u => u.id === sourceUserId);
  const selectedTargetUser = users.find(u => u.id === targetUserId);
  const canProceed = sourceUserId && targetUserId && sourceUserId !== targetUserId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Sistema de Clonagem Avançado
          </DialogTitle>
          <DialogDescription>
            Clone categorias e produtos entre usuários com controle total sobre o processo
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        {progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{progress.message}</span>
              <span>{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} className="w-full" />
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* User Selection */}
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
                      disabled={loadingUsers || cloning}
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
                      disabled={loadingUsers || cloning}
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

            {/* Validation Results */}
            {validation && canProceed && (
              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Análise da Operação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                        Origem: {selectedSourceUser?.name}
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Categorias:</span>
                          <Badge variant="secondary">{validation.sourceStats.categories}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Produtos:</span>
                          <Badge variant="secondary">{validation.sourceStats.products}</Badge>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500"></span>
                        Destino: {selectedTargetUser?.name}
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Categorias atuais:</span>
                          <Badge variant="secondary">{validation.targetStats.categories}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Produtos atuais:</span>
                          <Badge variant="secondary">{validation.targetStats.products}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Limite:</span>
                          <Badge variant="outline">{validation.targetStats.limit}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {validation.warnings.length > 0 && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1">
                          {validation.warnings.map((warning: string, index: number) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Clone Options */}
            <div className="space-y-4">
              <FormLabel className="text-base font-semibold">Opções de Clonagem</FormLabel>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cloneCategories"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={cloning}
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
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={cloning}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Produtos</FormLabel>
                        <FormDescription>
                          Copiar todos os produtos do usuário de origem
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="copyImages"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={cloning || !cloneProducts}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Imagens</FormLabel>
                        <FormDescription>
                          Copiar fisicamente todas as imagens dos produtos
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxProducts"
                  render={({ field }) => (
                    <FormItem className="rounded-lg border p-4">
                      <FormLabel>Limite de Produtos</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value?.toString() || '100'}
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          disabled={cloning || !cloneProducts}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="50">50 produtos</SelectItem>
                            <SelectItem value="100">100 produtos</SelectItem>
                            <SelectItem value="200">200 produtos</SelectItem>
                            <SelectItem value="500">500 produtos</SelectItem>
                            <SelectItem value="1000">Todos (até 1000)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>
                        Máximo de produtos a serem clonados
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Merge Strategy */}
            <FormField
              control={form.control}
              name="mergeStrategy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estratégia de Mesclagem</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={cloning}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="merge">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <div>
                            <div className="font-medium">Mesclar (Recomendado)</div>
                            <div className="text-xs text-muted-foreground">
                              Adiciona aos dados existentes
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="replace">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          <div>
                            <div className="font-medium">Substituir</div>
                            <div className="text-xs text-muted-foreground">
                              Remove dados existentes antes de copiar
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {mergeStrategy === 'merge'
                      ? 'Os dados serão adicionados aos existentes. Duplicatas serão ignoradas.'
                      : 'ATENÇÃO: Todos os dados do usuário de destino serão removidos!'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Warning for replace strategy */}
            {mergeStrategy === 'replace' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção!</strong> A estratégia "Substituir" irá deletar permanentemente todos os dados existentes do usuário de destino. Esta ação não pode ser desfeita.
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                }}
                disabled={cloning}
                className="flex-1"
              >
                Cancelar
              </Button>

              {/* Quick Clone Button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleQuickClone}
                disabled={cloning || !canProceed}
                className="flex-1"
              >
                <Zap className="mr-2 h-4 w-4" />
                Clonagem Rápida (Sem Imagens)
              </Button>

              {/* Full Clone Button */}
              <Button
                type="submit"
                disabled={cloning || !canProceed || (!cloneCategories && !cloneProducts)}
                className="flex-1"
              >
                {cloning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Clonando...
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Clonagem Completa
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* Help Section */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">Dicas de Uso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>• <strong>Clonagem Rápida:</strong> Copia apenas produtos e categorias (sem imagens) - Ideal para testes</p>
            <p>• <strong>Clonagem Completa:</strong> Copia tudo incluindo imagens - Pode levar vários minutos</p>
            <p>• <strong>Mesclar:</strong> Preserva dados existentes e adiciona novos</p>
            <p>• <strong>Substituir:</strong> Remove tudo e substitui pelos dados da origem</p>
            <p>• <strong>Limite:</strong> Use limites menores para operações mais rápidas</p>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}