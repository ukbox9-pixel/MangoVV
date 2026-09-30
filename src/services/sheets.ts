import { getAccessToken } from './auth';

const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export const SHEET_NAMES = [
  'Markets',
  'Categories',
  'CategoryMarkets',
  'Items',
  'Users',
  'UserMarkets',
  'Orders',
  'OrderItems',
  'Settings',
  'History',
] as const;

export const SHEET_HEADERS: Record<string, string[]> = {
  Markets: ['ID', 'Name', 'Description', 'CategoryIDs', 'CreatedAt'],
  Categories: ['ID', 'Name', 'CreatedAt'],
  CategoryMarkets: ['CategoryID', 'MarketID'],
  Items: ['ID', 'Name', 'CategoryID', 'CategoryName', 'Stock', 'Unit', 'CreatedAt'],
  Users: ['ID', 'Name', 'PIN', 'Role', 'Status', 'MarketIDs', 'CreatedAt'],
  UserMarkets: ['UserID', 'MarketID'],
  Orders: ['ID', 'OrderNumber', 'MarketID', 'MarketName', 'UserID', 'UserName', 'TotalItems', 'CreatedAt', 'Note'],
  OrderItems: ['ID', 'OrderID', 'ItemID', 'ItemName', 'CategoryName', 'StockBefore', 'Quantity', 'Unit'],
  Settings: ['Key', 'Value'],
  History: ['ID', 'Action', 'Details', 'Timestamp', 'UserID', 'UserName'],
};

/**
 * Creates a brand new Google Spreadsheet initialized with all 10 HPP database tabs and formatted headers.
 */
export async function createHppSpreadsheet(title = 'Mango_Database'): Promise<{ id: string; url: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('ไม่พบ Access Token กรุณาเชื่อมต่อ Google Account ก่อน');

  const sheetsPayload = SHEET_NAMES.map((name) => ({
    properties: {
      title: name,
      gridProperties: {
        frozenRowCount: 1,
      },
    },
  }));

  const res = await fetch(SHEETS_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: sheetsPayload,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `สร้าง Google Sheet ไม่สำเร็จ (${res.status})`);
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // Populate header row for each sheet
  const dataValues = SHEET_NAMES.map((name) => ({
    range: `${name}!A1:Z1`,
    values: [SHEET_HEADERS[name]],
  }));

  await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: dataValues,
    }),
  });

  return { id: spreadsheetId, url: spreadsheetUrl };
}

/**
 * Checks if all required sheets exist in an existing spreadsheet and adds missing ones if needed.
 */
export async function verifyAndInitSpreadsheet(spreadsheetId: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) throw new Error('ไม่พบ Access Token กรุณาเข้าสู่ระบบ Google อีกครั้ง');

  const res = await fetch(`${SHEETS_API_URL}/${spreadsheetId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error('ไม่สามารถเข้าถึง Google Sheets นี้ได้ กรุณาตรวจสอบ ID หรือสิทธิ์การเข้าถึง');
  }

  const meta = await res.json();
  const existingTitles = new Set(meta.sheets?.map((s: any) => s.properties?.title) || []);

  const missingSheets = SHEET_NAMES.filter((name) => !existingTitles.has(name));

  if (missingSheets.length > 0) {
    const requests = missingSheets.map((name) => ({
      addSheet: {
        properties: {
          title: name,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    }));

    await fetch(`${SHEETS_API_URL}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    const headerData = missingSheets.map((name) => ({
      range: `${name}!A1:Z1`,
      values: [SHEET_HEADERS[name]],
    }));

    await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: headerData,
      }),
    });
  }

  return true;
}

/**
 * Batch read all database tables from Google Sheets
 */
export async function readAllTablesFromSheet(spreadsheetId: string): Promise<Record<string, string[][]>> {
  const token = await getAccessToken();
  if (!token) throw new Error('ไม่พบ Access Token');

  const ranges = SHEET_NAMES.map((name) => `${name}!A2:Z`);
  const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');

  const res = await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values:batchGet?${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error('ไม่สามารถอ่านข้อมูลจาก Google Sheets ได้');
  }

  const data = await res.json();
  const result: Record<string, string[][]> = {};

  (data.valueRanges || []).forEach((vr: any, index: number) => {
    const sheetName = SHEET_NAMES[index];
    result[sheetName] = vr.values || [];
  });

  return result;
}

/**
 * Overwrite an entire sheet's rows (A2:Z)
 */
export async function overwriteSheetRows(
  spreadsheetId: string,
  sheetName: string,
  rows: (string | number)[][]
): Promise<void> {
  const token = await getAccessToken();
  if (!token) return; // If token is missing, cached data will be synced later

  // 1. Clear old data in range A2:Z
  await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values/${sheetName}!A2:Z:clear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }).catch(() => {});

  if (rows.length === 0) return;

  // 2. Write new rows
  await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values/${sheetName}!A2:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: rows,
    }),
  });
}

/**
 * Append row to a sheet
 */
export async function appendSheetRow(
  spreadsheetId: string,
  sheetName: string,
  row: (string | number)[]
): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;

  await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values/${sheetName}!A:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [row],
    }),
  });
}
