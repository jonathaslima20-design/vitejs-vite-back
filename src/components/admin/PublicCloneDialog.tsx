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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader as Loader2, Users, Key, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cloneUserDataPublic, type CloneOptions, type CloneProgress } from '@/lib/cloneApi';

const formSchema = z.object({
  apiKey: z.string().min(1, 'API Key é obrigatória'),
  sourceUserId: z.string().min(1, 'Selecione o usuário de origem'),
  targetUserId: z.string().min(1, 'Selecione o usuário de destino'),
});

interface User {
  id: string;
  name: string;
  email: string;
  listing_limit: number;
}

interface PublicCloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTargetUserId?: string;
  defaultSourceUserId?: string;
}

export function PublicCloneDialog({
  open,
  onOpenChange,
  defaultTargetUserId,
  defaultSourceUserId,
}: PublicCloneDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [progress, setProgress] = useState<CloneProgress | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      apiKey: '',
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

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setCloning(true);
      setProgress({ current: 0, total: 10, message: 'Iniciando clonagem via API...', percentage: 0 });

      const options: CloneOptions = {
        cloneCategories: true,
        cloneProducts: true,
        mergeStrategy: 'merge',
        copyImages: true
      };

      const result = await cloneUserDataPublic(
        values.apiKey,
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

        toast.success(`Clonagem via API concluída! Copiado: ${messages.join(', ')}`, {
          duration: 8000
        });

        onOpenChange(false);
        form.reset();
      } else {
        throw new Error(result.errors.join('; ') || 'Falha na clonagem via API');
      }

    } catch (error: any) {
      console.error('❌ Public clone failed:', error);
      toast.error(error.message || 'Erro na clonagem via API');
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            Clonagem via API Pública
          </DialogTitle>
          <DialogDescription>
            Use uma API Key para clonar dados sem necessidade de autenticação JWT. 
            Ideal para integrações externas e automações.
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
            {/* API Key Field */}
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="Digite sua API Key"
                        {...field}
                        disabled={cloning}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    API Key configurada nas variáveis de ambiente do Supabase
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* User Summary */}
            {canProceed && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                    Origem: {selectedSourceUser?.name}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Todos os produtos e categorias serão copiados
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    Destino: {selectedTargetUser?.name}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Dados serão adicionados (estratégia de mesclagem)
                  </p>
                </div>
              </div>
            )}

            {/* API Key Info */}
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                <strong>Configuração da API Key:</strong> A API Key deve estar configurada como variável de ambiente 
                <code className="mx-1 px-1 py-0.5 bg-muted rounded">ENHANCED_CLONE_API_KEY</code> no Supabase Dashboard.
                Esta função não requer autenticação JWT, apenas a API Key.
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
                disabled={cloning}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={cloning || !canProceed}
              >
                {cloning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Clonando via API...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Clonar via API
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