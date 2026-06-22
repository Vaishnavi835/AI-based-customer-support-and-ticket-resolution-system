/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, createContext, useContext } from 'react';

export const THEMES = [
  {
    id: 'charcoal-gold',
    label: 'Charcoal & Gold',
    description: 'Dark luxury',
    preview: { bg: '#1e1e1e', accent: '#c9a84c', text: '#e8e4dc' },
  },
  {
    id: 'slate-ivory',
    label: 'Slate & Ivory',
    description: 'Light professional',
    preview: { bg: '#f7f3ee', accent: '#2d3a4a', text: '#1c2333' },
  },
  {
    id: 'midnight-rose',
    label: 'Midnight & Rose',
    description: 'Dark refined',
    preview: { bg: '#161b22', accent: '#b07090', text: '#cdd5df' },
  },
];

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('app-theme-v2') || 'slate-ivory'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme-v2', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
