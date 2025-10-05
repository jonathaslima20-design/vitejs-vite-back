# Guia Rápido - Meta Tags Dinâmicas VitrineTurbo

## O que foi implementado?

Sistema completo de meta tags dinâmicas para que prévias de URL no WhatsApp, Instagram, Facebook e outras redes sociais mostrem informações específicas de cada loja (nome, logo, descrição) em vez de dados genéricos do VitrineTurbo.

## Arquivos Criados/Modificados

### Novos Arquivos:
1. **`netlify/edge-functions/meta-handler.ts`** - Edge Function principal (Netlify)
2. **`supabase/functions/meta-tags-handler/index.ts`** - Edge Function alternativa (Supabase)
3. **`test-meta-tags.sh`** - Script de testes automatizado
4. **`SOCIAL_MEDIA_METATAGS.md`** - Documentação técnica completa

### Arquivos Modificados:
- **`netlify.toml`** - Adicionada configuração da edge function

## Deploy em 3 Passos

### 1. Configurar Variáveis de Ambiente no Netlify

Acesse: **Netlify Dashboard → Site Settings → Environment Variables**

Confirme que estas variáveis existem:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

*(Essas variáveis já devem existir do deploy anterior)*

### 2. Deploy via Git

```bash
git add .
git commit -m "feat: add dynamic social media meta tags"
git push origin main
```

O Netlify irá automaticamente:
- Detectar a edge function em `netlify/edge-functions/`
- Fazer o deploy da função
- Configurar os redirects

### 3. Validar

Teste com curl:
```bash
curl -A "WhatsApp/2.0" https://vitrineturbo.com/[SEU-SLUG]
```

Ou use o script automatizado:
```bash
./test-meta-tags.sh https://vitrineturbo.com/[SEU-SLUG]
```

## Como Testar

### Teste Rápido (1 minuto)

```bash
# Simular WhatsApp
curl -A "WhatsApp/2.0" https://vitrineturbo.com/kingstore | grep "og:title"

# Simular Facebook
curl -A "facebookexternalhit/1.1" https://vitrineturbo.com/kingstore | grep "og:image"
```

**Resultado esperado:** Deve exibir meta tags com nome e imagem do corretor

### Teste Completo (5 minutos)

```bash
# Executar todos os testes
./test-meta-tags.sh https://vitrineturbo.com/kingstore
```

### Teste em Produção (10 minutos)

1. **Facebook Sharing Debugger**
   - Acesse: https://developers.facebook.com/tools/debug/
   - Cole: `https://vitrineturbo.com/[SEU-SLUG]`
   - Clique: "Scrape Again"
   - Verifique preview

2. **WhatsApp Real**
   - Envie URL no WhatsApp
   - Aguarde 5-10 segundos
   - Verifique preview

## Como Funciona

```
┌────────────────────┐
│  Usuário Compartilha│
│  vitrineturbo.com/  │
│  kingstore          │
└──────────┬─────────┘
           │
           ▼
┌────────────────────────────────┐
│  Bot/Crawler detectado?        │
│  (WhatsApp, Facebook, etc)     │
└──────────┬─────────────────────┘
           │
           ├─── SIM ───┐
           │           ▼
           │    ┌──────────────────────┐
           │    │ Netlify Edge Function│
           │    │ 1. Extrai slug       │
           │    │ 2. Busca dados       │
           │    │ 3. Gera HTML         │
           │    └──────┬───────────────┘
           │           │
           │           ▼
           │    ┌──────────────────────┐
           │    │ HTML com meta tags   │
           │    │ personalizadas       │
           │    └──────────────────────┘
           │
           └─── NÃO ───┐
                       ▼
                ┌──────────────────────┐
                │ SPA React normal     │
                │ (usuário comum)      │
                └──────────────────────┘
```

## Priorização de Imagens

O sistema busca imagens nesta ordem:
1. **Avatar do corretor** (logo/foto de perfil) ← **PRIORIDADE**
2. Cover desktop
3. Cover mobile
4. Logo padrão VitrineTurbo

## Troubleshooting Rápido

### ❌ Prévia ainda genérica

**Solução:**
1. Force re-scraping no Facebook Debugger
2. Adicione `?v=2` no final da URL no WhatsApp
3. Aguarde 10 minutos (cache)

### ❌ Imagem não aparece

**Verificar:**
```bash
# Ver qual imagem está sendo usada
curl -s -A "WhatsApp/2.0" https://vitrineturbo.com/kingstore | grep "og:image"

# Testar se imagem é acessível
curl -I [URL_DA_IMAGEM]
```

### ❌ Edge function não funciona

**Debug:**
```bash
# Ver logs no Netlify
netlify logs:function meta-handler

# Ou no dashboard: Functions → meta-handler → Logs
```

## Performance

- **Tempo de resposta:** < 500ms
- **Cache:** 5-10 minutos
- **Impacto:** Zero para usuários normais (só crawlers)

## Dados Consultados

A edge function busca na tabela `users`:
```sql
SELECT name, slug, bio, avatar_url, cover_url_desktop, cover_url_mobile
FROM users
WHERE slug = 'kingstore'
```

## Próximos Passos

Após deploy bem-sucedido:

1. ✅ Teste com script automatizado
2. ✅ Valide no Facebook Debugger
3. ✅ Teste real no WhatsApp
4. ✅ Compartilhe em todas as redes sociais
5. ✅ Monitore logs por 24h

## Comandos Úteis

```bash
# Testar localmente
netlify dev

# Ver logs em tempo real
netlify logs:function meta-handler --live

# Deploy manual
netlify deploy --prod

# Listar edge functions
netlify functions:list
```

## Suporte

- 📖 Documentação completa: `SOCIAL_MEDIA_METATAGS.md`
- 🧪 Script de testes: `./test-meta-tags.sh`
- 🐛 Logs Netlify: Dashboard → Functions → Logs

---

**Tempo total de implementação:** ~30 minutos
**Manutenção necessária:** Mínima (configurar e esquecer)
**Impacto:** Alta visibilidade em compartilhamentos sociais
