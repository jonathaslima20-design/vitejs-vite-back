import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  Copy, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Loader2, 
  ExternalLink,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Gift,
  AlertTriangle,
  Crown,
  Share2,
  Target,
  Zap,
  ArrowRight,
  Sparkles,
  Star
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ReferralCommission, WithdrawalRequest, UserPixKey, ReferralStats } from '@/types';
import SubscriptionModal from '@/components/subscription/SubscriptionModal';

const pixKeyFormSchema = z.object({
  pix_key: z.string().min(1, 'Chave PIX é obrigatória'),
  pix_key_type: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']),
  holder_name: z.string().min(1, 'Nome do titular é obrigatório'),
});

const withdrawalFormSchema = z.object({
  amount: z.string()
    .min(1, 'Valor é obrigatório')
    .refine(val => {
      const num = parseFloat(val.replace(',', '.'));
      return !isNaN(num) && num >= 50;
    }, 'Valor mínimo para saque é R$ 50,00'),
});

export default function ReferralPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    activeReferrals: 0,
    totalCommissions: 0,
    pendingCommissions: 0,
    paidCommissions: 0,
    availableForWithdrawal: 0,
  });
  const [commissions, setCommissions] = useState<ReferralCommission[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [pixKey, setPixKey] = useState<UserPixKey | null>(null);
  const [showPixDialog, setShowPixDialog] = useState(false);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPlanRequiredModal, setShowPlanRequiredModal] = useState(false);

  const pixKeyForm = useForm<z.infer<typeof pixKeyFormSchema>>({
    resolver: zodResolver(pixKeyFormSchema),
    defaultValues: {
      pix_key: '',
      pix_key_type: 'cpf',
      holder_name: '',
    },
  });

  const withdrawalForm = useForm<z.infer<typeof withdrawalFormSchema>>({
    resolver: zodResolver(withdrawalFormSchema),
    defaultValues: {
      amount: '',
    },
  });

  useEffect(() => {
    if (user?.id) {
      loadReferralData();
    }
  }, [user?.id]);

  const loadReferralData = async () => {
    try {
      setLoading(true);

      // Carregar comissões
      const { data: commissionsData, error: commissionsError } = await supabase
        .from('referral_commissions')
        .select(`
          *,
          referred_user:users!referred_user_id(name, email),
          subscription:subscriptions(plan_name, status)
        `)
        .eq('referrer_id', user?.id)
        .order('created_at', { ascending: false });

      if (commissionsError) throw commissionsError;
      setCommissions(commissionsData || []);

      // Carregar solicitações de saque
      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (withdrawalsError) throw withdrawalsError;
      setWithdrawals(withdrawalsData || []);

      // Carregar chave PIX
      const { data: pixData, error: pixError } = await supabase
        .from('user_pix_keys')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (pixError && pixError.code !== 'PGRST116') throw pixError;
      setPixKey(pixData);

      // Calcular estatísticas
      const totalCommissions = commissionsData?.reduce((sum, c) => sum + c.amount, 0) || 0;
      const pendingCommissions = commissionsData?.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0) || 0;
      const paidCommissions = commissionsData?.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0) || 0;
      
      // Calcular valor disponível para saque (comissões pendentes - saques pendentes/aprovados)
      const pendingWithdrawals = withdrawalsData?.filter(w => w.status === 'pending' || w.status === 'approved').reduce((sum, w) => sum + w.amount, 0) || 0;
      const availableForWithdrawal = Math.max(0, pendingCommissions - pendingWithdrawals);

      setStats({
        totalReferrals: commissionsData?.length || 0,
        activeReferrals: commissionsData?.filter(c => c.subscription?.status === 'active').length || 0,
        totalCommissions,
        pendingCommissions,
        paidCommissions,
        availableForWithdrawal,
      });

    } catch (error) {
      console.error('Error loading referral data:', error);
      toast.error('Erro ao carregar dados de indicação');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = async () => {
    // Verificar se o usuário tem plano ativo
    if (user?.plan_status !== 'active') {
      setShowPlanRequiredModal(true);
      return;
    }
    
    const referralLink = `${window.location.origin}/register?ref=${user?.referral_code}`;
    
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success('Link de indicação copiado!');
    } catch (error) {
      toast.error('Erro ao copiar link');
    }
  };

  const handlePixKeySubmit = async (values: z.infer<typeof pixKeyFormSchema>) => {
    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('user_pix_keys')
        .upsert({
          user_id: user?.id,
          pix_key: values.pix_key,
          pix_key_type: values.pix_key_type,
          holder_name: values.holder_name,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast.success('Chave PIX salva com sucesso!');
      setShowPixDialog(false);
      loadReferralData();
    } catch (error) {
      console.error('Error saving PIX key:', error);
      toast.error('Erro ao salvar chave PIX');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawalSubmit = async (values: z.infer<typeof withdrawalFormSchema>) => {
    try {
      setSubmitting(true);

      if (!pixKey) {
        toast.error('Configure sua chave PIX antes de solicitar um saque');
        return;
      }

      const amount = parseFloat(values.amount.replace(',', '.'));
      
      if (amount > stats.availableForWithdrawal) {
        toast.error('Valor solicitado maior que o disponível para saque');
        return;
      }

      const { error } = await supabase
        .from('withdrawal_requests')
        .insert({
          user_id: user?.id,
          amount,
          pix_key: pixKey.pix_key,
          pix_key_type: pixKey.pix_key_type,
          holder_name: pixKey.holder_name,
          status: 'pending',
        });

      if (error) throw error;

      toast.success('Solicitação de saque enviada com sucesso!');
      setShowWithdrawalDialog(false);
      withdrawalForm.reset();
      loadReferralData();
    } catch (error) {
      console.error('Error creating withdrawal request:', error);
      toast.error('Erro ao solicitar saque');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string, type: 'commission' | 'withdrawal') => {
    if (type === 'commission') {
      switch (status) {
        case 'pending':
          return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
        case 'paid':
          return <Badge className="bg-green-500">Paga</Badge>;
        default:
          return <Badge variant="outline">{status}</Badge>;
      }
    } else {
      switch (status) {
        case 'pending':
          return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
        case 'approved':
          return <Badge className="bg-blue-500">Aprovado</Badge>;
        case 'paid':
          return <Badge className="bg-green-500">Pago</Badge>;
        case 'rejected':
          return <Badge variant="destructive">Rejeitado</Badge>;
        default:
          return <Badge variant="outline">{status}</Badge>;
      }
    }
  };

  const getPixKeyTypeLabel = (type: string) => {
    switch (type) {
      case 'cpf': return 'CPF';
      case 'cnpj': return 'CNPJ';
      case 'email': return 'E-mail';
      case 'phone': return 'Telefone';
      case 'random': return 'Chave Aleatória';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="relative bg-muted/50 rounded-3xl p-8 mb-8 border">
          <div className="absolute top-4 right-4 opacity-10">
            <Sparkles className="h-16 w-16 text-primary" />
          </div>
          <div className="absolute bottom-4 left-4 opacity-10">
            <Gift className="h-12 w-12 text-primary" />
          </div>
          
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-full mb-4 shadow-lg">
              <Gift className="h-10 w-10 text-white" />
            </div>
          </motion.div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Indique e Ganhe
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Compartilhe o VitrineTurbo com amigos e ganhe <span className="font-bold text-primary">até R$ 100</span> por cada indicação que ativar um plano
          </p>
        </div>
      </motion.div>

      {/* Aviso para usuários sem plano ativo */}
      {user?.plan_status !== 'active' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="mb-8 border-destructive/20 bg-destructive/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-6 w-6 text-destructive mt-1 flex-shrink-0" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">
                    Plano Ativo Necessário
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Para participar do programa "Indique e Ganhe", você precisa ter um plano ativo na plataforma. 
                    Ative seu plano para começar a indicar amigos e ganhar comissões.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowPlanRequiredModal(true)}
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Ver Planos Disponíveis
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Cards de Estatísticas */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12"
      >
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Indicações</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalReferrals}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeReferrals} com planos ativos
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Comissões Totais</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{formatCurrency(stats.totalCommissions)}</div>
            <p className="text-xs text-muted-foreground">
              Valor total gerado
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Disponível para Saque</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(stats.availableForWithdrawal)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pronto para retirada
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Comissões Pagas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{formatCurrency(stats.paidCommissions)}</div>
            <p className="text-xs text-muted-foreground">
              Já recebidas
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Link de Indicação */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-12"
      >
        <Card className="bg-muted/30 border shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold flex items-center justify-center gap-2">
              <Share2 className="h-6 w-6 text-primary" />
              Seu Link de Indicação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-3 p-1 bg-background rounded-lg border shadow-inner">
              <Input
                value={user?.plan_status === 'active' 
                  ? `${window.location.origin}/register?ref=${user?.referral_code}`
                  : 'Ative seu plano para liberar o link de indicação'
                }
                readOnly
                className={`font-mono text-sm border-0 bg-transparent ${
                  user?.plan_status !== 'active' ? 'text-muted-foreground bg-muted' : ''
                }`}
                disabled={user?.plan_status !== 'active'}
              />
              <Button 
                onClick={copyReferralLink}
                disabled={user?.plan_status !== 'active'}
                className="shadow-md hover:shadow-lg transition-all"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </div>
            
            {/* Como Funciona - Visual Flow */}
            <div className="bg-card p-6 rounded-xl border">
              <h4 className="font-bold text-lg mb-6 text-center flex items-center justify-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Como Funciona
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Passo 1 */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Share2 className="h-8 w-8 text-white" />
                  </div>
                  <h5 className="font-semibold mb-2">1. Compartilhe</h5>
                  <p className="text-sm text-muted-foreground">
                    Envie seu link de indicação para amigos e conhecidos
                  </p>
                </motion.div>

                {/* Passo 2 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Users className="h-8 w-8 text-secondary-foreground" />
                  </div>
                  <h5 className="font-semibold mb-2">2. Eles se Cadastram</h5>
                  <p className="text-sm text-muted-foreground">
                    Seus amigos criam conta e ativam um plano
                  </p>
                </motion.div>

                {/* Passo 3 */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <DollarSign className="h-8 w-8 text-accent-foreground" />
                  </div>
                  <h5 className="font-semibold mb-2">3. Você Ganha</h5>
                  <p className="text-sm text-muted-foreground">
                    Receba sua comissão automaticamente
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Valores de Comissão */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 }}
                className="bg-primary text-primary-foreground p-4 rounded-xl text-center shadow-lg hover:shadow-xl transition-all"
              >
                <Zap className="h-6 w-6 mx-auto mb-2" />
                <div className="text-2xl font-bold">R$ 50</div>
                <div className="text-sm opacity-90">Plano Trimestral</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.0 }}
                className="bg-secondary text-secondary-foreground p-4 rounded-xl text-center shadow-lg hover:shadow-xl transition-all"
              >
                <Crown className="h-6 w-6 mx-auto mb-2" />
                <div className="text-2xl font-bold">R$ 70</div>
                <div className="text-sm opacity-90">Plano Semestral</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.1 }}
                className="bg-accent text-accent-foreground p-4 rounded-xl text-center shadow-lg hover:shadow-xl transition-all"
              >
                <TrendingUp className="h-6 w-6 mx-auto mb-2" />
                <div className="text-2xl font-bold">R$ 100</div>
                <div className="text-sm opacity-90">Plano Anual</div>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Configuração PIX e Saque */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
      >
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Chave PIX
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pixKey ? (
              <div className="space-y-3">
                <div className="p-4 bg-muted/50 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">PIX Configurado</span>
                  </div>
                  <div className="text-sm font-medium">{getPixKeyTypeLabel(pixKey.pix_key_type)}</div>
                  <div className="font-mono text-sm">{pixKey.pix_key}</div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setShowPixDialog(true)}
                  className="w-full"
                >
                  Alterar Chave PIX
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-muted/50 border rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Configure sua chave PIX para receber os saques
                  </p>
                </div>
                <Button 
                  onClick={() => setShowPixDialog(true)}
                  className="w-full"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Configurar PIX
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Solicitar Saque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-4 bg-muted/50 border rounded-lg text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {formatCurrency(stats.availableForWithdrawal)}
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  Disponível para saque
                </p>
              </div>
              <Button 
                onClick={() => setShowWithdrawalDialog(true)}
                disabled={!pixKey || stats.availableForWithdrawal < 50}
                className="w-full"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Solicitar Saque
              </Button>
              {!pixKey && (
                <p className="text-xs text-muted-foreground text-center bg-muted/50 p-2 rounded">
                  Configure sua chave PIX primeiro
                </p>
              )}
              {stats.availableForWithdrawal < 50 && (
                <p className="text-xs text-muted-foreground text-center bg-muted/50 p-2 rounded">
                  Valor mínimo para saque: R$ 50,00
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs com Histórico */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Tabs defaultValue="commissions" className="w-full">
          <TabsList>
            <TabsTrigger value="commissions">Comissões</TabsTrigger>
            <TabsTrigger value="withdrawals">Saques</TabsTrigger>
          </TabsList>

          <TabsContent value="commissions" className="mt-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Histórico de Comissões</CardTitle>
              </CardHeader>
              <CardContent>
                {commissions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Nenhuma indicação ainda</h3>
                    <p className="text-muted-foreground">
                      Compartilhe seu link de indicação para começar a ganhar comissões
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={copyReferralLink}
                      disabled={user?.plan_status !== 'active'}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar Link de Indicação
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário Indicado</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead>Comissão</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissions.map((commission) => (
                          <TableRow key={commission.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{commission.referred_user?.name}</div>
                                <div className="text-sm text-muted-foreground">{commission.referred_user?.email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{commission.plan_type}</Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-primary">
                              {formatCurrency(commission.amount)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(commission.status, 'commission')}
                            </TableCell>
                            <TableCell>
                              {format(new Date(commission.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals" className="mt-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Histórico de Saques</CardTitle>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <DollarSign className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Nenhum saque solicitado</h3>
                    <p className="text-muted-foreground">
                      Suas solicitações de saque aparecerão aqui
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Valor</TableHead>
                          <TableHead>Chave PIX</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data Solicitação</TableHead>
                          <TableHead>Data Processamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {withdrawals.map((withdrawal) => (
                          <TableRow key={withdrawal.id}>
                            <TableCell className="font-semibold">
                              {formatCurrency(withdrawal.amount)}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-mono text-sm">{withdrawal.pix_key}</div>
                                <div className="text-xs text-muted-foreground">
                                  {getPixKeyTypeLabel(withdrawal.pix_key_type)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(withdrawal.status, 'withdrawal')}
                            </TableCell>
                            <TableCell>
                              {format(new Date(withdrawal.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              {withdrawal.processed_at 
                                ? format(new Date(withdrawal.processed_at), "dd/MM/yyyy", { locale: ptBR })
                                : '-'
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Dialog para Configurar PIX */}
      <Dialog open={showPixDialog} onOpenChange={setShowPixDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Chave PIX</DialogTitle>
            <DialogDescription>
              Configure sua chave PIX para receber os saques das comissões
            </DialogDescription>
          </DialogHeader>

          <Form {...pixKeyForm}>
            <form onSubmit={pixKeyForm.handleSubmit(handlePixKeySubmit)} className="space-y-4">
              <FormField
                control={pixKeyForm.control}
                name="pix_key_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Chave PIX</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="phone">Telefone</SelectItem>
                        <SelectItem value="random">Chave Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={pixKeyForm.control}
                name="pix_key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chave PIX</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Digite sua chave PIX" 
                        {...field} 
                        defaultValue={pixKey?.pix_key || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Digite a chave PIX conforme o tipo selecionado
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={pixKeyForm.control}
                name="holder_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Titular</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Nome completo do titular da conta" 
                        {...field} 
                        defaultValue={pixKey?.holder_name || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Nome do titular da conta PIX
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowPixDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog para Solicitar Saque */}
      <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Saque</DialogTitle>
            <DialogDescription>
              Solicite o saque das suas comissões acumuladas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm">Disponível para saque:</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(stats.availableForWithdrawal)}
                </span>
              </div>
              {pixKey && (
                <div className="mt-2 pt-2 border-t">
                  <div className="text-xs text-muted-foreground">
                    PIX: {pixKey.pix_key} ({getPixKeyTypeLabel(pixKey.pix_key_type)})
                  </div>
                </div>
              )}
            </div>

            <Form {...withdrawalForm}>
              <form onSubmit={withdrawalForm.handleSubmit(handleWithdrawalSubmit)} className="space-y-4">
                <FormField
                  control={withdrawalForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor do Saque (R$)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          step="0.01"
                          min="50"
                          max={stats.availableForWithdrawal}
                          placeholder="50.00"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Valor mínimo: R$ 50,00 | Máximo disponível: {formatCurrency(stats.availableForWithdrawal)}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowWithdrawalDialog(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting || !pixKey}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Solicitar Saque
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Plano Ativo Necessário */}
      <Dialog open={showPlanRequiredModal} onOpenChange={setShowPlanRequiredModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Plano Ativo Necessário
            </DialogTitle>
            <DialogDescription>
              Para participar do programa "Indique e Ganhe", você precisa ter um plano ativo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold text-sm">Por que preciso de um plano ativo?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Garante que você é um usuário engajado da plataforma</li>
                <li>• Permite que você conheça todos os recursos antes de indicar</li>
                <li>• Assegura a qualidade das indicações</li>
              </ul>
            </div>

            <Separator />

            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold text-sm">Benefícios do Programa:</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-card rounded-lg shadow-sm border">
                  <span className="text-sm">Comissão Plano Trimestral</span>
                  <Badge className="bg-primary text-primary-foreground">R$ 50,00</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-card rounded-lg shadow-sm border">
                  <span className="text-sm">Comissão Plano Semestral</span>
                  <Badge className="bg-secondary text-secondary-foreground">R$ 70,00</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-card rounded-lg shadow-sm border">
                  <span className="text-sm">Comissão Plano Anual</span>
                  <Badge className="bg-accent text-accent-foreground">R$ 100,00</Badge>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowPlanRequiredModal(false)}
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
            <Button 
              onClick={() => {
                setShowPlanRequiredModal(false);
                // Aqui você pode adicionar navegação para página de planos se existir
                // navigate('/plans') ou abrir modal de assinatura
              }}
              className="w-full sm:w-auto"
            >
              <Crown className="h-4 w-4 mr-2" />
              Ver Planos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Modal */}
      <SubscriptionModal
        open={showPlanRequiredModal}
        onOpenChange={setShowPlanRequiredModal}
      />
    </div>
  );
}