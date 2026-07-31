import { Select } from '../ui/Select';
import { useEffect, useRef, useState } from 'react';
import { useScrollLock } from '../../lib/useScrollLock';
import {
  ABILITY_TIER_OPTIONS,
  MENTAL_ABILITY_FIELDS,
  MENTAL_ABILITY_OPTIONS,
  PHYSICAL_ABILITY_FIELDS,
  RATING_SECTIONS,
  SKILL_GROUP_CAP_FIELDS,
} from '../../../shared/playerEditorFields';
import { POSITION_ORDER } from '../../lib/rosterOrder';
import {
  DEALBREAKER_OPTIONS,
  IDEAL_PITCH_OPTIONS,
  PERSONALITY_OPTIONS,
  ROLE_OPTIONS,
  SCHEME_DEFENSE_OPTIONS,
  SCHEME_OFFENSE_OPTIONS,
  TRAIT_DEV_OPTIONS,
  type EnumOption,
} from '../../lib/playerEditorOptions';
import { PortraitPicker } from './PortraitPicker';
import { Button } from '../ui/Button';
import type { PlayerEditFields, RecruitEditFields } from '../../../shared/types';
import { ModalOverlay } from './ModalOverlay';
import { ModalCloseButton } from './ModalCloseButton';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export type PlayerEditorTab = 'profile' | 'recruiting' | 'ratings' | 'skillCaps' | 'mental' | 'physical' | 'portrait';
type Tab = PlayerEditorTab;

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile', label: 'Player Profile' },
  { key: 'ratings', label: 'Ratings' },
  { key: 'skillCaps', label: 'Skill Group Caps' },
  { key: 'mental', label: 'Mental Abilities' },
  { key: 'physical', label: 'Physical Abilities' },
  { key: 'portrait', label: 'Portrait' },
];
const RECRUITING_TAB: { key: Tab; label: string } = { key: 'recruiting', label: 'Recruiting Info' };

const CLASS_YEAR_OPTIONS: { value: string; label: string }[] = [
  { value: 'HighSchool', label: 'High school' },
  { value: 'JuniorCollege_Sophomore', label: 'Junior college (Sophomore)' },
  { value: 'JuniorCollege_Junior', label: 'Junior college (Junior)' },
  { value: 'JuniorCollege_Senior', label: 'Junior college (Senior)' },
];

const FIELD_LABEL_CLASS = 'mb-1.5 block type-eyebrow text-slate-400 dark:text-slate-500';
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200/80 bg-slate-50/85 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100';
const TILE_CLASS = 'rounded-lg border border-slate-200/80 bg-slate-50/85 p-3 dark:border-slate-800 dark:bg-white/5';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      {children}
    </label>
  );
}

/**
 * A select over a fixed enum option list. If the current value isn't in the
 * list (an unexpected/legacy enum member), it's shown as its own option so the
 * field never silently changes the saved value just by opening the editor.
 */
function EnumSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: EnumOption[];
  onChange: (value: string) => void;
}) {
  const known = options.some((o) => o.value === value);
  return (
    <Select
      value={value}
      onChange={onChange}
      ariaLabel="Value"
      className="w-full"
      options={[
        ...(known ? [] : [{ value, label: value || '—' }]),
        ...options.map((o) => ({ value: o.value, label: o.label })),
      ]}
    />
  );
}

/** The save stores these as real booleans; the dropdown trades in strings, so the conversion lives in one place rather than at four call sites. */
function BoolSelect({ value, onChange, label }: { value: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <Select
      value={String(value)}
      onChange={(next) => onChange(next === 'true')}
      ariaLabel={label}
      className="w-full"
      options={[
        { value: 'true', label: 'True' },
        { value: 'false', label: 'False' },
      ]}
    />
  );
}

/** A plain list of strings — the ability/tier enums, which have no separate label. */
function StringSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  label: string;
}) {
  return (
    <Select
      value={value}
      onChange={onChange}
      ariaLabel={label}
      className="w-full"
      options={options.map((o) => ({ value: o, label: o }))}
    />
  );
}

function WarningBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
      {children}
    </div>
  );
}

