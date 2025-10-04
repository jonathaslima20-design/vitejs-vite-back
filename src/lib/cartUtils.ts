import type { CartItem } from '@/types';
import { formatCurrencyI18n, generateWhatsAppMessage, type SupportedLanguage, type SupportedCurrency } from '@/lib/i18n';

/**
 * Generate a formatted WhatsApp message for a cart order
 */
export function generateCartOrderMessage(
  cartItems: CartItem[],
  total: number,
  sellerName: string,
  corretorSlug: string,
  currency: SupportedCurrency = 'BRL',
  language: SupportedLanguage = 'pt-BR'
): string {
  if (cartItems.length === 0) return '';

  // Simplified greeting for cart orders
  const greeting = `Olá ${sellerName}, gostaria de realizar um pedido com os itens abaixo.`;
  
  let orderMessage = `${greeting}\n\n`;
  
  // Order header
  const orderTitles = {
    'pt-BR': 'PEDIDO DE COMPRA',
    'en-US': 'PURCHASE ORDER', 
    'es-ES': 'ORDEN DE COMPRA',
  };
  
  orderMessage += `*${orderTitles[language] || orderTitles['pt-BR']}*\n`;
  orderMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Add each item
  cartItems.forEach((item, index) => {
    const price = item.discounted_price || item.price;
    const itemTotal = price * item.quantity;
    
    orderMessage += `${index + 1}. *${item.title.trim()}*\n`;
    
    // Add variant information if available
    if (item.selectedColor || item.selectedSize) {
      const variantInfo = [item.selectedColor, item.selectedSize].filter(Boolean).join(' • ');
      orderMessage += `   Variação: ${variantInfo}\n`;
    }
    
    // Add product link for easy access to full details
    if (corretorSlug) {
      try {
        // Use production domain in production, otherwise use current origin
        const isProduction = typeof window !== 'undefined' && 
          (window.location.hostname === 'vitrineturbo.com' || 
           window.location.hostname.includes('netlify.app') ||
           window.location.hostname.includes('vercel.app'));
        const baseUrl = isProduction ? 'https://vitrineturbo.com' : 
          (typeof window !== 'undefined' ? window.location.origin : 'https://vitrineturbo.com');
        const productUrl = `${baseUrl}/${corretorSlug}/produtos/${item.id}`;
        orderMessage += `${productUrl}\n`;
      } catch {
        // Fallback if URL generation fails
        orderMessage += `Ver produto\n`;
      }
    }
    
    const quantityLabels = {
      'pt-BR': 'Quantidade',
      'en-US': 'Quantity',
      'es-ES': 'Cantidad',
    };
    
    const unitPriceLabels = {
      'pt-BR': 'Preço unitário',
      'en-US': 'Unit price',
      'es-ES': 'Precio unitario',
    };
    
    const subtotalLabels = {
      'pt-BR': 'Subtotal',
      'en-US': 'Subtotal',
      'es-ES': 'Subtotal',
    };
    
    orderMessage += `   ${quantityLabels[language] || quantityLabels['pt-BR']}: ${item.quantity}\n`;
    orderMessage += `   ${unitPriceLabels[language] || unitPriceLabels['pt-BR']}: ${formatCurrencyI18n(price, currency, language)}\n`;
    orderMessage += `   ${subtotalLabels[language] || subtotalLabels['pt-BR']}: ${formatCurrencyI18n(itemTotal, currency, language)}\n`;
    
    // Add notes if they exist
    if (item.notes && item.notes.trim()) {
      const notesLabels = {
        'pt-BR': 'Observação',
        'en-US': 'Notes',
        'es-ES': 'Observación',
      };
      orderMessage += `   ${notesLabels[language] || notesLabels['pt-BR']}: ${item.notes}\n`;
    }
    
    orderMessage += `\n`;
  });

  // Order footer
  orderMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  const totalLabels = {
    'pt-BR': 'TOTAL',
    'en-US': 'TOTAL',
    'es-ES': 'TOTAL',
  };
  
  orderMessage += `*${totalLabels[language] || totalLabels['pt-BR']}: ${formatCurrencyI18n(total, currency, language)}*\n\n`;
  
  const footerMessages = {
    'pt-BR': 'Aguardo retorno com informações sobre pagamento e entrega.',
    'en-US': 'I await your response with payment and delivery information.',
    'es-ES': 'Espero su respuesta con información de pago y entrega.',
  };
  
  orderMessage += footerMessages[language] || footerMessages['pt-BR'];

  return orderMessage;
}

/**
 * Calculate cart statistics
 */
export function calculateCartStats(cartItems: CartItem[]) {
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const total = cartItems.reduce((sum, item) => {
    const price = item.discounted_price || item.price;
    return sum + (price * item.quantity);
  }, 0);

  return { itemCount, total };
}

/**
 * Validate cart item before adding
 */
export function validateCartItem(item: CartItem): boolean {
  return !!(
    item.id &&
    item.title &&
    item.price > 0 &&
    item.quantity > 0
  );
}