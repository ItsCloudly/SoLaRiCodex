import { createContext, useContext, createSignal, createEffect, onMount, JSX } from 'solid-js';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'solari-theme-mode';

interface ThemeContextValue {
  /** Current theme mode signal */
  theme: () => ThemeMode;
  /** Toggle between light and dark */
  toggleTheme: () => void;
  /** Set a specific theme */
  setTheme: (mode: ThemeMode) => void;
  /** Whether the current theme is dark */
  isDark: () => boolean;
  /** Human-readable label for the current theme */
  label: () => string;
}

const ThemeContext = createContext<ThemeContextValue>();

/**
 * Reads the stored theme from localStorage (if available).
 * Falls back to system preference, then to 'light'.
 */
function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;

  // Respect system preference when no stored value exists
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

function applyThemeToDOM(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', mode);
}

function persistTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // localStorage may be unavailable in some environments
  }
}

interface ThemeProviderProps {
  children: JSX.Element;
  /** Optional initial theme override (e.g. for SSR) */
  initialTheme?: ThemeMode;
}

export function ThemeProvider(props: ThemeProviderProps) {
  const [theme, setThemeSignal] = createSignal<ThemeMode>(props.initialTheme ?? 'light');

  onMount(() => {
    const resolved = props.initialTheme ?? getInitialTheme();
    setThemeSignal(resolved);
    applyThemeToDOM(resolved);
  });

  // Sync DOM attribute and localStorage whenever theme changes
  createEffect(() => {
    const current = theme();
    applyThemeToDOM(current);
    persistTheme(current);
  });

  // Listen for system preference changes while the app is open
  onMount(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) => {
      // Only auto-switch if the user hasn't explicitly set a preference
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (!stored) {
        setThemeSignal(event.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handler);

    // Note: SolidJS onMount doesn't support cleanup directly,
    // but the listener is lightweight and tied to window lifetime.
  });

  const toggleTheme = () => {
    setThemeSignal((current) => (current === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeSignal(mode);
  };

  const isDark = () => theme() === 'dark';

  const label = () => (theme() === 'light' ? 'Linen' : 'Noir');

  const value: ThemeContextValue = {
    theme,
    toggleTheme,
    setTheme,
    isDark,
    label,
  };

  return (
    <ThemeContext.Provider value={value}>
      {props.children}
    </ThemeContext.Provider>
  );
}

/**
 * Access theme state and controls from any descendant component.
 *
 * @example
 * ```tsx
 * const { theme, toggleTheme, isDark, label } = useTheme();
 * ```
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error(
      'useTheme() must be used within a <ThemeProvider>. ' +
      'Wrap your application (or a parent component) with <ThemeProvider>.'
    );
  }
  return context;
}
