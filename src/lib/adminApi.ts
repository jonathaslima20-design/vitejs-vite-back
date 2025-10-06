import { supabase } from './supabase';

/**
 * Update user email using admin privileges
 */
export async function updateUserEmailAdmin(userId: string, newEmail: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Não autenticado');
  }

  const { data, error } = await supabase.functions.invoke('update-user-email', {
    body: { userId, newEmail },
  });

  if (error) {
    // Extract detailed error message from Edge Function response
    let errorMessage = 'Erro ao atualizar email';
    if (error.context?.body) {
      try {
        const errorBody = typeof error.context.body === 'string' 
          ? JSON.parse(error.context.body) 
          : error.context.body;
        errorMessage = errorBody.error?.message || errorBody.message || errorMessage;
      } catch (parseError) {
        // If parsing fails, use the original error message
        errorMessage = error.message || errorMessage;
      }
    } else {
      errorMessage = error.message || errorMessage;
    }
    throw new Error(errorMessage);
  }

  if (data?.error) {
    throw new Error(data.error.message || 'Erro ao atualizar email');
  }
}

/**
 * Change user password using admin privileges
 */
export async function changeUserPassword(userId: string, newPassword: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Não autenticado');
  }

  const { data, error } = await supabase.functions.invoke('change-user-password', {
    body: { userId, newPassword },
  });

  if (error) {
    // Extract detailed error message from Edge Function response
    let errorMessage = 'Erro ao alterar senha';
    if (error.context?.body) {
      try {
        const errorBody = typeof error.context.body === 'string' 
          ? JSON.parse(error.context.body) 
          : error.context.body;
        errorMessage = errorBody.error?.message || errorBody.message || errorMessage;
      } catch (parseError) {
        // If parsing fails, use the original error message
        errorMessage = error.message || errorMessage;
      }
    } else {
      errorMessage = error.message || errorMessage;
    }
    throw new Error(errorMessage);
  }

  if (data?.error) {
    throw new Error(data.error.message || 'Erro ao alterar senha');
  }
}

/**
 * Reset user password using admin privileges (alias for changeUserPassword)
 */
export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  return changeUserPassword(userId, newPassword);
}

/**
 * Clone user with all associated data using admin privileges (requires JWT)
 */
export async function cloneUserAdmin(
  originalUserId: string,
  newUserData: {
    email: string;
    password: string;
    name: string;
    slug: string;
  }
): Promise<{ newUserId: string }> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Não autenticado');
  }

  const { data, error } = await supabase.functions.invoke('clone-user', {
    body: { originalUserId, newUserData },
  });

  if (error) {
    // Extract detailed error message from Edge Function response
    let errorMessage = 'Erro ao clonar usuário';
    if (error.context?.body) {
      try {
        const errorBody = typeof error.context.body === 'string' 
          ? JSON.parse(error.context.body) 
          : error.context.body;
        errorMessage = errorBody.error?.message || errorBody.message || errorMessage;
      } catch (parseError) {
        // If parsing fails, use the original error message
        errorMessage = error.message || errorMessage;
      }
    } else {
      errorMessage = error.message || errorMessage;
    }
    throw new Error(errorMessage);
  }

  if (data?.error) {
    throw new Error(data.error.message || 'Erro ao clonar usuário');
  }

  return { newUserId: data.newUserId };
}

/**
 * Clone user with all associated data using API Key (No JWT required - Public endpoint)
 * This function can be called without authentication by providing a valid API Key
 *
 * @param apiKey - The API Key for authentication (X-API-Key header)
 * @param originalUserId - ID of the user to clone from
 * @param newUserData - Data for the new user
 * @returns Promise with the new user ID
 */
export async function cloneUserPublic(
  apiKey: string,
  originalUserId: string,
  newUserData: {
    email: string;
    password: string;
    name: string;
    slug: string;
  }
): Promise<{ newUserId: string }> {
  if (!apiKey) {
    throw new Error('API Key é obrigatória');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL não configurada');
  }

  const functionUrl = `${supabaseUrl}/functions/v1/clone-user`;

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        originalUserId,
        newUserData,
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
      throw new Error(data.error.message || 'Erro ao clonar usuário');
    }

    if (!data?.newUserId) {
      throw new Error('Resposta inválida da função');
    }

    return { newUserId: data.newUserId };
  } catch (error: any) {
    console.error('Error calling clone-user function:', error);

    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão.');
    }

    throw new Error(error.message || 'Erro ao clonar usuário');
  }
}

/**
 * Clone categories and products from one user to another using admin privileges
 */
