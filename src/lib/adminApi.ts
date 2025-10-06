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
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Não autenticado');
  }

  console.log('Calling edge function clone-categories-products:', {
    sourceUserId,
    targetUserId,
    options
  });

  try {
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    if (!currentSession?.access_token) {
      throw new Error('Sessão inválida ou expirada. Faça login novamente.');
    }

    console.log('Session valid, invoking edge function...');

    const { data, error } = await supabase.functions.invoke('clone-categories-products', {
      body: {
        sourceUserId,
        targetUserId,
        cloneCategories: options.cloneCategories,
        cloneProducts: options.cloneProducts,
        mergeStrategy: options.mergeStrategy,
      },
    });

    console.log('Edge function response:', { data, error });

    if (error) {
      console.error('Edge function error:', error);

      // Extract detailed error message from Edge Function response
      let errorMessage = 'Erro ao clonar dados';
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

      if (error.message?.includes('Failed to send a request')) {
        errorMessage = 'Não foi possível conectar à função. Verifique se a função edge está deployada corretamente.';
      }

      if (error.message?.includes('FunctionsHttpError')) {
        errorMessage = `Erro HTTP na função: ${errorMessage}`;
      }

      throw new Error(errorMessage);
    }

    if (data?.error) {
      throw new Error(data.error.message || 'Erro ao clonar dados');
    }

    if (!data?.stats) {
      console.error('Invalid response from edge function:', data);
      throw new Error('Resposta inválida da função');
    }

    console.log('Clone completed successfully:', data.stats);

    return {
      categoriesCloned: data.stats.categoriesCloned || 0,
      productsCloned: data.stats.productsCloned || 0,
      imagesCloned: data.stats.imagesCloned || 0,
    };
  } catch (error: any) {
    console.error('Error calling clone-categories-products function:', error);

    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.');
    }

    throw new Error(error.message || 'Erro ao clonar dados');
  }
}