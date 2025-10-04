import { useState } from 'react';
import { X, Plus, Minus, Trash2, ShoppingCart, MessageCircle, Edit3, Palette, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCart } from '@/contexts/CartContext';
import { formatCurrencyI18n, generateWhatsAppMessage, useTranslation, type SupportedLanguage, type SupportedCurrency } from '@/lib/i18n';
import { generateWhatsAppUrl } from '@/lib/utils';
import { trackWhatsAppClick } from '@/lib/tracking';
import type { User } from '@/types';
import { generateCartOrderMessage } from '@/lib/cartUtils';

interface CartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  corretor: User;
  currency?: SupportedCurrency;
  language?: SupportedLanguage;
}

export default function CartModal({
  open,
  onOpenChange,
  corretor,
  currency = 'BRL',
  language = 'pt-BR'
}: CartModalProps) {
  const { cart, updateVariantQuantity, removeCartVariant, clearCart, updateVariantNotes, updateVariantOptions } = useCart();
  const { t } = useTranslation(language);
  const [sendingOrder, setSendingOrder] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editingVariant, setEditingVariant] = useState<string | null>(null);

  const generateOrderMessage = () => {
    return generateCartOrderMessage(
      cart.items,
      cart.total,
      corretor.name,
      corretor.slug || '',
      currency,
      language
    );
  };

  const handleSendOrder = async () => {
    if (cart.items.length === 0) return;
    
    try {
      setSendingOrder(true);
      
      const orderMessage = generateOrderMessage();
      const whatsappUrl = generateWhatsAppUrl(corretor.whatsapp || '', orderMessage);
      
      // Track the order as a WhatsApp lead
      await trackWhatsAppClick('storefront', 'product', 'cart_checkout');
      
      // Open WhatsApp
      window.open(whatsappUrl, '_blank');
      
      // Clear cart after sending
      clearCart();
      onOpenChange(false);
      
    } catch (error) {
      console.error('Error sending order:', error);
    } finally {
      setSendingOrder(false);
    }
  };

  // Get color value for circle display
  const getColorValue = (colorName: string) => {
    const colorMap: Record<string, string> = {
      'preto': '#000000',
      'branco': '#FFFFFF',
      'cinza': '#808080',
      'azul': '#0066CC',
      'vermelho': '#CC0000',
      'verde': '#00CC00',
      'amarelo': '#FFCC00',
      'rosa': '#FF69B4',
      'roxo': '#8A2BE2',
      'laranja': '#FF8C00',
      'marrom': '#8B4513',
      'bege': '#F5F5DC',
      'dourado': '#FFD700',
      'prateado': '#C0C0C0',
      'navy': '#000080',
      'vinho': '#722F37',
      'nude': '#E3C4A8',
      'off-white': '#FAF0E6',
      'creme': '#FFFDD0',
      'caramelo': '#D2691E'
    };
    
    const normalizedColor = colorName.toLowerCase().trim();
    return colorMap[normalizedColor] || '#6B7280';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrinho de Compras
          </DialogTitle>
          <DialogDescription>
            {cart.items.length === 0 
              ? 'Seu carrinho está vazio'
              : `${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'itens'} no carrinho`
            }
          </DialogDescription>
        </DialogHeader>

        {cart.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Adicione produtos ao carrinho para fazer um pedido
            </p>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[400px]">
              {cart.items.map((item) => {
                const price = item.discounted_price || item.price;
                const itemTotal = price * item.quantity;

                return (
                  <div key={item.id} className="flex gap-3 p-3 border rounded-lg">
                    {/* Product Image */}
                    <div className="w-16 h-16 bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm flex-shrink-0">
                      <img
                        src={item.featured_image_url || 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg'}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2 mb-1">
                        {item.title}
                      </h4>
                      
                      <div className="text-sm text-primary font-semibold mb-2">
                        {item.is_starting_price ? t('product.starting_from') + ' ' : ''}
                        {formatCurrencyI18n(price, currency, language)}
                      </div>

                      {/* Selected Variant Display */}
                      {(item.selectedColor || item.selectedSize) && (
                        <div className="mb-2">
                          {editingVariant === item.variantId ? (
                            <div className="space-y-2">
                              {/* Color Selection */}
                              {item.availableColors && item.availableColors.length > 0 && (
                                <div className="space-y-1">
                                  <Label className="text-xs">Cor</Label>
                                  <Select
                                    value={item.selectedColor || ''}
                                    onValueChange={(value) => {
                                      updateVariantOptions(item.variantId!, value || undefined, item.selectedSize);
                                      setEditingVariant(null);
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Selecionar cor">
                                        {item.selectedColor && (
                                          <div className="flex items-center gap-2">
                                            <div 
                                              className="w-3 h-3 rounded-full border border-gray-300"
                                              style={{ backgroundColor: getColorValue(item.selectedColor) }}
                                            />
                                            <span className="capitalize">{item.selectedColor}</span>
                                          </div>
                                        )}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {item.availableColors.map((color) => (
                                        <SelectItem key={color} value={color}>
                                          <div className="flex items-center gap-2">
                                            <div 
                                              className="w-3 h-3 rounded-full border border-gray-300"
                                              style={{ backgroundColor: getColorValue(color) }}
                                            />
                                            <span className="capitalize">{color}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* Size Selection */}
                              {item.availableSizes && item.availableSizes.length > 0 && (
                                <div className="space-y-1">
                                  <Label className="text-xs">Tamanho</Label>
                                  <Select
                                    value={item.selectedSize || ''}
                                    onValueChange={(value) => {
                                      updateVariantOptions(item.variantId!, item.selectedColor, value || undefined);
                                      setEditingVariant(null);
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Selecionar tamanho">
                                        {item.selectedSize && (
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium">{item.selectedSize}</span>
                                            {(() => {
                                              const numericSize = parseInt(item.selectedSize);
                                              if (!isNaN(numericSize) && numericSize >= 17 && numericSize <= 43) {
                                                return null;
                                              } else if (['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'].includes(item.selectedSize)) {
                                                return <Badge variant="outline" className="text-xs">Vestuário</Badge>;
                                              } else {
                                                return <Badge variant="outline" className="text-xs">Personalizado</Badge>;
                                              }
                                            })()}
                                          </div>
                                        )}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {item.availableSizes.map((size) => {
                                        const numericSize = parseInt(size);
                                        const isShoeSize = !isNaN(numericSize) && numericSize >= 17 && numericSize <= 43;
                                        const isApparelSize = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'].includes(size);
                                        
                                        return (
                                        <SelectItem key={size} value={size}>
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium">{size}</span>
                                            {isShoeSize && (
                                              null
                                            )}
                                            {isApparelSize && (
                                              <Badge variant="outline" className="text-xs">Vestuário</Badge>
                                            )}
                                            {!isShoeSize && !isApparelSize && (
                                              <Badge variant="outline" className="text-xs">Personalizado</Badge>
                                            )}
                                          </div>
                                        </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div 
                              className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                              onClick={() => setEditingVariant(item.variantId!)}
                            >
                              {item.selectedColor && (
                                <div className="flex items-center gap-1">
                                  <Palette className="h-3 w-3" />
                                  <div 
                                    className="w-3 h-3 rounded-full border border-gray-300"
                                    style={{ backgroundColor: getColorValue(item.selectedColor) }}
                                  />
                                  <span className="capitalize">{item.selectedColor}</span>
                                </div>
                              )}
                              {item.selectedSize && (
                                <div className="flex items-center gap-1">
                                  <Ruler className="h-3 w-3" />
                                  <span>{item.selectedSize}</span>
                                </div>
                              )}
                              <Edit3 className="h-3 w-3 ml-1" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes Section */}
                      <div className="mb-2">
                        {editingNotes === item.variantId ? (
                          <div className="space-y-2">
                            <Label className="text-xs">Observação (cor, tamanho, etc.)</Label>
                            <Input
                              placeholder="Ex: Cor preta, tamanho M"
                              defaultValue={item.notes || ''}
                              className="text-xs h-8"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const input = e.target as HTMLInputElement;
                                  updateVariantNotes(item.variantId!, input.value);
                                  setEditingNotes(null);
                                }
                                if (e.key === 'Escape') {
                                  setEditingNotes(null);
                                }
                              }}
                              onBlur={(e) => {
                                updateVariantNotes(item.variantId!, e.target.value);
                                setEditingNotes(null);
                              }}
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div 
                            className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors min-h-[16px] flex items-center gap-1"
                            onClick={() => setEditingNotes(item.variantId!)}
                          >
                            <Edit3 className="h-3 w-3" />
                            {item.notes ? item.notes : 'Adicionar observação'}
                          </div>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => updateVariantQuantity(item.variantId!, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-8 text-center">
                            {item.quantity}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => updateVariantQuantity(item.variantId!, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {formatCurrencyI18n(itemTotal, currency, language)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => removeCartVariant(item.variantId!)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator />

            {/* Cart Summary */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total:</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrencyI18n(cart.total, currency, language)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={clearCart}
                  className="flex-1"
                >
                  Limpar Carrinho
                </Button>
                
                {corretor.whatsapp && (
                  <Button
                    onClick={handleSendOrder}
                    disabled={sendingOrder}
                    className="flex-1"
                   asChild
                  >
                    <a
                      href={generateWhatsAppUrl(corretor.whatsapp || '', generateOrderMessage())}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={async (e) => {
                        // Track the order as a WhatsApp lead
                        await trackWhatsAppClick('storefront', 'product', 'cart_checkout');
                        
                        // Clear cart after sending
                        setTimeout(() => {
                          clearCart();
                          onOpenChange(false);
                        }, 100);
                      }}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Enviar Pedido
                    </a>
                  </Button>
                )}
              </div>

              {!corretor.whatsapp && (
                <p className="text-xs text-muted-foreground text-center">
                  WhatsApp não configurado para este vendedor
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}