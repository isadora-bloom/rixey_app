// Sidebar navigation (desktop) + mobile dropdown for Dashboard.
//
// Every entry, label, icon and group order comes from shared/sections.js. There
// are no hand-written labels left in here: the couple's menu and the venue's
// menu read the same list, so "open Bar Planner" means the same thing on both
// ends of a phone call.
import { useState } from 'react'
import { sectionsFor, FINALISABLE_KEYS, resolveSectionKey } from '../../../shared/sections.js'
import SectionIcon from '../../components/ui/SectionIcon'

const COUPLE_GROUPS = sectionsFor('couple')

// Kept under the old name because Dashboard.jsx and SectionFinaliser think in
// terms of "does this section have a sign-off", not "is it in the registry".
const FINALISABLE = FINALISABLE_KEYS

// Flat list with group markers, for the phone header menu in DashboardHeader.
// It renders the same sections the sidebar does, which is the whole point:
// two couples once wrote in saying the portal only had four things in it,
// because on a phone the hamburger showed the header's resource links and
// nothing else.
const NAV_ITEMS = COUPLE_GROUPS.flatMap(({ group, sections }) => [
  { section: group },
  ...sections.map(s => ({ key: s.key, label: s.label, icon: s.icon })),
])

export { FINALISABLE, NAV_ITEMS }

// Which sections show a little dot when there is a saved summary behind them.
const DOT_KEYS = new Set(['budget', 'timeline', 'tables'])

export default function DashboardNav({
  activeSection,
  setActiveSection,
  budgetSummary,
  timelineSummary,
  tableSummary,
  finalisations,
  isPreWedding,
  onboardingComplete = false,
}) {
  const dots = {
    budget: !!budgetSummary,
    timeline: !!timelineSummary,
    tables: !!tableSummary,
  }

  // Deliberately simple: one open/closed flag per group, only for groups the
  // couple has actually clicked, nothing remembered between visits. U3 is
  // building proper collapsible groups that remember themselves, and this is
  // meant to be lifted straight out when that lands.
  //
  // Once onboarding is finished, Get Started has nothing left to say, so it
  // starts closed. Worked out while rendering rather than pushed into state by
  // an effect, so a click still wins and the onboarding answer arriving late
  // does not shut a group the couple has just opened.
  const [toggled, setToggled] = useState({})
  const isCollapsed = (group) =>
    group in toggled ? toggled[group] : (group === 'Get Started' && onboardingComplete)

  const toggleGroup = (group) =>
    setToggled(prev => ({ ...prev, [group]: !isCollapsed(group) }))

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block lg:order-1">
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden lg:sticky lg:top-24">
          <div className="px-4 pt-5 pb-3 flex justify-center border-b border-cream-200">
            <img src="/rixey-manor-logo-optimized.png" alt="Rixey Manor" className="h-16 w-auto" />
          </div>
          <nav className="p-2">
            {COUPLE_GROUPS.map(({ group, sections }) => {
              const collapsed = isCollapsed(group)
              return (
                <div key={group}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
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
                      {/* Finalisation ticks — last 6 weeks only */}
                      {isPreWedding && FINALISABLE.has(section.key) ? (
                        <span className="flex items-center gap-0.5 shrink-0">
                          {[
                            finalisations[section.key]?.couple_finalised,
                            finalisations[section.key]?.staff_finalised,
                          ].map((done, i) => (
                            <span
                              key={i}
                              className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                                done ? 'bg-sage-500 border-sage-500' : 'border-cream-400 bg-white'
                              }`}
                            >
                              {done && <span className="text-white text-[7px] leading-none">✓</span>}
                            </span>
                          ))}
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
          a <select> with a hidden optgroup is just a section nobody can reach. */}
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
