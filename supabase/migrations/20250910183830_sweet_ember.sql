/*
  # Add Fake Statistics for Help Center

  This migration adds realistic fake statistics to help articles to simulate
  an active and well-used help center.
  
  1. Updates
    - Add view counts to help articles (ranging from 150 to 2500 views)
    - Add helpful feedback counts (80-95% positive feedback rate)
    - Add some not helpful feedback for realism
    - Distribute views realistically based on article importance
  
  2. Statistics Distribution
    - Getting started articles: Higher view counts (1500-2500)
    - Product management: Medium-high views (800-1500)
    - Configuration articles: Medium views (400-800)
    - Advanced features: Lower views (150-400)
*/

-- Update help articles with realistic view counts and feedback
UPDATE help_articles SET 
  view_count = CASE 
    WHEN slug = 'como-criar-conta' THEN 2487
    WHEN slug = 'configurar-perfil-vitrine' THEN 2156
    WHEN slug = 'cadastrar-primeiro-produto' THEN 1923
    WHEN slug = 'personalizar-aparencia' THEN 1654
    WHEN slug = 'organizar-produtos-categorias' THEN 1432
    WHEN slug = 'configurar-precos-promocoes' THEN 1287
    WHEN slug = 'gerenciar-imagens-produtos' THEN 1156
    WHEN slug = 'como-funciona-carrinho' THEN 987
    WHEN slug = 'configurar-checkout-externo' THEN 876
    WHEN slug = 'programa-indicacoes' THEN 1543
    WHEN slug = 'como-ganhar-comissoes' THEN 1234
    WHEN slug = 'solicitar-saque' THEN 892
    WHEN slug = 'produtos-nao-aparecem' THEN 1876
    WHEN slug = 'problemas-imagens' THEN 1345
    WHEN slug = 'erro-cadastro-produto' THEN 987
    WHEN slug = 'vitrine-nao-carrega' THEN 765
    WHEN slug = 'problemas-whatsapp' THEN 654
    WHEN slug = 'duvidas-pagamento' THEN 543
    ELSE 234
  END,
  helpful_count = CASE 
    WHEN slug = 'como-criar-conta' THEN 2298
    WHEN slug = 'configurar-perfil-vitrine' THEN 1987
    WHEN slug = 'cadastrar-primeiro-produto' THEN 1756
    WHEN slug = 'personalizar-aparencia' THEN 1487
    WHEN slug = 'organizar-produtos-categorias' THEN 1298
    WHEN slug = 'configurar-precos-promocoes' THEN 1156
    WHEN slug = 'gerenciar-imagens-produtos' THEN 1034
    WHEN slug = 'como-funciona-carrinho' THEN 876
    WHEN slug = 'configurar-checkout-externo' THEN 765
    WHEN slug = 'programa-indicacoes' THEN 1398
    WHEN slug = 'como-ganhar-comissoes' THEN 1098
    WHEN slug = 'solicitar-saque' THEN 798
    WHEN slug = 'produtos-nao-aparecem' THEN 1687
    WHEN slug = 'problemas-imagens' THEN 1198
    WHEN slug = 'erro-cadastro-produto' THEN 876
    WHEN slug = 'vitrine-nao-carrega' THEN 687
    WHEN slug = 'problemas-whatsapp' THEN 587
    WHEN slug = 'duvidas-pagamento' THEN 456
    ELSE 198
  END,
  not_helpful_count = CASE 
    WHEN slug = 'como-criar-conta' THEN 89
    WHEN slug = 'configurar-perfil-vitrine' THEN 76
    WHEN slug = 'cadastrar-primeiro-produto' THEN 67
    WHEN slug = 'personalizar-aparencia' THEN 78
    WHEN slug = 'organizar-produtos-categorias' THEN 65
    WHEN slug = 'configurar-precos-promocoes' THEN 54
    WHEN slug = 'gerenciar-imagens-produtos' THEN 43
    WHEN slug = 'como-funciona-carrinho' THEN 45
    WHEN slug = 'configurar-checkout-externo' THEN 56
    WHEN slug = 'programa-indicacoes' THEN 67
    WHEN slug = 'como-ganhar-comissoes' THEN 54
    WHEN slug = 'solicitar-saque' THEN 43
    WHEN slug = 'produtos-nao-aparecem' THEN 89
    WHEN slug = 'problemas-imagens' THEN 76
    WHEN slug = 'erro-cadastro-produto' THEN 54
    WHEN slug = 'vitrine-nao-carrega' THEN 43
    WHEN slug = 'problemas-whatsapp' THEN 32
    WHEN slug = 'duvidas-pagamento' THEN 28
    ELSE 21
  END
WHERE slug IN (
  'como-criar-conta', 'configurar-perfil-vitrine', 'cadastrar-primeiro-produto',
  'personalizar-aparencia', 'organizar-produtos-categorias', 'configurar-precos-promocoes',
  'gerenciar-imagens-produtos', 'como-funciona-carrinho', 'configurar-checkout-externo',
  'programa-indicacoes', 'como-ganhar-comissoes', 'solicitar-saque',
  'produtos-nao-aparecem', 'problemas-imagens', 'erro-cadastro-produto',
  'vitrine-nao-carrega', 'problemas-whatsapp', 'duvidas-pagamento'
);

-- Add some fake article views to make the statistics more realistic
INSERT INTO help_article_views (article_id, user_id, ip_address, user_agent, viewed_at)
SELECT 
  ha.id,
  NULL, -- Anonymous views
  ('192.168.1.' || (RANDOM() * 254 + 1)::int)::inet,
  CASE (RANDOM() * 4)::int
    WHEN 0 THEN 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    WHEN 1 THEN 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    WHEN 2 THEN 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
    ELSE 'Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/88.0'
  END,
  NOW() - (RANDOM() * INTERVAL '30 days')
FROM help_articles ha
WHERE ha.is_published = true;

-- Add some fake feedback entries
INSERT INTO help_feedback (article_id, user_id, is_helpful, feedback_text, created_at)
SELECT 
  ha.id,
  NULL, -- Anonymous feedback
  CASE 
    WHEN RANDOM() < 0.85 THEN true -- 85% positive feedback
    ELSE false
  END,
  CASE 
    WHEN RANDOM() < 0.3 THEN 
      CASE (RANDOM() * 5)::int
        WHEN 0 THEN 'Muito útil, obrigado!'
        WHEN 1 THEN 'Explicação clara e objetiva'
        WHEN 2 THEN 'Resolveu meu problema rapidamente'
        WHEN 3 THEN 'Tutorial bem detalhado'
        ELSE 'Excelente conteúdo'
      END
    ELSE NULL
  END,
  NOW() - (RANDOM() * INTERVAL '25 days')
FROM help_articles ha
WHERE ha.is_published = true
AND RANDOM() < 0.4; -- 40% of articles get feedback