# vitejs-vite-back

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/jonathaslima20-design/vitejs-vite-back)

## API Pública - Copiar Produtos

### Função Edge: `enhanced-clone-products`

Esta função permite clonar produtos e categorias entre usuários com controle avançado e autenticação por API Key.

#### Endpoint
```
POST /functions/v1/enhanced-clone-products
```

#### Headers Obrigatórios
```
Content-Type: application/json
X-API-Key: [SUA_API_KEY]
```

#### Body da Requisição
```json
{
  "sourceUserId": "uuid-do-usuario-origem",
  "targetUserId": "uuid-do-usuario-destino",
  "options": {
    "cloneCategories": true,
    "cloneProducts": true,
    "mergeStrategy": "merge",
    "copyImages": true,
    "maxProducts": 100
  }
}
```

#### Parâmetros
- `sourceUserId`: ID do usuário de onde copiar os dados
- `targetUserId`: ID do usuário para onde copiar os dados
- `options.cloneCategories`: Se deve clonar categorias (boolean)
- `options.cloneProducts`: Se deve clonar produtos (boolean)
- `options.mergeStrategy`: "merge" (adicionar) ou "replace" (substituir)
- `options.copyImages`: Se deve copiar imagens fisicamente (boolean)
- `options.maxProducts`: Limite máximo de produtos a clonar (opcional)

#### Resposta de Sucesso
```json
{
  "success": true,
  "message": "Clone operation completed successfully",
  "stats": {
    "categoriesCloned": 5,
    "productsCloned": 23,
    "imagesCloned": 67,
    "errors": [],
    "skipped": 0,
    "totalProcessed": 28
  }
}
```

#### Exemplo de Uso com cURL
```bash
curl -X POST \
  "https://[SEU_PROJETO].supabase.co/functions/v1/enhanced-clone-products" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: [SUA_API_KEY]" \
  -d '{
    "sourceUserId": "123e4567-e89b-12d3-a456-426614174000",
    "targetUserId": "987fcdeb-51a2-43d7-8f9e-123456789abc",
    "options": {
      "cloneCategories": true,
      "cloneProducts": true,
      "mergeStrategy": "merge",
      "copyImages": true,
      "maxProducts": 100
    }
  }'
```

#### Configuração da API Key

A API Key deve ser configurada como variável de ambiente no Supabase:
```
ENHANCED_CLONE_API_KEY=sua_chave_secreta_aqui
```

#### Funcionalidades

1. **Clonagem Configurável**: Escolha o que clonar (categorias, produtos, imagens)
2. **Estratégias de Mesclagem**: Merge (adicionar) ou Replace (substituir)
3. **Cópia Física de Imagens**: Baixa e re-upload todas as imagens
4. **Controle de Limites**: Respeita limites de produtos dos usuários
5. **Progress Tracking**: Acompanhamento em tempo real do progresso
6. **Tratamento Robusto de Erros**: Logs detalhados e recuperação de falhas
7. **Validação Avançada**: Verificações pré-operação para evitar problemas

#### Modos de Operação

1. **Clonagem Rápida**: Sem imagens, ~30 segundos
2. **Clonagem Avançada**: Com imagens e controle total, ~5-15 minutos
3. **API Pública**: Via API Key, para integrações externas

#### Segurança

- ✅ API Key deve ser mantida em segredo
- ✅ Validação de existência de usuários
- ✅ Respeito aos limites de produtos
- ✅ Logs de auditoria detalhados
- ✅ Timeout protection e heartbeat
- ✅ Cleanup automático em caso de falha