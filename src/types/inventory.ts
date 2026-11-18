export type AppPage = 'inventory' | 'stock-in' | 'stock-out' | 'reports';

export type TransactionType = 'รับเข้า' | 'เบิกออก';

export interface Product {
  rowIndex: number; // 2-based row index in Google Sheets 'Products' tab
  code: string; // 5-digit code e.g. 69001
  name: string;
  category: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  vendor: string;
  updatedAt: string; // YYYY-MM-DD
  notes: string;
}

export interface ProductInput {
  code: string;
  name: string;
  category: string;
  unit: string;
  quantity: number; // จำนวนที่รับเข้า (ตอนเพิ่มใหม่) หรือ คงเหลือ (ตอนแก้ไข)
  unitPrice: number;
  vendor: string;
  date: string; // YYYY-MM-DD
  notes: string;
}

export interface Transaction {
  id: string; // Client-side identity for React/editing (not written to Google Sheet columns)
  rowIndex: number; // 2-based row index in Google Sheets 'Transactions' tab
  date: string; // YYYY-MM-DD
  type: TransactionType;
  productCode: string;
  productName: string;
  category: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  party: string; // ชื่อผู้ขาย (รับเข้า) หรือ ชื่อผู้เบิก (เบิกออก)
  notes: string;
  editedBy: string; // ชื่อพนักงานผู้แก้ไข (กรณีแก้ไขย้อนหลัง)
}

export interface StockDraftItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export interface SpreadsheetInfo {
  id: string;
  title: string;
  url: string;
  sheetIds: {
    products: number;
    transactions: number;
  };
}

export interface ConfirmDialogConfig {
  isOpen: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  variant?: 'primary' | 'danger';
  onConfirm: () => Promise<void> | void;
}
