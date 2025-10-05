# Meta Tags Dinâmicas para Redes Sociais - VitrineTurbo

## Problema Identificado

Quando links do VitrineTurbo são compartilhados no WhatsApp, Instagram, Facebook ou outras redes sociais, as prévias de URL mostram informações genéricas do sistema em vez dos dados específicos de cada loja/corretor.

**Causa Raiz:** VitrineTurbo é uma Single Page Application (SPA) React. Crawlers de redes sociais não executam JavaScript, então eles veem apenas o HTML estático inicial com meta tags genéricas.

## Solução Implementada

### Arquitetura da Solução

A solução implementa **Server-Side Meta Tags Generation** através de duas abordagens complementares:

1. **Netlify Edge Functions** (Recomendado para produção)
2. **Supabase Edge Functions** (Alternativa/Backup)

#### Como Funciona

```
┌─────────────────┐
│  WhatsApp Bot   │
│  Facebook Bot   │
│  Twitter Bot    │
└────────┬────────┘
         │
         │ GET vitrineturbo.com/kingstore
         │ User-Agent: facebookexternalhit
         │
         ▼
┌─────────────────────────────────────┐
│     Netlify Edge Function           │
│  (meta-handler.ts)                  │
│                                     │
│  1. Detecta User-Agent do crawler  │
│  2. Extrai slug da URL (kingstore) │
│  3. Consulta banco Supabase        │
│  4. Gera HTML com meta tags        │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     HTML Dinâmico Retornado         │
│                                     │
│  <meta og:title="King Store">      │
│  <meta og:description="...">        │
│  <meta og:image="avatar_url">       │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Prévia Social com Dados Corretos  │
└─────────────────────────────────────┘
```

### Componentes Implementados

#### 1. Netlify Edge Function (`netlify/edge-functions/meta-handler.ts`)

**Responsabilidades:**
- Interceptar requisições de crawlers antes de servir o HTML estático
- Detectar User-Agents de bots de redes sociais
- Consultar dados do corretor no Supabase
- Gerar HTML com Open Graph e Twitter Cards dinâmicos
- Permitir passagem de usuários normais para a SPA

**Crawlers Detectados:**
- Facebook (facebookexternalhit, Facebot)
- WhatsApp
- Twitter (Twitterbot)
- LinkedIn (LinkedInBot)
- Telegram (TelegramBot)
- Discord (Discordbot)
- Slack (Slackbot)
- E outros...

**Exemplo de HTML Gerado:**

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <title>King Store - VitrineTurbo</title>

    <!-- Open Graph -->
    <meta property="og:type" content="profile" />
    <meta property="og:url" content="https://vitrineturbo.com/kingstore" />
    <meta property="og:title" content="King Store - VitrineTurbo" />
    <meta property="og:description" content="Confira os melhores produtos..." />
    <meta property="og:image" content="https://[avatar-url]" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="King Store - VitrineTurbo" />
    <meta name="twitter:description" content="Confira os melhores produtos..." />
    <meta name="twitter:image" content="https://[avatar-url]" />
  </head>
  <body>...</body>
</html>
```

#### 2. Supabase Edge Function (`supabase/functions/meta-tags-handler/`)

Funcionalidade similar à Netlify Edge Function, mas pode ser usada como:
- Alternativa se não estiver usando Netlify
- Backup em caso de problemas
- API endpoint direto para testar meta tags

**Endpoint:** `https://[project].supabase.co/functions/v1/meta-tags-handler?url=https://vitrineturbo.com/kingstore`

#### 3. Configuração Netlify (`netlify.toml`)

```toml
[[edge_functions]]
  path = "/*"
  function = "meta-handler"
```

Esta configuração garante que todas as requisições passem pela edge function antes de serem processadas.

### Priorização de Imagens

A lógica implementada prioriza imagens na seguinte ordem:

**Para páginas de loja/corretor:**
1. `avatar_url` (logo/foto do corretor) - **PRIORIDADE MÁXIMA**
2. `cover_url_desktop` (banner desktop)
3. `cover_url_mobile` (banner mobile)
4. Imagem padrão do VitrineTurbo

**Justificativa:** O avatar representa a marca/identidade do corretor e é mais adequado para prévias de redes sociais.

### Dados Consultados do Banco

A solução consulta a tabela `users` com os seguintes campos:

```sql
SELECT name, slug, bio, avatar_url, cover_url_desktop, cover_url_mobile
FROM users
WHERE slug = 'kingstore'
LIMIT 1
```

### Cache e Performance

**Netlify Edge Function:**
- `Cache-Control: public, max-age=300, s-maxage=600`
- Cache de 5 minutos no navegador
- Cache de 10 minutos no CDN

**Supabase Edge Function:**
- `Cache-Control: public, max-age=300, s-maxage=600`
- Mesma estratégia de cache

Isso garante:
- Performance otimizada
- Redução de consultas ao banco
- Atualizações de dados em no máximo 10 minutos

## Implementação Passo a Passo

