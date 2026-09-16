import { useEffect, useState } from 'react'
import { API_URL } from '../config/api'
import { loadJson } from '../utils/api'
import { headcount } from '../../shared/guest-names'

/**
 * What the guest list says, for the planners that ask you to type a number.
 *
 * The bar planner, the table planner, the canvas and the staffing guide each
 * ask for a guest count and each remembered its own answer, so four screens
 * quietly disagreed with the guest list and with each other. They all read the
 * same list now.
 *
 * `expected` is the figure worth planning from: everybody on the list except
 * the ones who have said no. Before replies come back it is simply the whole
 * list; once people decline it stops ordering food for them. Declines are the
 * only thing subtracted, because a pending guest is far more likely to turn up
 * than not.
 *
 * A failure here is deliberately quiet. These are hints beside a number the
 * couple typed themselves, never the saved value, so a guest list that will
 * not load must not put an error in front of a planner that works.
 *
 * Returns null until the list has loaded, and null if it never does.
 */
export function useGuestHeadcount(weddingId) {
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    // Nothing to read yet. The state is already null, and clearing it here
    // would be a setState in an effect body for a case that only happens
    // before the parent has its wedding.
    if (!weddingId) return undefined
    let cancelled = false
    loadJson(`${API_URL}/api/guests/${weddingId}`)
      .then(data => {
        if (cancelled) return
        const c = headcount(data?.guests || [])
        setCounts({ ...c, expected: c.total - c.declined })
      })
      .catch(err => {
        if (cancelled) return
        console.error('Could not read the guest list for a headcount:', err)
        setCounts(null)
      })
    return () => { cancelled = true }
  }, [weddingId])

  return counts
}

/**
 * The one sentence every planner shows under its guest-count field.
 *
 * Returns null when there is nothing worth saying: no list yet, an empty list,
 * or a typed figure that already agrees with it.
 */
export function headcountNote(counts, typed) {
  if (!counts || !counts.total) return null
  if (Number(typed) === counts.expected) return null
  const declined = counts.declined
    ? `, ${counts.declined} declined` : ''
  return `Guest list says ${counts.expected} (${counts.total} invited${declined}).`
}