function ProfileTab({ draft, update }: { draft: PlayerEditFields; update: (patch: Partial<PlayerEditFields>) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="First Name">
          <input type="text" value={draft.firstName} onChange={(e) => update({ firstName: e.target.value })} className={INPUT_CLASS} />
        </Field>
        <Field label="Last Name">
          <input type="text" value={draft.lastName} onChange={(e) => update({ lastName: e.target.value })} className={INPUT_CLASS} />
        </Field>
        <Field label="Position">
          <Select
            value={draft.position}
            onChange={(position) => update({ position })}
            ariaLabel="Position"
            className="w-full"
            options={POSITION_ORDER.map((p) => ({ value: p, label: p }))}
          />
        </Field>
        <Field label="School Year">
          <Select
            value={draft.schoolYear}
            onChange={(schoolYear) => update({ schoolYear })}
            ariaLabel="School year"
            className="w-full"
            options={['Freshman', 'Sophomore', 'Junior', 'Senior'].map((y) => ({ value: y, label: y }))}
          />
        </Field>
        <Field label="Redshirt Status">
          <input type="text" value={draft.redshirtStatus} onChange={(e) => update({ redshirtStatus: e.target.value })} className={INPUT_CLASS} />
        </Field>
        <Field label="Jersey #">
          <input
            type="number"
            value={draft.jerseyNumber}
            onChange={(e) => update({ jerseyNumber: Number(e.target.value) })}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Trait Development">
          <EnumSelect value={draft.traitDevelopment} options={TRAIT_DEV_OPTIONS} onChange={(v) => update({ traitDevelopment: v })} />
        </Field>
        <Field label="Age">
          <input type="number" value={draft.age} onChange={(e) => update({ age: Number(e.target.value) })} className={INPUT_CLASS} />
        </Field>
        <Field label="Height (in)">
          <input
            type="number"
            value={draft.heightInches}
            onChange={(e) => update({ heightInches: Number(e.target.value) })}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Weight (lb)">
          <input
            type="number"
            value={draft.weightPounds}
            onChange={(e) => update({ weightPounds: Number(e.target.value) })}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Personality">
          <EnumSelect value={draft.personality} options={PERSONALITY_OPTIONS} onChange={(v) => update({ personality: v })} />
        </Field>
        <Field label="Scheme">
          {/* The two <optgroup>s become suffixes — the list is flat now, and an
              unlabelled mix of offensive and defensive schemes would be a puzzle. */}
          <Select
            value={draft.scheme}
            onChange={(scheme) => update({ scheme })}
            ariaLabel="Scheme"
            className="w-full"
            options={[
              ...(SCHEME_OFFENSE_OPTIONS.concat(SCHEME_DEFENSE_OPTIONS).some((o) => o.value === draft.scheme)
                ? []
                : [{ value: draft.scheme, label: draft.scheme || '—' }]),
              ...SCHEME_OFFENSE_OPTIONS.map((o) => ({ value: o.value, label: `${o.label} · Offense` })),
              ...SCHEME_DEFENSE_OPTIONS.map((o) => ({ value: o.value, label: `${o.label} · Defense` })),
            ]}
          />
        </Field>
        <Field label="Role">
          <EnumSelect value={draft.role} options={ROLE_OPTIONS} onChange={(v) => update({ role: v })} />
        </Field>
        <Field label="Deal Breaker">
          <EnumSelect value={draft.recruitingDealbreaker} options={DEALBREAKER_OPTIONS} onChange={(v) => update({ recruitingDealbreaker: v })} />
        </Field>
        <Field label="Ideal Pitch">
          <EnumSelect value={draft.idealRecruitingPitch} options={IDEAL_PITCH_OPTIONS} onChange={(v) => update({ idealRecruitingPitch: v })} />
        </Field>
        <Field label="NIL Demand ($K)">
          <input
            type="number"
            min={-255}
            max={1023}
            value={draft.nilDemand}
            onChange={(e) => update({ nilDemand: Number(e.target.value) })}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Skill Points">
          <input
            type="number"
            min={0}
            max={32767}
            value={draft.skillPoints}
            onChange={(e) => update({ skillPoints: Number(e.target.value) })}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="XP Points">
          <input
            type="number"
            min={0}
            max={1048575}
            value={draft.experiencePoints}
            onChange={(e) => update({ experiencePoints: Number(e.target.value) })}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Impact Player">
          <BoolSelect
            value={draft.isImpactPlayer}
            onChange={(isImpactPlayer) => update({ isImpactPlayer })}
            label="Impact player"
          />
        </Field>
        <Field label="Created">
          <BoolSelect value={draft.isCreated} onChange={(isCreated) => update({ isCreated })} label="Created" />
        </Field>
        <Field label="User Controlled">
          <BoolSelect
            value={draft.isUserControlled}
            onChange={(isUserControlled) => update({ isUserControlled })}
            label="User controlled"
          />
        </Field>
      </div>
    </div>
  );
}