### 1. Deploy da Supabase Edge Function

```bash
# A função já está no repositório em:
# supabase/functions/meta-tags-handler/index.ts

# Deploy usando a CLI do Supabase (se disponível localmente):
supabase functions deploy meta-tags-handler

# OU deploy através do MCP tool (já configurado no projeto)
```

A função será automaticamente deployada quando você fizer push para o repositório.

### 2. Configuração Netlify

**Arquivo:** `netlify.toml`

A configuração já está incluída:

```toml
[[edge_functions]]
  path = "/*"
  function = "meta-handler"
```

**Variáveis de Ambiente no Netlify:**

No dashboard do Netlify, adicione:
- `VITE_SUPABASE_URL`: URL do seu projeto Supabase
- `VITE_SUPABASE_ANON_KEY`: Chave anônima do Supabase

Estas variáveis já devem existir no seu `.env` e serão automaticamente disponibilizadas para a edge function.

### 3. Deploy no Netlify

```bash
# Build local para testar
npm run build

# Deploy via Git (recomendado)
git add .
git commit -m "feat: add social media meta tags handler"
git push origin main

# Deploy manual via CLI Netlify (alternativa)
netlify deploy --prod
```

### 4. Verificação da Implementação

Após o deploy:

1. Acesse: `https://vitrineturbo.com/kingstore`
2. Abra as DevTools > Network
3. Verifique que a página carrega normalmente
4. Teste com curl simulando um crawler (ver seção de testes abaixo)

## Testes e Validação

### 1. Teste Local com cURL

Simule um crawler do Facebook:

```bash
curl -A "facebookexternalhit/1.1" https://vitrineturbo.com/kingstore
```

Resposta esperada: HTML com meta tags dinâmicas

### 2. Teste com WhatsApp User-Agent

```bash
curl -A "WhatsApp/2.0" https://vitrineturbo.com/kingstore
```

### 3. Teste com Navegador Normal

```bash
curl -A "Mozilla/5.0" https://vitrineturbo.com/kingstore
```

Resposta esperada: Deve passar pela edge function e carregar a SPA normalmente

### 4. Validadores Oficiais

#### Facebook Sharing Debugger

**URL:** https://developers.facebook.com/tools/debug/

**Passos:**
1. Acesse o Facebook Sharing Debugger
2. Cole a URL: `https://vitrineturbo.com/kingstore`
3. Clique em "Debug" ou "Scrape Again"
4. Verifique as informações exibidas:
   - Título correto
   - Descrição correta
   - Imagem do avatar

**Importante:** Primeira vez pode mostrar cache antigo. Clique em "Scrape Again" para forçar atualização.

#### Twitter Card Validator

**URL:** https://cards-dev.twitter.com/validator

**Passos:**
1. Acesse o Twitter Card Validator
2. Cole a URL: `https://vitrineturbo.com/kingstore`
3. Clique em "Preview card"
4. Verifique preview gerado

**Nota:** Pode ser necessário ter uma conta Twitter Developer ativa.

#### LinkedIn Post Inspector

**URL:** https://www.linkedin.com/post-inspector/

**Passos:**
1. Acesse o LinkedIn Post Inspector
2. Cole a URL: `https://vitrineturbo.com/kingstore`
3. Clique em "Inspect"
4. Verifique preview

#### WhatsApp (Teste Real)

WhatsApp não tem validador público, então teste enviando a URL:

1. Abra WhatsApp Web ou app
2. Envie a URL para você mesmo: `https://vitrineturbo.com/kingstore`
3. Aguarde 5-10 segundos
4. Verifique se a prévia aparece com dados corretos

**Dica:** Se não aparecer, pode haver cache. Tente:
- Adicionar `?t=123` no final da URL para forçar nova consulta
- Aguardar 5-10 minutos (cache do WhatsApp)

### 5. Teste da Supabase Edge Function (Direto)

```bash
# Substitua pela URL do seu projeto Supabase
curl "https://[seu-projeto].supabase.co/functions/v1/meta-tags-handler?url=https://vitrineturbo.com/kingstore" \
  -H "Authorization: Bearer [ANON_KEY]" \
  -A "WhatsApp/2.0"
```

### 6. Script de Teste Automatizado

Crie um arquivo `test-meta-tags.sh`:

```bash
#!/bin/bash

URL="https://vitrineturbo.com/kingstore"

echo "==================================="
echo "Testando Meta Tags para: $URL"
echo "==================================="

echo ""
echo "1. Teste com Facebook Bot:"
curl -s -A "facebookexternalhit/1.1" "$URL" | grep -E 'og:title|og:image|og:description' | head -5

echo ""
echo "2. Teste com WhatsApp:"
curl -s -A "WhatsApp/2.0" "$URL" | grep -E 'og:title|og:image|og:description' | head -5

echo ""
echo "3. Teste com Twitter Bot:"
curl -s -A "Twitterbot/1.0" "$URL" | grep -E 'twitter:title|twitter:image|twitter:description' | head -5

echo ""
echo "4. Teste com navegador normal (não deve retornar meta tags customizadas):"
curl -s -A "Mozilla/5.0" "$URL" -I | grep -E 'HTTP|Content-Type'

echo ""
echo "==================================="
echo "Testes concluídos!"
echo "==================================="
```

