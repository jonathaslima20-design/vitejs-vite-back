import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader as Loader2, Phone, Mail, Calendar, User, Shield, Users, CircleCheck as CheckCircle, CreditCard, Save, Copy, Eye, EyeOff } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getInitials, formatPhone, formatCurrency, formatWhatsAppForDisplay } from '@/lib/utils';
import { UserStats } from '@/components/admin/UserStats';
import PlanStatusBadge from '@/components/subscription/PlanStatusBadge';
import { cloneUserAdmin } from '@/lib/adminApi';
import { syncUserCategoriesWithStorefrontSettings } from '@/lib/utils';
import type { SubscriptionPlan, Subscription } from '@/types';
import { CloneCategoriesProductsDialog } from '@/components/admin/CloneCategoriesProductsDialog';

const planFormSchema = z.object({
  plan_id: z.string().min(1, 'Selecione um plano'),
  status: z.enum(['active', 'pending', 'suspended', 'cancelled']),
  payment_status: z.enum(['paid', 'pending', 'overdue']),
});

const cloneUserFormSchema = z.object({
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

interface UserDetail {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
  whatsapp?: string;
  instagram?: string;
  location_url?: string;
  slug?: string;
  listing_limit: number;
  is_blocked: boolean;
  plan_status?: string;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  creator?: {
    name: string;
    email: string;
  };
}

export default function UserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [showCloneCategoriesProductsDialog, setShowCloneCategoriesProductsDialog] = useState(false);

  const planForm = useForm<z.infer<typeof planFormSchema>>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      plan_id: '',
      status: 'pending',
      payment_status: 'pending',
    },
  });

  const cloneForm = useForm<z.infer<typeof cloneUserFormSchema>>({
    resolver: zodResolver(cloneUserFormSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      slug: '',
    },
  });

  useEffect(() => {
    if (userId) {
      fetchUserDetail();
      fetchSubscriptionPlans();
      fetchUserSubscription();
    }
  }, [userId]);

  const fetchSubscriptionPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
    }
  };

  const fetchUserSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      setSubscription(data);
      
      if (data) {
        // Find the corresponding plan
        const plan = plans.find(p => p.name === data.plan_name);
        planForm.reset({
          plan_id: plan?.id || '',
          status: data.status,
          payment_status: data.payment_status,
        });
      }
    } catch (error) {
      console.error('Error fetching user subscription:', error);
    }
  };

  // Refetch subscription when plans are loaded
  useEffect(() => {
    if (plans.length > 0 && userId) {
      fetchUserSubscription();
    }
  }, [plans, userId]);

  const fetchUserDetail = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          creator:created_by (
            name,
            email
          )
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Check permissions
      const isOwner = data.id === currentUser?.id;
      const isAdmin = currentUser?.role === 'admin';
      
      let isPartnerAndCreator = false;
      if (currentUser?.role === 'parceiro') {
        isPartnerAndCreator = data.created_by === currentUser.id;
      }

      if (!isOwner && !isAdmin && !isPartnerAndCreator) {
        setError('Você não tem permissão para visualizar este usuário.');
        return;
      }

      setUserDetail(data);
    } catch (error: any) {
      console.error('Error fetching user detail:', error);
      setError('Erro ao carregar dados do usuário');
      toast.error('Erro ao carregar dados do usuário');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSubmit = async (values: z.infer<typeof planFormSchema>) => {
    try {
      setSavingPlan(true);

      // Find the selected plan
      const selectedPlan = plans.find(p => p.id === values.plan_id);
      if (!selectedPlan) {
        toast.error('Plano selecionado não encontrado');
        return;
      }

      // Calculate next payment date based on plan duration
      const startDate = new Date();
      const nextPaymentDate = new Date(startDate);
      
      switch (selectedPlan.duration) {
        case 'Trimestral':
          nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 3);
          break;
        case 'Semestral':
          nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 6);
          break;
        case 'Anual':
          nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
          break;
      }

      const subscriptionData = {
        user_id: userId,
        plan_name: selectedPlan.name,
        monthly_price: selectedPlan.price,
        status: values.status,
        payment_status: values.payment_status,
        start_date: startDate.toISOString().split('T')[0],
        next_payment_date: nextPaymentDate.toISOString().split('T')[0],
      };

      if (subscription) {
        // Update existing subscription
        const { error } = await supabase
          .from('subscriptions')
          .update(subscriptionData)
          .eq('id', subscription.id);

        if (error) throw error;
      } else {
        // Create new subscription
        const { error } = await supabase
          .from('subscriptions')
          .insert(subscriptionData);

        if (error) throw error;
      }

      // Update user's plan_status
      const userPlanStatus = values.status === 'active' ? 'active' : 
                            values.status === 'suspended' ? 'suspended' : 'inactive';
      
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ plan_status: userPlanStatus })
        .eq('id', userId);

      if (userUpdateError) throw userUpdateError;

      toast.success('Plano do usuário atualizado com sucesso');
      
      // Refresh data
      await Promise.all([
        fetchUserDetail(),
        fetchUserSubscription()
      ]);
      
    } catch (error: any) {
      console.error('Error updating user plan:', error);
      toast.error('Erro ao atualizar plano do usuário');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleCloneUser = async (values: z.infer<typeof cloneUserFormSchema>) => {
    if (!userDetail) return;

    try {
      setCloning(true);

      console.log('Starting user cloning process...');
      
      const { newUserId } = await cloneUserAdmin(userDetail.id, {
        email: values.email,
        password: values.password,
        name: values.name,
        slug: values.slug,
      });

      console.log('User cloned successfully, syncing categories...');
      
      // Sync categories for the new user
      try {
        await syncUserCategoriesWithStorefrontSettings(newUserId);
        console.log('Categories synced successfully');
      } catch (syncError) {
        console.warn('Category sync warning (non-critical):', syncError);
      }

      toast.success('Usuário clonado com sucesso! Todos os dados, configurações e imagens foram copiados.');
      setShowCloneDialog(false);
      cloneForm.reset();
      
      // Redirect to the new user's detail page
      navigate(`/admin/users/${newUserId}`);
      
    } catch (error: any) {
      console.error('Error cloning user:', error);
      toast.error('Erro ao clonar usuário: ' + error.message);
    } finally {
      setCloning(false);
    }
  };

  const generateSlugFromName = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-5 w-5 text-primary" />;
      case 'parceiro':
        return <Users className="h-5 w-5 text-blue-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'parceiro':
        return 'Parceiro';
      default:
        return 'Vendedor';
    }
  };

  const handleGoBack = () => {
    navigate('/admin/users');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !userDetail) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={handleGoBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
        
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <h2 className="text-xl font-semibold mb-2">Erro ao carregar usuário</h2>
          <p className="text-muted-foreground mb-4">
            {error || 'Usuário não encontrado'}
          </p>
          <Button onClick={handleGoBack}>
            Voltar para lista de usuários
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={handleGoBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        
        {/* Clone User Buttons - Only for admins */}
        {currentUser?.role === 'admin' && (
          <>
            <Button
              variant="outline"
              onClick={() => setShowCloneCategoriesProductsDialog(true)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Receber Dados
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <Copy className="h-4 w-4 mr-2" />
                  Clonar Usuário Completo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clonar Usuário</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação criará uma cópia completa do usuário "{userDetail.name}" incluindo:
                    <br />• Perfil e configurações
                    <br />• Todas as categorias
                    <br />• Todos os produtos e suas imagens
                    <br />• Configurações da vitrine
                    <br />• Configurações de rastreamento
                    <br /><br />
                    O processo pode levar alguns minutos dependendo da quantidade de produtos e imagens.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => setShowCloneDialog(true)}>
                    Continuar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
        <h1 className="text-3xl font-bold">Detalhes do Usuário</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Profile Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={userDetail.avatar_url} alt={userDetail.name} />
                  <AvatarFallback className="text-2xl">
                    {getInitials(userDetail.name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <CardTitle className="text-xl">{userDetail.name}</CardTitle>
              <div className="flex items-center justify-center gap-2 mt-2">
                {getRoleIcon(userDetail.role)}
                <span className="text-sm text-muted-foreground">
                  {getRoleText(userDetail.role)}
                </span>
                {userDetail.is_blocked && (
                  <Badge variant="destructive" className="ml-2">Bloqueado</Badge>
                )}
              </div>
              {/* Plan Status */}
              <div className="mt-3">
                <PlanStatusBadge status={userDetail.plan_status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{userDetail.email}</span>
              </div>

              {userDetail.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formatPhone(userDetail.phone)}</span>
                </div>
              )}

              {userDetail.whatsapp && (
                <div className="flex items-center gap-3">
                  <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className="text-sm">{formatWhatsAppForDisplay(userDetail.whatsapp)}</span>
                </div>
              )}

              {userDetail.slug && (
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={`/${userDetail.slug}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    vitrineturbo.com/{userDetail.slug}
                  </a>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Cadastrado em {format(new Date(userDetail.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>

              {userDetail.creator && (
                <div>
                  <Separator className="my-4" />
                  <div className="text-sm">
                    <span className="text-muted-foreground">Criado por:</span>
                    <div className="mt-1">
                      <div className="font-medium">{userDetail.creator.name}</div>
                      <div className="text-muted-foreground">{userDetail.creator.email}</div>
                    </div>
                  </div>
                </div>
              )}

              {userDetail.bio && (
                <div>
                  <Separator className="my-4" />
                  <div className="text-sm">
                    <span className="text-muted-foreground">Biografia:</span>
                    <p className="mt-1">{userDetail.bio}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plan Management Card - Only for admin */}
          {currentUser?.role === 'admin' && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Gerenciamento de Plano
                </CardTitle>
              </CardHeader>
              <CardContent>
                {subscription && (
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm space-y-1">
                      <div><strong>Plano Atual:</strong> {subscription.plan_name}</div>
                      <div><strong>Valor:</strong> {formatCurrency(subscription.monthly_price)}</div>
                      <div><strong>Status:</strong> {subscription.status}</div>
                      <div><strong>Próximo Pagamento:</strong> {format(new Date(subscription.next_payment_date), "dd/MM/yyyy")}</div>
                    </div>
                  </div>
                )}

                <Form {...planForm}>
                  <form onSubmit={planForm.handleSubmit(handlePlanSubmit)} className="space-y-4">
                    <FormField
                      control={planForm.control}
                      name="plan_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plano de Assinatura</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um plano" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {plans.map((plan) => (
                                <SelectItem key={plan.id} value={plan.id}>
                                  {plan.name} - {formatCurrency(plan.price)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={planForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status da Assinatura</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Ativa</SelectItem>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="suspended">Suspensa</SelectItem>
                              <SelectItem value="cancelled">Cancelada</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={planForm.control}
                      name="payment_status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status do Pagamento</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status do pagamento" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="paid">Pago</SelectItem>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="overdue">Em Atraso</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Status do pagamento da assinatura
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={savingPlan}
                    >
                      {savingPlan ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {subscription ? 'Atualizar Plano' : 'Ativar Plano'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Statistics and Details */}
        <div className="lg:col-span-2">
          <UserStats userId={userDetail.id} />
        </div>
      </div>

      {/* Clone User Dialog */}
      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Usuário Clonado</DialogTitle>
            <DialogDescription>
              Configure os dados do novo usuário que será criado como cópia de "{userDetail?.name}"
            </DialogDescription>
          </DialogHeader>

          <Form {...cloneForm}>
            <form onSubmit={cloneForm.handleSubmit(handleCloneUser)} className="space-y-4">
              <FormField
                control={cloneForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Nome do novo usuário" 
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          // Auto-generate slug from name
                          if (!cloneForm.getValues('slug')) {
                            const slug = generateSlugFromName(e.target.value);
                            cloneForm.setValue('slug', slug);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={cloneForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email"
                        placeholder="email@exemplo.com" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={cloneForm.control}
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

              <FormField
                control={cloneForm.control}
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
                control={cloneForm.control}
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

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Atenção:</strong> O processo de clonagem pode levar alguns minutos para ser concluído, 
                  especialmente se o usuário tiver muitos produtos e imagens. Todas as imagens serão copiadas 
                  para novos arquivos para evitar conflitos.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCloneDialog(false);
                    cloneForm.reset();
                    setShowPassword(false);
                    setShowConfirmPassword(false);
                  }}
                  disabled={cloning}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={cloning}>
                  {cloning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {cloning ? 'Clonando...' : 'Clonar Usuário'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Clone Categories and Products Dialog */}
      <CloneCategoriesProductsDialog
        open={showCloneCategoriesProductsDialog}
        onOpenChange={(open) => {
          setShowCloneCategoriesProductsDialog(open);
          if (!open) {
            // Refresh user data after closing
            fetchUserDetail();
          }
        }}
        defaultTargetUserId={userDetail?.id}
      />
    </div>
  );
}