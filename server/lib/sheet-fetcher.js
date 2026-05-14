import { google } from 'googleapis';

const SHEET_ID_PATTERNS = [
  /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/,
  /[?&]key=([a-zA-Z0-9_-]{20,})/,
  /^([a-zA-Z0-9_-]{30,})$/
];

export function extractSheetId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  for (const re of SHEET_ID_PATTERNS) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return null;
}

export class SheetFetchError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SheetFetchError';
    this.code = code;
  }
}

export async function fetchAllTabs(authClient, sheetUrl) {
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) {
    throw new SheetFetchError('Could not extract spreadsheet ID from URL', 'BAD_URL');
  }

  const sheets = google.sheets({ version: 'v4', auth: authClient });

  let meta;
  try {
    const metaRes = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'properties(title),sheets(properties(sheetId,title,gridProperties))'
    });
    meta = metaRes.data;
  } catch (err) {
    const status = err?.response?.status;
    const reason = err?.errors?.[0]?.reason || err?.message || '';
    if (status === 403 && /insufficient/i.test(reason)) {
      throw new SheetFetchError(
        'Google account is missing the Sheets scope. Reconnect Gmail/Google in admin settings to re-consent.',
        'INSUFFICIENT_SCOPE'
      );
    }
    if (status === 404) {
      throw new SheetFetchError('Spreadsheet not found or not shared with this account.', 'NOT_FOUND');
    }
    if (status === 403) {
      throw new SheetFetchError('Permission denied. Make sure the signed-in Google account can view the sheet.', 'PERMISSION_DENIED');
    }
    throw new SheetFetchError(`Sheets API error: ${reason}`, 'API_ERROR');
  }

  const tabNames = (meta.sheets || [])
    .map((s) => s.properties?.title)
    .filter(Boolean);

  if (tabNames.length === 0) {
    return { spreadsheetId: sheetId, title: meta.properties?.title || '', tabs: {}, fetchedAt: new Date().toISOString() };
  }

  const ranges = tabNames.map((name) => `'${name.replace(/'/g, "''")}'`);
  let valuesRes;
  try {
    valuesRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges,
      valueRenderOption: 'FORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    });
  } catch (err) {
    const reason = err?.errors?.[0]?.reason || err?.message || '';
    throw new SheetFetchError(`Sheets batchGet failed: ${reason}`, 'API_ERROR');
  }

  const tabs = {};
  (valuesRes.data.valueRanges || []).forEach((vr, i) => {
    tabs[tabNames[i]] = vr.values || [];
  });

  return {
    spreadsheetId: sheetId,
    title: meta.properties?.title || '',
    tabs,
    fetchedAt: new Date().toISOString()
  };
}
