# vitejs-vite-back

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/jonathaslima20-design/vitejs-vite-back)

## API Pública - Copiar Produtos

### Função Edge: `copy-products-public`

Esta função permite copiar produtos e categorias entre usuários usando autenticação por API Key (sem necessidade de JWT).

#### Endpoint
```
POST /functions/v1/copy-products-public
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
  "cloneCategories": true,
  "cloneProducts": true,
  "mergeStrategy": "merge"
}
```

#### Parâmetros
- `sourceUserId`: ID do usuário de onde copiar os dados
- `targetUserId`: ID do usuário para onde copiar os dados
- `cloneCategories`: Se deve copiar as categorias (boolean)
- `cloneProducts`: Se deve copiar os produtos (boolean)
- `mergeStrategy`: "merge" (mesclar) ou "replace" (substituir)

#### Resposta de Sucesso
```json
{
  "success": true,
  "message": "Products and categories copied successfully",
  "stats": {
    "categoriesCloned": 5,
    "productsCloned": 23,
    "imagesCloned": 67
  }
}
```

#### Exemplo de Uso com cURL
```bash
curl -X POST \
  "https://[SEU_PROJETO].supabase.co/functions/v1/copy-products-public" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: [SUA_API_KEY]" \
  -d '{
    "sourceUserId": "123e4567-e89b-12d3-a456-426614174000",
    "targetUserId": "987fcdeb-51a2-43d7-8f9e-123456789abc",
    "cloneCategories": true,
    "cloneProducts": true,
    "mergeStrategy": "merge"
  }'
```

#### Configuração da API Key

A API Key deve ser configurada como variável de ambiente no Supabase:
```
COPY_PRODUCTS_API_KEY=sua_chave_secreta_aqui
```

#### Funcionalidades

1. **Cópia de Categorias**: Copia todas as categorias do usuário de origem
2. **Cópia de Produtos**: Copia todos os produtos com metadados completos
3. **Cópia de Imagens**: Baixa e re-upload todas as imagens para novos arquivos
4. **Estratégias de Mesclagem**:
   - `merge`: Adiciona aos dados existentes (padrão)
   - `replace`: Remove todos os dados existentes antes de copiar
5. **Validações**: Verifica limites de produtos e existência de usuários
6. **Tratamento de Erros**: Logs detalhados e rollback em caso de falha

#### Diferenças da Função Admin

- ✅ **Sem JWT**: Usa API Key em vez de autenticação JWT
- ✅ **Pública**: Pode ser chamada de sistemas externos
- ✅ **Mesma Funcionalidade**: Copia produtos e categorias igualmente
- ✅ **Logs Detalhados**: Melhor rastreamento de erros
- ✅ **Validações Robustas**: Verificações de limite e permissões

#### Segurança

- API Key deve ser mantida em segredo
- Função valida existência de usuários
- Respeita limites de produtos dos usuários
- Logs de auditoria para todas as operações