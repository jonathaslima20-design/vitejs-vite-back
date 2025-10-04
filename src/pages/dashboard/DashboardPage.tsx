import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Package, Users, TrendingUp, Loader2, ExternalLink, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatCurrency as formatCurrencyUtil } from '@/lib/utils';
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
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { STOREFRONT_UUID } from '@/lib/tracking';

// Helper function to format currency with user's settings
const formatCurrency = (value: number, user: any) => 
  formatCurrencyUtil(value, user?.currency || 'BRL', user?.language || 'pt-BR');

interface DashboardStats {
  totalProducts: number;
  totalViews: number;
  totalLeads: number;
  conversionRate: number;
}

interface ChartData {
  date: string;
  views: number;
  leads: number;
}

interface LeadsBySource {
  source: string;
  count: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalViews: 0,
    totalLeads: 0,
    conversionRate: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [leadsBySource, setLeadsBySource] = useState<LeadsBySource[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch products first
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', user?.id);

      if (productsError) {
        console.error('Error fetching products:', productsError);
        throw productsError;
      }

      const productIds = productsData?.map(p => p.id) || [];
      console.log('Product IDs:', productIds);

      // If no products, set empty stats
      if (productIds.length === 0) {
        setStats({
          totalProducts: 0,
          totalViews: 0,
          totalLeads: 0,
          conversionRate: 0,
        });
        setChartData([]);
        setLeadsBySource([]);
        setLoading(false);
        return;
      }

      // Fetch total views and leads for this user's products only
      const [viewsResponse, leadsResponse] = await Promise.all([
        supabase
          .from('property_views')
          .select('id')
          .in('property_id', productIds)
          .eq('listing_type', 'product'),
        supabase
          .from('leads')
          .select('id, source')
          .in('property_id', productIds)
          .eq('listing_type', 'product')
      ]);

      if (viewsResponse.error) {
        console.error('Error fetching views:', viewsResponse.error);
      }

      if (leadsResponse.error) {
        console.error('Error fetching leads:', leadsResponse.error);
      }

      const totalViews = viewsResponse.data?.length || 0;
      const totalLeads = leadsResponse.data?.length || 0;
      const leadsData = leadsResponse.data || [];

      console.log('Dashboard stats for user:', { 
        userId: user?.id,
        totalViews, 
        totalLeads, 
        productIds: productIds.length,
        productIdsArray: productIds
      });

      // Calculate conversion rate
      const conversionRate = totalViews > 0 ? (totalLeads / totalViews) * 100 : 0;

      setStats({
        totalProducts: productIds.length,
        totalViews,
        totalLeads,
        conversionRate,
      });

      // Fetch chart data for the last 7 days
      const chartPromises = Array.from({ length: 7 }).map(async (_, i) => {
        const date = subDays(new Date(), i);
        const start = startOfDay(date);
        const end = endOfDay(date);

        // Views for this day
        const { data: dayViews } = await supabase
          .from('property_views')
          .select('id')
          .in('property_id', productIds)
          .eq('listing_type', 'product')
          .gte('viewed_at', start.toISOString())
          .lte('viewed_at', end.toISOString());

        // Leads for this day
        const { data: dayLeads } = await supabase
          .from('leads')
          .select('id')
          .in('property_id', productIds)
          .eq('listing_type', 'product')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());

        return {
          date: format(date, 'dd/MM', { locale: ptBR }),
          views: dayViews?.length || 0,
          leads: dayLeads?.length || 0,
        };
      });

      const chartResults = await Promise.all(chartPromises);
      setChartData(chartResults.reverse());

      // Process leads by source
      const sourceCount = leadsData?.reduce((acc, curr) => {
        const source = curr.source || 'form';
        // Map WhatsApp sources to a single category
        const mappedSource = source.includes('whatsapp') || source.includes('contact_sidebar') || source.includes('header_social') 
          ? 'WhatsApp' 
          : source === 'form' 
            ? 'Formulário' 
            : source;
        acc[mappedSource] = (acc[mappedSource] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      setLeadsBySource(
        Object.entries(sourceCount).map(([source, count]) => ({
          source,
          count,
        }))
      );

      console.log('Dashboard stats updated for user:', {
        userId: user?.id,
        totalProducts: productIds.length,
        totalViews,
        totalLeads,
        conversionRate,
        leadsBySource: sourceCount
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const handleExternalSiteClick = () => {
    if (!user?.slug) {
      toast.error('Configure seu perfil primeiro para ter acesso ao site público');
      navigate('/dashboard/settings');
      return;
    }
    window.open(`/${user.slug}`, '_blank', 'noopener,noreferrer');
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo de volta, {user?.name}
          </p>
        </div>

        <Button 
          onClick={handleExternalSiteClick}
          className="mt-4 md:mt-0"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Ver Minha Vitrine
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">Produtos cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Visualizações</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalViews}</div>
            <p className="text-xs text-muted-foreground">Total de visualizações</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLeads}</div>
            <p className="text-xs text-muted-foreground">Contatos recebidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.conversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Visualizações para leads</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Visualizações e Leads</CardTitle>
            <p className="text-sm text-muted-foreground">
              Últimos 7 dias
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="#8884d8"
                    name="Visualizações"
                  />
                  <Line
                    type="monotone"
                    dataKey="leads"
                    stroke="#82ca9d"
                    name="Leads"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leads por Origem</CardTitle>
            <p className="text-sm text-muted-foreground">
              Distribuição dos contatos
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
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
    </div>
  );
}