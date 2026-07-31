import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { TeamLogo } from './TeamLogo';
import { useViewedTeamOptional } from '../../data/ViewedTeamProvider';

/**
 * A toggle between related pages that share a single Team Hub tab — Roster |
 * Transfers, Schedule | Rivalries, Statistics | Analytics, Season Awards |
 * Weekly Honors.
 *
 * Now the app's own ToggleSwitch rather than a bespoke pair of pills: a two-way
 * switch is exactly what this is, and having the same interaction wear a
 * segmented-button costume here and a switch costume inside Analytics — often
 * on the same screen — was the kind of small inconsistency that reads as
 * unfinished.
 *
 * Each pair is still its own route group, so the pages are untouched: they keep
 * their own mastheads and URLs, this only renders the switch above whichever
 * one matched, and the parent tab highlights for either (see TeamHubLayout).
 */
export function PairLayout({ items }: { items: { to: string; label: string }[] }) {
  const { id } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // PairLayout always renders inside a dynasty, but reading the team through
  // the OPTIONAL hook means it degrades to a plain knob rather than throwing if
  // that ever stops being true.
  const viewed = useViewedTeamOptional();

  if (!id || items.length < 2) return null;
  const [left, right] = items;
  const active = pathname.endsWith(`/${right.to}`) ? right.to : left.to;
  const teamName = viewed?.userTeamName ?? null;

  return (
    /*
      space-y-10 rather than the old space-y-5: the page below opens with a
      masthead whose mark deliberately overhangs the card, and on the tallest
      logos that overhang was reaching up far enough to sit on the toggle.
      Doubling the gap gives the marks their room back.
    */
    <div className="space-y-10">
      {/* pl-5 puts the left label's first letter at x=20 — the same pixel the
          sub-nav tabs above start on. The switch has no padding of its own, so
          without this it sat 20px left of every other row on the page. */}
      <div className="pl-5">
        <ToggleSwitch
          value={active}
          onChange={(to) => navigate(`/dynasty/${id}/${to}`)}
          left={{ value: left.to, label: left.label }}
          right={{ value: right.to, label: right.label }}
          ariaLabel={`${left.label} or ${right.label}`}
          knob={
            teamName ? (
              <TeamLogo
                team={{ assetName: teamName, label: teamName }}
                size="sm"
                variant="gold"
                className="h-[35px] w-[35px]"
              />
            ) : undefined
          }
        />
      </div>
      <Outlet />
    </div>
  );
}
