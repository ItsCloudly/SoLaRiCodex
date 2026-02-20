import { Component } from 'solid-js';
import { Sun, MoonStar } from 'lucide-solid';
import { useTheme } from './ThemeProvider';

/**
 * ThemeToggle — An Apple-inspired animated pill toggle for switching
 * between light ("Linen") and dark ("Noir") themes.
 *
 * Uses the `useTheme()` context hook so it can be placed anywhere
 * inside a `<ThemeProvider>`.
 *
 * The animation is entirely CSS-driven via the `data-theme` attribute
 * on `<html>`, using transforms, opacity, and rotation for the icon
 * morph. No JS animation libraries required.
 */
const ThemeToggle: Component = () => {
  const { theme, toggleTheme, isDark, label } = useTheme();

  return (
    <button
      type="button"
      class="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark() ? 'light' : 'dark'} mode`}
      aria-pressed={isDark()}
      data-active-theme={theme()}
    >
      <span class="theme-toggle-track">
        <span class="theme-toggle-thumb" />
      </span>

      <span class="theme-toggle-icons">
        <span
          class="theme-toggle-icon theme-toggle-icon-sun"
          aria-hidden="true"
        >
          <Sun size={13} strokeWidth={2.2} />
        </span>
        <span
          class="theme-toggle-icon theme-toggle-icon-moon"
          aria-hidden="true"
        >
          <MoonStar size={13} strokeWidth={2.2} />
        </span>
      </span>

      <span class="theme-toggle-label">{label()}</span>
    </button>
  );
};

export default ThemeToggle;
