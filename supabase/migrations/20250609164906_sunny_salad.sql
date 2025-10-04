/*
  # Políticas de Row Level Security (RLS)

  1. Políticas para users
    - Usuários podem ver seus próprios dados
    - Admins e parceiros podem gerenciar usuários
    - Perfis públicos são visíveis para todos

  2. Políticas para products
    - Usuários podem gerenciar seus próprios produtos
    - Produtos visíveis na vitrine são públicos

  3. Políticas para outras tabelas
    - Baseadas na propriedade do usuário
    - Acesso público para visualizações e leads
*/

-- Users policies
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'parceiro')
    )
  );

CREATE POLICY "Admins can create users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'parceiro')
    )
  );

CREATE POLICY "Admins can update users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'parceiro')
    )
  );

CREATE POLICY "Admins can delete users"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Public profiles are visible"
  ON users
  FOR SELECT
  TO anon
  USING (slug IS NOT NULL AND NOT is_blocked);

-- Products policies
CREATE POLICY "Users can manage own products"
  ON products
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Public can view visible products"
  ON products
  FOR SELECT
  TO anon, authenticated
  USING (
    is_visible_on_storefront = true 
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = products.user_id 
      AND NOT is_blocked
    )
  );

-- Product images policies
CREATE POLICY "Users can manage own product images"
  ON product_images
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products 
      WHERE id = product_images.product_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view product images"
  ON product_images
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products 
      WHERE id = product_images.product_id 
      AND is_visible_on_storefront = true
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE id = products.user_id 
        AND NOT is_blocked
      )
    )
  );

-- User product categories policies
CREATE POLICY "Users can manage own categories"
  ON user_product_categories
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- User storefront settings policies
CREATE POLICY "Users can manage own storefront settings"
  ON user_storefront_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Tracking settings policies
CREATE POLICY "Users can manage own tracking settings"
  ON tracking_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Property views policies (public for analytics)
CREATE POLICY "Anyone can create views"
  ON property_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read views of their products"
  ON property_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products 
      WHERE id = property_views.property_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all views"
  ON property_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'parceiro')
    )
  );

-- Leads policies
CREATE POLICY "Anyone can create leads"
  ON leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read leads for their products"
  ON leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products 
      WHERE id = leads.property_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update leads for their products"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products 
      WHERE id = leads.property_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'parceiro')
    )
  );

-- Site settings policies
CREATE POLICY "Admins can manage site settings"
  ON site_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Anyone can read site settings"
  ON site_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);