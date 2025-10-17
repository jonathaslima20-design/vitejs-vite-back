import { supabase } from '../supabase';
import type { User } from '@/types';

// Pure localStorage authentication (no Supabase Auth)
export interface StoredCredentials {
  email: string;
  password: string;
  timestamp: number;
}

export interface StoredUser extends User {
  sessionId?: string;
  lastActivity?: number;
}

export interface AuthSession {
  id: string;
  user: StoredUser;
  expiresAt: number;
  isValid: boolean;
}

const STORAGE_KEYS = {
  CREDENTIALS: 'vitrineturbo_credentials',
  USER: 'vitrineturbo_user',
  SESSION: 'vitrineturbo_session',
  AUTH_STATE: 'vitrineturbo_auth_state'
} as const;

// Session duration: 7 days
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

/**
 * Enhanced authentication functions with localStorage persistence
 */

// Generate a simple session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Check if session is valid
function isSessionValid(session: AuthSession): boolean {
  return session.isValid && Date.now() < session.expiresAt;
}

// Store credentials for auto-login
export function storeCredentials(email: string, password: string): void {
  try {
    const credentials: StoredCredentials = {
      email,
      password,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(credentials));
    console.log('✅ Credentials stored successfully');
  } catch (error) {
    console.error('❌ Error storing credentials:', error);
  }
}

// Get stored credentials
export function getStoredCredentials(): StoredCredentials | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CREDENTIALS);
    if (!stored) return null;
    
    const credentials = JSON.parse(stored) as StoredCredentials;
    
    // Check if credentials are not too old (7 days)
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - credentials.timestamp > maxAge) {
      clearStoredCredentials();
      return null;
    }
    
    return credentials;
  } catch (error) {
    console.error('❌ Error getting stored credentials:', error);
    return null;
  }
}

// Store user data with session
export function storeUser(user: StoredUser): void {
  try {
    const sessionId = generateSessionId();
    const userWithSession: StoredUser = {
      ...user,
      sessionId,
      lastActivity: Date.now()
    };
    
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userWithSession));
    
    // Store session separately
    const session: AuthSession = {
      id: sessionId,
      user: userWithSession,
      expiresAt: Date.now() + SESSION_DURATION,
      isValid: true
    };
    
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    localStorage.setItem(STORAGE_KEYS.AUTH_STATE, 'authenticated');
    
    console.log('✅ User and session stored successfully');
  } catch (error) {
    console.error('❌ Error storing user:', error);
  }
}

// Get stored user
export function getStoredUser(): StoredUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.USER);
    if (!stored) return null;
    
    const user = JSON.parse(stored) as StoredUser;
    
    // Validate session
    const session = getStoredSession();
    if (!session || !isSessionValid(session)) {
      clearAllStoredData();
      return null;
    }
    
    // Update last activity
    updateLastActivity();
    
    return user;
  } catch (error) {
    console.error('❌ Error getting stored user:', error);
    return null;
  }
}

// Store session info
export function storeSession(sessionData: Partial<AuthSession>): void {
  try {
    const existingSession = getStoredSession();
    const session: AuthSession = {
      id: sessionData.id || generateSessionId(),
      user: sessionData.user || existingSession?.user || {} as StoredUser,
      expiresAt: sessionData.expiresAt || (Date.now() + SESSION_DURATION),
      isValid: sessionData.isValid ?? true
    };
    
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    console.log('✅ Session stored successfully');
  } catch (error) {
    console.error('❌ Error storing session:', error);
  }
}

// Get stored session
export function getStoredSession(): AuthSession | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!stored) return null;
    
    const session = JSON.parse(stored) as AuthSession;
    
    // Check if session is expired
    if (!isSessionValid(session)) {
      clearAllStoredData();
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('❌ Error getting stored session:', error);
    return null;
  }
}

// Update last activity timestamp
export function updateLastActivity(): void {
  try {
    const user = localStorage.getItem(STORAGE_KEYS.USER);
    if (user) {
      const userData = JSON.parse(user) as StoredUser;
      userData.lastActivity = Date.now();
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
    }
  } catch (error) {
    console.error('❌ Error updating last activity:', error);
  }
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  try {
    const authState = localStorage.getItem(STORAGE_KEYS.AUTH_STATE);
    const session = getStoredSession();
    const user = getStoredUser();
    
    return authState === 'authenticated' && !!session && !!user && isSessionValid(session);
  } catch (error) {
    console.error('❌ Error checking authentication:', error);
    return false;
  }
}

// Authenticate user with email and password
export async function authenticateUser(email: string, password: string): Promise<{
  user: StoredUser | null;
  error: string | null;
}> {
  try {
    console.log('🔐 Attempting localStorage-only authentication for:', email);

    // Use Supabase's native authentication
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (authError) {
      console.error('🔐 Authentication error:', authError);
      return { user: null, error: 'E-mail ou senha incorretos' };
    }

    if (!authData.user) {
      return { user: null, error: 'E-mail ou senha incorretos' };
    }

    // Get user profile from users table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim())
      .single();

    if (profileError || !userProfile) {
      console.error('🔐 Profile fetch error:', profileError);
      return { user: null, error: 'Erro ao buscar perfil do usuário' };
    }

    // Check if user is blocked
    if (userProfile.is_blocked) {
      return { user: null, error: 'BLOCKED_USER' };
    }

    // Store credentials for future auto-login
    storeCredentials(email, password);

    // Store user data with session
    storeUser(userProfile);

    console.log('✅ Supabase authentication successful');
    return { user: userProfile, error: null };

  } catch (error: any) {
    console.error('❌ Authentication error:', error);
    return { user: null, error: error.message || 'Erro inesperado na autenticação' };
  }
}

