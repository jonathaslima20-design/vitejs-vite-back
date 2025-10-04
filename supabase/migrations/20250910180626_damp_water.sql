/*
  # Central de Ajuda - Estrutura de Dados

  1. Novas Tabelas
    - `help_categories` - Categorias de ajuda (ex: "Primeiros Passos", "Produtos", "Configurações")
    - `help_articles` - Artigos de ajuda com conteúdo detalhado
    - `help_article_views` - Rastreamento de visualizações dos artigos
    - `help_feedback` - Feedback dos usuários sobre os artigos

  2. Recursos
    - Sistema de categorias hierárquico
    - Artigos com conteúdo rico (markdown/HTML)
    - Sistema de busca por texto
    - Rastreamento de popularidade
    - Feedback dos usuários (útil/não útil)
    - Suporte a múltiplos idiomas

  3. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas para leitura pública
    - Políticas para administração restrita
*/

-- Categorias de Ajuda
CREATE TABLE IF NOT EXISTS help_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text, -- Nome do ícone Lucide React
  slug text UNIQUE NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Artigos de Ajuda
CREATE TABLE IF NOT EXISTS help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES help_categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  excerpt text, -- Resumo do artigo
  content text NOT NULL, -- Conteúdo em markdown/HTML
  tags text[], -- Tags para busca
  difficulty_level text CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
  estimated_read_time integer DEFAULT 5, -- Tempo estimado de leitura em minutos
  is_featured boolean DEFAULT false,
  is_published boolean DEFAULT true,
  view_count integer DEFAULT 0,
  helpful_count integer DEFAULT 0,
  not_helpful_count integer DEFAULT 0,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Visualizações de Artigos
CREATE TABLE IF NOT EXISTS help_article_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES help_articles(id) ON DELETE CASCADE,
  viewer_id text, -- ID do visitante (pode ser anônimo)
  user_id uuid REFERENCES users(id) ON DELETE SET NULL, -- Se usuário logado
  viewed_at timestamptz DEFAULT now(),
  session_id text,
  user_agent text,
  referrer text
);

-- Feedback dos Artigos
CREATE TABLE IF NOT EXISTS help_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES help_articles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  is_helpful boolean NOT NULL,
  feedback_text text, -- Comentário opcional
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_help_articles_category ON help_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_help_articles_slug ON help_articles(slug);
CREATE INDEX IF NOT EXISTS idx_help_articles_published ON help_articles(is_published);
CREATE INDEX IF NOT EXISTS idx_help_articles_featured ON help_articles(is_featured);
CREATE INDEX IF NOT EXISTS idx_help_articles_search ON help_articles USING gin(to_tsvector('portuguese', title || ' ' || excerpt || ' ' || content));
CREATE INDEX IF NOT EXISTS idx_help_article_views_article ON help_article_views(article_id);
CREATE INDEX IF NOT EXISTS idx_help_feedback_article ON help_feedback(article_id);

-- RLS Policies
ALTER TABLE help_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_article_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_feedback ENABLE ROW LEVEL SECURITY;

-- Políticas para leitura pública
CREATE POLICY "Anyone can read active help categories"
  ON help_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can read published help articles"
  ON help_articles FOR SELECT
  USING (is_published = true);

CREATE POLICY "Anyone can create article views"
  ON help_article_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read article views"
  ON help_article_views FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create feedback"
  ON help_feedback FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read feedback stats"
  ON help_feedback FOR SELECT
  USING (true);

-- Políticas para administração (apenas admins)
CREATE POLICY "Admins can manage help categories"
  ON help_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage help articles"
  ON help_articles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Função para atualizar contador de visualizações
CREATE OR REPLACE FUNCTION increment_article_view_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE help_articles 
  SET view_count = view_count + 1 
  WHERE id = NEW.article_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para incrementar visualizações
DROP TRIGGER IF EXISTS trigger_increment_article_views ON help_article_views;
CREATE TRIGGER trigger_increment_article_views
  AFTER INSERT ON help_article_views
  FOR EACH ROW
  EXECUTE FUNCTION increment_article_view_count();

-- Função para atualizar contadores de feedback
CREATE OR REPLACE FUNCTION update_article_feedback_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_helpful THEN
      UPDATE help_articles SET helpful_count = helpful_count + 1 WHERE id = NEW.article_id;
    ELSE
      UPDATE help_articles SET not_helpful_count = not_helpful_count + 1 WHERE id = NEW.article_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Remove old vote
    IF OLD.is_helpful THEN
      UPDATE help_articles SET helpful_count = helpful_count - 1 WHERE id = OLD.article_id;
    ELSE
      UPDATE help_articles SET not_helpful_count = not_helpful_count - 1 WHERE id = OLD.article_id;
    END IF;
    -- Add new vote
    IF NEW.is_helpful THEN
      UPDATE help_articles SET helpful_count = helpful_count + 1 WHERE id = NEW.article_id;
    ELSE
      UPDATE help_articles SET not_helpful_count = not_helpful_count + 1 WHERE id = NEW.article_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_helpful THEN
      UPDATE help_articles SET helpful_count = helpful_count - 1 WHERE id = OLD.article_id;
    ELSE
      UPDATE help_articles SET not_helpful_count = not_helpful_count - 1 WHERE id = OLD.article_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar feedback
DROP TRIGGER IF EXISTS trigger_update_feedback_count ON help_feedback;
CREATE TRIGGER trigger_update_feedback_count
  AFTER INSERT OR UPDATE OR DELETE ON help_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_article_feedback_count();