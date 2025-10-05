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
    throw new Error(error.message || 'Erro ao atualizar email');
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
    throw new Error(error.message || 'Erro ao alterar senha');
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
 * Clone user with all associated data using admin privileges
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
    throw new Error(error.message || 'Erro ao clonar usuário');
  }

  if (data?.error) {
    throw new Error(data.error.message || 'Erro ao clonar usuário');
  }

  return { newUserId: data.newUserId };
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
    const { data, error } = await supabase.functions.invoke('clone-categories-products', {
      body: {
        sourceUserId,
        targetUserId,
        cloneCategories: options.cloneCategories,
        cloneProducts: options.cloneProducts,
        mergeStrategy: options.mergeStrategy,
      },
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message || 'Erro ao clonar dados');
    }

    if (data?.error) {
      throw new Error(data.error.message || 'Erro ao clonar dados');
    }

    if (!data?.stats) {
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

    if (error.message?.includes('fetch')) {
      throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.');
    }

    throw new Error(error.message || 'Erro ao clonar dados');
  }
}