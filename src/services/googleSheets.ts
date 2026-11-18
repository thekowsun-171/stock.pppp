import {
  Product,
  SpreadsheetInfo,
  Transaction,
  TransactionType,
} from '../types/inventory';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

export const DEFAULT_SPREADSHEET_TITLE = 'สต็อตผลไม้ บจก.พิพุทพูนผล';

export const TAB_PRODUCTS = 'Products';
export const TAB_TRANSACTIONS = 'Transactions';

const PRODUCTS_HEADERS = [
  'รหัสสินค้า',
  'ชื่อสินค้า',
  'หมวดหมู่',
  'หน่วยนับ',
  'คงเหลือ',
  'ราคาต่อหน่วย',
  'มูลค่าคงเหลือ',
  'ผู้ขายล่าสุด',
  'วันที่อัปเดต',
  'หมายเหตุ',
];

// ออกแบบให้เหมาะสำหรับงานบัญชีโดยตรง ไม่มีคอลัมน์รหัสรายการหรือรหัสอ้างอิงที่ไม่จำเป็น
const TRANSACTIONS_HEADERS = [
  'วันที่',
  'ประเภท',
  'รหัสสินค้า',
  'ชื่อสินค้า',
  'หมวดหมู่',
  'หน่วยนับ',
  'จำนวน',
  'ราคาต่อหน่วย',
  'มูลค่ารวม',
  'ผู้ขาย / ผู้เบิก',
  'หมายเหตุ',
  'ผู้แก้ไขล่าสุด',
];

export class AuthExpiredError extends Error {
  constructor(
    message = 'สิทธิ์การเชื่อมต่อ Google หมดอายุ กรุณาเชื่อมต่อ Google Sheets ใหม่อีกครั้ง'
  ) {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

async function googleFetch(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (res.status === 401) {
    throw new AuthExpiredError();
  }

  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) {
        errorDetail = errJson.error.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(`เกิดข้อผิดพลาดจาก Google API: ${errorDetail}`);
  }

  return res.json();
}

export async function findAppSpreadsheets(
  token: string
): Promise<Array<{ id: string; name: string; modifiedTime?: string }>> {
  const query = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime,appProperties)');
  const data = await googleFetch(
    `${DRIVE_API}?q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=20`,
    token
  );
  const files: Array<{
    id: string;
    name: string;
    modifiedTime?: string;
    appProperties?: Record<string, string>;
  }> = data.files || [];

  return files.sort((a, b) => {
    const aMatch =
      a.appProperties?.ppFruitStock === 'true' ||
      a.name === DEFAULT_SPREADSHEET_TITLE
        ? 1
        : 0;
    const bMatch =
      b.appProperties?.ppFruitStock === 'true' ||
      b.name === DEFAULT_SPREADSHEET_TITLE
        ? 1
        : 0;
    return bMatch - aMatch;
  });
}

function extractSheetIds(
  sheets: Array<{ properties?: { sheetId?: number; title?: string } }>
) {
  let products = 0;
  let transactions = 0;

  for (const s of sheets) {
    const title = s.properties?.title;
    const id = s.properties?.sheetId ?? 0;
    if (title === TAB_PRODUCTS) products = id;
    if (title === TAB_TRANSACTIONS) transactions = id;
  }

  return { products, transactions };
}

