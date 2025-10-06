import { supabase } from './supabase';
import { toast } from 'sonner';

export interface CopyProductsResult {
  success: boolean;
  categoriesCloned: number;
  productsCloned: number;
  imagesCloned: number;
  errors: string[];
  skipped: number;
}

/**
 * Função aprimorada para copiar produtos entre usuários
 * - Remove limites artificiais
 * - Copia fisicamente todas as imagens
 * - Melhor tratamento de erros
 * - Progress tracking
 */
export async function simpleCopyProducts(
  sourceUserId: string,
  targetUserId: string,
  onProgress?: (progress: { current: number; total: number; message: string }) => void
): Promise<CopyProductsResult> {
  const result: CopyProductsResult = {
    success: false,
    categoriesCloned: 0,
    productsCloned: 0,
    imagesCloned: 0,
    errors: [],
    skipped: 0
  };

  try {
    console.log('🚀 Iniciando cópia completa de produtos:', {
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

    onProgress?.({ current: 1, total: 10, message: 'Usuários validados...' });

    // 2. Copiar categorias (sem limite)
    const { data: sourceCategories } = await supabase
      .from('user_product_categories')
      .select('name')
      .eq('user_id', sourceUserId);

    if (sourceCategories && sourceCategories.length > 0) {
      console.log(`📁 Copiando ${sourceCategories.length} categorias...`);
      onProgress?.({ current: 2, total: 10, message: `Copiando ${sourceCategories.length} categorias...` });

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

    // 3. Buscar TODOS os produtos (sem limite)
    const { data: sourceProducts, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', sourceUserId);

    if (fetchError) {
      result.errors.push(`Erro ao buscar produtos: ${fetchError.message}`);
      return result;
    }

    if (!sourceProducts || sourceProducts.length === 0) {
      result.errors.push('Nenhum produto encontrado no usuário de origem');
      return result;
    }

    console.log(`📦 Encontrados ${sourceProducts.length} produtos para copiar`);
    onProgress?.({ current: 3, total: 10, message: `Encontrados ${sourceProducts.length} produtos...` });

    // 4. Remover limite de produtos do usuário de destino temporariamente
    const originalLimit = targetUser.data.listing_limit;
    console.log(`🔓 Removendo limite temporariamente (era ${originalLimit})`);
    
    await supabase
      .from('users')
      .update({ listing_limit: 9999 }) // Limite temporário muito alto
      .eq('id', targetUserId);

    try {
      // 5. Copiar produtos um por vez com cópia física de imagens
      for (let i = 0; i < sourceProducts.length; i++) {
        const product = sourceProducts[i];
        const progressPercent = Math.round(((i + 1) / sourceProducts.length) * 100);
        
        onProgress?.({ 
          current: 4 + Math.round((i / sourceProducts.length) * 5), 
          total: 10, 
          message: `Copiando produto ${i + 1}/${sourceProducts.length}: ${product.title.substring(0, 30)}...` 
        });

        try {
          console.log(`📦 Copiando produto ${i + 1}/${sourceProducts.length}: ${product.title}`);

          // Criar novo produto
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
              is_visible_on_storefront: false, // Criar como oculto inicialmente para revisão
              external_checkout_url: product.external_checkout_url,
              colors: product.colors,
              sizes: product.sizes,
              display_order: product.display_order
            })
            .select()
            .single();

          if (productError) {
            result.errors.push(`Erro ao criar produto "${product.title}": ${productError.message}`);
            result.skipped++;
            continue;
          }

          result.productsCloned++;
          console.log(`✅ Produto criado: ${newProduct.title}`);

          // 6. Copiar TODAS as imagens fisicamente (sem limite)
          const { data: productImages } = await supabase
            .from('product_images')
            .select('*')
            .eq('product_id', product.id);

          if (productImages && productImages.length > 0) {
            console.log(`🖼️ Copiando ${productImages.length} imagens fisicamente...`);
            let featuredImageUrl = null;

            for (let imgIndex = 0; imgIndex < productImages.length; imgIndex++) {
              const image = productImages[imgIndex];
              
              try {
                console.log(`🖼️ Baixando imagem ${imgIndex + 1}/${productImages.length}...`);
                
                // Baixar imagem original
                const imageResponse = await fetch(image.url, {
                  headers: {
                    'User-Agent': 'VitrineTurbo-Copy-Function/2.0'
                  }
                });

                if (!imageResponse.ok) {
                  console.warn(`⚠️ Falha ao baixar imagem: HTTP ${imageResponse.status}`);
                  continue;
                }

                const imageBlob = await imageResponse.blob();
                console.log(`📥 Imagem baixada: ${(imageBlob.size / 1024).toFixed(1)}KB`);

                // Gerar nome único para evitar conflitos
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(2, 11);
                const fileExtension = image.url.split('.').pop()?.split('?')[0] || 'jpg';
                const newFileName = `${newProduct.id}-${timestamp}-${randomStr}-${imgIndex}.${fileExtension}`;
                const newFilePath = `products/${newFileName}`;

                // Upload da nova imagem
                const { error: uploadError } = await supabase.storage
                  .from('public')
                  .upload(newFilePath, imageBlob, {
                    contentType: imageBlob.type,
                    cacheControl: '3600',
                    upsert: false
                  });

                if (uploadError) {
                  console.warn(`⚠️ Erro no upload da imagem: ${uploadError.message}`);
                  continue;
                }

                // Obter URL pública da nova imagem
                const { data: { publicUrl } } = supabase.storage
                  .from('public')
                  .getPublicUrl(newFilePath);

                console.log(`📤 Nova imagem salva: ${newFilePath}`);

                // Salvar referência da nova imagem
                const { error: imageError } = await supabase
                  .from('product_images')
                  .insert({
                    product_id: newProduct.id,
                    url: publicUrl,
                    is_featured: image.is_featured
                  });

                if (imageError) {
                  console.warn(`⚠️ Erro ao salvar referência da imagem: ${imageError.message}`);
                  // Tentar limpar o arquivo enviado
                  await supabase.storage
                    .from('public')
                    .remove([newFilePath]);
                  continue;
                }

                if (image.is_featured) {
                  featuredImageUrl = publicUrl;
                }

                result.imagesCloned++;
                console.log(`✅ Imagem ${imgIndex + 1} copiada fisicamente com sucesso`);

              } catch (imageError) {
                console.warn(`⚠️ Falha ao processar imagem ${imgIndex + 1}:`, imageError);
                result.errors.push(`Erro na imagem ${imgIndex + 1} do produto "${product.title}": ${imageError}`);
              }
            }

            // Atualizar URL da imagem principal
            if (featuredImageUrl) {
              await supabase
                .from('products')
                .update({ featured_image_url: featuredImageUrl })
                .eq('id', newProduct.id);
              
              console.log('🌟 Imagem principal definida');
            }
          }

        } catch (productError) {
          result.errors.push(`Erro ao processar produto "${product.title}": ${productError}`);
          result.skipped++;
          console.error(`❌ Erro no produto "${product.title}":`, productError);
        }
      }

    } finally {
      // 7. Restaurar limite original do usuário
      console.log(`🔒 Restaurando limite original (${originalLimit})`);
      await supabase
        .from('users')
        .update({ listing_limit: originalLimit })
        .eq('id', targetUserId);
    }

    // 8. Sincronizar configurações da vitrine
    try {
      console.log('⚙️ Sincronizando configurações da vitrine...');
      onProgress?.({ current: 9, total: 10, message: 'Sincronizando configurações...' });
      
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

    onProgress?.({ current: 10, total: 10, message: 'Cópia concluída!' });

    result.success = result.productsCloned > 0;
    console.log('🎉 Cópia concluída com sucesso:', {
      categoriesCloned: result.categoriesCloned,
      productsCloned: result.productsCloned,
      imagesCloned: result.imagesCloned,
      errors: result.errors.length,
      skipped: result.skipped
    });

    return result;

  } catch (error: any) {
    console.error('❌ Erro geral na cópia:', error);
    result.errors.push(`Erro geral: ${error.message}`);
    return result;
  }
}

/**
 * Função ainda mais simples - apenas produtos, sem imagens (ultra-rápida)
 */
export async function simpleCopyProductsOnly(
  sourceUserId: string,
  targetUserId: string,
  onProgress?: (progress: { current: number; total: number; message: string }) => void
): Promise<CopyProductsResult> {
  const result: CopyProductsResult = {
    success: false,
    categoriesCloned: 0,
    productsCloned: 0,
    imagesCloned: 0,
    errors: [],
    skipped: 0
  };

  try {
    console.log('🚀 Cópia ultra-rápida (apenas produtos, sem imagens)');
    onProgress?.({ current: 1, total: 5, message: 'Iniciando cópia ultra-rápida...' });

    // Buscar TODOS os produtos do usuário de origem (sem limite)
    const { data: sourceProducts, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', sourceUserId);

    if (fetchError) {
      result.errors.push(`Erro ao buscar produtos: ${fetchError.message}`);
      return result;
    }

    if (!sourceProducts || sourceProducts.length === 0) {
      result.errors.push('Nenhum produto encontrado no usuário de origem');
      return result;
    }

    console.log(`📦 Encontrados ${sourceProducts.length} produtos para copiar`);
    onProgress?.({ current: 2, total: 5, message: `Encontrados ${sourceProducts.length} produtos...` });

    // Remover limite temporariamente
    const { data: targetUser } = await supabase
      .from('users')
      .select('listing_limit')
      .eq('id', targetUserId)
      .single();

    const originalLimit = targetUser?.listing_limit || 50;
    
    await supabase
      .from('users')
      .update({ listing_limit: 9999 })
      .eq('id', targetUserId);

    try {
      onProgress?.({ current: 3, total: 5, message: 'Copiando produtos em lote...' });

      // Copiar produtos em lotes para melhor performance
      const BATCH_SIZE = 10;
      const batches = [];
      for (let i = 0; i < sourceProducts.length; i += BATCH_SIZE) {
        batches.push(sourceProducts.slice(i, i + BATCH_SIZE));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`📦 Processando lote ${batchIndex + 1}/${batches.length} (${batch.length} produtos)`);
        
        const batchInserts = batch.map(product => ({
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
          is_visible_on_storefront: false, // Criar como oculto inicialmente
          external_checkout_url: product.external_checkout_url,
          colors: product.colors,
          sizes: product.sizes,
          display_order: product.display_order
        }));

        const { data: insertedProducts, error: insertError } = await supabase
          .from('products')
          .insert(batchInserts)
          .select();

        if (insertError) {
          result.errors.push(`Erro no lote ${batchIndex + 1}: ${insertError.message}`);
          result.skipped += batch.length;
        } else {
          result.productsCloned += insertedProducts?.length || 0;
          console.log(`✅ Lote ${batchIndex + 1} copiado: ${insertedProducts?.length || 0} produtos`);
        }

        // Pequena pausa entre lotes para não sobrecarregar
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

    } finally {
      // Restaurar limite original
      await supabase
        .from('users')
        .update({ listing_limit: originalLimit })
        .eq('id', targetUserId);
    }

    onProgress?.({ current: 5, total: 5, message: 'Cópia ultra-rápida concluída!' });

    result.success = result.productsCloned > 0;
    return result;

  } catch (error: any) {
    result.errors.push(`Erro geral: ${error.message}`);
    return result;
  }
}

/**
 * Função para copiar apenas imagens de produtos existentes
 */
export async function copyProductImages(
  sourceUserId: string,
  targetUserId: string,
  onProgress?: (progress: { current: number; total: number; message: string }) => void
): Promise<CopyProductsResult> {
  const result: CopyProductsResult = {
    success: false,
    categoriesCloned: 0,
    productsCloned: 0,
    imagesCloned: 0,
    errors: [],
    skipped: 0
  };

  try {
    console.log('🖼️ Copiando apenas imagens de produtos...');
    
    // Buscar produtos do usuário de destino que não têm imagens
    const { data: targetProducts } = await supabase
      .from('products')
      .select('id, title')
      .eq('user_id', targetUserId)
      .is('featured_image_url', null);

    if (!targetProducts || targetProducts.length === 0) {
      result.errors.push('Nenhum produto sem imagem encontrado no usuário de destino');
      return result;
    }

    // Buscar produtos correspondentes do usuário de origem
    const { data: sourceProducts } = await supabase
      .from('products')
      .select('id, title')
      .eq('user_id', sourceUserId);

    if (!sourceProducts || sourceProducts.length === 0) {
      result.errors.push('Nenhum produto encontrado no usuário de origem');
      return result;
    }

    // Mapear produtos por título para encontrar correspondências
    const sourceProductsMap = new Map(
      sourceProducts.map(p => [p.title.toLowerCase(), p.id])
    );

    let processedCount = 0;
    for (const targetProduct of targetProducts) {
      const sourceProductId = sourceProductsMap.get(targetProduct.title.toLowerCase());
      
      if (!sourceProductId) {
        console.log(`⚠️ Produto correspondente não encontrado: ${targetProduct.title}`);
        continue;
      }

      onProgress?.({ 
        current: processedCount + 1, 
        total: targetProducts.length, 
        message: `Copiando imagens: ${targetProduct.title.substring(0, 30)}...` 
      });

      // Copiar imagens do produto correspondente
      const { data: sourceImages } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', sourceProductId);

      if (sourceImages && sourceImages.length > 0) {
        let featuredImageUrl = null;

        for (const image of sourceImages) {
          try {
            // Baixar e re-upload da imagem
            const imageResponse = await fetch(image.url);
            if (!imageResponse.ok) continue;

            const imageBlob = await imageResponse.blob();
            const newFileName = `${targetProduct.id}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.jpg`;
            const newFilePath = `products/${newFileName}`;

            const { error: uploadError } = await supabase.storage
              .from('public')
              .upload(newFilePath, imageBlob);

            if (uploadError) continue;

            const { data: { publicUrl } } = supabase.storage
              .from('public')
              .getPublicUrl(newFilePath);

            // Salvar referência
            await supabase
              .from('product_images')
              .insert({
                product_id: targetProduct.id,
                url: publicUrl,
                is_featured: image.is_featured
              });

            if (image.is_featured) {
              featuredImageUrl = publicUrl;
            }

            result.imagesCloned++;

          } catch (error) {
            console.warn('Erro ao copiar imagem:', error);
          }
        }

        // Atualizar imagem principal do produto
        if (featuredImageUrl) {
          await supabase
            .from('products')
            .update({ featured_image_url: featuredImageUrl })
            .eq('id', targetProduct.id);
        }
      }

      processedCount++;
    }

    result.success = result.imagesCloned > 0;
    return result;

  } catch (error: any) {
    result.errors.push(`Erro geral: ${error.message}`);
    return result;
  }
}