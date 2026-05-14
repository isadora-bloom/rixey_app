/**
 * Factory: build a placeholder module that surfaces a single informational entry
 * in the UI so Grace can see the section exists but the parser hasn't been written yet.
 */
import { makeEntry } from '../types.js';

export function makeStub(section, tabHints = []) {
  return {
    section,
    build({ sheet }) {
      const tabKeys = Object.keys(sheet?.tabs || {});
      const matched = tabHints
        .map((hint) => tabKeys.find((k) => k.toLowerCase().includes(hint.toLowerCase())))
        .filter(Boolean);
      return [
        makeEntry({
          id: `${slug(section)}:stub`,
          section,
          field: '(not yet implemented)',
          sheetValue: matched.length ? `Tab found: ${matched.join(', ')}` : 'No matching tab',
          portalValue: null,
          status: 'both-missing',
          notes: 'This section will be parsed in a follow-up release.'
        })
      ];
    }
  };
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
