import { supabase } from './supabase';
import { toast } from 'sonner';

export interface CopyProductsResult {
  success: boolean;
  categoriesCloned: number;
  productsCloned: number;
  imagesCloned: number;
  errors: string[];
}

/**
 * Função simples para copiar produtos entre usuários
 * Sem edge functions, sem complexidade - apenas operações diretas no banco
 */
export async function simpleCopyProducts(
  sourceUserId: string,
  targetUserId: string
): Promise<CopyProductsResult> {
  const result: CopyProductsResult = {
    success: false,
    categoriesCloned: 0,
    productsCloned: 0,
    imagesCloned: 0,
    errors: []
  };

  try {
    console.log('🚀 Iniciando cópia simples de produtos:', {
      sourceUserId: sourceUserId.substring(0, 8),
      targetUserId: targetUserId.substring(0, 8)
    });

    // 1. Validar usuários
    const [sourceUser, targetUser] = await Promise.all([
      supabase.from('users').select('id, name, listing_limit').eq('id', sourceUserId).single(),
      supabase.from('users').select('id, name, listing_limit').eq('id', targetUserId).single()
    ]);

    if (sourceUser.error) {
      result.errors.push('Usuário de origem não encontrado');
      return result;
    }

    if (targetUser.error) {
      result.errors.push('Usuário de destino não encontrado');
      return result;
    }

    console.log('✅ Usuários validados:', {
      source: sourceUser.data.name,
      target: targetUser.data.name
    });

    // 2. Copiar categorias (simples - sem verificação de duplicatas)
    const { data: sourceCategories } = await supabase
      .from('user_product_categories')
      .select('name')
      .eq('user_id', sourceUserId);

    if (sourceCategories && sourceCategories.length > 0) {
      console.log(`📁 Copiando ${sourceCategories.length} categorias...`);

      // Buscar categorias existentes no destino
      const { data: existingCategories } = await supabase
        .from('user_product_categories')
        .select('name')
        .eq('user_id', targetUserId);

      const existingNames = new Set(existingCategories?.map(c => c.name.toLowerCase()) || []);
      
      // Filtrar apenas categorias novas
      const newCategories = sourceCategories.filter(cat => 
        !existingNames.has(cat.name.toLowerCase())
      );

      if (newCategories.length > 0) {
        const categoryInserts = newCategories.map(cat => ({
          user_id: targetUserId,
          name: cat.name
        }));

        const { error: categoryError } = await supabase
          .from('user_product_categories')
          .insert(categoryInserts);

        if (categoryError) {
          result.errors.push(`Erro ao copiar categorias: ${categoryError.message}`);
        } else {
          result.categoriesCloned = newCategories.length;
          console.log(`✅ ${result.categoriesCloned} categorias copiadas`);
        }
      } else {
        console.log('ℹ️ Todas as categorias já existem no destino');
      }
    }

    // 3. Copiar produtos (um por vez para evitar timeout)
    const { data: sourceProducts } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', sourceUserId)
      .limit(50); // Limitar para evitar timeout

    if (sourceProducts && sourceProducts.length > 0) {
      console.log(`📦 Copiando ${sourceProducts.length} produtos...`);

      // Verificar limite do usuário de destino
      const { count: existingProductCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId);

      const totalAfterCopy = (existingProductCount || 0) + sourceProducts.length;
      const listingLimit = targetUser.data.listing_limit || 50;

      if (totalAfterCopy > listingLimit) {
        result.errors.push(`Limite excedido: ${totalAfterCopy} produtos, limite: ${listingLimit}`);
        return result;
      }

      // Copiar produtos um por vez
      for (const product of sourceProducts) {
        try {
          console.log(`📦 Copiando produto: ${product.title}`);

          // Criar novo produto (sem imagens primeiro)
          const { data: newProduct, error: productError } = await supabase
            .from('products')
            .insert({
              user_id: targetUserId,
              title: product.title,
              description: product.description,
              price: product.price,
              discounted_price: product.discounted_price,
              status: product.status,
              category: product.category,
              brand: product.brand,
              model: product.model,
              gender: product.gender,
              condition: product.condition,
              video_url: product.video_url,
              featured_offer_price: product.featured_offer_price,
              featured_offer_installment: product.featured_offer_installment,
              featured_offer_description: product.featured_offer_description,
              is_starting_price: product.is_starting_price,
              short_description: product.short_description,
              is_visible_on_storefront: product.is_visible_on_storefront,
              external_checkout_url: product.external_checkout_url,
              colors: product.colors,
              sizes: product.sizes,
              display_order: product.display_order
            })
            .select()
            .single();

          if (productError) {
            result.errors.push(`Erro ao criar produto "${product.title}": ${productError.message}`);
            continue;
          }

          result.productsCloned++;
          console.log(`✅ Produto criado: ${newProduct.title}`);

          // 4. Copiar imagens do produto (método simples)
          const { data: productImages } = await supabase
            .from('product_images')
            .select('*')
            .eq('product_id', product.id);

          if (productImages && productImages.length > 0) {
            console.log(`🖼️ Copiando ${productImages.length} imagens...`);
            let featuredImageUrl = null;

            for (const image of productImages) {
              try {
                // Método simples: apenas referenciar a mesma URL
                // (não copia fisicamente o arquivo - mais rápido e simples)
                const { error: imageError } = await supabase
                  .from('product_images')
                  .insert({
                    product_id: newProduct.id,
                    url: image.url, // Reutiliza a mesma URL
                    is_featured: image.is_featured
                  });

                if (imageError) {
                  console.warn(`⚠️ Erro ao copiar imagem: ${imageError.message}`);
                  continue;
                }

                if (image.is_featured) {
                  featuredImageUrl = image.url;
                }

                result.imagesCloned++;
                console.log(`✅ Imagem referenciada: ${image.url.split('/').pop()}`);

              } catch (imageError) {
                console.warn(`⚠️ Falha ao processar imagem:`, imageError);
              }
            }

            // Atualizar URL da imagem principal
            if (featuredImageUrl) {
              await supabase
                .from('products')
                .update({ featured_image_url: featuredImageUrl })
                .eq('id', newProduct.id);
            }
          }

        } catch (productError) {
          result.errors.push(`Erro ao processar produto "${product.title}": ${productError}`);
          console.error(`❌ Erro no produto "${product.title}":`, productError);
        }
      }
    }

    // 5. Sincronizar configurações da vitrine
    try {
      console.log('⚙️ Sincronizando configurações da vitrine...');
      
      // Buscar configurações do usuário de origem
      const { data: sourceSettings } = await supabase
        .from('user_storefront_settings')
        .select('settings')
        .eq('user_id', sourceUserId)
        .maybeSingle();

      if (sourceSettings?.settings) {
        // Aplicar configurações no usuário de destino (merge com existentes)
        const { data: targetSettings } = await supabase
          .from('user_storefront_settings')
          .select('settings')
          .eq('user_id', targetUserId)
          .maybeSingle();

        const mergedSettings = {
          ...targetSettings?.settings,
          ...sourceSettings.settings,
          // Manter configurações específicas do usuário de destino se existirem
          categoryDisplaySettings: [
            ...(targetSettings?.settings?.categoryDisplaySettings || []),
            ...(sourceSettings.settings.categoryDisplaySettings || [])
          ]
        };

        await supabase
          .from('user_storefront_settings')
          .upsert({
            user_id: targetUserId,
            settings: mergedSettings
          }, {
            onConflict: 'user_id'
          });

        console.log('✅ Configurações sincronizadas');
      }
    } catch (settingsError) {
      console.warn('⚠️ Erro ao sincronizar configurações (não crítico):', settingsError);
    }

    result.success = true;
    console.log('🎉 Cópia concluída com sucesso:', {
      categoriesCloned: result.categoriesCloned,
      productsCloned: result.productsCloned,
      imagesCloned: result.imagesCloned,
      errors: result.errors.length
    });

    return result;

  } catch (error: any) {
    console.error('❌ Erro geral na cópia:', error);
    result.errors.push(`Erro geral: ${error.message}`);
    return result;
  }
}

