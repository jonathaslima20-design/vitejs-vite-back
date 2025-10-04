/*
  # Inserir dados padrão

  1. Configurações do site
    - Configurações básicas do sistema
    - Limites padrão para usuários

  2. Usuário administrador padrão (opcional)
    - Pode ser criado via interface posteriormente
*/

-- Insert default site settings
INSERT INTO site_settings (setting_name, setting_value) VALUES
  ('default_listing_limit', '5'),
  ('enable_user_registration', 'true'),
  ('default_user_role', 'corretor'),
  ('require_creci', 'false')
ON CONFLICT (setting_name) DO NOTHING;

-- Create a function to handle user creation from auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, niche_type)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'corretor'),
    'diversos'
  );
  RETURN new;
END;
$$ language plpgsql security definer;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();