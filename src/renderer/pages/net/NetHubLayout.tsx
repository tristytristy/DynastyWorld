import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { GliderNav, gliderItemClass, matchTabIndex } from '../../components/ui/GliderNav';
import { PINNED_SUB_NAV_CLASS, usePinnedSubNav } from '../../lib/pinnedSubNav';

/**
 * The Net — the save's own internet. Feed (social), Tube (highlight uploads
 * with comment sections), The Crystal Football (paper of record), and 4th &
 * Forever (podcast). EXPORTED like the other hubs' tab lists: DynastyLayout
 * derives section membership from it.
 */
export const NET_TABS: { to: string; label: string; end?: boolean }[] = [
  { to: '/net', label: 'Feed', end: true },
  { to: '/net/tube', label: 'DynastyTube' },
  { to: '/net/paper', label: 'The Paper' },
  { to: '/net/pods', label: 'Podcasts' },
];

export function NetHubLayout() {
  const { id } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const subNavRef = usePinnedSubNav<HTMLDivElement>();

  if (!id) return null;

  const base = `/dynasty/${id}`;
  const activeIndex = matchTabIndex(pathname, base, NET_TABS);

  return (
    <div className="space-y-5">
      <div ref={subNavRef} className={`${PINNED_SUB_NAV_CLASS} -mx-1 overflow-x-auto px-1 py-2`}>
        <GliderNav activeIndex={activeIndex} emphasis="quiet" ariaLabel="The Net sections" itemsClassName="gap-1.5">
          {NET_TABS.map((tab, index) => (
            <Link
              key={tab.to}
              to={`${base}${tab.to}`}
              className={gliderItemClass(index === activeIndex, 'px-3.5 py-1.5')}
            >
              {tab.label}
            </Link>
          ))}
        </GliderNav>
      </div>

      <Outlet />
    </div>
  );
}
