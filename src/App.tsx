import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Cloud,
  FileSpreadsheet,
  LogOut,
  Menu,
  Package,
  X,
} from 'lucide-react';
import {
  clearAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/auth';
import {
  AuthExpiredError,
  connectAndVerifySpreadsheet,
  createInventorySpreadsheet,
  findAppSpreadsheets,
  loadAllDataFromSheet,
  syncFullStateToSheet,
} from './services/googleSheets';
import {
  isPasscodeUnlocked,
  loadLocalData,
  saveLocalData,
  setPasscodeUnlocked,
} from './services/storage';
import {
  AppPage,
  ConfirmDialogConfig,
  Product,
  ProductInput,
  SpreadsheetInfo,
  StockDraftItem,
  Transaction,
} from './types/inventory';
import { LoginView } from './components/LoginView';
import { ConfirmDialog } from './components/ConfirmDialog';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { BarcodeViewModal } from './components/BarcodeViewModal';
import { ProductFormModal } from './components/ProductFormModal';
import { EditTransactionModal } from './components/EditTransactionModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { InventoryPage } from './pages/InventoryPage';
import { StockMovementPage } from './pages/StockMovementPage';
import { ReportsPage } from './pages/ReportsPage';
import { formatCurrency, formatNumber, formatThaiShortDate } from './utils/format';

const LAST_SHEET_KEY = 'pp_fruit_last_spreadsheet_id';

const NAV_ITEMS: Array<{
  id: AppPage;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'inventory',
    label: 'จัดการสต็อคสินค้า',
    shortLabel: 'สต็อค',
    icon: Package,
  },
  {
    id: 'stock-in',
    label: 'รับเข้าสินค้า',
    shortLabel: 'รับเข้า',
    icon: ArrowDownToLine,
  },
  {
    id: 'stock-out',
    label: 'เบิกสินค้า',
    shortLabel: 'เบิกออก',
    icon: ArrowUpFromLine,
  },
  {
    id: 'reports',
    label: 'รายงานสต็อค & บัญชี',
    shortLabel: 'รายงาน',
    icon: BarChart3,
  },
];

