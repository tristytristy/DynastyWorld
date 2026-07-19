import type { ReactNode } from 'react';
import { SurfaceCard } from './SurfaceCard';

/**
 * Shared page-header system (visual overhaul §13). Every page previously
 * hand-assembled the same eyebrow + title + description block (13 copies with
 * drifting spacing); this is the single structure:
 *
 *   eyebrow (context) → title (DIN, the page identity) → description →
 *   optional right-aligned actions → optional full-width children (tabs,
 *   filters, metadata rows).
 *
 * Pages with genuinely bespoke heroes (Coach Hub's portrait hero) keep their
 * own layout — this is for the standard "titled page" case.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned controls (buttons, selects) on desktop; stacks below on narrow widths. */
  actions?: ReactNode;
  /** Full-width content under the title row — tabs, filter rows, metadata. */
  children?: ReactNode;
}) {
  return (
    <SurfaceCard>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">{eyebrow}</p>
          <h2 className="type-page-title mt-2 text-slate-950 dark:text-white">{title}</h2>
          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </SurfaceCard>
  );
}
