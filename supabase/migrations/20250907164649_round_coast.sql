/*
  # Create Subscription Plans System

  1. New Tables
    - `subscription_plans`
      - `id` (uuid, primary key)
      - `name` (text, plan name)
      - `duration` (text, Trimestral/Semestral/Anual)
      - `price` (numeric, plan price)
      - `checkout_url` (text, external checkout link)
      - `is_active` (boolean, plan availability)
      - `display_order` (integer, plan ordering)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `subscription_plans` table
    - Add policies for public read access and admin management

  3. Default Data
    - Insert default subscription plans with pricing
*/

-- Create subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  duration text NOT NULL CHECK (duration IN ('Trimestral', 'Semestral', 'Anual')),
  price numeric(10,2) NOT NULL,
  checkout_url text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Policies for subscription plans
CREATE POLICY "Anyone can read active subscription plans"
  ON subscription_plans
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage subscription plans"
  ON subscription_plans
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_subscription_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_plans_updated_at();

-- Insert default subscription plans
INSERT INTO subscription_plans (name, duration, price, display_order) VALUES
  ('Plano Trimestral', 'Trimestral', 149.00, 1),
  ('Plano Semestral', 'Semestral', 229.00, 2),
  ('Plano Anual', 'Anual', 336.00, 3);

-- Update users table to have plan_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'plan_status'
  ) THEN
    ALTER TABLE users ADD COLUMN plan_status text DEFAULT 'inactive' CHECK (plan_status IN ('active', 'inactive', 'suspended'));
  END IF;
END $$;

-- Update existing users to have inactive plan status
UPDATE users SET plan_status = 'inactive' WHERE plan_status IS NULL;