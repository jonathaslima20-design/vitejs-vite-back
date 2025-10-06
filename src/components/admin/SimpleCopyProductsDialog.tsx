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
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader as Loader2, Copy, Info, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cloneUserComplete } from '@/lib/adminApi';
import { syncUserCategoriesWithStorefrontSettings } from '@/lib/utils';

const formSchema = z.object({
  sourceUserId: z.string().min(1, 'Selecione o usuário de origem'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  slug: z.string().min(2, 'Slug deve ter pelo menos 2 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífens'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

interface User {
  id: string;
  name: string;
  email: string;
  listing_limit: number;
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
  const [cloning, setCloning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceUserId: defaultSourceUserId || '',
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      slug: '',
    },
  });

  const sourceUserId = form.watch('sourceUserId');
  const name = form.watch('name');

  useEffect(() => {
    if (open) {
      fetchUsers();
      if (defaultSourceUserId) {
        form.setValue('sourceUserId', defaultSourceUserId);
      }
    }
  }, [open, defaultSourceUserId]);

  // Auto-generate slug from name
  useEffect(() => {
    if (name && !form.getValues('slug')) {
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      form.setValue('slug', slug);
    }
  }, [name]);

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
      setProgress(10);
      setProgressMessage('Iniciando clonagem...');

      const selectedUser = users.find(u => u.id === values.sourceUserId);
      if (!selectedUser) {
        throw new Error('Usuário de origem não encontrado');
      }

      setProgress(30);
      setProgressMessage('Criando novo usuário...');

      const { newUserId } = await cloneUserComplete(values.sourceUserId, {
        email: values.email,
        password: values.password,
        name: values.name,
        slug: values.slug,
      });

      setProgress(80);
      setProgressMessage('Sincronizando configurações...');

      // Sync categories for the new user
      try {
        await syncUserCategoriesWithStorefrontSettings(newUserId);
      } catch (syncError) {
        console.warn('Category sync warning (non-critical):', syncError);
      }

      setProgress(100);
      setProgressMessage('Clonagem concluída!');

      toast.success(`Usuário "${values.name}" clonado com sucesso! Todos os dados, produtos e imagens foram copiados.`);
      
      onOpenChange(false);
      form.reset();
      
      // Small delay to show completion
      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
      }, 1000);

    } catch (error: any) {
      console.error('❌ Clone operation failed:', error);
      toast.error(error.message || 'Erro na clonagem');
    } finally {
      setCloning(false);
    }
  };

  const selectedSourceUser = users.find(u => u.id === sourceUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Clonar Usuário Completo
          </DialogTitle>
          <DialogDescription>
            Cria uma cópia completa do usuário incluindo perfil, categorias, produtos e todas as imagens.
            Esta operação pode levar alguns minutos dependendo da quantidade de dados.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        {cloning && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{progressMessage}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Source User Selection */}
            <FormField
              control={form.control}
              name="sourceUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuário para Clonar</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={loadingUsers || cloning}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o usuário para clonar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Todos os dados deste usuário serão copiados
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* New User Data */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Dados do Novo Usuário</h3>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do novo usuário" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link da Vitrine</FormLabel>
                    <FormControl>
                      <div className="flex items-center">
                        <span className="text-sm text-muted-foreground mr-2">vitrineturbo.com/</span>
                        <Input placeholder="novo-usuario" {...field} />
                      </div>
                    </FormControl>
                    <FormDescription>
                      URL única para a vitrine do novo usuário
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Senha do novo usuário"
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showConfirmPassword ? "text" : "password"} 
                            placeholder="Confirme a senha"
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Source User Summary */}
            {selectedSourceUser && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  Origem: {selectedSourceUser.name}
                </h4>
                <p className="text-sm text-muted-foreground">
                  Todos os dados deste usuário serão copiados para o novo usuário, incluindo:
                  perfil, configurações, categorias, produtos e imagens.
                </p>
              </div>
            )}

            {/* Info Alert */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Clonagem Completa:</strong> Esta operação cria uma cópia exata do usuário selecionado,
                incluindo todas as configurações, produtos e imagens. O processo é otimizado e confiável,
                baseado no sistema de clonagem de usuários já testado.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                }}
                disabled={cloning}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={cloning || !sourceUserId}
              >
                {cloning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Clonando...
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Clonar Usuário
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