import React from 'react';
import { THEMES } from '@/components/notebook/themes';

const STORAGE_KEY = 'autonovel-notebook-theme';

export const NOTEBOOK_THEMES = Object.entries(THEMES).map(([id, t]) => ({
  id,
  label: t.label,
  description: t.description,
  swatch: t.swatch,
}));

export const NOTEBOOK_ACCENTS = [
  '#8b5cf6', '#ef4444', '#0ea5e9', '#10b981',
  '#f59e0b', '#ec4899', '#6366f1', '#1f2937',
];

const defaultSettings = {
  theme: 'classic',
  accent: '',
  fontSize: 'base',
  ruledLines: true,
  showMargin: true,
  coloredTabs: true,
};

const ThemeContext = React.createContext({
  settings: defaultSettings,
  updateSettings: () => {},
  theme: THEMES.classic,
});

export function useNotebookTheme() {
  return React.useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
  const [settings, setSettings] = React.useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    try {
      const parsed = { ...defaultSettings, ...JSON.parse(raw) };
      // Migrate old theme IDs to new ones
      if (parsed.theme && !THEMES[parsed.theme]) parsed.theme = 'classic';
      return parsed;
    } catch {
      return defaultSettings;
    }
  });

  const theme = THEMES[settings.theme] || THEMES.classic;

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.dataset.notebookTheme = settings.theme;
    document.documentElement.style.setProperty('--notebook-accent', settings.accent || theme.accent);
    document.documentElement.style.setProperty(
      '--notebook-font-size',
      settings.fontSize === 'sm' ? '15px' : settings.fontSize === 'lg' ? '18px' : settings.fontSize === 'xl' ? '20px' : '16px'
    );
  }, [settings, theme]);

  const updateSettings = (patch) => {
    setSettings((current) => ({ ...current, ...patch }));
  };

  return (
    <ThemeContext.Provider value={{ settings, updateSettings, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}