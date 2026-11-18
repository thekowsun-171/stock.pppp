import { Product, Transaction } from '../types/inventory';

const PRODUCTS_KEY = 'pp_fruit_stock_products_v1';
const TRANSACTIONS_KEY = 'pp_fruit_stock_transactions_v1';
const PASSCODE_SESSION_KEY = 'pp_fruit_stock_unlocked_v1';

export function isPasscodeUnlocked(): boolean {
  try {
    return sessionStorage.getItem(PASSCODE_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setPasscodeUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) {
      sessionStorage.setItem(PASSCODE_SESSION_KEY, 'true');
    } else {
      sessionStorage.removeItem(PASSCODE_SESSION_KEY);
    }
  } catch {
    // ignore storage restriction
  }
}

export function loadLocalData(): {
  products: Product[];
  transactions: Transaction[];
} {
  try {
    const rawP = localStorage.getItem(PRODUCTS_KEY);
    const rawT = localStorage.getItem(TRANSACTIONS_KEY);
    const products: Product[] = rawP ? JSON.parse(rawP) : [];
    const transactions: Transaction[] = rawT ? JSON.parse(rawT) : [];
    return {
      products: Array.isArray(products) ? products : [],
      transactions: Array.isArray(transactions) ? transactions : [],
    };
  } catch {
    return { products: [], transactions: [] };
  }
}

export function saveLocalData(
  products: Product[],
  transactions: Transaction[]
): void {
  try {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  } catch {
    // ignore storage quota errors
  }
}