Execute:

```bash
chmod +x test-meta-tags.sh
./test-meta-tags.sh
```

## Troubleshooting

### Problema: Prévias ainda mostram dados genéricos

**Possíveis causas:**

1. **Cache de redes sociais**
   - Solução: Use os debuggers para forçar re-scraping

2. **Edge function não deployada**
   - Verifique logs do Netlify: `netlify logs`
   - Confirme deploy: `netlify functions:list`

3. **Variáveis de ambiente faltando**
   - Verifique no Netlify Dashboard > Site Settings > Environment Variables
   - Confirme que `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão configuradas

4. **Slug não existe no banco**
   - Teste query direta no Supabase:
   ```sql
   SELECT name, slug, avatar_url FROM users WHERE slug = 'kingstore';
   ```

### Problema: Edge function retorna erro 500

**Debug:**

1. Verifique logs do Netlify:
```bash
netlify logs:function meta-handler
```

2. Teste localmente com Netlify Dev:
```bash
netlify dev
# Em outro terminal:
curl -A "WhatsApp/2.0" http://localhost:8888/kingstore
```

3. Verifique se dados do usuário existem no banco

### Problema: Imagem não aparece na prévia

**Checklist:**

1. Verifique se `avatar_url` está salvo no banco:
```sql
SELECT avatar_url FROM users WHERE slug = 'kingstore';
```

2. Teste se URL da imagem é acessível:
```bash
curl -I [URL_DA_IMAGEM]
```

3. Confirme que imagem tem dimensões adequadas:
   - Mínimo: 200x200px
   - Recomendado: 1200x630px (formato Open Graph)

4. Verifique se URL da imagem é HTTPS (obrigatório)

### Problema: Funciona no debugger mas não no WhatsApp

**Explicação:** WhatsApp tem cache agressivo e pode levar até 24 horas para atualizar.

**Soluções:**

1. Adicionar parâmetro único na URL:
```
https://vitrineturbo.com/kingstore?v=2
```

2. Aguardar 24h para cache expirar naturalmente

3. Tentar em outro dispositivo/número

## Monitoramento e Logs

### Logs da Netlify Edge Function

```bash
# Via CLI
netlify logs:function meta-handler --live

# Via Dashboard
Dashboard do Netlify > Functions > meta-handler > Logs
```

### Logs da Supabase Edge Function

```bash
# Via CLI Supabase
supabase functions logs meta-tags-handler --tail

# Via Dashboard
Dashboard do Supabase > Edge Functions > meta-tags-handler > Logs
```

### Métricas Importantes

Monitore:
- **Taxa de detecção de crawlers:** Quantos % de requests são crawlers
- **Tempo de resposta:** Deve ser < 500ms
- **Taxa de erro:** Idealmente 0%
- **Cache hit rate:** Idealmente > 80%

## Manutenção Futura

### Adicionar Novo Crawler

Edite `netlify/edge-functions/meta-handler.ts`:

```typescript
function isCrawlerUserAgent(userAgent: string): boolean {
  const crawlerPatterns = [
    // ... existing patterns
    'NovoCrawlerBot', // Adicione aqui
  ];
  // ...
}
```

### Atualizar Imagens de Fallback

Edite os valores padrão:

```typescript
const imageUrl = profile.avatar_url ||
                 profile.cover_url_desktop ||
                 'https://[NOVA_URL_PADRAO]';
```

### Adicionar Suporte para Páginas de Produto

A estrutura atual suporta páginas de loja. Para produtos:

1. Detecte padrão de URL: `/:slug/produtos/:productId`
2. Consulte tabela `products`
3. Use `product.featured_image_url` como imagem
4. Gere meta tags específicas do produto

## Checklist de Deploy

- [ ] Edge function criada em `netlify/edge-functions/meta-handler.ts`
- [ ] Configuração adicionada em `netlify.toml`
- [ ] Variáveis de ambiente configuradas no Netlify
- [ ] Build e deploy realizados
- [ ] Teste com curl simulando Facebook
- [ ] Teste com curl simulando WhatsApp
- [ ] Validação no Facebook Sharing Debugger
- [ ] Teste real no WhatsApp
- [ ] Verificação de logs sem erros
- [ ] Cache funcionando corretamente

## Referências

- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Facebook Sharing Best Practices](https://developers.facebook.com/docs/sharing/webmasters)
- [Netlify Edge Functions](https://docs.netlify.com/edge-functions/overview/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

## Suporte

Para problemas ou dúvidas:
1. Verifique logs das edge functions
2. Teste com curl conforme exemplos acima
3. Valide dados no banco Supabase
4. Use os debuggers oficiais das redes sociais
