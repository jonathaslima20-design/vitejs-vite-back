import { useState, useEffect } from 'react';
import { Plus, Search, Loader as Loader2, DollarSign, Calendar, CreditCard, CircleAlert as AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency as formatCurrencyUtil } from '@/lib/utils';
import type { Subscription, Payment, WithdrawalRequest } from '@/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { format as formatDate, subMonths, startOfMonth, endOfMonth } from 'date-fns';

// Helper function to format currency with BRL default for admin pages
const formatCurrency = (value: number) => formatCurrencyUtil(value, 'BRL', 'pt-BR');

interface MonthlyStats {
  name: string;
  items: number;
  users: number;
}

interface LeadsBySource {
  source: string;
  count: number;
}

const subscriptionFormSchema = z.object({
  user_id: z.string().min(1, 'Usuário é obrigatório'),
  plan_name: z.string().min(1, 'Nome do plano é obrigatório'),
  monthly_price: z.string().min(1, 'Valor é obrigatório'),
  billing_cycle: z.enum(['monthly', 'quarterly', 'semiannually', 'annually']).default('monthly'),
  status: z.enum(['active', 'pending', 'cancelled', 'suspended']),
  payment_status: z.enum(['paid', 'pending', 'overdue']),
  start_date: z.string().min(1, 'Data de início é obrigatória'),
  next_payment_date: z.string().min(1, 'Próximo pagamento é obrigatório'),
});

const paymentFormSchema = z.object({
  subscription_id: z.string().min(1, 'Assinatura é obrigatória'),
  amount: z.string().min(1, 'Valor é obrigatório'),
  payment_date: z.string().min(1, 'Data do pagamento é obrigatória'),
  payment_method: z.string().min(1, 'Método de pagamento é obrigatório'),
  status: z.enum(['completed', 'pending', 'failed', 'refunded']),
  notes: z.string().optional(),
});