function RatingsTab({ draft, update }: { draft: PlayerEditFields; update: (patch: Partial<PlayerEditFields>) => void }) {
  return (
    <div className="space-y-5">
      <WarningBanner>Overall rating may be recalculated by the game after the dynasty file is loaded back in.</WarningBanner>
      {RATING_SECTIONS.map((section) => (
        <div key={section.title}>
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{section.title}</h4>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 xl:grid-cols-6">
            {section.fields.map((f) => (
              <div key={f.key} className={TILE_CLASS}>
                <p className="type-eyebrow text-slate-400 dark:text-slate-500">{f.abbr}</p>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={draft.ratings[f.key] ?? 0}
                  onChange={(e) => update({ ratings: { ...draft.ratings, [f.key]: Number(e.target.value) } })}
                  className="mt-1 w-full rounded-md border border-slate-200/80 bg-white/85 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-[var(--team-primary)] dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillCapsTab({ draft, update }: { draft: PlayerEditFields; update: (patch: Partial<PlayerEditFields>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {SKILL_GROUP_CAP_FIELDS.map((f) => (
        <Field key={f.key} label={f.label}>
          <input
            type="number"
            value={draft.skillGroupCaps[f.key] ?? 0}
            onChange={(e) => update({ skillGroupCaps: { ...draft.skillGroupCaps, [f.key]: Number(e.target.value) } })}
            className={INPUT_CLASS}
          />
        </Field>
      ))}
    </div>
  );
}

function MentalAbilitiesTab({ draft, update }: { draft: PlayerEditFields; update: (patch: Partial<PlayerEditFields>) => void }) {
  return (
    <div className="space-y-4">
      <WarningBanner>Mental abilities are not limited by player position. Selecting an ability not normally available for this position may cause unexpected behavior.</WarningBanner>
      <div className="grid gap-4 sm:grid-cols-2">
        {MENTAL_ABILITY_FIELDS.map((f, i) => (
          <div key={f.abilityKey} className="grid grid-cols-2 gap-2">
            <Field label={`Mental Ability ${i + 1}`}>
              <StringSelect
                value={draft.mentalAbilities[f.abilityKey] ?? 'None'}
                onChange={(next) => update({ mentalAbilities: { ...draft.mentalAbilities, [f.abilityKey]: next } })}
                options={MENTAL_ABILITY_OPTIONS}
                label={`Mental ability ${i + 1}`}
              />
            </Field>
            <Field label={`Rank ${i + 1}`}>
              <StringSelect
                value={draft.mentalAbilities[f.rankKey] ?? 'None'}
                onChange={(next) => update({ mentalAbilities: { ...draft.mentalAbilities, [f.rankKey]: next } })}
                options={ABILITY_TIER_OPTIONS}
                label={`Mental ability ${i + 1} rank`}
              />
            </Field>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhysicalAbilitiesTab({ draft, update }: { draft: PlayerEditFields; update: (patch: Partial<PlayerEditFields>) => void }) {
  return (
    <div className="space-y-4">
      <WarningBanner>
        Named ability slots (e.g. &quot;360&quot;, &quot;Cutter&quot;) depend on the player&apos;s archetype and aren&apos;t exposed
        by the save file outside the game itself — only each slot&apos;s tier is editable here.
      </WarningBanner>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PHYSICAL_ABILITY_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <StringSelect
              value={draft.physicalAbilities[f.key] ?? 'None'}
              onChange={(next) => update({ physicalAbilities: { ...draft.physicalAbilities, [f.key]: next } })}
              options={ABILITY_TIER_OPTIONS}
              label={f.label}
            />
          </Field>
        ))}
      </div>
    </div>
  );
}

function RecruitingInfoTab({
  draft,
  update,
}: {
  draft: RecruitEditFields;
  update: (patch: Partial<RecruitEditFields>) => void;
}) {
  return (
    <div className="space-y-4">
      <WarningBanner>
        Home state, top schools, commitment status, and signed school aren&apos;t editable yet — not confirmed safe to write.
      </WarningBanner>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hometown">
          <input type="text" value={draft.hometown} onChange={(e) => update({ hometown: e.target.value })} className={INPUT_CLASS} />
        </Field>
        <Field label="Star Rating">
          <Select
            value={String(draft.stars)}
            onChange={(next) => update({ stars: Number(next) })}
            ariaLabel="Star rating"
            className="w-full"
            options={[1, 2, 3, 4, 5].map((s) => ({ value: String(s), label: `${s} Star${s === 1 ? '' : 's'}` }))}
          />
        </Field>
        <Field label="Class">
          <Select
            value={draft.classYear}
            onChange={(classYear) => update({ classYear })}
            ariaLabel="Class"
            className="w-full"
            options={CLASS_YEAR_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </Field>
        <Field label="National Rank">
          <input
            type="number"
            value={draft.nationalRank}
            onChange={(e) => update({ nationalRank: Number(e.target.value) })}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Position Rank">
          <input
            type="number"
            value={draft.positionRank}
            onChange={(e) => update({ positionRank: Number(e.target.value) })}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="State Rank">
          <input
            type="number"
            value={draft.stateRank}
            onChange={(e) => update({ stateRank: Number(e.target.value) })}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
    </div>
  );
}

export function PlayerEditorModal({
  dynastyId,
  playerId,
  playerLabel,
  onClose,
  onSaved,
  initialTab = 'profile',
  isRecruit = false,
}: {
  dynastyId: string;
  playerId: number;
  playerLabel: string;
  onClose: () => void;
  onSaved?: () => void;
  initialTab?: Tab;
  isRecruit?: boolean;
}) {
  const [draft, setDraft] = useState<PlayerEditFields | null | undefined>(undefined);
  const [recruitDraft, setRecruitDraft] = useState<RecruitEditFields | null | undefined>(isRecruit ? undefined : null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; success: boolean } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const tabs = isRecruit ? [TABS[0], RECRUITING_TAB, ...TABS.slice(1)] : TABS;

  useEffect(() => {
    let cancelled = false;
    setDraft(undefined);
    window.api.editor.getPlayer(dynastyId, playerId).then((result) => {
      if (!cancelled) setDraft(result?.fields ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, playerId]);

  useEffect(() => {
    if (!isRecruit) {
      setRecruitDraft(null);
      return;
    }
    let cancelled = false;
    setRecruitDraft(undefined);
    window.api.editor.getRecruit(dynastyId, playerId).then((result) => {
      if (!cancelled) setRecruitDraft(result?.fields ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, playerId, isRecruit]);

  useScrollLock(true);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null,
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(patch: Partial<PlayerEditFields>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function updateRecruit(patch: Partial<RecruitEditFields>) {
    setRecruitDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setStatusMessage(null);
    const playerResult = await window.api.editor.savePlayer(dynastyId, playerId, draft);
    let recruitResult: { success: boolean; message: string } | null = null;
    if (isRecruit && recruitDraft) {
      recruitResult = await window.api.editor.saveRecruit(dynastyId, playerId, recruitDraft);
    }
    const success = playerResult.success && (recruitResult?.success ?? true);
    const text = recruitResult && !recruitResult.success ? recruitResult.message : playerResult.message;
    setStatusMessage({ text, success });
    setSaving(false);
    if (success) onSaved?.();
  }

  return (
    <ModalOverlay
      className="modal-scrim fixed inset-0 flex items-start justify-center overflow-y-auto p-4 md:items-center md:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${playerLabel}`}
        className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden modal-panel corner-cut md:max-h-[calc(100vh-4rem)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <div>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Edit Player</p>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{playerLabel}</h3>
          </div>
          <ModalCloseButton label="player editor" onClick={onClose} />
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-b border-slate-200/80 px-5 py-3 dark:border-white/10">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium transition ${
                tab === t.key
                  ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                  : 'border border-slate-200/80 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          {draft === undefined && <p className="text-slate-500 dark:text-slate-400">Loading player from save file...</p>}
          {draft === null && <p className="text-slate-500 dark:text-slate-400">Could not find this player in the save file.</p>}
          {draft && (
            <>
              {tab === 'profile' && <ProfileTab draft={draft} update={update} />}
              {tab === 'recruiting' && isRecruit && recruitDraft === undefined && (
                <p className="text-slate-500 dark:text-slate-400">Loading recruiting info from save file...</p>
              )}
              {tab === 'recruiting' && isRecruit && recruitDraft === null && (
                <p className="text-slate-500 dark:text-slate-400">Could not find recruiting info for this player.</p>
              )}
              {tab === 'recruiting' && isRecruit && recruitDraft && (
                <RecruitingInfoTab draft={recruitDraft} update={updateRecruit} />
              )}
              {tab === 'ratings' && <RatingsTab draft={draft} update={update} />}
              {tab === 'skillCaps' && <SkillCapsTab draft={draft} update={update} />}
              {tab === 'mental' && <MentalAbilitiesTab draft={draft} update={update} />}
              {tab === 'physical' && <PhysicalAbilitiesTab draft={draft} update={update} />}
              {tab === 'portrait' && (
                <PortraitPicker
                  kind="player"
                  currentAssetName={draft.portraitAssetName}
                  onSelect={(assetName) => update({ portraitAssetName: assetName })}
                />
              )}
            </>
          )}
        </div>

        {draft && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200/80 px-5 py-4 dark:border-white/10">
            <p className={`text-sm ${statusMessage ? (statusMessage.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-slate-400 dark:text-slate-500'}`}>
              {statusMessage?.text ?? 'Edits write directly to the save file when saved.'}
            </p>
            <Button variant="primary" onClick={handleSave} disabled={saving} className="px-6">
              {saving ? 'Saving...' : 'Save Player'}
            </Button>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
