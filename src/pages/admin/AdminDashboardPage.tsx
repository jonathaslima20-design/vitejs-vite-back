import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, TrendingUp, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface DashboardStats {
  totalProducts: number;
  totalUsers: number;
  totalViews: number;
  totalLeads: number;
  conversionRate: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalUsers: 0,
    totalViews: 0,
    totalLeads: 0,
    conversionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Get total users based on role
      let usersQuery = supabase.from('users').select('*', { count: 'exact', head: true });
      
      // If user is partner, only count users they created
      if (user?.role === 'parceiro') {
        usersQuery = usersQuery.eq('created_by', user.id);
      }
      
      // Fetch total users
      const { count: totalUsers } = await usersQuery;

      // Get all users for this partner/admin
      let userDataQuery = supabase
        .from('users')
        .select('id');

      if (user?.role === 'parceiro') {
        userDataQuery = userDataQuery.eq('created_by', user.id);
      }

      const { data: usersData } = await userDataQuery;

      // Initialize counters
      let totalProducts = 0;
      let totalViews = 0;
      let totalLeads = 0;

      // Count products, views and leads for each user
      for (const userData of usersData || []) {
        // Count products
        const { count: productsCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userData.id);
        totalProducts += productsCount || 0;

        // Count product views
        const { count: productViews } = await supabase
          .from('property_views')
          .select('*', { count: 'exact', head: true })
          .eq('listing_type', 'product')
          .in('property_id', 
            (await supabase
              .from('products')
              .select('id')
              .eq('user_id', userData.id)
            ).data?.map(p => p.id) || []
          );
        totalViews += productViews || 0;

        // Count product leads
        const { count: productLeads } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('listing_type', 'product')
          .in('property_id', 
            (await supabase
              .from('products')
              .select('id')
              .eq('user_id', userData.id)
            ).data?.map(p => p.id) || []
          );
        totalLeads += productLeads || 0;
      }

      // Get financial stats
      let subscriptionsQuery = supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true });

      if (user?.role === 'parceiro') {
        // For partners, get subscriptions of users they created
        const partnerUserIds = usersData?.map(u => u.id) || [];
        subscriptionsQuery = subscriptionsQuery.in('user_id', partnerUserIds);
      }

      const { count: totalSubscriptions } = await subscriptionsQuery;
      // Calculate conversion rate
      const conversionRate = totalViews > 0 ? (totalLeads / totalViews) * 100 : 0;

      setStats({
        totalProducts,
        totalUsers: totalUsers || 0,
        totalViews,
        totalLeads,
        conversionRate,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Painel Administrativo</h1>
          {user?.role === 'parceiro' && (
            <p className="text-muted-foreground mt-1">
              Gerencie seus usuários e acompanhe as estatísticas
            </p>
          )}
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {user?.role === 'parceiro' ? 'Total de Produtos' : 'Total de Usuários'}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user?.role === 'parceiro' ? stats.totalProducts : stats.totalUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              {user?.role === 'parceiro' 
                ? 'Produtos cadastrados' 
                : 'Usuários no sistema'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {user?.role === 'parceiro' ? 'Total de Usuários' : 'Total de Visualizações'}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user?.role === 'parceiro' ? stats.totalUsers : stats.totalViews}
            </div>
            <p className="text-xs text-muted-foreground">
              {user?.role === 'parceiro' 
                ? 'Usuários gerenciados' 
                : 'Visualizações totais'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Visualizações
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalViews}</div>
            <p className="text-xs text-muted-foreground">
              Visualizações dos produtos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              Contatos recebidos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Rate Card */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary mb-2">
              {stats.conversionRate.toFixed(1)}%
            </div>
            <p className="text-muted-foreground">
              Taxa de conversão de visualizações para leads
            </p>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>• {stats.totalViews} visualizações totais</p>
              <p>• {stats.totalLeads} leads gerados</p>
              <p>• {stats.totalUsers} usuários {user?.role === 'parceiro' ? 'gerenciados' : 'no sistema'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}