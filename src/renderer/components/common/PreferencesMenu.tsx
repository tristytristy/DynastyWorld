import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildTeamColorVars } from '../../lib/teamTheme';
import { DEFAULT_THEME_PREFERENCE, useTheme } from '../../theme/ThemeProvider';
import type { ColorMode } from '../../theme/themePreference';
import { AnchoredMenuPanel } from './AnchoredMenuPanel';

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value.trim());
}

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('#') ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
}

function SegmentButton({
  label,
  active,
  isDark,
  onClick,
}: {
  label: string;
  active: boolean;
  isDark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium transition ${
        active
          ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)] shadow-[0_16px_32px_-24px_rgba(37,99,235,0.9)]'
          : isDark
            ? 'text-slate-300 hover:bg-white/5 hover:text-white'
            : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
      }`}
    >
      {label}
    </button>
  );
}

function ThemeModeButton({
  label,
  value,
  description,
  active,
  isDark,
  onSelect,
}: {
  label: string;
  value: ColorMode;
  description: string;
  active: boolean;
  isDark: boolean;
  onSelect: (value: ColorMode) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        active
          ? isDark
            ? 'border-[var(--team-primary)] bg-slate-950/96 shadow-[0_22px_50px_-36px_rgba(37,99,235,0.45)]'
            : 'border-[var(--team-primary)] bg-white/88 shadow-[0_22px_50px_-36px_rgba(37,99,235,0.7)]'
          : isDark
            ? 'border-slate-800/85 bg-slate-950/82 hover:bg-slate-900/92'
            : 'border-slate-200/90 bg-white/72 hover:bg-white/88'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{label}</p>
        {active && (
          <span className="bg-[var(--team-primary)] px-2.5 py-1 type-eyebrow text-[var(--team-on-primary)]">
            Active
          </span>
        )}
      </div>
      <p className={`mt-2 text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{description}</p>
    </button>
  );
}

