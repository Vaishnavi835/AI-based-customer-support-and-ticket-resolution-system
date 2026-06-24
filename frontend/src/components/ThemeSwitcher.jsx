import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

/* ── ThemeSwitcher widget ────────────────────────── */
export default function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="theme-switcher" style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        className="theme-trigger"
        onClick={() => setOpen(o => !o)}
        title="Switch theme"
        aria-label="Switch theme"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        <span>Theme</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
            onClick={() => setOpen(false)}
          />
          <div className="theme-panel">
            <p className="theme-panel__title">Choose a theme</p>
            <div className="theme-options">
              {themes.map(t => (
                <button
                  key={t.id}
                  className={`theme-option ${theme === t.id ? 'theme-option--active' : ''}`}
                  onClick={() => { setTheme(t.id); setOpen(false); }}
                >
                  {/* Color preview swatch */}
                  <span
                    className="theme-swatch"
                    style={{ background: t.preview.bg, border: `2px solid ${t.preview.accent}` }}
                  >
                    <span style={{
                      display: 'block', width: 10, height: 10,
                      borderRadius: '50%', background: t.preview.accent,
                      margin: '6px auto 0'
                    }} />
                  </span>
                  <span className="theme-option__info">
                    <span className="theme-option__name">{t.label}</span>
                    <span className="theme-option__desc">{t.description}</span>
                  </span>
                  {theme === t.id && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
