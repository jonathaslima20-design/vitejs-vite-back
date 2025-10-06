/**
 * Public API functions that use API Key authentication instead of JWT
 * These functions can be called without user authentication
 */

/**
 * Copy products and categories between users using public API
 * 
 * @param apiKey - The API Key for authentication (X-API-Key header)
 * @param sourceUserId - ID of the user to copy from
 * @param targetUserId - ID of the user to copy to
 * @returns Promise with copy statistics
 */
export async function copyProductsPublic(
  apiKey: string,
  sourceUserId: string,
  targetUserId: string
): Promise<{ categoriesCloned: number; productsCloned: number; imagesCloned: number }> {
  if (!apiKey) {
    throw new Error('API Key é obrigatória');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL não configurada');
  }

  const functionUrl = `${supabaseUrl}/functions/v1/copy-products-public`;

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        sourceUserId,
        targetUserId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData?.error?.message ||
        `Erro HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data?.error) {
      throw new Error(data.error.message || 'Erro ao copiar produtos');
    }

    if (!data?.stats) {
      throw new Error('Resposta inválida da função');
    }

    return {
      categoriesCloned: data.stats.categoriesCloned || 0,
      productsCloned: data.stats.productsCloned || 0,
      imagesCloned: data.stats.imagesCloned || 0,
    };
  } catch (error: any) {
    console.error('Error calling copy-products-public function:', error);

    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão.');
    }

    throw new Error(error.message || 'Erro ao copiar produtos');
  }
}

/**
 * Copy products and categories using the existing admin API (requires JWT)
 * This is a wrapper around the existing admin function for consistency
 */
export async function copyProductsAdmin(
  sourceUserId: string,
  targetUserId: string
): Promise<{ categoriesCloned: number; productsCloned: number; imagesCloned: number }> {
  // Import the existing admin function
  const { cloneUserCategoriesAndProductsAdmin } = await import('./adminApi');
  
  return cloneUserCategoriesAndProductsAdmin(sourceUserId, targetUserId, {
    cloneCategories: true,
    cloneProducts: true,
    mergeStrategy: 'merge'
  });
}