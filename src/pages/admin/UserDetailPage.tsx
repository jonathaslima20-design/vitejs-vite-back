import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Eye, EyeOff, Trash2, Mail, Phone, Calendar, MapPin, Instagram, ExternalLink, ShoppingBag, Copy, Ban, CheckCircle, Key, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getInitials, generateWhatsAppUrl, formatWhatsAppForDisplay } from '@/lib/utils';
import type { User, Product, Subscription, ReferralCommission } from '@/types';
import PlanStatusBadge from '@/components/subscription/PlanStatusBadge';
import { ChangePasswordDialog } from '@/components/admin/ChangePasswordDialog';

interface UserStats {
  totalProducts: number;
  activeProducts: number;
  soldProducts: number;
  totalValue: number;
}

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [referrals, setReferrals] = useState<ReferralCommission[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalProducts: 0,
    activeProducts: 0,
    soldProducts: 0,
    totalValue: 0
  });
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchUserDetails();
    }
  }, [userId]);

  const fetchUserDetails = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      const [userResult, productsResult, subscriptionResult, referralsResult] = await Promise.all([
        supabase
          .from('users')
          .select(`
            *,
            creator:created_by (
              name,
              email
            )
          `)
          .eq('id', userId)
          .maybeSingle(),

        supabase
          .from('products')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),

        supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),

        supabase
          .from('referral_commissions')
          .select(`
            *,
            referred_user:referred_user_id (
              name,
              email
            )
          `)
          .eq('referrer_id', userId)
          .order('created_at', { ascending: false })
      ]);

      if (userResult.error) throw userResult.error;
      if (!userResult.data) {
        toast.error('Usuário não encontrado');
        navigate('/admin/users');
        return;
      }

      setUser(userResult.data);

      const productsData = productsResult.data || [];
      setProducts(productsData);

      const activeProducts = productsData.filter(p => p.status === 'disponivel').length;
      const soldProducts = productsData.filter(p => p.status === 'vendido').length;
      const totalValue = productsData.reduce((sum, p) => sum + (p.price || 0), 0);

      setStats({
        totalProducts: productsData.length,
        activeProducts,
        soldProducts,
        totalValue
      });

      setSubscription(subscriptionResult.data);
      setReferrals(referralsResult.data || []);
    } catch (error) {
      console.error('Error fetching user details:', error);
      toast.error('Erro ao carregar detalhes do usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_blocked: !user.is_blocked })
        .eq('id', user.id);

      if (error) throw error;

      setUser({ ...user, is_blocked: !user.is_blocked });
      toast.success(
        !user.is_blocked ? 'Usuário bloqueado com sucesso' : 'Usuário desbloqueado com sucesso'
      );
    } catch (error) {
      console.error('Error toggling user block status:', error);
      toast.error('Erro ao atualizar status do usuário');
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        method: 'DELETE',
        body: { userId: user.id }
      });

      if (error) throw error;

      toast.success('Usuário excluído com sucesso');
      navigate('/admin/users');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Erro ao excluir usuário');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-primary">Administrador</Badge>;
      case 'parceiro':
        return <Badge className="bg-blue-500">Parceiro</Badge>;
      case 'corretor':
        return <Badge variant="secondary">Vendedor</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'disponivel':
        return <Badge className="bg-green-500">Disponível</Badge>;
      case 'vendido':
        return <Badge className="bg-blue-500">Vendido</Badge>;
      case 'reservado':
        return <Badge className="bg-yellow-500">Reservado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">Usuário não encontrado</h3>
            <Button onClick={() => navigate('/admin/users')} className="mt-4">
              Voltar para Lista de Usuários
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Detalhes do Usuário</h1>
            <p className="text-muted-foreground">Informações completas e gerenciamento</p>
          </div>
        </div>
        <div className="flex gap-2">
          {user.slug && (
            <Button variant="outline" asChild>
              <a href={`/${user.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver Vitrine
              </a>
            </Button>
          )}
          <Button
            variant={user.is_blocked ? "default" : "destructive"}
            onClick={handleToggleBlock}
          >
            {user.is_blocked ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Desbloquear
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 mr-2" />
                Bloquear
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.avatar_url} alt={user.name} />
                <AvatarFallback className="text-2xl">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold">{user.name}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex gap-2">
                {getRoleBadge(user.role)}
                <PlanStatusBadge status={user.plan_status} />
                {user.is_blocked && <Badge variant="destructive">Bloqueado</Badge>}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              {user.whatsapp && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={generateWhatsAppUrl(user.whatsapp, `Olá ${user.name}, sou da equipe VitrineTurbo.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:underline"
                  >
                    {formatWhatsAppForDisplay(user.whatsapp)}
                  </a>
                </div>
              )}

              {user.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{user.phone}</span>
                </div>
              )}

              {user.instagram && (
                <div className="flex items-center gap-3 text-sm">
                  <Instagram className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`https://instagram.com/${user.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pink-600 hover:underline"
                  >
                    @{user.instagram.replace('@', '')}
                  </a>
                </div>
              )}

              {user.location_url && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={user.location_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Ver Localização
                  </a>
                </div>
              )}

              {user.slug && (
                <div className="flex items-center gap-3 text-sm">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">/{user.slug}</span>
                </div>
              )}

              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  Cadastrado em {format(new Date(user.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>

              {user.referral_code && (
                <div className="flex items-center gap-3 text-sm">
                  <Copy className="h-4 w-4 text-muted-foreground" />
                  <span>Código de Indicação: <span className="font-mono">{user.referral_code}</span></span>
                </div>
              )}
            </div>

            {user.bio && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-2">Biografia</h4>
                  <p className="text-sm text-muted-foreground">{user.bio}</p>
                </div>
              </>
            )}

            <Separator />

            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowPasswordDialog(true)}
              >
                <Key className="h-4 w-4 mr-2" />
                Alterar Senha
              </Button>

              {user.role !== 'admin' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Usuário
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir o usuário "{user.name}"?
                        Esta ação não pode ser desfeita e todos os dados do usuário serão removidos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteUser}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalProducts}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Produtos Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.activeProducts}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.soldProducts}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: user.currency || 'BRL'
                  }).format(stats.totalValue)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="products" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="subscription">Assinatura</TabsTrigger>
              <TabsTrigger value="referrals">Indicações</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Produtos</CardTitle>
                  <CardDescription>
                    Lista de todos os produtos cadastrados por este usuário
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {products.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum produto cadastrado</p>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Preço</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Cadastrado em</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map((product) => (
                            <TableRow key={product.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {product.featured_image_url && (
                                    <img
                                      src={product.featured_image_url}
                                      alt={product.title}
                                      className="w-10 h-10 rounded object-cover"
                                    />
                                  )}
                                  <div>
                                    <div className="font-medium">{product.title}</div>
                                    {product.brand && (
                                      <div className="text-xs text-muted-foreground">{product.brand}</div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {product.category.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {product.category.slice(0, 2).map((cat, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {cat}
                                      </Badge>
                                    ))}
                                    {product.category.length > 2 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{product.category.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {product.price ? (
                                  <div>
                                    {product.discounted_price && (
                                      <div className="text-xs line-through text-muted-foreground">
                                        {new Intl.NumberFormat('pt-BR', {
                                          style: 'currency',
                                          currency: user.currency || 'BRL'
                                        }).format(product.price)}
                                      </div>
                                    )}
                                    <div className={product.discounted_price ? 'font-semibold text-green-600' : ''}>
                                      {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: user.currency || 'BRL'
                                      }).format(product.discounted_price || product.price)}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(product.status)}</TableCell>
                              <TableCell>
                                {format(new Date(product.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-right">
                                {user.slug && (
                                  <Button variant="outline" size="sm" asChild>
                                    <a
                                      href={`/${user.slug}/produtos/${product.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </a>
                                  </Button>
                                )}
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

            <TabsContent value="subscription" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Assinatura</CardTitle>
                  <CardDescription>
                    Detalhes da assinatura do usuário
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {subscription ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Plano</div>
                          <div className="font-semibold">{subscription.plan_name}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Valor Mensal</div>
                          <div className="font-semibold">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: user.currency || 'BRL'
                            }).format(subscription.monthly_price)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Status</div>
                          <div className="mt-1">
                            <Badge className={
                              subscription.status === 'active' ? 'bg-green-500' :
                              subscription.status === 'pending' ? 'bg-yellow-500' :
                              subscription.status === 'cancelled' ? 'bg-red-500' :
                              'bg-gray-500'
                            }>
                              {subscription.status === 'active' ? 'Ativo' :
                               subscription.status === 'pending' ? 'Pendente' :
                               subscription.status === 'cancelled' ? 'Cancelado' :
                               subscription.status === 'suspended' ? 'Suspenso' :
                               subscription.status}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Status do Pagamento</div>
                          <div className="mt-1">
                            <Badge variant={
                              subscription.payment_status === 'paid' ? 'default' :
                              subscription.payment_status === 'overdue' ? 'destructive' :
                              'secondary'
                            }>
                              {subscription.payment_status === 'paid' ? 'Pago' :
                               subscription.payment_status === 'pending' ? 'Pendente' :
                               subscription.payment_status === 'overdue' ? 'Vencido' :
                               subscription.payment_status}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Data de Início</div>
                          <div className="font-semibold">
                            {format(new Date(subscription.start_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Próximo Pagamento</div>
                          <div className="font-semibold">
                            {format(new Date(subscription.next_payment_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>Nenhuma assinatura ativa</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="referrals" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Indicações</CardTitle>
                  <CardDescription>
                    Usuários indicados e comissões geradas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {referrals.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <UserIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma indicação realizada</p>
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
                          {referrals.map((referral) => (
                            <TableRow key={referral.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">
                                    {referral.referred_user?.name || 'N/A'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {referral.referred_user?.email || 'N/A'}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{referral.plan_type}</TableCell>
                              <TableCell className="font-semibold">
                                {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: user.currency || 'BRL'
                                }).format(referral.amount)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={referral.status === 'paid' ? 'default' : 'secondary'}>
                                  {referral.status === 'paid' ? 'Pago' : 'Pendente'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {format(new Date(referral.created_at), 'dd/MM/yyyy', { locale: ptBR })}
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
        </div>
      </div>

      <ChangePasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        userId={user.id}
        userName={user.name}
      />
    </div>
  );
}