export async function cloneUserCategoriesAndProductsAdmin(
  sourceUserId: string,
  targetUserId: string,
  options: {
    cloneCategories: boolean;
    cloneProducts: boolean;
    mergeStrategy: 'merge' | 'replace';
  }
): Promise<{ categoriesCloned: number; productsCloned: number; imagesCloned: number }> {
  console.log('🔄 Starting clone operation:', {
    sourceUserId: sourceUserId.substring(0, 8),
    targetUserId: targetUserId.substring(0, 8),
    options
  });

  // Refresh the session to ensure we have a valid token
  const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

  if (refreshError || !session) {
    console.error('❌ Session refresh failed:', refreshError);
    throw new Error('Não autenticado ou sessão expirada');
  }

  // Validate users exist before calling edge function
  const [sourceUser, targetUser] = await Promise.all([
    supabase.from('users').select('id, name').eq('id', sourceUserId).single(),
    supabase.from('users').select('id, name, listing_limit').eq('id', targetUserId).single()
  ]);

  if (sourceUser.error || !sourceUser.data) {
    throw new Error('Usuário de origem não encontrado');
  }

  if (targetUser.error || !targetUser.data) {
    throw new Error('Usuário de destino não encontrado');
  }

  console.log('✅ Users validated:', {
    source: sourceUser.data.name,
    target: targetUser.data.name
  });

  try {
    console.log('🚀 Invoking edge function with extended timeout...');

    // Create a promise with custom timeout (5 minutes)
    const invokePromise = supabase.functions.invoke('clone-categories-products', {
      body: {
        sourceUserId,
        targetUserId,
        cloneCategories: options.cloneCategories,
        cloneProducts: options.cloneProducts,
        mergeStrategy: options.mergeStrategy,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: Operação demorou mais de 5 minutos')), 5 * 60 * 1000);
    });

    const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as any;

    console.log('📥 Edge function response received:', { 
      hasData: !!data, 
      hasError: !!error,
      errorType: error?.name || 'none'
    });

    if (error) {
      console.error('Edge function error:', error);

      // Extract detailed error message from Edge Function response
      let errorMessage = 'Erro ao clonar dados';
      
      // Enhanced error parsing
      if (error.message?.includes('Failed to send a request')) {
        errorMessage = 'Não foi possível conectar à função. Verifique se a função edge está deployada corretamente.';
      } else if (error.message?.includes('FunctionsHttpError')) {
        // Try to extract more details from the error
        if (error.context?.body) {
          try {
            const errorBody = typeof error.context.body === 'string' 
              ? JSON.parse(error.context.body) 
              : error.context.body;
            errorMessage = errorBody.error?.message || errorBody.message || errorMessage;
          } catch (parseError) {
            console.warn('Failed to parse error body:', parseError);
            errorMessage = error.message || errorMessage;
          }
        } else {
          errorMessage = `Erro HTTP na função: ${error.message || 'Erro desconhecido'}`;
        }
      } else if (error.context?.body) {
        try {
          const errorBody = typeof error.context.body === 'string' 
            ? JSON.parse(error.context.body) 
            : error.context.body;
          errorMessage = errorBody.error?.message || errorBody.message || errorMessage;
        } catch (parseError) {
          console.warn('Failed to parse error context:', parseError);
          errorMessage = error.message || errorMessage;
        }
      } else {
        errorMessage = error.message || errorMessage;
      }

      console.error('❌ Final error message:', errorMessage);

      throw new Error(errorMessage);
    }

    if (data?.error) {
      console.error('❌ Edge function returned error:', data.error);
      throw new Error(data.error.message || 'Erro ao clonar dados');
    }

    if (!data?.stats) {
      console.error('Invalid response from edge function:', data);
      throw new Error('Resposta inválida da função');
    }

    console.log('✅ Clone completed successfully:', data.stats);

    return {
      categoriesCloned: data.stats.categoriesCloned || 0,
      productsCloned: data.stats.productsCloned || 0,
      imagesCloned: data.stats.imagesCloned || 0,
    };
  } catch (error: any) {
    console.error('Error calling clone-categories-products function:', error);

    // Enhanced error categorization
    if (error.message?.includes('Timeout')) {
      throw new Error('A operação demorou muito para ser concluída. Tente novamente com menos produtos ou em horário de menor movimento.');
    } else if (error.message?.includes('fetch') || error.message?.includes('network')) {
      throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.');
    } else if (error.message?.includes('JWT') || error.message?.includes('token')) {
      throw new Error('Sessão expirada. Faça login novamente e tente a operação.');
    } else if (error.message?.includes('limit') || error.message?.includes('quota')) {
      throw new Error('Limite de recursos atingido. Tente novamente em alguns minutos.');
    }

    throw new Error(error.message || 'Erro ao clonar dados');
  }
}