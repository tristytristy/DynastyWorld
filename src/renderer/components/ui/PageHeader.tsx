import { InfoHint } from './InfoHint';
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
          {/* The description now lives behind the hint icon beside the title
              rather than as a paragraph under it. Most of these explained
              something a returning player already knows, and printed in full on
              every visit they pushed the actual content down the page. The words
              are unchanged — just on demand. */}
          <h2 className="type-page-title mt-2 flex items-center gap-2 text-slate-950 dark:text-white">
            <span>{title}</span>
            {description ? <InfoHint label="About this page">{description}</InfoHint> : null}
          </h2>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </SurfaceCard>
  );
}