function ColorField({
  label,
  value,
  isDark,
  onChange,
}: {
  label: string;
  value: string;
  isDark: boolean;
  onChange: (value: string) => void;
}) {
  const colorValue = isHexColor(value) ? value : '#2563eb';

  return (
    <label className="space-y-2">
      <span className={`type-eyebrow ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </span>
      <div
        className={`flex items-center gap-3 rounded-xl border p-2 ${
          isDark
            ? 'border-slate-800/85 bg-slate-950/84'
            : 'border-slate-200/90 bg-white/82'
        }`}
      >
        <input
          type="color"
          value={colorValue}
          onChange={(event) => onChange(event.target.value)}
          className={`h-11 w-12 cursor-pointer rounded-lg border bg-transparent p-1 ${
            isDark ? 'border-slate-700' : 'border-slate-300'
          }`}
          aria-label={`${label} color picker`}
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#2563eb"
          spellCheck={false}
          className={`flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400 ${
            isDark ? 'text-slate-100' : 'text-slate-700'
          }`}
          aria-label={`${label} hex value`}
        />
      </div>
    </label>
  );
}

export function PreferencesMenu({ triggerClassName }: { triggerClassName?: string } = {}) {
  const {
    preference,
    appearance,
    setAppearance,
    setColorMode,
    setCustomColors,
    resolveColorVars,
  } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [draftPrimary, setDraftPrimary] = useState(preference.customPrimary);
  const [draftSecondary, setDraftSecondary] = useState(preference.customSecondary);
  const isDark = appearance === 'dark';
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraftPrimary(preference.customPrimary);
    setDraftSecondary(preference.customSecondary);
  }, [isOpen, preference.customPrimary, preference.customSecondary]);

  const normalizedPrimary = normalizeHex(draftPrimary);
  const normalizedSecondary = normalizeHex(draftSecondary);
  const customColorsValid = isHexColor(normalizedPrimary) && isHexColor(normalizedSecondary);

  const previewVars = useMemo(
    () =>
      buildTeamColorVars(
        customColorsValid ? normalizedPrimary : preference.customPrimary,
        customColorsValid ? normalizedSecondary : preference.customSecondary,
      ),
    [
      customColorsValid,
      normalizedPrimary,
      normalizedSecondary,
      preference.customPrimary,
      preference.customSecondary,
    ],
  );

  const currentVars = resolveColorVars();
  const previewStyle = previewVars as unknown as CSSProperties;
  const currentStyle = currentVars as unknown as CSSProperties;

  const panelUnderlayClass = isDark
    ? 'bg-slate-950/78 shadow-[0_42px_120px_-44px_rgba(2,6,23,0.88)] backdrop-blur-[52px] backdrop-saturate-[1.55] backdrop-brightness-[0.28]'
    : 'bg-white/18 shadow-[0_42px_120px_-44px_rgba(15,23,42,0.72)] backdrop-blur-[44px] backdrop-saturate-[1.8] backdrop-brightness-[0.68]';
  const panelGradientClass = isDark
    ? 'border border-slate-700/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.92)_0%,rgba(15,23,42,0.78)_18%,rgba(2,6,23,0.96)_100%)]'
    : 'border border-white/38 bg-[linear-gradient(180deg,rgba(255,255,255,0.52)_0%,rgba(255,255,255,0.22)_16%,rgba(248,250,252,0.9)_100%)]';
  const panelShellClass = isDark
    ? 'border border-slate-800/90 bg-slate-950/96 shadow-[0_44px_120px_-44px_rgba(2,6,23,0.9)] backdrop-blur-2xl'
    : 'border border-white/72 bg-white/80 shadow-[0_40px_120px_-44px_rgba(15,23,42,0.45)] backdrop-blur-2xl';
  const sectionClass = isDark
    ? 'rounded-xl border border-slate-800/80 bg-slate-950/84 p-4'
    : 'rounded-xl border border-slate-200/90 bg-white/72 p-4';
  const railClass = isDark
    ? 'flex border border-slate-800/85 bg-slate-950/90 p-1'
    : 'flex border border-slate-200/90 bg-white/88 p-1';
  const subtleTextClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const strongTextClass = isDark ? 'text-white' : 'text-slate-900';
  const badgeClass = isDark
    ? 'border border-slate-700/85 px-3 py-1 type-eyebrow text-slate-300'
    : 'border border-slate-300/80 px-3 py-1 type-eyebrow text-slate-500';
  const previewCardClass = isDark
    ? 'overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-[0_22px_50px_-40px_rgba(2,6,23,0.9)]'
    : 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.45)]';
  const secondaryButtonClass = isDark
    ? 'border border-slate-700/85 bg-slate-950/92 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-900'
    : 'border border-slate-300/80 bg-white/92 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100';
  const closeButtonClass = isDark
    ? 'border border-slate-700/85 bg-slate-950/94 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300 transition hover:bg-slate-900 hover:text-white'
    : 'border border-slate-300/85 bg-white/92 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800';

  function handleApplyCustomColors() {
    if (!customColorsValid) {
      return;
    }
    setCustomColors(normalizedPrimary, normalizedSecondary);
    setColorMode('custom');
  }

  function handleResetColors() {
    setCustomColors(
      DEFAULT_THEME_PREFERENCE.customPrimary,
      DEFAULT_THEME_PREFERENCE.customSecondary,
    );
    setColorMode(DEFAULT_THEME_PREFERENCE.colorMode);
    setDraftPrimary(DEFAULT_THEME_PREFERENCE.customPrimary);
    setDraftSecondary(DEFAULT_THEME_PREFERENCE.customSecondary);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={triggerClassName ?? 'border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        Preferences
      </button>

      <AnchoredMenuPanel anchorRef={triggerRef} open={isOpen} onClose={() => setIsOpen(false)} widthRem={30} isDark={isDark}>
        <div className="relative isolate">
            <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${panelUnderlayClass}`} />
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-[1px] ${panelGradientClass}`}
            />
            <div className={`relative overflow-hidden p-5 ${panelShellClass}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`type-eyebrow ${subtleTextClass}`}>
                    Experience Settings
                  </p>
                  <h2 className={`mt-2 text-xl font-semibold tracking-tight ${strongTextClass}`}>
                    Customize your workspace.
                  </h2>
                  <p className={`mt-2 text-sm leading-6 ${subtleTextClass}`}>
                    Adjust appearance, choose how accent colors are sourced, and set a custom palette that matches how you want to work.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className={closeButtonClass}
                  aria-label="Close preferences"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <section className={sectionClass}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className={`text-sm font-semibold ${strongTextClass}`}>Appearance</h3>
                      <p className={`mt-1 text-xs ${subtleTextClass}`}>Pick the base canvas for the app.</p>
                    </div>
                    <div className={railClass}>
                      <SegmentButton
                        label="Light"
                        active={appearance === 'light'}
                        isDark={isDark}
                        onClick={() => setAppearance('light')}
                      />
                      <SegmentButton
                        label="Dark"
                        active={appearance === 'dark'}
                        isDark={isDark}
                        onClick={() => setAppearance('dark')}
                      />
                    </div>
                  </div>
                </section>

                <section className={`space-y-3 ${sectionClass}`}>
                  <div>
                    <h3 className={`text-sm font-semibold ${strongTextClass}`}>Theme Source</h3>
                    <p className={`mt-1 text-xs ${subtleTextClass}`}>
                      Choose whether accent colors follow the active dynasty, the default app palette, or your own custom values.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <ThemeModeButton
                      label="Team Mode"
                      value="team"
                      description="Use the active dynasty's team colors in dynasty views while the shell keeps its shared structure."
                      active={preference.colorMode === 'team'}
                      isDark={isDark}
                      onSelect={setColorMode}
                    />
                    <ThemeModeButton
                      label="Default Mode"
                      value="default"
                      description="Keep the app on the built-in brand palette for a steady, neutral presentation."
                      active={preference.colorMode === 'default'}
                      isDark={isDark}
                      onSelect={setColorMode}
                    />
                    <ThemeModeButton
                      label="Custom Mode"
                      value="custom"
                      description="Set your own palette and let the app preserve readable contrast across surfaces."
                      active={preference.colorMode === 'custom'}
                      isDark={isDark}
                      onSelect={setColorMode}
                    />
                  </div>
                </section>

                <section className={sectionClass}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className={`text-sm font-semibold ${strongTextClass}`}>Custom Palette</h3>
                      <p className={`mt-1 text-xs ${subtleTextClass}`}>
                        Enter full hex values like #2563eb. Apply stays disabled until both values are valid.
                      </p>
                    </div>
                    <span className={badgeClass}>Guardrails on</span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ColorField label="Primary" value={draftPrimary} isDark={isDark} onChange={setDraftPrimary} />
                    <ColorField label="Secondary" value={draftSecondary} isDark={isDark} onChange={setDraftSecondary} />
                  </div>

                  {!customColorsValid && (
                    <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                      Both custom colors must be valid #RRGGBB values before they can become the active palette.
                    </p>
                  )}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className={`mb-2 type-eyebrow ${subtleTextClass}`}>
                        Current Theme
                      </p>
                      <div style={currentStyle} className={previewCardClass}>
                        <div className="bg-[var(--team-primary)] px-4 py-4 text-[var(--team-on-primary)]">
                          <p className="text-xs uppercase tracking-[0.24em] opacity-80">Active Accent</p>
                          <p className="mt-2 text-lg font-semibold">See how the current palette reads on live surfaces.</p>
                        </div>
                        <div className="space-y-2 px-4 py-4">
                          <p className="text-sm text-[var(--team-text-light)] dark:text-[var(--team-text-dark)]">
                            Preview how accents, text, and cards balance inside the workspace.
                          </p>
                          <div className="flex gap-2">
                            <span className={`border px-2.5 py-1 text-xs ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                              Primary
                            </span>
                            <span className={`border px-2.5 py-1 text-xs ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                              Contrast safe
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className={`mb-2 type-eyebrow ${subtleTextClass}`}>
                        Draft Preview
                      </p>
                      <div style={previewStyle} className={previewCardClass}>
                        <div className="bg-[var(--team-primary)] px-4 py-4 text-[var(--team-on-primary)]">
                          <p className="text-xs uppercase tracking-[0.24em] opacity-80">Draft Accent</p>
                          <p className="mt-2 text-lg font-semibold">Review your custom palette before it goes live.</p>
                        </div>
                        <div className="space-y-2 px-4 py-4">
                          <p className="text-sm text-[var(--team-text-light)] dark:text-[var(--team-text-dark)]">
                            The preview uses the same contrast logic as the live app.
                          </p>
                          <div className="flex gap-2">
                            <span className={`border px-2.5 py-1 text-xs ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                              Preview
                            </span>
                            <span className={`border px-2.5 py-1 text-xs ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                              Ready
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleApplyCustomColors}
                      disabled={!customColorsValid}
                      className="bg-[var(--team-primary)] px-4 py-2 text-sm font-medium text-[var(--team-on-primary)] transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Apply Custom Palette
                    </button>
                    <button type="button" onClick={handleResetColors} className={secondaryButtonClass}>
                      Reset to Defaults
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
      </AnchoredMenuPanel>
    </div>
  );
}
