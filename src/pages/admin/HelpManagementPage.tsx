import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye, EyeOff, Star, Loader2 } from 'lucide-react';
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HelpCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  slug: string;
  is_active: boolean;
  display_order: number;
  article_count?: number;
}

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  is_published: boolean;
  is_featured: boolean;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  category?: {
    name: string;
    slug: string;
  };
}

export default function HelpManagementPage() {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('articles');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load categories with article counts
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('help_categories')
        .select(`
          *,
          help_articles(id)
        `)
        .order('display_order');

      if (categoriesError) throw categoriesError;

      const processedCategories = categoriesData?.map(cat => ({
        ...cat,
        article_count: cat.help_articles?.length || 0
      })) || [];

      setCategories(processedCategories);

      // Load articles
      const { data: articlesData, error: articlesError } = await supabase
        .from('help_articles')
        .select(`
          *,
          category:help_categories(name, slug)
        `)
        .order('created_at', { ascending: false });

      if (articlesError) throw articlesError;
      setArticles(articlesData || []);

    } catch (error) {
      console.error('Error loading help data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const toggleArticleStatus = async (articleId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('help_articles')
        .update({ 
          is_published: !currentStatus,
          published_at: !currentStatus ? new Date().toISOString() : null
        })
        .eq('id', articleId);

      if (error) throw error;

      setArticles(prev => prev.map(article => 
        article.id === articleId 
          ? { ...article, is_published: !currentStatus }
          : article
      ));

      toast.success(`Artigo ${!currentStatus ? 'publicado' : 'despublicado'} com sucesso`);
    } catch (error) {
      console.error('Error toggling article status:', error);
      toast.error('Erro ao alterar status do artigo');
    }
  };

  const toggleArticleFeatured = async (articleId: string, currentFeatured: boolean) => {
    try {
      const { error } = await supabase
        .from('help_articles')
        .update({ is_featured: !currentFeatured })
        .eq('id', articleId);

      if (error) throw error;

      setArticles(prev => prev.map(article => 
        article.id === articleId 
          ? { ...article, is_featured: !currentFeatured }
          : article
      ));

      toast.success(`Artigo ${!currentFeatured ? 'destacado' : 'removido dos destaques'}`);
    } catch (error) {
      console.error('Error toggling article featured:', error);
      toast.error('Erro ao alterar destaque do artigo');
    }
  };

  const deleteArticle = async (articleId: string) => {
    try {
      const { error } = await supabase
        .from('help_articles')
        .delete()
        .eq('id', articleId);

      if (error) throw error;

      setArticles(prev => prev.filter(article => article.id !== articleId));
      toast.success('Artigo excluído com sucesso');
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error('Erro ao excluir artigo');
    }
  };

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Central de Ajuda</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie categorias e artigos de ajuda
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/help" target="_blank">
              <Eye className="h-4 w-4 mr-2" />
              Ver Central de Ajuda
            </Link>
          </Button>
          <Button asChild>
            <Link to="/admin/help/articles/new">
              <Plus className="h-4 w-4 mr-2" />
              Novo Artigo
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="articles">Artigos</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Artigos de Ajuda</CardTitle>
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar artigos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Visualizações</TableHead>
                      <TableHead>Feedback</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredArticles.map((article) => (
                      <TableRow key={article.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {article.title}
                              {article.is_featured && (
                                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {article.excerpt}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {article.category && (
                            <Badge variant="outline">{article.category.name}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {article.is_published ? (
                            <Badge className="bg-green-500">Publicado</Badge>
                          ) : (
                            <Badge variant="secondary">Rascunho</Badge>
                          )}
                        </TableCell>
                        <TableCell>{article.view_count}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-green-600">+{article.helpful_count}</span>
                            <span className="text-red-600">-{article.not_helpful_count}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(article.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleArticleFeatured(article.id, article.is_featured)}
                            >
                              <Star className={`h-4 w-4 ${article.is_featured ? 'fill-current text-yellow-500' : ''}`} />
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleArticleStatus(article.id, article.is_published)}
                            >
                              {article.is_published ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link to={`/admin/help/articles/${article.id}/edit`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir artigo</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir "{article.title}"? 
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteArticle(article.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Categorias de Ajuda</CardTitle>
                <Button asChild>
                  <Link to="/admin/help/categories/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Categoria
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Artigos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>
                          <Badge variant="outline">{category.display_order}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="max-w-xs truncate">{category.description}</TableCell>
                        <TableCell>{category.article_count || 0}</TableCell>
                        <TableCell>
                          {category.is_active ? (
                            <Badge className="bg-green-500">Ativa</Badge>
                          ) : (
                            <Badge variant="secondary">Inativa</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link to={`/admin/help/categories/${category.id}/edit`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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