export default function App() {
  const [unlocked, setUnlocked] = useState<boolean>(() => isPasscodeUnlocked());

  // Core Inventory State (always persisted locally + synced to Google Sheets when connected)
  const [products, setProducts] = useState<Product[]>(
    () => loadLocalData().products
  );
  const [transactions, setTransactions] = useState<Transaction[]>(
    () => loadLocalData().transactions
  );

  // Optional Google Sheets Cloud Sync State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetInfo | null>(null);
  const [discoveredSheets, setDiscoveredSheets] = useState<
    Array<{ id: string; name: string; modifiedTime?: string }>
  >([]);
  const [sheetsModalOpen, setSheetsModalOpen] = useState(false);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  // Navigation & Modals
  const [activePage, setActivePage] = useState<AppPage>('inventory');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmDialogConfig | null>(
    null
  );
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [quickAddDefaults, setQuickAddDefaults] = useState<{
    vendor: string;
    date: string;
  }>({ vendor: '', date: '' });
  const [barcodeViewProduct, setBarcodeViewProduct] = useState<Product | null>(
    null
  );
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const scannerCallbackRef = useRef<(code: string) => void>(() => {});
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Persist locally whenever state changes
  useEffect(() => {
    saveLocalData(products, transactions);
  }, [products, transactions]);

  const commitState = useCallback(
    async (nextProducts: Product[], nextTransactions: Transaction[]) => {
      setProducts(nextProducts);
      setTransactions(nextTransactions);
      saveLocalData(nextProducts, nextTransactions);

      const token = getAccessToken();
      if (token && spreadsheet) {
        try {
          await syncFullStateToSheet(
            token,
            spreadsheet.id,
            nextProducts,
            nextTransactions
          );
          setSyncNotice(null);
        } catch (err) {
          if (err instanceof AuthExpiredError) {
            clearAccessToken();
            setHasGoogleToken(false);
            setSyncNotice(err.message);
          } else {
            setSyncNotice(
              err instanceof Error
                ? err.message
                : 'ซิงค์ Google Sheets ไม่สำเร็จ (บันทึกข้อมูลในเครื่องแล้ว)'
            );
          }
        }
      }
    },
    [spreadsheet]
  );

  // Google Sheets OAuth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
        setHasGoogleToken(Boolean(getAccessToken()));
      },
      (existingUser) => {
        setGoogleUser(existingUser);
        setHasGoogleToken(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const connectSheetAndPullOrPush = useCallback(
    async (token: string, sheetId: string) => {
      setSheetsLoading(true);
      setSheetsError(null);
      try {
        const info = await connectAndVerifySpreadsheet(token, sheetId);
        setSpreadsheet(info);
        try {
          localStorage.setItem(LAST_SHEET_KEY, info.id);
        } catch {
          // ignore
        }
        const remote = await loadAllDataFromSheet(token, info.id);
        if (remote.products.length > 0 || remote.transactions.length > 0) {
          setProducts(remote.products);
          setTransactions(remote.transactions);
        } else if (products.length > 0 || transactions.length > 0) {
          await syncFullStateToSheet(token, info.id, products, transactions);
        }
      } catch (err) {
        if (err instanceof AuthExpiredError) {
          clearAccessToken();
          setHasGoogleToken(false);
        }
        setSheetsError(
          err instanceof Error
            ? err.message
            : 'ไม่สามารถเชื่อมต่อ Google Sheet ได้'
        );
      } finally {
        setSheetsLoading(false);
      }
    },
    [products, transactions]
  );

  const handleGoogleLogin = async () => {
    setSheetsLoading(true);
    setSheetsError(null);
    try {
      const result = await googleSignIn();
      setGoogleUser(result.user);
      setHasGoogleToken(true);
      const files = await findAppSpreadsheets(result.accessToken);
      setDiscoveredSheets(files);

      let savedId: string | null = null;
      try {
        savedId = localStorage.getItem(LAST_SHEET_KEY);
      } catch {
        savedId = null;
      }
      const targetId =
        (savedId && files.some((f) => f.id === savedId) ? savedId : null) ||
        files[0]?.id ||
        null;

      if (targetId) {
        await connectSheetAndPullOrPush(result.accessToken, targetId);
      }
    } catch (err) {
      setSheetsError(
        err instanceof Error ? err.message : 'เชื่อมต่อบัญชี Google ไม่สำเร็จ'
      );
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleCreateNewSheet = async () => {
    const token = getAccessToken();
    if (!token) return;
    setSheetsLoading(true);
    setSheetsError(null);
    try {
      const info = await createInventorySpreadsheet(token);
      setSpreadsheet(info);
      try {
        localStorage.setItem(LAST_SHEET_KEY, info.id);
      } catch {
        // ignore
      }
      if (products.length > 0 || transactions.length > 0) {
        await syncFullStateToSheet(token, info.id, products, transactions);
      }
      const files = await findAppSpreadsheets(token);
      setDiscoveredSheets(files);
    } catch (err) {
      setSheetsError(
        err instanceof Error ? err.message : 'สร้าง Google Sheet ไม่สำเร็จ'
      );
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSelectExistingSheet = async (id: string) => {
    const token = getAccessToken();
    if (!token) return;
    await connectSheetAndPullOrPush(token, id);
  };

  const handleRefreshSheetList = async () => {
    const token = getAccessToken();
    if (!token) return;
    setSheetsLoading(true);
    try {
      const files = await findAppSpreadsheets(token);
      setDiscoveredSheets(files);
    } catch (err) {
      setSheetsError(
        err instanceof Error ? err.message : 'ดึงรายการไฟล์ไม่สำเร็จ'
      );
    } finally {
      setSheetsLoading(false);
    }
  };

  const handlePullFromSheet = async () => {
    const token = getAccessToken();
    if (!token || !spreadsheet) return;
    setSheetsLoading(true);
    setSheetsError(null);
    try {
      const remote = await loadAllDataFromSheet(token, spreadsheet.id);
      setProducts(remote.products);
      setTransactions(remote.transactions);
    } catch (err) {
      setSheetsError(
        err instanceof Error ? err.message : 'ดึงข้อมูลจาก Sheet ไม่สำเร็จ'
      );
    } finally {
      setSheetsLoading(false);
    }
  };

  const handlePushToSheet = async () => {
    const token = getAccessToken();
    if (!token || !spreadsheet) return;
    setConfirmConfig({
      isOpen: true,
      title: 'ยืนยันการอัปโหลดข้อมูลทั้งหมดขึ้น Google Sheets',
      description: `ข้อมูลในชีต "${spreadsheet.title}" จะถูกอัปเดตให้ตรงกับข้อมูลปัจจุบัน (${products.length} สินค้า, ${transactions.length} รายการเคลื่อนไหว)`,
      confirmLabel: 'อัปโหลดขึ้น Google Sheets',
      variant: 'primary',
      onConfirm: async () => {
        setSheetsLoading(true);
        try {
          await syncFullStateToSheet(
            token,
            spreadsheet.id,
            products,
            transactions
          );
        } finally {
          setSheetsLoading(false);
        }
      },
    });
  };

  const handleGoogleDisconnect = async () => {
    await logout();
    setGoogleUser(null);
    setHasGoogleToken(false);
    setSpreadsheet(null);
  };

  // Predictive dropdown sources built dynamically from existing saved records
  const savedCategories = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...products.map((p) => p.category),
            ...transactions.map((t) => t.category),
          ]
            .map((s) => s.trim())
            .filter(Boolean)
        )
      ),
    [products, transactions]
  );

  const savedUnits = useMemo(
    () =>
      Array.from(
        new Set(
          [...products.map((p) => p.unit), ...transactions.map((t) => t.unit)]
            .map((s) => s.trim())
            .filter(Boolean)
        )
      ),
    [products, transactions]
  );

  const savedVendors = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...products.map((p) => p.vendor),
            ...transactions
              .filter((t) => t.type === 'รับเข้า')
              .map((t) => t.party),
          ]
            .map((s) => s.trim())
            .filter(Boolean)
        )
      ),
    [products, transactions]
  );

  const savedWithdrawers = useMemo(
    () =>
      Array.from(
        new Set(
          transactions
            .filter((t) => t.type === 'เบิกออก')
            .map((t) => t.party.trim())
            .filter(Boolean)
        )
      ),
    [transactions]
  );

  const openScanner = (onScanned: (code: string) => void) => {
    scannerCallbackRef.current = onScanned;
    setScannerOpen(true);
  };

  // Add / Edit Product with Confirmation Dialog
  const handleRequestSaveProduct = (
    input: ProductInput,
    existing: Product | null
  ) => {
    if (
      !existing &&
      products.some((p) => p.code.toLowerCase() === input.code.toLowerCase())
    ) {
      setConfirmConfig({
        isOpen: true,
        title: 'รหัสสินค้าซ้ำกัน',
        description: `มีสินค้ารหัส "${input.code}" อยู่ในระบบแล้ว กรุณาเปลี่ยนรหัสสินค้าใหม่`,
        confirmLabel: 'ตกลง',
        variant: 'danger',
        onConfirm: () => {},
      });
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: existing
        ? 'ยืนยันการแก้ไขข้อมูลสินค้า'
        : 'ยืนยันการเพิ่มสินค้าใหม่',
      description: existing
        ? `บันทึกการเปลี่ยนแปลงข้อมูลสินค้า "${input.name}" (${input.code})`
        : `เพิ่มสินค้าใหม่ "${input.name}" รหัส ${input.code}${
            input.quantity > 0
              ? ` พร้อมบันทึกรับเข้า ${formatNumber(input.quantity)} ${input.unit}`
              : ''
          }`,
      details: [
        `รหัสสินค้า: ${input.code}`,
        `หมวดหมู่: ${input.category} · หน่วยนับ: ${input.unit}`,
        `${existing ? 'จำนวนคงเหลือ' : 'จำนวนที่รับเข้า'}: ${formatNumber(input.quantity)} ${input.unit}`,
        `ราคาต่อหน่วย: ฿${formatCurrency(input.unitPrice)}`,
        `ผู้ขาย (Vendor): ${input.vendor || '-'}`,
      ],
      confirmLabel: existing ? 'บันทึกการแก้ไข' : 'ยืนยันเพิ่มสินค้า',
      variant: 'primary',
      onConfirm: async () => {
        let nextProducts: Product[];
        let nextTransactions = [...transactions];

        if (existing) {
          nextProducts = products.map((p) =>
            p.code === existing.code
              ? {
                  ...p,
                  code: input.code,
                  name: input.name,
                  category: input.category,
                  unit: input.unit,
                  quantity: input.quantity,
                  unitPrice: input.unitPrice,
                  vendor: input.vendor,
                  updatedAt: input.date,
                  notes: input.notes,
                }
              : p
          );
        } else {
          const newProduct: Product = {
            rowIndex: products.length + 2,
            code: input.code,
            name: input.name,
            category: input.category,
            unit: input.unit,
            quantity: input.quantity,
            unitPrice: input.unitPrice,
            vendor: input.vendor,
            updatedAt: input.date,
            notes: input.notes,
          };
          nextProducts = [...products, newProduct];

          if (input.quantity > 0) {
            const tx: Transaction = {
              id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              rowIndex: nextTransactions.length + 2,
              date: input.date,
              type: 'รับเข้า',
              productCode: input.code,
              productName: input.name,
              category: input.category,
              unit: input.unit,
              quantity: input.quantity,
              unitPrice: input.unitPrice,
              totalValue: Number((input.quantity * input.unitPrice).toFixed(2)),
              party: input.vendor || '-',
              notes: input.notes || 'รับเข้าสินค้าใหม่',
              editedBy: '',
            };
            nextTransactions = [...nextTransactions, tx];
          }
        }

        setProductModalOpen(false);
        setEditingProduct(null);
        await commitState(nextProducts, nextTransactions);
      },
    });
  };

  const handleRequestDeleteProduct = (product: Product) => {
    setConfirmConfig({
      isOpen: true,
      title: 'ยืนยันการลบสินค้า',
      description: `คุณต้องการลบ "${product.name}" (รหัส ${product.code}) ออกจากรายการสินค้าหรือไม่?`,
      details: [
        `ยอดคงเหลือปัจจุบัน: ${formatNumber(product.quantity)} ${product.unit}`,
      ],
      confirmLabel: 'ลบสินค้า',
      variant: 'danger',
      onConfirm: async () => {
        const nextProducts = products
          .filter((p) => p.code !== product.code)
          .map((p, idx) => ({ ...p, rowIndex: idx + 2 }));
        await commitState(nextProducts, transactions);
      },
    });
  };

  // Stock-In / Stock-Out Batch Submission with Confirmation Dialog
  const handleRequestStockSubmit = (
    mode: 'in' | 'out',
    items: StockDraftItem[],
    meta: { date: string; party: string; notes: string },
    onSuccess: () => void
  ) => {
    const isStockIn = mode === 'in';
    const txType = isStockIn ? 'รับเข้า' : 'เบิกออก';

    setConfirmConfig({
      isOpen: true,
      title: isStockIn
        ? 'ยืนยันบันทึกรับเข้าสินค้า'
        : 'ยืนยันบันทึกเบิกสินค้า',
      description: `วันที่ ${formatThaiShortDate(meta.date)} · ${
        isStockIn ? 'ผู้ขาย' : 'ผู้เบิก'
      }: ${meta.party}`,
      details: items.map(
        (i) =>
          `${i.product.code} ${i.product.name}: ${isStockIn ? '+' : '-'}${formatNumber(i.quantity)} ${i.product.unit} (฿${formatCurrency(i.quantity * i.unitPrice)})`
      ),
      confirmLabel: isStockIn ? 'ยืนยันรับเข้า' : 'ยืนยันเบิกออก',
      variant: 'primary',
      onConfirm: async () => {
        const itemMap = new Map(items.map((i) => [i.product.code, i]));
        const nextProducts = products.map((p) => {
          const item = itemMap.get(p.code);
          if (!item) return p;
          const nextQty = isStockIn
            ? p.quantity + item.quantity
            : Math.max(0, p.quantity - item.quantity);
          return {
            ...p,
            quantity: nextQty,
            unitPrice: isStockIn && item.unitPrice > 0 ? item.unitPrice : p.unitPrice,
            vendor: isStockIn ? meta.party : p.vendor,
            updatedAt: meta.date,
          };
        });

        const baseRow = transactions.length + 2;
        const newTxs: Transaction[] = items.map((item, idx) => ({
          id: `tx-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          rowIndex: baseRow + idx,
          date: meta.date,
          type: txType,
          productCode: item.product.code,
          productName: item.product.name,
          category: item.product.category,
          unit: item.product.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalValue: Number((item.quantity * item.unitPrice).toFixed(2)),
          party: meta.party,
          notes: meta.notes,
          editedBy: '',
        }));

        const nextTransactions = [...transactions, ...newTxs];
        await commitState(nextProducts, nextTransactions);
        onSuccess();
      },
    });
  };

  // Retrospective Transaction Edit with Mandatory Staff Editor Name & Automatic Stock Adjustment
  const handleRequestSaveEditedTransaction = (
    original: Transaction,
    updated: {
      date: string;
      quantity: number;
      unitPrice: number;
      party: string;
      notes: string;
      editedBy: string;
    }
  ) => {
    const qtyDiff =
      original.type === 'รับเข้า'
        ? updated.quantity - original.quantity
        : original.quantity - updated.quantity;

    setConfirmConfig({
      isOpen: true,
      title: 'ยืนยันการแก้ไขรายการย้อนหลัง',
      description: `แก้ไขรายการ ${original.type} ของ "${original.productName}" โดยพนักงาน: ${updated.editedBy}`,
      details: [
        `วันที่: ${formatThaiShortDate(updated.date)}`,
        `จำนวน: ${formatNumber(original.quantity)} -> ${formatNumber(updated.quantity)} ${original.unit}`,
        `ราคาต่อหน่วย: ฿${formatCurrency(original.unitPrice)} -> ฿${formatCurrency(updated.unitPrice)}`,
        `ปรับยอดสต็อคคงเหลืออัตโนมัติ: ${qtyDiff >= 0 ? '+' : ''}${formatNumber(qtyDiff)} ${original.unit}`,
      ],
      confirmLabel: 'บันทึกการแก้ไข',
      variant: 'primary',
      onConfirm: async () => {
        const nextProducts = products.map((p) => {
          if (p.code !== original.productCode) return p;
          return {
            ...p,
            quantity: Math.max(0, p.quantity + qtyDiff),
            updatedAt: updated.date,
          };
        });

        const nextTransactions = transactions.map((t) => {
          if (t.id !== original.id) return t;
          return {
            ...t,
            date: updated.date,
            quantity: updated.quantity,
            unitPrice: updated.unitPrice,
            totalValue: Number(
              (updated.quantity * updated.unitPrice).toFixed(2)
            ),
            party: updated.party,
            notes: updated.notes,
            editedBy: updated.editedBy,
          };
        });

        setEditingTx(null);
        await commitState(nextProducts, nextTransactions);
      },
    });
  };

  const handlePasscodeLogin = () => {
    setPasscodeUnlocked(true);
    setUnlocked(true);
  };

  const handleAppLock = () => {
    setPasscodeUnlocked(false);
    setUnlocked(false);
  };

  if (!unlocked) {
    return <LoginView onSuccess={handlePasscodeLogin} />;
  }

  const currentNav = NAV_ITEMS.find((n) => n.id === activePage) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <img
            src="/assets/aistudio/_________________________1__f33f9ccd.jpg"
            alt="โลโก้ บจก.พิพุทพูนผล"
            referrerPolicy="no-referrer"
            className="h-11 w-11 shrink-0 rounded-lg border border-slate-100 object-contain p-0.5"
          />
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold text-slate-900">
              สต็อตผลไม้
            </p>
            <p className="truncate text-sm text-brand-800 font-medium">
              บจก.พิพุทพูนผล
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="เมนูหลัก">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActivePage(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left text-base font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-brand-50 font-semibold text-brand-900'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${
                    active ? 'text-brand-800' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={() => setSheetsModalOpen(true)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left text-base font-medium text-slate-800 transition-colors hover:bg-brand-50"
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-brand-800" />
              <span className="truncate">
                {spreadsheet ? 'ซิงค์ Google Sheets แล้ว' : 'เชื่อมต่อ Google Sheets'}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={handleAppLock}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex min-h-screen flex-col pb-20 lg:pb-0 lg:pl-[268px]">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden"
              aria-label="เปิดเมนู"
            >
              <Menu className="h-5 w-5" />
            </button>

            <img
              src="/assets/aistudio/_________________________1__f33f9ccd.jpg"
              alt="โลโก้ บจก.พิพุทพูนผล"
              referrerPolicy="no-referrer"
              className="h-9 w-9 shrink-0 rounded object-contain lg:hidden"
            />

            <div className="min-w-0 truncate text-base text-slate-500">
              <span className="hidden sm:inline">สต็อตผลไม้ บจก.พิพุทพูนผล · </span>
              <span className="font-semibold text-slate-900">
                {currentNav.label}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSheetsModalOpen(true)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-base font-medium text-slate-800 transition-colors hover:bg-brand-50 whitespace-nowrap shrink-0"
          >
            <Cloud className="h-4 w-4 text-brand-800" />
            <span>
              {spreadsheet ? 'Google Sheets (เชื่อมต่อแล้ว)' : 'เชื่อมต่อ Google Sheets'}
            </span>
          </button>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="no-print fixed inset-0 z-40 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/assets/aistudio/_________________________1__f33f9ccd.jpg"
                    alt="โลโก้ บจก.พิพุทพูนผล"
                    referrerPolicy="no-referrer"
                    className="h-9 w-9 object-contain"
                  />
                  <span className="font-display text-base font-bold text-slate-900">
                    สต็อตผลไม้
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg p-1.5 text-slate-500"
                  aria-label="ปิดเมนู"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-1 p-3">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActivePage(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-base font-medium ${
                        active
                          ? 'bg-brand-50 font-semibold text-brand-900'
                          : 'text-slate-700'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2 border-t border-slate-200 p-4">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setSheetsModalOpen(true);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-base font-medium text-slate-800"
                >
                  <FileSpreadsheet className="h-4 w-4 text-brand-800" />
                  <span>Google Sheets</span>
                </button>
                <button
                  type="button"
                  onClick={handleAppLock}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2.5 text-base font-medium text-red-700"
                >
                  <LogOut className="h-4 w-4" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {syncNotice && (
            <div className="no-print mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-950">
              <span>{syncNotice}</span>
              <button
                type="button"
                onClick={() => setSyncNotice(null)}
                className="font-medium underline shrink-0"
              >
                ปิด
              </button>
            </div>
          )}

          {activePage === 'inventory' && (
            <InventoryPage
              products={products}
              onAddProduct={() => {
                setEditingProduct(null);
                setQuickAddDefaults({ vendor: '', date: '' });
                setProductModalOpen(true);
              }}
              onEditProduct={(p) => {
                setEditingProduct(p);
                setQuickAddDefaults({ vendor: '', date: '' });
                setProductModalOpen(true);
              }}
              onDeleteProduct={handleRequestDeleteProduct}
              onViewBarcode={(p) => setBarcodeViewProduct(p)}
              onOpenScanner={openScanner}
            />
          )}

          {activePage === 'stock-in' && (
            <StockMovementPage
              key="stock-in"
              mode="in"
              products={products}
              transactions={transactions}
              savedVendors={savedVendors}
              savedWithdrawers={savedWithdrawers}
              onOpenScanner={openScanner}
              onQuickAddProduct={(defaults) => {
                setEditingProduct(null);
                setQuickAddDefaults(defaults);
                setProductModalOpen(true);
              }}
              onRequestSubmit={(items, meta, onSuccess) =>
                handleRequestStockSubmit('in', items, meta, onSuccess)
              }
            />
          )}

          {activePage === 'stock-out' && (
            <StockMovementPage
              key="stock-out"
              mode="out"
              products={products}
              transactions={transactions}
              savedVendors={savedVendors}
              savedWithdrawers={savedWithdrawers}
              onOpenScanner={openScanner}
              onRequestSubmit={(items, meta, onSuccess) =>
                handleRequestStockSubmit('out', items, meta, onSuccess)
              }
            />
          )}

          {activePage === 'reports' && (
            <ReportsPage
              products={products}
              transactions={transactions}
              onEditTransaction={(tx) => setEditingTx(tx)}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white lg:hidden"
        aria-label="เมนูด่วนมือถือ"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActivePage(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium whitespace-nowrap ${
                active ? 'font-semibold text-brand-800' : 'text-slate-600'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      <ProductFormModal
        isOpen={productModalOpen}
        editingProduct={editingProduct}
        existingProducts={products}
        savedCategories={savedCategories}
        savedUnits={savedUnits}
        savedVendors={savedVendors}
        defaultVendor={quickAddDefaults.vendor}
        defaultDate={quickAddDefaults.date}
        onClose={() => {
          setProductModalOpen(false);
          setEditingProduct(null);
        }}
        onRequestSave={handleRequestSaveProduct}
      />

      <BarcodeViewModal
        product={barcodeViewProduct}
        onClose={() => setBarcodeViewProduct(null)}
      />

      <EditTransactionModal
        transaction={editingTx}
        product={
          editingTx
            ? products.find((p) => p.code === editingTx.productCode)
            : undefined
        }
        onClose={() => setEditingTx(null)}
        onRequestSaveEdit={handleRequestSaveEditedTransaction}
      />

      <GoogleSheetsModal
        isOpen={sheetsModalOpen}
        isSignedIn={hasGoogleToken}
        userEmail={googleUser?.email || null}
        spreadsheet={spreadsheet}
        discoveredSheets={discoveredSheets}
        isLoading={sheetsLoading}
        error={sheetsError}
        onClose={() => setSheetsModalOpen(false)}
        onGoogleLogin={handleGoogleLogin}
        onCreateNew={handleCreateNewSheet}
        onSelectExisting={handleSelectExistingSheet}
        onRefreshList={handleRefreshSheetList}
        onPushLocalToSheet={handlePushToSheet}
        onPullSheetToLocal={handlePullFromSheet}
        onGoogleDisconnect={handleGoogleDisconnect}
      />

      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          scannerCallbackRef.current(code);
        }}
      />

      <ConfirmDialog
        config={confirmConfig}
        onClose={() => setConfirmConfig(null)}
      />
    </div>
  );
}
