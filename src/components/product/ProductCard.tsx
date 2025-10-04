import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyI18n, useTranslation, type SupportedLanguage, type SupportedCurrency } from '@/lib/i18n';
import { useCart } from '@/contexts/CartContext';
import ProductVariantModal from './ProductVariantModal';
import type { Product } from '@/types';
import { useState } from 'react';

interface ProductCardProps {
  product: Product;
  corretorSlug: string;
  currency?: SupportedCurrency;
  language?: SupportedLanguage;
}

export function ProductCard({
  product,
  corretorSlug,
  currency = 'BRL',
  language = 'pt-BR'
}: ProductCardProps) {
  const { t } = useTranslation(language);
  const { addToCart, isInCart, getItemQuantity } = useCart();
  const [showVariantModal, setShowVariantModal] = useState(false);

  // Calculate discount information
  const hasDiscount = product.discounted_price && product.discounted_price < product.price;
  const displayPrice = hasDiscount ? product.discounted_price : product.price;
  const originalPrice = hasDiscount ? product.price : null;
  const discountPercentage = hasDiscount 
    ? Math.round(((product.price - product.discounted_price!) / product.price) * 100)
    : null;

  const isAvailable = product.status === 'disponivel';
  const hasPrice = product.price && product.price > 0;
  
  // More robust checking for colors and sizes with debug logging
  const hasColors = product.colors && 
                   Array.isArray(product.colors) && 
                   product.colors.length > 0 &&
                   product.colors.some(color => color && color.trim().length > 0);
                   
  const hasSizes = product.sizes && 
                  Array.isArray(product.sizes) && 
                  product.sizes.length > 0 &&
                  product.sizes.some(size => size && size.trim().length > 0);
                  
  const hasOptions = hasColors || hasSizes;
  
  const totalInCart = getItemQuantity(product.id);

  // Debug logging for troubleshooting
  if (process.env.NODE_ENV === 'development') {
    console.log('🛒 ProductCard - Product data:', {
      id: product.id,
      title: product.title,
      colors: product.colors,
      sizes: product.sizes,
      hasColors,
      hasSizes,
      hasOptions
    });
  }

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If product has options (colors/sizes), show variant modal
    if (isAvailable && hasPrice && hasOptions) {
      setShowVariantModal(true);
      return;
    }
    
    // For products without options, add directly to cart
    if (isAvailable && hasPrice && !hasOptions) {
      addToCart(product);
      return;
    }
    
    // Don't do anything for products without price or not available
    if (!hasPrice) {
      return;
    }
    
    if (!isAvailable) {
      return;
    }
  };

  return (
    <motion.div 
      className="h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Link 
        to={`/${corretorSlug}/produtos/${product.id}`}
        className="block h-full"
      >
        <div className="rounded-xl border bg-card text-card-foreground shadow overflow-hidden h-full flex flex-col hover:shadow-lg transition-all duration-300 cursor-pointer">
          {/* Image Container */}
          <div className="relative aspect-square overflow-hidden p-3">
            <div className="w-full h-full bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
              <img
                src={product.featured_image_url || 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg'}
                alt={product.title}
                className="w-full h-full object-cover"
                loading="lazy"
                style={{ 
                  backgroundColor: '#ffffff',
                  backgroundImage: 'none'
                }}
              />
            </div>
            
            {/* Discount Badge - Top Right */}
            {hasDiscount && discountPercentage && (
              <div className="absolute top-5 right-5">
                <Badge className="bg-green-600 hover:bg-green-700 text-white border-transparent text-xs px-2 py-1">
                  -{discountPercentage}%
                </Badge>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="p-4 flex-1 flex flex-col">
            <h3 className="font-semibold text-sm leading-tight mb-3 line-clamp-2 h-[35px]">
              {product.title}
            </h3>
            
            <div className="mt-auto">
              {/* Price Display */}
              {hasDiscount ? (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground line-through">
                    {formatCurrencyI18n(originalPrice!, currency, language)}
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {product.is_starting_price ? t('product.starting_from') + ' ' : ''}
                    {formatCurrencyI18n(displayPrice!, currency, language)}
                  </div>
                </div>
              ) : (
                <div className="text-lg font-bold text-primary">
                  {product.is_starting_price ? t('product.starting_from') + ' ' : ''}
                  {formatCurrencyI18n(displayPrice!, currency, language)}
                </div>
              )}

              {/* Short Description */}
              {product.short_description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-1 md:line-clamp-2">
                  {product.short_description}
                </p>
              )}


              {/* Add to Cart Button */}
              {isAvailable && hasPrice && (
                <div className="mt-3 pt-2 border-t">
                  <Button
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {totalInCart > 0 ? `No Carrinho (${totalInCart})` : 'Adicionar'}
                  </Button>
                </div>
              )}

              {/* External Checkout Button */}
              {isAvailable && product.external_checkout_url && (
                <div className="mt-3 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a 
                      href={product.external_checkout_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Comprar
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
      
      {/* Variant Selection Modal */}
      <ProductVariantModal
        open={showVariantModal}
        onOpenChange={setShowVariantModal}
        product={product}
        currency={currency}
        language={language}
      />
    </motion.div>
  );
}