/*
  # Add Custom Domain Support to Users

  1. New Column
    - `custom_domain` (text, unique, nullable)
      - Stores the user's custom domain (e.g., "meudominio.com.br")
      - Must be unique across all users
      - Nullable to allow users without custom domains

  2. Security
    - Add unique constraint to prevent domain conflicts
    - Add index for performance when looking up by custom domain

  3. Validation
    - Domain format will be validated on the frontend
    - Backend constraint ensures uniqueness
*/

-- Add custom_domain column to users table
ALTER TABLE users ADD COLUMN custom_domain text;

-- Add unique constraint to prevent multiple users from using the same domain
ALTER TABLE users ADD CONSTRAINT users_custom_domain_key UNIQUE (custom_domain);

-- Add index for performance when looking up users by custom domain
CREATE INDEX idx_users_custom_domain ON users (custom_domain) WHERE custom_domain IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN users.custom_domain IS 'Custom domain for user storefront (e.g., meudominio.com.br)';