export default function FinancialPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const { user: currentUser } = useAuth();
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [leadsBySource, setLeadsBySource] = useState<LeadsBySource[]>([]);

  const subscriptionForm = useForm<z.infer<typeof subscriptionFormSchema>>({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: {
      plan_name: 'Plano Básico',
      monthly_price: '29.90',
      billing_cycle: 'monthly',
      status: 'active',
      payment_status: 'paid',
    },
  });

  const paymentForm = useForm<z.infer<typeof paymentFormSchema>>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      payment_method: 'PIX',
      status: 'completed',
    },
  });

  useEffect(() => {
    fetchData();
    fetchStats();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchSubscriptions(),
        fetchPayments(),
        fetchWithdrawalRequests(),
        fetchUsers(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptions = async () => {
    let query = supabase
      .from('subscriptions')
      .select(`
        *,
        user:users(name, email)
      `)
      .order('created_at', { ascending: false });

    if (currentUser?.role === 'parceiro') {
      query = query.eq('users.created_by', currentUser.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    setSubscriptions(data || []);
  };

  const fetchPayments = async () => {
    let query = supabase
      .from('payments')
      .select(`
        *,
        subscription:subscriptions(
          user:users(name, email)
        )
      `)
      .order('payment_date', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    setPayments(data || []);
  };

  const fetchUsers = async () => {
    let query = supabase
      .from('users')
      .select('id, name, email')
      .eq('role', 'corretor')
      .order('name');

    if (currentUser?.role === 'parceiro') {
      query = query.eq('created_by', currentUser.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    setUsers(data || []);
  };

  const fetchWithdrawalRequests = async () => {
    let query = supabase
      .from('withdrawal_requests')
      .select(`
        *,
        user:users(name, email)
      `)
      .order('created_at', { ascending: false });

    if (currentUser?.role === 'parceiro') {
      // Para parceiros, mostrar apenas saques de usuários que eles criaram
      const { data: partnerUsers } = await supabase
        .from('users')
        .select('id')
        .eq('created_by', currentUser.id);
      
      const userIds = partnerUsers?.map(u => u.id) || [];
      if (userIds.length > 0) {
        query = query.in('user_id', userIds);
      } else {
        // Se não tem usuários, retornar array vazio
        setWithdrawalRequests([]);
        return;
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    setWithdrawalRequests(data || []);
  };

  const fetchStats = async () => {
    try {
      const stats: MonthlyStats[] = [];
      const today = new Date();

      // Get stats for the last 6 months
      for (let i = 0; i < 6; i++) {
        const currentMonth = subMonths(today, i);
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);

        // Get users created in this month
        let usersQuery = supabase
          .from('users')
          .select('id, niche_type', { count: 'exact', head: true })
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());

        // If partner, only count users they created
        if (currentUser?.role === 'parceiro') {
          usersQuery = usersQuery.eq('created_by', currentUser.id);
        }

        const { count: usersCount, data: usersData } = await usersQuery;

        // Count items for each niche type
        let totalItems = 0;

        for (const userData of usersData || []) {
          let itemCount = 0;
          
          switch (userData.niche_type) {
            case 'imoveis':
              const { count: propertiesCount } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userData.id)
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString());
              itemCount = propertiesCount || 0;
              break;
              
            case 'veiculos':
              const { count: carsCount } = await supabase
                .from('cars')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userData.id)
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString());
              itemCount = carsCount || 0;
              break;
              
            case 'diversos':
              const { count: productsCount } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userData.id)
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString());
              itemCount = productsCount || 0;
              break;
          }
          
          totalItems += itemCount;
        }

        stats.unshift({
          name: formatDate(currentMonth, 'MMM', { locale: ptBR }),
          items: totalItems,
          users: usersCount || 0,
        });
      }

      setMonthlyStats(stats);

      // Fetch leads by source
      let userIds: string[] = [];
      
      if (currentUser?.role === 'parceiro') {
        const { data: partnerUsers } = await supabase
          .from('users')
          .select('id')
          .eq('created_by', currentUser.id);
        userIds = partnerUsers?.map(u => u.id) || [];
      } else {
        const { data: allUsers } = await supabase
          .from('users')
          .select('id');
        userIds = allUsers?.map(u => u.id) || [];
      }

      if (userIds.length > 0) {
        // Get all products for these users
        const { data: products } = await supabase
          .from('products')
          .select('id')
          .in('user_id', userIds);

        const productIds = products?.map(p => p.id) || [];

        if (productIds.length > 0) {
          // Split productIds into smaller chunks to avoid URL length limits
          const chunkSize = 50;
          const chunks = [];
          for (let i = 0; i < productIds.length; i += chunkSize) {
            chunks.push(productIds.slice(i, i + chunkSize));
          }

          // Fetch leads data in chunks and combine results
          let leadSourceData: any[] = [];
          for (const chunk of chunks) {
            const { data } = await supabase
              .from('leads')
              .select('source')
              .in('property_id', chunk);
            
            if (data) {
              leadSourceData = leadSourceData.concat(data);
            }
          }

          const sourceCount = leadSourceData?.reduce((acc, curr) => {
            const source = curr.source || 'form';
            const mappedSource = source.includes('whatsapp') || source.includes('contact_sidebar') || source.includes('header_social') 
              ? 'WhatsApp' 
              : source === 'form' 
                ? 'Formulário' 
                : source;
            acc[mappedSource] = (acc[mappedSource] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          setLeadsBySource(
            Object.entries(sourceCount || {}).map(([source, count]) => ({
              source,
              count,
            }))
          );
        }
      }

    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCreateSubscription = async (values: z.infer<typeof subscriptionFormSchema>) => {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: values.user_id,
          plan_name: values.plan_name,
          monthly_price: parseFloat(values.monthly_price),
          billing_cycle: values.billing_cycle,
          status: values.status,
          payment_status: values.payment_status,
          start_date: values.start_date,
          next_payment_date: values.next_payment_date,
        });

      if (error) throw error;

      toast.success('Assinatura criada com sucesso');
      setShowSubscriptionDialog(false);
      subscriptionForm.reset();
      fetchSubscriptions();
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast.error('Erro ao criar assinatura');
    }
  };

  const handleUpdateSubscription = async (values: z.infer<typeof subscriptionFormSchema>) => {
    if (!editingSubscription) return;

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan_name: values.plan_name,
          monthly_price: parseFloat(values.monthly_price),
          billing_cycle: values.billing_cycle,
          status: values.status,
          payment_status: values.payment_status,
          start_date: values.start_date,
          next_payment_date: values.next_payment_date,
        })
        .eq('id', editingSubscription.id);

      if (error) throw error;

      toast.success('Assinatura atualizada com sucesso');
      setShowSubscriptionDialog(false);
      setEditingSubscription(null);
      subscriptionForm.reset();
      fetchSubscriptions();
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Erro ao atualizar assinatura');
    }
  };

  const handleCreatePayment = async (values: z.infer<typeof paymentFormSchema>) => {
    try {
      const { error } = await supabase
        .from('payments')
        .insert({
          subscription_id: values.subscription_id,
          amount: parseFloat(values.amount),
          payment_date: values.payment_date,
          payment_method: values.payment_method,
          status: values.status,
          notes: values.notes,
        });

      if (error) throw error;

      // Update subscription payment status if payment is completed
      if (values.status === 'completed') {
        // Calcular próxima data de pagamento (30 dias a partir da data do pagamento)
        const paymentDate = new Date(values.payment_date);
        const nextPaymentDate = new Date(paymentDate);
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        
        await supabase
          .from('subscriptions')
          .update({
            payment_status: 'paid',
            status: 'active', // Ativar assinatura quando pagamento é confirmado
            next_payment_date: nextPaymentDate.toISOString().split('T')[0]
          })
          .eq('id', values.subscription_id);
      }

      toast.success('Pagamento registrado com sucesso');
      setShowPaymentDialog(false);
      paymentForm.reset();
      fetchPayments();
      fetchSubscriptions();
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Erro ao registrar pagamento');
    }
  };

  const openEditSubscription = (subscription: Subscription) => {
    setEditingSubscription(subscription);
  const handleWithdrawalAction = async (withdrawalId: string, action: 'approve' | 'reject', notes?: string) => {
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({
          status: newStatus,
          admin_notes: notes,
          processed_at: new Date().toISOString(),
          processed_by: currentUser?.id,
        })
        .eq('id', withdrawalId);

      if (error) throw error;

      toast.success(`Solicitação ${action === 'approve' ? 'aprovada' : 'rejeitada'} com sucesso`);
      fetchWithdrawalRequests();
    } catch (error) {
      console.error('Error updating withdrawal request:', error);
      toast.error('Erro ao processar solicitação');
    }
  };

    subscriptionForm.reset({
      user_id: subscription.user_id,
      plan_name: subscription.plan_name,
      monthly_price: subscription.monthly_price.toString(),
      status: subscription.status,
      payment_status: subscription.payment_status,
      start_date: subscription.start_date,
      next_payment_date: subscription.next_payment_date,
    });
    setShowSubscriptionDialog(true);
  };

  const getStatusBadge = (status: string, type: 'subscription' | 'payment') => {
    if (type === 'subscription') {
      switch (status) {
        case 'active':
          return <Badge className="bg-green-500">Ativa</Badge>;
        case 'pending':
          return <Badge variant="secondary">Pendente</Badge>;
        case 'suspended':
          return <Badge variant="destructive">Suspensa</Badge>;
        case 'cancelled':
          return <Badge variant="outline">Cancelada</Badge>;
        default:
          return <Badge variant="secondary">{status}</Badge>;
      }
    } else {
      switch (status) {
        case 'paid':
        case 'completed':
          return <Badge className="bg-green-500">Pago</Badge>;
        case 'pending':
          return <Badge variant="secondary">Pendente</Badge>;
        case 'overdue':
        case 'failed':
          return <Badge variant="destructive">Em Atraso</Badge>;
        case 'refunded':
          return <Badge variant="outline">Reembolsado</Badge>;
        default:
          return <Badge variant="secondary">{status}</Badge>;
      }
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub =>
    sub.user?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.user?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.plan_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPayments = payments.filter(payment =>
    payment.subscription?.user?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    payment.subscription?.user?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    payment.payment_method.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate statistics
  const totalRevenue = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;
  const overduePayments = subscriptions.filter(s => s.payment_status === 'overdue').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Controle Financeiro</h1>
        <div className="flex gap-2">
          <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <CreditCard className="h-4 w-4 mr-2" />
                Registrar Pagamento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Pagamento</DialogTitle>
                <DialogDescription>
                  Registre um novo pagamento de assinatura
                </DialogDescription>
              </DialogHeader>
              <Form {...paymentForm}>
                <form onSubmit={paymentForm.handleSubmit(handleCreatePayment)} className="space-y-4">
                  <FormField
                    control={paymentForm.control}
                    name="subscription_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assinatura</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a assinatura" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {subscriptions.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id}>
                                {sub.user?.name} - {sub.plan_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={subscriptionForm.control}
                    name="billing_cycle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciclo de Cobrança</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="quarterly">Trimestral</SelectItem>
                            <SelectItem value="semiannually">Semestral</SelectItem>
                            <SelectItem value="annually">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={paymentForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor (R$)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="payment_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data do Pagamento</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={paymentForm.control}
                      name="payment_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Método de Pagamento</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="PIX">PIX</SelectItem>
                              <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                              <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                              <SelectItem value="Boleto">Boleto</SelectItem>
                              <SelectItem value="Transferência">Transferência</SelectItem>
                              <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="completed">Concluído</SelectItem>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="failed">Falhou</SelectItem>
                              <SelectItem value="refunded">Reembolsado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={paymentForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowPaymentDialog(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">Registrar Pagamento</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Assinatura
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSubscription ? 'Editar Assinatura' : 'Nova Assinatura'}
                </DialogTitle>
                <DialogDescription>
                  {editingSubscription ? 'Edite os dados da assinatura' : 'Crie uma nova assinatura para um usuário'}
                </DialogDescription>
              </DialogHeader>
              <Form {...subscriptionForm}>
                <form onSubmit={subscriptionForm.handleSubmit(editingSubscription ? handleUpdateSubscription : handleCreateSubscription)} className="space-y-4">
                  {!editingSubscription && (
                    <FormField
                      control={subscriptionForm.control}
                      name="user_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usuário</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o usuário" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {users.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.name} - {user.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={subscriptionForm.control}
                      name="plan_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Plano</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={subscriptionForm.control}
                      name="monthly_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor Mensal (R$)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={subscriptionForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status da Assinatura</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
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
                      control={subscriptionForm.control}
                      name="payment_status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status do Pagamento</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="paid">Pago</SelectItem>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="overdue">Em Atraso</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={subscriptionForm.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Início</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={subscriptionForm.control}
                      name="next_payment_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Próximo Pagamento</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => {
                      setShowSubscriptionDialog(false);
                      setEditingSubscription(null);
                      subscriptionForm.reset();
                    }}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingSubscription ? 'Atualizar' : 'Criar'} Assinatura
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Pagamentos confirmados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Usuários ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pagamentos em Atraso</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overduePayments}</div>
            <p className="text-xs text-muted-foreground">Requer atenção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Assinaturas</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.length}</div>
            <p className="text-xs text-muted-foreground">Todas as assinaturas</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuário, plano ou método..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="subscriptions" className="w-full">
        <TabsList>
          <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          <TabsTrigger value="withdrawals">Saques</TabsTrigger>
          <TabsTrigger value="statistics">Estatísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Assinaturas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Ciclo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Próximo Pagamento</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptions.map((subscription) => (
                      <TableRow key={subscription.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{subscription.user?.name}</div>
                            <div className="text-sm text-muted-foreground">{subscription.user?.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{subscription.plan_name}</TableCell>
                        <TableCell>{formatCurrency(subscription.monthly_price)}</TableCell>
                        <TableCell>
                          {subscription.billing_cycle ? getBillingCycleLabel(subscription.billing_cycle) : 'Mensal'}
                        </TableCell>
                        <TableCell>{getStatusBadge(subscription.status, 'subscription')}</TableCell>
                        <TableCell>{getStatusBadge(subscription.payment_status, 'payment')}</TableCell>
                        <TableCell>
                          {format(new Date(subscription.next_payment_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditSubscription(subscription)}
                          >
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Pagamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{payment.subscription?.user?.name}</div>
                            <div className="text-sm text-muted-foreground">{payment.subscription?.user?.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>
                          {format(new Date(payment.payment_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{payment.payment_method}</TableCell>
                        <TableCell>{getStatusBadge(payment.status, 'payment')}</TableCell>
                        <TableCell className="max-w-xs truncate">{payment.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Saque</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Chave PIX</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Solicitação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawalRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhuma solicitação de saque encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      withdrawalRequests.map((withdrawal) => (
                        <TableRow key={withdrawal.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{withdrawal.user?.name}</div>
                              <div className="text-sm text-muted-foreground">{withdrawal.user?.email}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(withdrawal.amount)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-mono text-sm">{withdrawal.pix_key}</div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {withdrawal.pix_key_type}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(withdrawal.status, 'payment')}
                          </TableCell>
                          <TableCell>
                            {format(new Date(withdrawal.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            {withdrawal.status === 'pending' && (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleWithdrawalAction(withdrawal.id, 'approve')}
                                >
                                  Aprovar
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleWithdrawalAction(withdrawal.id, 'reject')}
                                >
                                  Rejeitar
                                </Button>
                              </div>
                            )}
                            {withdrawal.status === 'approved' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleWithdrawalAction(withdrawal.id, 'approve', 'Pagamento processado')}
                              >
                                Marcar como Pago
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="mt-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Crescimento Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="items"
                        stroke="#8884d8"
                        name="Itens"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="users"
                        stroke="#82ca9d"
                        name="Usuários"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leads por Origem</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leadsBySource}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="source" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" name="Leads" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}