export async function createInventorySpreadsheet(
  token: string,
  title: string = DEFAULT_SPREADSHEET_TITLE
): Promise<SpreadsheetInfo> {
  const created = await googleFetch(SHEETS_API, token, {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        title,
        locale: 'th_TH',
      },
      sheets: [
        {
          properties: {
            title: TAB_PRODUCTS,
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: TAB_TRANSACTIONS,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    }),
  });

  const spreadsheetId: string = created.spreadsheetId;
  const sheetIds = extractSheetIds(created.sheets || []);

  try {
    await googleFetch(`${DRIVE_API}/${spreadsheetId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({
        appProperties: { ppFruitStock: 'true' },
      }),
    });
  } catch {
    // Non-fatal
  }

  await googleFetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, token, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `'${TAB_PRODUCTS}'!A1:J1`, values: [PRODUCTS_HEADERS] },
        { range: `'${TAB_TRANSACTIONS}'!A1:L1`, values: [TRANSACTIONS_HEADERS] },
      ],
    }),
  });

  const formatRequests = [
    { sheetId: sheetIds.products, cols: PRODUCTS_HEADERS.length },
    { sheetId: sheetIds.transactions, cols: TRANSACTIONS_HEADERS.length },
  ].map(({ sheetId, cols }) => ({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: cols,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.08, green: 0.24, blue: 0.14 },
          textFormat: {
            foregroundColor: { red: 1, green: 1, blue: 1 },
            bold: true,
            fontSize: 11,
          },
          horizontalAlignment: 'LEFT',
          verticalAlignment: 'MIDDLE',
        },
      },
      fields:
        'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
    },
  }));

  await googleFetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
    method: 'POST',
    body: JSON.stringify({ requests: formatRequests }),
  });

  return {
    id: spreadsheetId,
    title: created.properties?.title || title,
    url:
      created.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    sheetIds,
  };
}

export async function connectAndVerifySpreadsheet(
  token: string,
  spreadsheetId: string
): Promise<SpreadsheetInfo> {
  const meta = await googleFetch(
    `${SHEETS_API}/${spreadsheetId}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties`,
    token
  );

  const existingSheets: Array<{
    properties?: { sheetId?: number; title?: string };
  }> = meta.sheets || [];
  const existingTitles = new Set(
    existingSheets.map((s) => s.properties?.title).filter(Boolean)
  );

  const missingTabs: string[] = [];
  if (!existingTitles.has(TAB_PRODUCTS)) missingTabs.push(TAB_PRODUCTS);
  if (!existingTitles.has(TAB_TRANSACTIONS)) missingTabs.push(TAB_TRANSACTIONS);

  let updatedMeta = meta;
  if (missingTabs.length > 0) {
    await googleFetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
      method: 'POST',
      body: JSON.stringify({
        requests: missingTabs.map((title) => ({
          addSheet: {
            properties: {
              title,
              gridProperties: { frozenRowCount: 1 },
            },
          },
        })),
      }),
    });

    const headerWrites: Array<{ range: string; values: string[][] }> = [];
    if (missingTabs.includes(TAB_PRODUCTS)) {
      headerWrites.push({
        range: `'${TAB_PRODUCTS}'!A1:J1`,
        values: [PRODUCTS_HEADERS],
      });
    }
    if (missingTabs.includes(TAB_TRANSACTIONS)) {
      headerWrites.push({
        range: `'${TAB_TRANSACTIONS}'!A1:L1`,
        values: [TRANSACTIONS_HEADERS],
      });
    }

    if (headerWrites.length > 0) {
      await googleFetch(
        `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: headerWrites,
          }),
        }
      );
    }

    updatedMeta = await googleFetch(
      `${SHEETS_API}/${spreadsheetId}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties`,
      token
    );
  }

  return {
    id: updatedMeta.spreadsheetId,
    title: updatedMeta.properties?.title || DEFAULT_SPREADSHEET_TITLE,
    url:
      updatedMeta.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${updatedMeta.spreadsheetId}`,
    sheetIds: extractSheetIds(updatedMeta.sheets || []),
  };
}

function toNumber(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function loadAllDataFromSheet(
  token: string,
  spreadsheetId: string
): Promise<{
  products: Product[];
  transactions: Transaction[];
}> {
  const ranges = [
    encodeURIComponent(`'${TAB_PRODUCTS}'!A2:J`),
    encodeURIComponent(`'${TAB_TRANSACTIONS}'!A2:L`),
  ]
    .map((r) => `ranges=${r}`)
    .join('&');

  const data = await googleFetch(
    `${SHEETS_API}/${spreadsheetId}/values:batchGet?${ranges}&valueRenderOption=FORMATTED_VALUE`,
    token
  );

  const valueRanges: Array<{ values?: unknown[][] }> = data.valueRanges || [];

  const productRows = valueRanges[0]?.values || [];
  const products: Product[] = productRows
    .map((row, idx) => ({
      rowIndex: idx + 2,
      code: String(row[0] ?? '').trim(),
      name: String(row[1] ?? '').trim(),
      category: String(row[2] ?? '').trim() || 'ผลไม้ทั่วไป',
      unit: String(row[3] ?? '').trim() || 'กิโลกรัม',
      quantity: toNumber(row[4]),
      unitPrice: toNumber(row[5]),
      vendor: String(row[7] ?? '').trim(),
      updatedAt: String(row[8] ?? '').trim(),
      notes: String(row[9] ?? '').trim(),
    }))
    .filter((p) => p.code !== '' || p.name !== '');

  const txRows = valueRanges[1]?.values || [];
  const transactions: Transaction[] = txRows
    .map((row, idx) => {
      const rawType = String(row[1] ?? '').trim();
      const type: TransactionType =
        rawType === 'เบิกออก' ? 'เบิกออก' : 'รับเข้า';
      const qty = toNumber(row[6]);
      const price = toNumber(row[7]);
      const total = toNumber(row[8]) || Number((qty * price).toFixed(2));
      return {
        id: `row-${idx + 2}`,
        rowIndex: idx + 2,
        date: String(row[0] ?? '').trim(),
        type,
        productCode: String(row[2] ?? '').trim(),
        productName: String(row[3] ?? '').trim(),
        category: String(row[4] ?? '').trim(),
        unit: String(row[5] ?? '').trim(),
        quantity: qty,
        unitPrice: price,
        totalValue: total,
        party: String(row[9] ?? '').trim(),
        notes: String(row[10] ?? '').trim(),
        editedBy: String(row[11] ?? '').trim(),
      };
    })
    .filter((t) => t.productCode !== '' || t.productName !== '');

  return { products, transactions };
}

function productToRow(p: Product): Array<string | number> {
  return [
    p.code,
    p.name,
    p.category,
    p.unit,
    p.quantity,
    Number(p.unitPrice.toFixed(2)),
    Number((p.quantity * p.unitPrice).toFixed(2)),
    p.vendor,
    p.updatedAt,
    p.notes,
  ];
}

function transactionToRow(t: Transaction): Array<string | number> {
  return [
    t.date,
    t.type,
    t.productCode,
    t.productName,
    t.category,
    t.unit,
    t.quantity,
    Number(t.unitPrice.toFixed(2)),
    Number((t.quantity * t.unitPrice).toFixed(2)),
    t.party,
    t.notes,
    t.editedBy,
  ];
}

export async function syncFullStateToSheet(
  token: string,
  spreadsheetId: string,
  products: Product[],
  transactions: Transaction[]
): Promise<void> {
  // Clear existing data rows (row 2 onward) and rewrite cleanly in order
  await googleFetch(
    `${SHEETS_API}/${spreadsheetId}/values:batchClear`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: [`'${TAB_PRODUCTS}'!A2:J`, `'${TAB_TRANSACTIONS}'!A2:L`],
      }),
    }
  );

  const data: Array<{ range: string; values: Array<Array<string | number>> }> =
    [];

  if (products.length > 0) {
    data.push({
      range: `'${TAB_PRODUCTS}'!A2:J${products.length + 1}`,
      values: products.map(productToRow),
    });
  }

  if (transactions.length > 0) {
    data.push({
      range: `'${TAB_TRANSACTIONS}'!A2:L${transactions.length + 1}`,
      values: transactions.map(transactionToRow),
    });
  }

  if (data.length > 0) {
    await googleFetch(
      `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data,
        }),
      }
    );
  }
}