// Register new user
export async function registerUser(
  email: string,
  password: string,
  userData: { name: string; niche_type?: string; whatsapp: string }
): Promise<{
  user: StoredUser | null;
  error: string | null;
}> {
  try {
    console.log('📝 Attempting Supabase registration for:', email);

    // Use Supabase's native authentication for registration
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password
    });

    if (authError) {
      console.error('📝 Registration error:', authError);
      if (authError.message.includes('already registered')) {
        return { user: null, error: 'Este e-mail já está cadastrado' };
      }
      return { user: null, error: authError.message || 'Erro ao criar conta' };
    }

    if (!authData.user) {
      return { user: null, error: 'Erro ao criar usuário' };
    }

    // Create user profile in the users table
    const { data: userProfile, error: createError } = await supabase
      .from('users')
      .insert({
        email: email.trim(),
        name: userData.name,
        niche_type: userData.niche_type || 'diversos',
        whatsapp: userData.whatsapp,
        role: 'corretor',
        is_blocked: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError || !userProfile) {
      console.error('📝 User creation error:', createError);
      return { user: null, error: 'Erro ao criar usuário' };
    }

    // Store credentials and user data
    storeCredentials(email, password);
    storeUser(userProfile);

    console.log('✅ Supabase registration successful');
    return { user: userProfile, error: null };

  } catch (error: any) {
    console.error('❌ Registration error:', error);
    return { user: null, error: error.message || 'Erro inesperado no registro' };
  }
}

// Auto-login using stored credentials
export async function autoLogin(): Promise<{
  user: StoredUser | null;
  error: string | null;
}> {
  try {
    // Check if already authenticated
    if (isAuthenticated()) {
      const user = getStoredUser();
      if (user) {
        console.log('✅ User already authenticated from localStorage');
        return { user, error: null };
      }
    }
    
    // Try to get stored credentials
    const credentials = getStoredCredentials();
    if (!credentials) {
      return { user: null, error: 'No stored credentials found' };
    }
    
    console.log('🔄 Attempting auto-login with stored credentials');
    
    // Attempt authentication with stored credentials
    return await authenticateUser(credentials.email, credentials.password);
    
  } catch (error: any) {
    console.error('❌ Auto-login error:', error);
    clearAllStoredData();
    return { user: null, error: error.message || 'Erro no auto-login' };
  }
}

// Logout user
export async function logoutUser(): Promise<void> {
  try {
    console.log('🚪 Logging out user');

    // Clear all stored data
    clearAllStoredData();

    console.log('✅ User logged out successfully');
  } catch (error) {
    console.error('❌ Logout error:', error);
    // Clear storage even if there's an error
    clearAllStoredData();
  }
}

// Update user profile
export async function updateUserProfile(updates: Partial<StoredUser>): Promise<{
  user: StoredUser | null;
  error: string | null;
}> {
  try {
    const currentUser = getStoredUser();
    if (!currentUser) {
      return { user: null, error: 'Usuário não autenticado' };
    }
    
    console.log('👤 Updating user profile:', updates);
    
    // Update in Supabase
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', currentUser.id);

    if (error) {
      console.error('👤 Profile update error:', error);
      return { user: null, error: error.message };
    }

    // Update stored user data
    const updatedUser = { ...currentUser, ...updates };
    storeUser(updatedUser);
    
    console.log('✅ Profile updated successfully');
    return { user: updatedUser, error: null };
    
  } catch (error: any) {
    console.error('❌ Profile update error:', error);
    return { user: null, error: error.message || 'Erro ao atualizar perfil' };
  }
}

// Clear all stored data
export function clearAllStoredData(): void {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('✅ All stored data cleared');
  } catch (error) {
    console.error('❌ Error clearing stored data:', error);
  }
}

// Clear only credentials
export function clearStoredCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CREDENTIALS);
    console.log('✅ Stored credentials cleared');
  } catch (error) {
    console.error('❌ Error clearing credentials:', error);
  }
}

// Update user data in storage
export function updateStoredUser(updates: Partial<StoredUser>): void {
  try {
    const currentUser = getStoredUser();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      storeUser(updatedUser);
      console.log('✅ Stored user updated');
    }
  } catch (error) {
    console.error('❌ Error updating stored user:', error);
  }
}

// Validate and refresh session
export function validateSession(): boolean {
  try {
    const session = getStoredSession();
    if (!session || !isSessionValid(session)) {
      clearAllStoredData();
      return false;
    }
    
    // Update last activity
    updateLastActivity();
    return true;
  } catch (error) {
    console.error('❌ Session validation error:', error);
    clearAllStoredData();
    return false;
  }
}

// Get authentication state
export function getAuthState(): {
  isAuthenticated: boolean;
  user: StoredUser | null;
  session: AuthSession | null;
} {
  try {
    const isAuth = isAuthenticated();
    const user = isAuth ? getStoredUser() : null;
    const session = isAuth ? getStoredSession() : null;
    
    return {
      isAuthenticated: isAuth,
      user,
      session
    };
  } catch (error) {
    console.error('❌ Error getting auth state:', error);
    return {
      isAuthenticated: false,
      user: null,
      session: null
    };
  }
}

// Session management utilities
export function extendSession(): void {
  try {
    const session = getStoredSession();
    if (session && isSessionValid(session)) {
      session.expiresAt = Date.now() + SESSION_DURATION;
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
      updateLastActivity();
    }
  } catch (error) {
    console.error('❌ Error extending session:', error);
  }
}