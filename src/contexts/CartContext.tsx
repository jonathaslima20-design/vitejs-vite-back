import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import type { CartItem, CartState, Product } from '@/types';

interface CartContextType {
  cart: CartState;
  addToCart: (product: Product, selectedColor?: string, selectedSize?: string) => void;
  removeFromCart: (productId: string) => void;
  removeCartVariant: (variantId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateVariantQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  hasVariant: (productId: string, color?: string, size?: string) => boolean;
  getItemQuantity: (productId: string) => number;
  getVariantQuantity: (productId: string, color?: string, size?: string) => number;
  updateItemNotes: (productId: string, notes: string) => void;
  updateVariantNotes: (variantId: string, notes: string) => void;
  updateVariantOptions: (variantId: string, color?: string, size?: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'vitrineturbo_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>({
    items: [],
    total: 0,
    itemCount: 0,
  });

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(STORAGE_KEY);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }, [cart]);

  // Calculate totals whenever items change
  useEffect(() => {
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const total = cart.items.reduce((sum, item) => {
      const price = item.discounted_price || item.price;
      return sum + (price * item.quantity);
    }, 0);

    // Only update if values actually changed to prevent infinite loops
    if (cart.total !== total || cart.itemCount !== itemCount) {
      setCart(prev => ({
        ...prev,
        total,
        itemCount,
      }));
    }
  }, [cart.items]);

  const generateVariantId = (productId: string, color?: string, size?: string) => {
    return `${productId}-${color || 'no-color'}-${size || 'no-size'}`;
  };

  const addToCart = (product: Product, selectedColor?: string, selectedSize?: string) => {
    // Check if product has a price
    if (!product.price || product.price <= 0) {
      toast.error('Este produto não pode ser adicionado ao carrinho pois não possui preço definido.');
      return;
    }

    const variantId = generateVariantId(product.id, selectedColor, selectedSize);

    setCart(prev => {
      const existingItem = prev.items.find(item => item.variantId === variantId);
      
      if (existingItem) {
        // Update quantity if item already exists
        const updatedItems = prev.items.map(item =>
          item.variantId === variantId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
        
        const variantText = [selectedColor, selectedSize].filter(Boolean).join(', ');
        toast.success(`Quantidade atualizada: ${product.title}${variantText ? ` (${variantText})` : ''}`);
        return { ...prev, items: updatedItems };
      } else {
        // Add new item to cart
        const newItem: CartItem = {
          id: product.id,
          variantId,
          title: product.title,
          price: product.price,
          discounted_price: product.discounted_price,
          quantity: 1,
          featured_image_url: product.featured_image_url,
          short_description: product.short_description,
          is_starting_price: product.is_starting_price,
          notes: '',
          selectedColor,
          selectedSize,
          availableColors: product.colors,
          availableSizes: product.sizes,
        };
        
        const variantText = [selectedColor, selectedSize].filter(Boolean).join(', ');
        toast.success(`Adicionado ao carrinho: ${product.title}${variantText ? ` (${variantText})` : ''}`);
        return { ...prev, items: [...prev.items, newItem] };
      }
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const item = prev.items.find(item => item.id === productId);
      if (item) {
        toast.success(`Removido do carrinho: ${item.title}`);
      }
      
      return {
        ...prev,
        items: prev.items.filter(item => item.id !== productId)
      };
    });
  };

  const removeCartVariant = (variantId: string) => {
    setCart(prev => {
      const item = prev.items.find(item => item.variantId === variantId);
      if (item) {
        const variantText = [item.selectedColor, item.selectedSize].filter(Boolean).join(', ');
        toast.success(`Removido do carrinho: ${item.title}${variantText ? ` (${variantText})` : ''}`);
      }
      
      return {
        ...prev,
        items: prev.items.filter(item => item.variantId !== variantId)
      };
    });
  };
  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === productId
          ? { ...item, quantity }
          : item
      )
    }));
  };

  const updateVariantQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeCartVariant(variantId);
      return;
    }

    setCart(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.variantId === variantId
          ? { ...item, quantity }
          : item
      )
    }));
  };
  const clearCart = () => {
    setCart({
      items: [],
      total: 0,
      itemCount: 0,
    });
    toast.success('Carrinho limpo');
  };

  const isInCart = (productId: string): boolean => {
    return cart.items.some(item => item.id === productId);
  };

  const hasVariant = (productId: string, color?: string, size?: string): boolean => {
    const variantId = generateVariantId(productId, color, size);
    return cart.items.some(item => item.variantId === variantId);
  };
  const getItemQuantity = (productId: string): number => {
    // Return total quantity for all variants of this product
    return cart.items
      .filter(item => item.id === productId)
      .reduce((total, item) => total + item.quantity, 0);
  };

  const getVariantQuantity = (productId: string, color?: string, size?: string): number => {
    const variantId = generateVariantId(productId, color, size);
    const item = cart.items.find(item => item.variantId === variantId);
    return item?.quantity || 0;
  };

  const updateItemNotes = (productId: string, notes: string) => {
    setCart(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === productId
          ? { ...item, notes }
          : item
      )
    }));
  };

  const updateVariantNotes = (variantId: string, notes: string) => {
    setCart(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.variantId === variantId
          ? { ...item, notes }
          : item
      )
    }));
  };

  const updateVariantOptions = (variantId: string, color?: string, size?: string) => {
    setCart(prev => {
      const item = prev.items.find(item => item.variantId === variantId);
      if (!item) return prev;

      const newVariantId = generateVariantId(item.id, color, size);
      
      // Check if this new variant already exists
      const existingVariant = prev.items.find(item => item.variantId === newVariantId);
      
      if (existingVariant && newVariantId !== variantId) {
        // Merge quantities if variant already exists
        const updatedItems = prev.items
          .filter(item => item.variantId !== variantId) // Remove old variant
          .map(item => 
            item.variantId === newVariantId
              ? { ...item, quantity: item.quantity + item.quantity }
              : item
          );
        
        toast.success('Variações combinadas no carrinho');
        return { ...prev, items: updatedItems };
      } else {
        // Update the variant options
        const updatedItems = prev.items.map(item =>
          item.variantId === variantId
            ? { 
                ...item, 
                variantId: newVariantId,
                selectedColor: color,
                selectedSize: size
              }
            : item
        );
        
        return { ...prev, items: updatedItems };
      }
    });
  };
  const value = {
    cart,
    addToCart,
    removeFromCart,
    removeCartVariant,
    updateQuantity,
    updateVariantQuantity,
    clearCart,
    isInCart,
    hasVariant,
    getItemQuantity,
    getVariantQuantity,
    updateItemNotes,
    updateVariantNotes,
    updateVariantOptions,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart deve ser usado dentro de um CartProvider');
  }
  return context;
};