/**
 * Função ainda mais simples - apenas produtos, sem imagens
 */
export async function simpleCopyProductsOnly(
  sourceUserId: string,
  targetUserId: string
): Promise<CopyProductsResult> {
  const result: CopyProductsResult = {
    success: false,
    categoriesCloned: 0,
    productsCloned: 0,
    imagesCloned: 0,
    errors: []
  };

  try {
    console.log('🚀 Cópia ultra-simples (apenas produtos)');

    // Buscar produtos do usuário de origem
    const { data: sourceProducts, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', sourceUserId)
      .limit(20); // Limite baixo para garantir sucesso

    if (fetchError) {
      result.errors.push(`Erro ao buscar produtos: ${fetchError.message}`);
      return result;
    }

    if (!sourceProducts || sourceProducts.length === 0) {
      result.errors.push('Nenhum produto encontrado no usuário de origem');
      return result;
    }

    console.log(`📦 Encontrados ${sourceProducts.length} produtos para copiar`);

    // Copiar produtos sem imagens
    for (const product of sourceProducts) {
      try {
        const { error: insertError } = await supabase
          .from('products')
          .insert({
            user_id: targetUserId,
            title: `[CÓPIA] ${product.title}`,
            description: product.description,
            price: product.price,
            discounted_price: product.discounted_price,
            status: product.status,
            category: product.category,
            brand: product.brand,
            condition: product.condition,
            is_starting_price: product.is_starting_price,
            short_description: product.short_description,
            is_visible_on_storefront: false, // Criar como oculto inicialmente
            colors: product.colors,
            sizes: product.sizes
          });

        if (insertError) {
          result.errors.push(`Erro ao copiar "${product.title}": ${insertError.message}`);
        } else {
          result.productsCloned++;
          console.log(`✅ Produto copiado: ${product.title}`);
        }

      } catch (error: any) {
        result.errors.push(`Erro no produto "${product.title}": ${error.message}`);
      }
    }

    result.success = result.productsCloned > 0;
    return result;

  } catch (error: any) {
    result.errors.push(`Erro geral: ${error.message}`);
    return result;
  }
}