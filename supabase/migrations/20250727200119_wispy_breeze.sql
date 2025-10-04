/*
  # Create Subscriptions Table for Financial Control

  1. New Tables
    - `subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `plan_name` (text)
      - `monthly_price` (decimal)
      - `status` (enum: active, pending, cancelled, suspended)
      - `payment_status` (enum: paid, pending, overdue)
      - `start_date` (date)
      - `end_date` (date)
      - `next_payment_date` (date)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `payments`
      - `id` (uuid, primary key)
      - `subscription_id` (uuid, foreign key to subscriptions)
      - `amount` (decimal)
      - `payment_date` (date)
      - `payment_method` (text)
      - `status` (enum: completed, pending, failed, refunded)
      - `notes` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for admin access
*/

-- Create subscription status enum
CREATE TYPE subscription_status AS ENUM ('active', 'pending', 'cancelled', 'suspended');
CREATE TYPE payment_status AS ENUM ('paid', 'pending', 'overdue');
CREATE TYPE payment_method_status AS ENUM ('completed', 'pending', 'failed', 'refunded');

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  plan_name text NOT NULL DEFAULT 'Plano Básico',
  monthly_price decimal(10,2) NOT NULL DEFAULT 29.90,
  status subscription_status NOT NULL DEFAULT 'pending',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  next_payment_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
  amount decimal(10,2) NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'Não informado',
  status payment_method_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create policies for subscriptions
CREATE POLICY "Admins can manage all subscriptions"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Partners can view subscriptions for their users"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'parceiro'
      AND EXISTS (
        SELECT 1 FROM users u2 
        WHERE u2.id = subscriptions.user_id 
        AND u2.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Users can view their own subscription"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create policies for payments
CREATE POLICY "Admins can manage all payments"
  ON payments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Partners can view payments for their users"
  ON payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'parceiro'
      AND EXISTS (
        SELECT 1 FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.id = payments.subscription_id 
        AND u.created_by = auth.uid()
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_status ON subscriptions(payment_status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_payment_date ON subscriptions(next_payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for subscriptions
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create default subscription for existing users
INSERT INTO subscriptions (user_id, plan_name, monthly_price, status, payment_status)
SELECT 
  id,
  'Plano Básico',
  29.90,
  CASE 
    WHEN is_blocked = true THEN 'suspended'::subscription_status
    ELSE 'active'::subscription_status
  END,
  CASE 
    WHEN is_blocked = true THEN 'overdue'::payment_status
    ELSE 'paid'::payment_status
  END
FROM users 
WHERE role = 'corretor'
AND NOT EXISTS (
  SELECT 1 FROM subscriptions WHERE subscriptions.user_id = users.id
);