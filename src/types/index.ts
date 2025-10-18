export type UserRole = 'corretor' | 'admin' | 'parceiro';
export type NicheType = 'diversos';
export type PlanStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone?: string;
  avatar_url?: string;
  cover_url_desktop?: string;
  cover_url_mobile?: string;
  promotional_banner_url?: string;
  promotional_banner_url_desktop?: string;
  promotional_banner_url_mobile?: string;
  slug?: string;
  custom_domain?: string;
  listing_limit: number;
  is_blocked: boolean;
  created_at: string;
  updated_at?: string;
  bio?: string;
  whatsapp?: string;
  instagram?: string;
  location_url?: string;
  created_by?: string;
  theme?: 'light' | 'dark';
  niche_type?: NicheType;
  currency?: string;
  language?: string;
  plan_status?: PlanStatus;
  referral_code?: string;
  referred_by?: string;
}

export type ProductStatus = 'disponivel' | 'vendido' | 'reservado';
export type ProductGender = 'masculino' | 'feminino' | 'unissex';

export interface ProductImage {
  id: string;
  url: string;
  is_featured: boolean;
}

export interface Product {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price?: number;
  discounted_price?: number;
  status: ProductStatus;
  category: string[];
  brand?: string;
  model?: string;
  gender?: ProductGender;
  condition: 'novo' | 'usado' | 'seminovo';
  featured_image_url?: string;
  video_url?: string;
  featured_offer_price?: number;
  featured_offer_installment?: number;
  featured_offer_description?: string;
  is_starting_price?: boolean;
  short_description?: string;
  is_visible_on_storefront?: boolean;
  external_checkout_url?: string;
  created_at: string;
  updated_at?: string;
  product_images?: ProductImage[];
  colors?: string[];
  sizes?: string[];
}

export interface ProductCategory {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at?: string;
}

export interface CategoryDisplaySetting {
  category: string;
  order: number;
  enabled: boolean;
}

export interface StorefrontSettings {
  id: string;
  user_id: string;
  settings: {
    filters?: {
      showFilters?: boolean;
      showSearch?: boolean;
      showPriceRange?: boolean;
      showCategories?: boolean;
      showBrands?: boolean;
      showGender?: boolean;
      showStatus?: boolean;
      showCondition?: boolean;
    };
    itemsPerPage?: number;
    categoryDisplaySettings?: CategoryDisplaySetting[];
  };
  created_at: string;
  updated_at?: string;
}

export type SubscriptionStatus = 'active' | 'pending' | 'cancelled' | 'suspended';
export type PaymentStatus = 'paid' | 'pending' | 'overdue';
export type PaymentMethodStatus = 'completed' | 'pending' | 'failed' | 'refunded';
export type BillingCycle = 'monthly' | 'quarterly' | 'semiannually' | 'annually';

export interface Subscription {
  id: string;
  user_id: string;
  plan_name: string;
  monthly_price: number;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  payment_status: PaymentStatus;
  start_date: string;
  end_date?: string;
  next_payment_date: string;
  created_at: string;
  updated_at?: string;
  user?: {
    name: string;
    email: string;
  };
}

export interface Payment {
  id: string;
  subscription_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: PaymentMethodStatus;
  notes?: string;
  created_at: string;
  subscription?: {
    user?: {
      name: string;
      email: string;
    };
  };
}

export interface CartItem {
  id: string;
  title: string;
  price: number;
  discounted_price?: number;
  quantity: number;
  featured_image_url?: string;
  short_description?: string;
  is_starting_price?: boolean;
  notes?: string;
  selectedColor?: string;
  selectedSize?: string;
  availableColors?: string[];
  availableSizes?: string[];
  variantId?: string; // Unique identifier for this specific variant
}

export interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
}

// Referral System Types
export interface ReferralCommission {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  subscription_id: string;
  plan_type: string;
  amount: number;
  status: 'pending' | 'paid';
  created_at: string;
  paid_at?: string;
  referred_user?: {
    name: string;
    email: string;
  };
  subscription?: {
    plan_name: string;
    status: string;
  };
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  pix_key: string;
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  admin_notes?: string;
  created_at: string;
  processed_at?: string;
  processed_by?: string;
  user?: {
    name: string;
    email: string;
  };
}

export interface UserPixKey {
  id: string;
  user_id: string;
  pix_key: string;
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  holder_name: string;
  created_at: string;
  updated_at: string;
}

export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  availableForWithdrawal: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  duration: 'Trimestral' | 'Semestral' | 'Anual';
  price: number;
  checkout_url?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}