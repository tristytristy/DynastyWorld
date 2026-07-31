import { FluidSavedPlayerCard } from './SavedPlayerCard';
import type { PlayerCardRecord } from '../../../shared/types';

/**
 * A player's cards, as cards — three to a row, every one the same size.
 *
 * WHY EQUAL (user direction, 2026-07-30). This replaced a hero-plus-strip
 * layout: one card at full size with the rest as 78px tiles beneath it. That
 * shape says the big one is the card and the others are a filing detail, which
 * is exactly wrong — a player's cards are a set, and the second one you made is
 * not a lesser version of the first. Equal tiles say "these are your cards";
 * clicking one opens it full size, so nothing is lost by not printing one of
 * them large by default.
 *
 * NO LABELS AND NO EXPLAINER, because none are needed if the thing behaves the
 * way its shape implies: the tiles ARE the cards (real ones, rendered small),
 * clicking one opens it, and the radio dot marks the one that stands for the
 * player everywhere else — the hover preview, and any surface that shows a
 * single card. A radio is the right control precisely because it already means
 * "exactly one of these", which is the rule the DAL enforces underneath. The dot
 * is only interactive on the cards that aren't the default; on the default it's
 * the state, not a button, since there's nothing to switch to.
 *
 * Destructive and one-card-at-a-time actions (delete, export, star, edit) are
 * deliberately NOT here. They live in the expanded card, one click away, where
 * there is exactly one card in view and no chance of hitting the wrong tile.
 */
export function CardGrid({
  dynastyId,
  cards,
  onOpen,
  onAdd,
  onMakeDefault,
}: {
  dynastyId: string;
  cards: PlayerCardRecord[];
  onOpen: (card: PlayerCardRecord) => void;
  onAdd: () => void;
  onMakeDefault: (id: number) => void;
}) {
  return (
    /* Three to a row, and the row is capped rather than stretched: across the
       full width of the player modal three cards come out near their 330px
       design size, which turns a collection into three posters and puts the
       second row a full screen below the first. Capped here they land at ~240px
       — the same size a card is on a page of the card book, so the two surfaces
       show the same object at the same scale. */
    <div className="mx-auto grid max-w-[48rem] grid-cols-3 gap-x-5 gap-y-8" aria-label="Cards for this player">
      {/* Creation order, NOT the DAL's default-first order. The list comes back
          re-sorted every time the default changes, which would make the tiles
          jump out from under the cursor at the exact moment you clicked one —
          the dot already says which is which without moving anything. */}
      {[...cards]
        .sort((a, b) => a.id - b.id)
        .map((card) => (
          <div key={card.id} className="group/tile relative">
            <button
              type="button"
              onClick={() => onOpen(card)}
              title={card.seasonYear ? `Open the ${card.seasonYear} card` : 'Open this card'}
              aria-label={`Open ${card.player.firstName} ${card.player.lastName}${
                card.seasonYear ? `, ${card.seasonYear}` : ''
              }`}
              /* The lift is the whole hover state: a card rising a little off
                 the page, not a colour wash over the art. 4px on the app's
                 standard curve — the same restraint the rest of the UI uses,
                 and the global reduced-motion clamp zeroes it for free. */
              className="block w-full outline-none transition duration-fast ease-standard hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--team-primary)]"
            >
              <FluidSavedPlayerCard dynastyId={dynastyId} card={card} />
            </button>

            {/* In the card book. An indicator only — the star is a toggle in the
                expanded card, where the thing it applies to is unambiguous. */}
            {card.favorite && (
              <span
                className="pointer-events-none absolute -left-1.5 -top-1.5 text-[#f0b429] drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
                title="In your card book"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.44l-5.81 3.06L7.3 14.03 2.6 9.45l6.5-.95L12 2.6z"
                    fill="currentColor"
                  />
                </svg>
                <span className="sr-only">In your card book</span>
              </span>
            )}

            {/* Which card IS the player's card. */}
            <button
              type="button"
              role="radio"
              aria-checked={card.isDefault}
              aria-label={
                card.isDefault ? 'Shown on hover' : `Show the ${card.seasonYear ?? ''} card on hover`.trim()
              }
              title={card.isDefault ? 'Shown on hover' : 'Show this one on hover'}
              disabled={card.isDefault}
              onClick={() => onMakeDefault(card.id)}
              className="absolute -bottom-5 left-1/2 grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full border border-slate-400/70 bg-white transition duration-fast ease-standard disabled:cursor-default dark:border-slate-600 dark:bg-black"
            >
              <span
                className={`h-2 w-2 rounded-full transition duration-fast ease-standard ${
                  card.isDefault ? 'bg-[var(--team-primary)]' : 'bg-transparent group-hover/tile:bg-slate-400/60'
                }`}
              />
            </button>
          </div>
        ))}

      {/* Add. A bare mark in an empty cell (user direction) — no dashed box, no
          placeholder card. A box would read as a card that hasn't loaded; a
          plus on its own reads as the one thing on this page that isn't a card,
          which is exactly what it is. */}
      <button
        type="button"
        onClick={onAdd}
        title="Add another card for this player"
        aria-label="Add another card for this player"
        className="group/add grid w-full place-items-center text-slate-300 outline-none transition duration-fast ease-standard hover:text-[var(--team-primary)] focus-visible:text-[var(--team-primary)] dark:text-slate-700"
        style={{ aspectRatio: '330 / 496' }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-10 w-10 transition duration-fast ease-standard group-hover/add:scale-110 group-focus-visible/add:scale-110"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
