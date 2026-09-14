// Sidebar navigation (desktop) + mobile dropdown for Dashboard.
//
// Every entry, label, icon and group order comes from shared/sections.js. There
// are no hand-written labels left in here: the couple's menu and the venue's
// menu read the same list, so "open Bar Planner" means the same thing on both
// ends of a phone call.
import { sectionsFor, FINALISABLE_KEYS, resolveSectionKey } from '../../../shared/sections.js'
import SectionIcon from '../../components/ui/SectionIcon'
import SectionJump from '../../components/ui/SectionJump'
import useSectionStatus from '../../hooks/useSectionStatus'
import useCollapsedGroups from '../../hooks/useCollapsedGroups'

const COUPLE_GROUPS = sectionsFor('couple')

// Kept under the old name because Dashboard.jsx and SectionFinaliser think in
// terms of "does this section have a sign-off", not "is it in the registry".
const FINALISABLE = FINALISABLE_KEYS

// Flat list with group markers, for the phone header menu in DashboardHeader.
// It renders the same sections the sidebar does, which is the whole point:
// two couples once wrote in saying the portal only had four things in it,
// because on a phone the hamburger showed the header's resource links and
// nothing else. Never collapsed, same as the phone dropdown below: a section
// nobody can reach on a phone is a section that does not exist.
const NAV_ITEMS = COUPLE_GROUPS.flatMap(({ group, sections }) => [
  { section: group },
  ...sections.map(s => ({ key: s.key, label: s.label, icon: s.icon })),
])

export { FINALISABLE, NAV_ITEMS }

// Which sections show a little dot when there is a saved summary behind them.
// Only reached outside the pre-wedding window, where the finalisation tick
// and pending count below take over — see isPreWedding below.
const DOT_KEYS = new Set(['budget', 'timeline', 'tables'])

export default function DashboardNav({
  activeSection,
  setActiveSection,
  budgetSummary,
  timelineSummary,
  tableSummary,
  finalisations,
  planningNotes = [],
  isPreWedding,
  onboardingComplete = false,
}) {
  const dots = {
    budget: !!budgetSummary,
    timeline: !!timelineSummary,
    tables: !!tableSummary,
  }

  const { finalised, pending } = useSectionStatus(finalisations, planningNotes)
  const { isCollapsed, toggleGroup } = useCollapsedGroups('couple')

  // The group holding whatever is open stays open, whatever is stored for it.
  const activeGroup = COUPLE_GROUPS.find(g => g.sections.some(s => s.key === activeSection))?.group

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block lg:order-1">
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden lg:sticky lg:top-24">
          <div className="px-4 pt-5 pb-3 flex justify-center border-b border-cream-200">
            <img src="/rixey-manor-logo-optimized.png" alt="Rixey Manor" className="h-16 w-auto" />
          </div>
          <SectionJump groups={COUPLE_GROUPS} onJump={setActiveSection} />
          <nav className="p-2">
            {COUPLE_GROUPS.map(({ group, sections }) => {
              // Once onboarding is finished, Get Started has nothing left to
              // say, so it defaults closed the first time nobody has clicked
              // it. Worked out fresh each render rather than baked into the
              // stored state, so a click still wins and the onboarding answer
              // arriving late does not shut a group the couple has just
              // opened.
              const defaultCollapsed = group === 'Get Started' && onboardingComplete
              const collapsed = isCollapsed(group, { activeGroup, defaultCollapsed })
              return (
                <div key={group}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group, collapsed)}
                    aria-expanded={!collapsed}
                    className="w-full flex items-center justify-between text-xs font-semibold text-sage-400 uppercase tracking-wide px-3 pt-3 pb-1 hover:text-sage-600"
                  >
                    <span>{group}</span>
                    <span aria-hidden="true" className="text-[10px]">{collapsed ? '▸' : '▾'}</span>
                  </button>
                  {!collapsed && sections.map(section => (
                    <button
                      key={section.key}
                      onClick={() => setActiveSection(section.key)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                        activeSection === section.key
                          ? 'bg-sage-100 text-sage-700 font-medium'
                          : 'text-sage-500 hover:bg-cream-50 hover:text-sage-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <SectionIcon sectionKey={section.key} />
                        <span>{section.label}</span>
                      </span>
                      {/* Finalisation tick + pending count — last 6 weeks
                          only, the same window the finaliser bar itself
                          uses, so a section cannot show signed-off in the
                          menu once the bar that sets it has gone. */}
                      {isPreWedding ? (
                        <span className="flex items-center gap-1 shrink-0">
                          {finalised.has(section.key) && (
                            <span
                              className="w-4 h-4 rounded-full bg-sage-500 flex items-center justify-center shrink-0"
                              title="Couple signed off"
                            >
                              <span className="text-white text-[9px] leading-none">✓</span>
                            </span>
                          )}
                          {pending.get(section.key) > 0 && (
                            <span
                              className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center"
                              title="Waiting on Rixey"
                            >
                              {pending.get(section.key)}
                            </span>
                          )}
                        </span>
                      ) : (
                        DOT_KEYS.has(section.key) && dots[section.key] && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sage-400 flex-shrink-0" />
                        )
                      )}
                    </button>
                  ))}
                </div>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Mobile: section dropdown — same registry, same order, so a section
          cannot exist on one and be missing from the other. Never collapsed:
          a <select> with a hidden optgroup is just a section nobody can reach.
          No jump box here either, for the same reason: typing into a phone
          keyboard to filter a list this short saves nothing a native <select>
          does not already do. */}
      <div className="lg:hidden mb-3">
        <select
          value={activeSection}
          onChange={e => setActiveSection(resolveSectionKey(e.target.value) || 'chat')}
          className="w-full p-3 border border-cream-200 rounded-xl bg-white text-sage-700 font-medium focus:outline-none focus:ring-2 focus:ring-sage-300"
        >
          {COUPLE_GROUPS.map(({ group, sections }) => (
            <optgroup key={group} label={group}>
              {sections.map(section => (
                <option key={section.key} value={section.key}>{section.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </>
  )
}
