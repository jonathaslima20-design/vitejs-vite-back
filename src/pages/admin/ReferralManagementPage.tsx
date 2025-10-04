import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Loader2, Search, DollarSign, Users, TrendingUp, Gift, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import type { ReferralCommission, WithdrawalRequest } from '@/types';

export default function ReferralManagementPage() {
  const [commissions, setCommissions] = useState<ReferralCommission[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchCommissions(),
        fetchWithdrawals(),
      ]);
    } catch (error) {
      console.error('Error fetching referral data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommissions = async () => {
    let query = supabase
      .from('referral_commissions')
      .select(`
        *,
        referrer:users!referrer_id(name, email),
        referred_user:users!referred_user_id(name, email),
        subscription:subscriptions(plan_name, status)
      `)
      .order('created_at', { ascending: false });

    if (currentUser?.role === 'parceiro') {
      // Para parceiros, mostrar apenas comissões de usuários que eles criaram
      const { data: partnerUsers } = await supabase
        .from('users')
        .select('id')
        .eq('created_by', currentUser.id);
      
      const userIds = partnerUsers?.map(u => u.id) || [];
      if (userIds.length > 0) {
        query = query.in('referrer_id', userIds);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    setCommissions(data || []);
  };

  const fetchWithdrawals = async () => {
    let query = supabase
      .from('withdrawal_requests')
      .select(`
        *,
        user:users!withdrawal_requests_user_id_fkey(name, email)
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
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    setWithdrawals(data || []);
  };

  const handleWithdrawalAction = async (withdrawalId: string, action: 'approve' | 'reject' | 'mark_paid', notes?: string) => {
    try {
      setProcessing(withdrawalId);
      
      let newStatus: string;
      switch (action) {
        case 'approve':
          newStatus = 'approved';
          break;
        case 'reject':
          newStatus = 'rejected';
          break;
        case 'mark_paid':
          newStatus = 'paid';
          break;
        default:
          return;
      }

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

      const actionText = action === 'approve' ? 'aprovada' : action === 'reject' ? 'rejeitada' : 'marcada como paga';
      toast.success(`Solicitação ${actionText} com sucesso`);
      fetchWithdrawals();
    } catch (error) {
      console.error('Error updating withdrawal request:', error);
      toast.error('Erro ao processar solicitação');
    } finally {
      setProcessing(null);
    }
  };

  const handleMarkCommissionAsPaid = async (commissionId: string) => {
    try {
      setProcessing(commissionId);

      const { error } = await supabase
        .from('referral_commissions')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', commissionId);

      if (error) throw error;

      toast.success('Comissão marcada como paga');
      fetchCommissions();
    } catch (error) {
      console.error('Error updating commission:', error);
      toast.error('Erro ao atualizar comissão');
    } finally {
      setProcessing(null);
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

  const filteredCommissions = commissions.filter(commission =>
    commission.referrer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    commission.referred_user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    commission.plan_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWithdrawals = withdrawals.filter(withdrawal =>
    withdrawal.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    withdrawal.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    withdrawal.pix_key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calcular estatísticas
  const totalCommissions = commissions.reduce((sum, c) => sum + c.amount, 0);
  const pendingCommissions = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
  const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length;

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
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gift className="h-8 w-8 text-primary" />
            Gerenciar Indicações
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie comissões e solicitações de saque do programa de indicações
          </p>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Comissões</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCommissions)}</div>
            <p className="text-xs text-muted-foreground">Valor total gerado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Comissões Pendentes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingCommissions)}</div>
            <p className="text-xs text-muted-foreground">Aguardando pagamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Saques</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalWithdrawals)}</div>
            <p className="text-xs text-muted-foreground">Valor total solicitado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saques Pendentes</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingWithdrawals}</div>
            <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuário, plano..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="commissions" className="w-full">
        <TabsList>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
          <TabsTrigger value="withdrawals">Solicitações de Saque</TabsTrigger>
        </TabsList>

        <TabsContent value="commissions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Comissões de Indicação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indicador</TableHead>
                      <TableHead>Usuário Indicado</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Comissão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhuma comissão encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCommissions.map((commission) => (
                        <TableRow key={commission.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{commission.referrer?.name}</div>
                              <div className="text-sm text-muted-foreground">{commission.referrer?.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{commission.referred_user?.name}</div>
                              <div className="text-sm text-muted-foreground">{commission.referred_user?.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{commission.plan_type}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(commission.amount)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(commission.status, 'commission')}
                          </TableCell>
                          <TableCell>
                            {format(new Date(commission.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            {commission.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMarkCommissionAsPaid(commission.id)}
                                disabled={processing === commission.id}
                              >
                                {processing === commission.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Marcar como Paga
                                  </>
                                )}
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
                    {filteredWithdrawals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhuma solicitação de saque encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredWithdrawals.map((withdrawal) => (
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
                              {withdrawal.holder_name && (
                                <div className="text-xs text-muted-foreground">
                                  Titular: {withdrawal.holder_name}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(withdrawal.status, 'withdrawal')}
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
                                  disabled={processing === withdrawal.id}
                                >
                                  {processing === withdrawal.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Aprovar
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleWithdrawalAction(withdrawal.id, 'reject')}
                                  disabled={processing === withdrawal.id}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Rejeitar
                                </Button>
                              </div>
                            )}
                            {withdrawal.status === 'approved' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleWithdrawalAction(withdrawal.id, 'mark_paid', 'Pagamento processado via PIX')}
                                disabled={processing === withdrawal.id}
                              >
                                {processing === withdrawal.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <DollarSign className="h-4 w-4 mr-2" />
                                    Marcar como Pago
                                  </>
                                )}
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
      </Tabs>
    </div>
  );
}