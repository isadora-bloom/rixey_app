// Collapsed/open state for the nav groups, remembered per side across a
// reload. Before this, DashboardNav kept one open/closed flag per group in
// component state and forgot it the moment the tab closed; a couple who
// collapsed everything but Day Of got the whole menu open again on their next
// visit and had to redo it.
import { useState, useEffect } from 'react'

function storageKeyFor(side) {
  return `rixey.nav.${side}`
}

function readStored(key) {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    // Private window, storage disabled, corrupt JSON from an older shape —
    // every group just opens, which is the safe default, not a crash.
    return {}
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Nothing remembered this time. Not worth surfacing to the couple.
  }
}

/**
 * `side` is 'couple' or 'venue', so the two menus keep separate memories
 * (a coordinator working a dozen weddings a day should not have their group
 * state fight with whichever couple last opened this browser).
 *
 * Returns `{ isCollapsed, toggleGroup }`.
 *
 * `isCollapsed(group, { activeGroup, defaultCollapsed })`: the group holding
 * the active section is never collapsed, regardless of anything stored.
 * Otherwise an explicit prior toggle wins; failing that, `defaultCollapsed`
 * (a plain boolean the caller works out — Get Started collapsed once
 * onboarding is complete, everything else open) — computed fresh each call
 * rather than baked into the stored state, so a value that arrives late
 * (onboarding status loading after first render) still applies, and a group
 * the couple has actually clicked keeps their answer instead of it.
 *
 * `toggleGroup(group, currentlyCollapsed)`: flips from whatever isCollapsed
 * just returned for that group, so the first click on a group that started
 * collapsed by default opens it rather than trying to collapse it further.
 */
export default function useCollapsedGroups(side) {
  const storageKey = storageKeyFor(side)
  const [toggled, setToggled] = useState(() => readStored(storageKey))

  useEffect(() => {
    writeStored(storageKey, toggled)
  }, [storageKey, toggled])

  const isCollapsed = (group, { activeGroup, defaultCollapsed = false } = {}) => {
    if (group === activeGroup) return false
    return group in toggled ? !!toggled[group] : !!defaultCollapsed
  }

  const toggleGroup = (group, currentlyCollapsed) => {
    setToggled(prev => ({ ...prev, [group]: !currentlyCollapsed }))
  }

  return { isCollapsed, toggleGroup }
}
