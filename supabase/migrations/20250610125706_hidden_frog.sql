/*
  # Adicionar campo de preço com desconto

  1. Nova Coluna
    - `discounted_price` (numeric) - Preço com desconto aplicado
  
  2. Funcionalidades
    - Campo opcional para preços promocionais
    - Permite cálculo automático de porcentagem de desconto
    - Compatível com sistema existente
*/

-- Adicionar coluna de preço com desconto
ALTER TABLE products 
ADD COLUMN discounted_price numeric(12,2);

-- Adicionar comentário para documentação
COMMENT ON COLUMN products.discounted_price IS 'Preço com desconto aplicado (opcional)';