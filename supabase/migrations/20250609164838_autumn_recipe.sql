/*
  # Criação do schema base para VitrineTurbo - Produtos Diversos

  1. Tabelas principais
    - `users` - Usuários do sistema (vendedores, admins, parceiros)
    - `products` - Produtos diversos
    - `product_images` - Imagens dos produtos
    - `user_product_categories` - Categorias personalizadas por usuário
    - `user_storefront_settings` - Configurações da vitrine
    - `tracking_settings` - Configurações de rastreamento
    - `property_views` - Visualizações (mantém nome para compatibilidade)
    - `leads` - Leads/contatos
    - `site_settings` - Configurações globais do site

  2. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas de acesso baseadas em usuário
    - Triggers para timestamps automáticos

  3. Funcionalidades
    - Sistema de autenticação
    - Upload de imagens
    - Categorização flexível
    - Rastreamento de visualizações
    - Gestão de leads
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'corretor' CHECK (role IN ('corretor', 'admin', 'parceiro')),
  niche_type text DEFAULT 'diversos' CHECK (niche_type = 'diversos'),
  phone text,
  avatar_url text,
  cover_url_desktop text,
  cover_url_mobile text,
  promotional_banner_url_desktop text,
  promotional_banner_url_mobile text,
  slug text UNIQUE,
  listing_limit integer DEFAULT 5,
  is_blocked boolean DEFAULT false,
  bio text,
  whatsapp text,
  instagram text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  primary_color text DEFAULT '#0f172a',
  primary_foreground text DEFAULT '#f8fafc',
  accent_color text DEFAULT '#6366f1',
  accent_foreground text DEFAULT '#ffffff',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  short_description text,
  price decimal(12,2) NOT NULL,
  is_starting_price boolean DEFAULT false,
  status text DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'vendido', 'reservado')),
  category text[] DEFAULT '{}',
  brand text,
  model text,
  condition text DEFAULT 'novo' CHECK (condition IN ('novo', 'usado', 'seminovo')),
  featured_image_url text,
  video_url text,
  featured_offer_price decimal(12,2),
  featured_offer_installment decimal(12,2),
  featured_offer_description text,
  is_visible_on_storefront boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create product_images table
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create user_product_categories table
CREATE TABLE IF NOT EXISTS user_product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Create user_storefront_settings table
CREATE TABLE IF NOT EXISTS user_storefront_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  settings jsonb DEFAULT '{
    "filters": {
      "showFilters": true,
      "showSearch": true,
      "showPriceRange": true,
      "showCategories": true,
      "showStatus": true,
      "showCondition": true
    },
    "itemsPerPage": 12
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create tracking_settings table
CREATE TABLE IF NOT EXISTS tracking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meta_pixel_id text,
  meta_events jsonb,
  ga_measurement_id text,
  ga_events jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create property_views table (mantém nome para compatibilidade)
CREATE TABLE IF NOT EXISTS property_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL, -- Referencia products.id
  viewer_id text NOT NULL,
  listing_type text DEFAULT 'product' CHECK (listing_type = 'product'),
  source text DEFAULT 'direct',
  view_date date DEFAULT CURRENT_DATE,
  viewed_at timestamptz DEFAULT now(),
  is_unique boolean DEFAULT true,
  UNIQUE(property_id, viewer_id, view_date, listing_type)
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL, -- Referencia products.id
  listing_type text DEFAULT 'product' CHECK (listing_type = 'product'),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text,
  source text DEFAULT 'form',
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'closed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_name text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_storefront_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_slug ON users(slug);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products USING GIN(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_featured ON product_images(is_featured);
CREATE INDEX IF NOT EXISTS idx_property_views_property_id ON property_views(property_id);
CREATE INDEX IF NOT EXISTS idx_property_views_date ON property_views(view_date);
CREATE INDEX IF NOT EXISTS idx_leads_property_id ON leads(property_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_product_categories_updated_at BEFORE UPDATE ON user_product_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_storefront_settings_updated_at BEFORE UPDATE ON user_storefront_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tracking_settings_updated_at BEFORE UPDATE ON tracking_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();