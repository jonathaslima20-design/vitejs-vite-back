/*
  # Sistema de Indique e Ganhe - VitrineTurbo

  1. Novas Tabelas
    - `referral_commissions` - Registra comissões geradas por indicações
    - `withdrawal_requests` - Solicitações de saque dos usuários
    - `user_pix_keys` - Chaves PIX dos usuários para saques

  2. Modificações na Tabela Users
    - `referral_code` - Código único de indicação para cada usuário
    - `referred_by` - ID do usuário que fez a indicação

  3. Triggers e Funções
    - Função para gerar comissões automaticamente quando plano é ativado
    - Trigger para executar a função quando subscription status muda para 'active'

  4. Políticas de Segurança (RLS)
    - Usuários podem ver apenas suas próprias comissões e saques
    - Admins podem ver tudo
*/

-- 1. Adicionar colunas na tabela users para sistema de indicação
DO $$
BEGIN
  -- Adicionar coluna referral_code se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE public.users ADD COLUMN referral_code uuid DEFAULT gen_random_uuid() UNIQUE;
  END IF;

  -- Adicionar coluna referred_by se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'referred_by'
  ) THEN
    ALTER TABLE public.users ADD COLUMN referred_by uuid REFERENCES public.users(id);
  END IF;
END $$;

-- 2. Criar tabela de comissões de indicação
CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES public.users(id) NOT NULL,
  referred_user_id uuid REFERENCES public.users(id) NOT NULL UNIQUE,
  subscription_id uuid REFERENCES public.subscriptions(id) NOT NULL,
  plan_type text NOT NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'paid')),
  created_at timestamptz DEFAULT now() NOT NULL,
  paid_at timestamptz
);

-- 3. Criar tabela de chaves PIX dos usuários
CREATE TABLE IF NOT EXISTS public.user_pix_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) NOT NULL UNIQUE,
  pix_key text NOT NULL,
  pix_key_type text NOT NULL CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 4. Criar tabela de solicitações de saque
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  pix_key text NOT NULL,
  pix_key_type text NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  admin_notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  processed_at timestamptz,
  processed_by uuid REFERENCES public.users(id)
);

-- 5. Habilitar RLS nas novas tabelas
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pix_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de segurança para referral_commissions
CREATE POLICY "Users can view their own commissions"
  ON public.referral_commissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id);

CREATE POLICY "Admins can view all commissions"
  ON public.referral_commissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 7. Políticas de segurança para user_pix_keys
CREATE POLICY "Users can manage their own PIX keys"
  ON public.user_pix_keys
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all PIX keys"
  ON public.user_pix_keys
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 8. Políticas de segurança para withdrawal_requests
CREATE POLICY "Users can manage their own withdrawal requests"
  ON public.withdrawal_requests
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all withdrawal requests"
  ON public.withdrawal_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 9. Função para gerar comissões automaticamente
CREATE OR REPLACE FUNCTION public.generate_referral_commission()
RETURNS TRIGGER AS $$
DECLARE
  referrer_uuid uuid;
  commission_amount numeric;
  plan_name_lower text;
BEGIN
  -- Verificar se a assinatura foi ativada (status mudou para 'active')
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    
    -- Buscar quem indicou este usuário
    SELECT referred_by INTO referrer_uuid 
    FROM public.users 
    WHERE id = NEW.user_id;
    
    -- Se há um indicador, calcular comissão
    IF referrer_uuid IS NOT NULL THEN
      
      -- Converter plan_name para lowercase para comparação
      plan_name_lower := LOWER(NEW.plan_name);
      
      -- Determinar valor da comissão baseado no tipo de plano
      IF plan_name_lower LIKE '%trimestral%' OR plan_name_lower LIKE '%3%' OR plan_name_lower LIKE '%três%' THEN
        commission_amount := 50.00;
      ELSIF plan_name_lower LIKE '%semestral%' OR plan_name_lower LIKE '%6%' OR plan_name_lower LIKE '%seis%' THEN
        commission_amount := 70.00;
      ELSIF plan_name_lower LIKE '%anual%' OR plan_name_lower LIKE '%12%' OR plan_name_lower LIKE '%ano%' THEN
        commission_amount := 100.00;
      ELSE
        commission_amount := 0.00; -- Sem comissão para outros planos
      END IF;
      
      -- Inserir comissão se valor > 0
      IF commission_amount > 0 THEN
        INSERT INTO public.referral_commissions (
          referrer_id, 
          referred_user_id, 
          subscription_id,
          plan_type, 
          amount, 
          status
        )
        VALUES (
          referrer_uuid, 
          NEW.user_id, 
          NEW.id,
          NEW.plan_name, 
          commission_amount, 
          'pending'
        )
        ON CONFLICT (referred_user_id) DO NOTHING; -- Evita comissões duplicadas
      END IF;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Trigger para executar a função quando subscription é atualizada
DROP TRIGGER IF EXISTS on_subscription_activated ON public.subscriptions;
CREATE TRIGGER on_subscription_activated
  AFTER UPDATE OF status ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_commission();

-- 11. Função para atualizar referral_code para usuários existentes que não têm
DO $$
BEGIN
  UPDATE public.users 
  SET referral_code = gen_random_uuid() 
  WHERE referral_code IS NULL;
END $$;

-- 12. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer_id ON public.referral_commissions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_status ON public.referral_commissions(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users(referred_by);