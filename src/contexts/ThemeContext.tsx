import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [isLoaded, setIsLoaded] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Get saved theme or system preference
    const savedTheme = localStorage.getItem('theme');
    let initialTheme: Theme = 'light';
    
    if (savedTheme === 'light' || savedTheme === 'dark') {
      initialTheme = savedTheme;
    } else {
      // Default to light theme instead of following system preference
      initialTheme = 'light';
    }
    
    setTheme(initialTheme);
    
    // Apply theme to document
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(initialTheme);
    
    // Save to localStorage
    localStorage.setItem('theme', initialTheme);
    
    // Mark as loaded
    setIsLoaded(true);

    // Listen for system theme changes (but don't auto-apply them)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Don't automatically change theme based on system preference
      // Users must manually toggle the theme
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    
    // Check if current route is an external storefront page
    const isStorefrontPage = location.pathname.match(/^\/[^\/]+$/) || 
                            location.pathname.match(/^\/[^\/]+\/produtos\/[^\/]+$/);
    
    // Only apply theme if NOT on storefront pages
    if (!isStorefrontPage) {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
      localStorage.setItem('theme', theme);
    }
  }, [theme, isLoaded, location.pathname]);

  const value = {
    theme,
    setTheme,
    isLoaded,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider');
  }
  return context;
};