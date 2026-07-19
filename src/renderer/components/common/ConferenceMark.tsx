import { getConferenceLogoPath } from '../../lib/trophyAssetMapping';

type ConferenceMarkContext = 'standings' | 'picker' | 'table' | 'inline';

interface PresentationClasses {
  wrapper: string;
  image: string;
}

/**
 * The conference SVG pack uses consistent filenames but not consistent visual
 * occupancy inside each SVG canvas. These per-conference presentation tweaks
 * normalize perceived size in the UI without modifying the assets themselves.
 */
const BASE_PRESENTATION: Record<ConferenceMarkContext, PresentationClasses> = {
  standings: {
    wrapper: 'flex h-full w-full items-center justify-center overflow-visible',
    image: 'h-full w-full object-contain object-center',
  },
  picker: {
    wrapper: 'flex h-8 w-14 items-center justify-center overflow-visible',
    image: 'h-auto w-auto max-h-8 max-w-14 object-contain object-center',
  },
  table: {
    wrapper: 'flex h-8 w-12 items-center justify-center overflow-visible',
    image: 'h-auto w-auto max-h-8 max-w-12 object-contain object-center',
  },
  inline: {
    wrapper: 'flex h-5 w-8 items-center justify-center overflow-visible',
    image: 'h-auto w-auto max-h-5 max-w-8 object-contain object-center',
  },
};

const PRESENTATION_OVERRIDES: Record<
  string,
  Partial<Record<ConferenceMarkContext, Partial<PresentationClasses>>>
> = {
  ACC: {
    standings: { image: 'h-full w-full max-h-full max-w-full object-contain object-center' },
    picker: { image: 'max-h-[1.45rem] max-w-[3.8rem]' },
    table: { image: 'max-h-[1.35rem] max-w-[3.2rem]' },
    inline: { image: 'max-h-[1rem] max-w-[2.4rem]' },
  },
  American: {
    standings: { image: 'h-full w-full max-h-full max-w-full object-contain object-center' },
    picker: { image: 'max-h-[2rem] max-w-[2.2rem]' },
    table: { image: 'max-h-[1.95rem] max-w-[2rem]' },
    inline: { image: 'max-h-[1.25rem] max-w-[1.3rem]' },
  },
  'Big 12': {
    standings: { image: 'h-full w-full max-h-full max-w-full object-contain object-center' },
    picker: { image: 'max-h-[2rem] max-w-[2.75rem]' },
    table: { image: 'max-h-[1.9rem] max-w-[2.5rem]' },
    inline: { image: 'max-h-[1.2rem] max-w-[1.8rem]' },
  },
  'Big Ten': {
    standings: { image: 'h-full w-full max-h-full max-w-full object-contain object-center' },
    picker: { image: 'max-h-[1.95rem] max-w-[3.5rem]' },
    table: { image: 'max-h-[1.8rem] max-w-[3.2rem]' },
    inline: { image: 'max-h-[1.1rem] max-w-[2.1rem]' },
  },
  CUSA: {
    standings: { image: 'h-full w-full max-h-full max-w-full object-contain object-center' },
    picker: { image: 'max-h-[1.55rem] max-w-[4rem]' },
    table: { image: 'max-h-[1.4rem] max-w-[3.25rem]' },
    inline: { image: 'max-h-[0.95rem] max-w-[2.25rem]' },
  },
  'Conference USA': {
    standings: { image: 'h-full w-full max-h-full max-w-full object-contain object-center' },
    picker: { image: 'max-h-[1.55rem] max-w-[4rem]' },
    table: { image: 'max-h-[1.4rem] max-w-[3.25rem]' },
    inline: { image: 'max-h-[0.95rem] max-w-[2.25rem]' },
  },
  MAC: {
    standings: { image: 'h-full w-full max-h-full max-w-full object-contain object-center' },
    picker: { image: 'max-h-[2rem] max-w-[2.2rem]' },
    table: { image: 'max-h-[1.95rem] max-w-[2rem]' },
    inline: { image: 'max-h-[1.2rem] max-w-[1.3rem]' },
  },
  MWC: {
    standings: { image: 'h-full w-full max-h-full max-w-full object-contain object-center' },
    picker: { image: 'max-h-[2rem] max-w-[2.15rem]' },
    table: { image: 'max-h-[1.95rem] max-w-[1.95rem]' },
    inline: { image: 'max-h-[1.2rem] max-w-[1.25rem]' },
  },
  'Mountain West': {
    standings: { image: 'h-full w-full max-h-full max-w-full object-contain object-center' },
    picker: { image: 'max-h-[2rem] max-w-[2.15rem]' },
    table: { image: 'max-h-[1.95rem] max-w-[1.95rem]' },
    inline: { image: 'max-h-[1.2rem] max-w-[1.25rem]' },
  },
  'Pac-12': {
    standings: { image: 'h-full w-full max-h-full max-w-full object-contain object-center' },
    picker: { image: 'max-h-[1.95rem] max-w-[2.7rem] scale-[1.14]' },
    table: { image: 'max-h-[1.8rem] max-w-[2.45rem] scale-[1.14]' },
    inline: { image: 'max-h-[1.15rem] max-w-[1.6rem] scale-[1.14]' },
  },
  SEC: {
    standings: {
      wrapper: 'flex h-full w-full items-center justify-center overflow-visible',
      image: 'h-full w-full max-h-full max-w-full object-contain object-center',
    },
    picker: { image: 'max-h-[2rem] max-w-[2rem]' },
    table: { image: 'max-h-[1.9rem] max-w-[1.9rem]' },
    inline: { image: 'max-h-[1.2rem] max-w-[1.2rem]' },
  },
  'Sun Belt': {
    standings: { image: 'h-full w-full max-h-full max-w-full object-contain object-center' },
    picker: { image: 'max-h-[1.9rem] max-w-[3.4rem]' },
    table: { image: 'max-h-[1.8rem] max-w-[3rem]' },
    inline: { image: 'max-h-[1.1rem] max-w-[2rem]' },
  },
};

function joinClasses(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function ConferenceMark({
  conferenceName,
  background,
  context,
  alt,
}: {
  conferenceName: string;
  background: 'light' | 'dark';
  context: ConferenceMarkContext;
  alt?: string;
}) {
  const src = getConferenceLogoPath(conferenceName, background);
  if (!src) return null;

  const base = BASE_PRESENTATION[context];
  const override = PRESENTATION_OVERRIDES[conferenceName]?.[context];

  return (
    <div className={joinClasses(base.wrapper, override?.wrapper)}>
      <img
        src={src}
        alt={alt ?? conferenceName}
        className={joinClasses(base.image, override?.image)}
        draggable={false}
      />
    </div>
  );
}
