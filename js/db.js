import { assertLoanInput, assertLumpSumInput, assertSettingsInput, getCurrentYearMonth } from "./validation.js";

const DB_NAME = "loanPayoffPlannerDB";
const DB_VERSION = 1;
export const STORES = Object.freeze({ LOANS: "loans", LUMP_SUMS: "lumpSums", SETTINGS: "settings" });
let dbPromise;

export const DEFAULT_SETTINGS = Object.freeze({
  id: "simulationSettings",
  startDate: getCurrentYearMonth(),
  maxSimulationYears: 10,
  rolloverEnabled: false,
  rolloverStrategy: "avalanche"
});

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.LOANS)) {
        const store = db.createObjectStore(STORES.LOANS, { keyPath: "id", autoIncrement: true });
        store.createIndex("name", "name", { unique: true });
        store.createIndex("creationOrder", "creationOrder", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.LUMP_SUMS)) {
        const store = db.createObjectStore(STORES.LUMP_SUMS, { keyPath: "id", autoIncrement: true });
        store.createIndex("loanId", "loanId", { unique: false });
        store.createIndex("yearMonth", "yearMonth", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) db.createObjectStore(STORES.SETTINGS, { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error("Unable to open IndexedDB."));
  });
  return dbPromise;
}

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
  });
}

async function getStore(storeName, mode = "readonly") {
  const db = await openDb();
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function getAllLoans() {
  const store = await getStore(STORES.LOANS);
  const loans = await requestPromise(store.getAll());
  return loans.sort((a, b) => (a.creationOrder ?? 0) - (b.creationOrder ?? 0));
}

export async function getLoan(id) {
  const store = await getStore(STORES.LOANS);
  return requestPromise(store.get(Number(id)));
}

export async function addLoan(input) {
  assertLoanInput(input);
  const existing = await getLoanByName(input.name.trim());
  if (existing) throw new Error(`A loan named "${input.name.trim()}" already exists.`);
  const loans = await getAllLoans();
  const creationOrder = loans.length ? Math.max(...loans.map((loan) => Number(loan.creationOrder) || 0)) + 1 : 1;
  const record = normalizeLoan({ ...input, name: input.name.trim(), creationOrder, compoundingFrequency: "monthly" });
  const store = await getStore(STORES.LOANS, "readwrite");
  return requestPromise(store.add(record));
}

export async function updateLoan(input) {
  if (!input.id) throw new Error("Loan ID is required for an update.");
  assertLoanInput(input);
  const current = await getLoan(input.id);
  if (!current) throw new Error("Loan not found.");
  const duplicate = await getLoanByName(input.name.trim());
  if (duplicate && duplicate.id !== current.id) throw new Error(`A loan named "${input.name.trim()}" already exists.`);
  const record = normalizeLoan({ ...current, ...input, id: current.id, name: input.name.trim(), creationOrder: current.creationOrder, compoundingFrequency: "monthly" });
  const store = await getStore(STORES.LOANS, "readwrite");
  await requestPromise(store.put(record));
  return record.id;
}

export async function deleteLoan(id) {
  const db = await openDb();
  const transaction = db.transaction([STORES.LOANS, STORES.LUMP_SUMS], "readwrite");
  transaction.objectStore(STORES.LOANS).delete(Number(id));
  const lumpStore = transaction.objectStore(STORES.LUMP_SUMS);
  const index = lumpStore.index("loanId");
  const request = index.openCursor(IDBKeyRange.only(Number(id)));
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };
  await transactionDone(transaction);
}

export async function getLoanByName(name) {
  const store = await getStore(STORES.LOANS);
  return requestPromise(store.index("name").get(String(name).trim()));
}

export async function getAllLumpSums() {
  const store = await getStore(STORES.LUMP_SUMS);
  const records = await requestPromise(store.getAll());
  return records.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth) || a.id - b.id);
}

export async function addLumpSum(input) {
  assertLumpSumInput(input);
  const record = normalizeLumpSum(input);
  if (record.allocationMethod === "specificLoan") {
    const loan = await getLoan(record.loanId);
    if (!loan) throw new Error("The selected target loan no longer exists.");
  }
  const store = await getStore(STORES.LUMP_SUMS, "readwrite");
  return requestPromise(store.add(record));
}

export async function updateLumpSum(input) {
  if (!input.id) throw new Error("Lump-sum ID is required for an update.");
  assertLumpSumInput(input);
  const record = normalizeLumpSum(input);
  if (record.allocationMethod === "specificLoan") {
    const loan = await getLoan(record.loanId);
    if (!loan) throw new Error("The selected target loan no longer exists.");
  }
  const store = await getStore(STORES.LUMP_SUMS, "readwrite");
  await requestPromise(store.put(record));
  return record.id;
}

export async function deleteLumpSum(id) {
  const store = await getStore(STORES.LUMP_SUMS, "readwrite");
  return requestPromise(store.delete(Number(id)));
}

export async function getSettings() {
  const store = await getStore(STORES.SETTINGS);
  const saved = await requestPromise(store.get(DEFAULT_SETTINGS.id));
  return { ...DEFAULT_SETTINGS, ...(saved || {}) };
}

export async function saveSettings(input) {
  assertSettingsInput(input);
  const record = {
    id: DEFAULT_SETTINGS.id,
    startDate: input.startDate,
    maxSimulationYears: Number(input.maxSimulationYears),
    rolloverEnabled: Boolean(input.rolloverEnabled),
    rolloverStrategy: input.rolloverStrategy
  };
  const store = await getStore(STORES.SETTINGS, "readwrite");
  await requestPromise(store.put(record));
  return record;
}

export async function exportDatabase() {
  return { version: 1, exportedAt: new Date().toISOString(), loans: await getAllLoans(), lumpSums: await getAllLumpSums(), settings: await getSettings() };
}

export async function importDatabase(data) {
  validateImportData(data);
  const db = await openDb();
  const transaction = db.transaction([STORES.LOANS, STORES.LUMP_SUMS, STORES.SETTINGS], "readwrite");
  const loanStore = transaction.objectStore(STORES.LOANS);
  const lumpStore = transaction.objectStore(STORES.LUMP_SUMS);
  const settingsStore = transaction.objectStore(STORES.SETTINGS);
  loanStore.clear();
  lumpStore.clear();
  settingsStore.clear();
  data.loans.forEach((loan) => loanStore.put(normalizeLoan({ ...loan, compoundingFrequency: "monthly" })));
  data.lumpSums.forEach((lump) => lumpStore.put(normalizeLumpSum(lump)));
  settingsStore.put({ ...DEFAULT_SETTINGS, ...data.settings, id: DEFAULT_SETTINGS.id });
  await transactionDone(transaction);
}

function validateImportData(data) {
  if (!data || !Array.isArray(data.loans) || !Array.isArray(data.lumpSums) || !data.settings) throw new Error("Import file must contain loans, lumpSums, and settings.");
  const names = new Set();
  const ids = new Set();
  data.loans.forEach((loan) => {
    assertLoanInput(loan);
    const normalized = loan.name.trim().toLowerCase();
    if (names.has(normalized)) throw new Error(`Duplicate loan name detected: "${loan.name}".`);
    names.add(normalized);
    if (loan.id !== undefined && loan.id !== null) ids.add(Number(loan.id));
  });
  data.lumpSums.forEach((lump) => {
    assertLumpSumInput(lump);
    if (lump.allocationMethod === "specificLoan" && !ids.has(Number(lump.loanId))) throw new Error("A specific-loan lump sum references a missing loan.");
  });
  assertSettingsInput(data.settings);
}

function normalizeLoan(loan) {
  return {
    ...(loan.id !== undefined ? { id: Number(loan.id) } : {}),
    creationOrder: Number(loan.creationOrder),
    name: String(loan.name).trim(),
    principal: Number(loan.principal),
    accruedInterest: Number(loan.accruedInterest),
    apr: Number(loan.apr),
    interestType: loan.interestType,
    compoundingFrequency: "monthly",
    minimumPayment: Number(loan.minimumPayment),
    additionalPayment: Number(loan.additionalPayment),
    paymentDay: Number(loan.paymentDay)
  };
}

function normalizeLumpSum(lump) {
  return {
    ...(lump.id !== undefined ? { id: Number(lump.id) } : {}),
    amount: Number(lump.amount),
    yearMonth: String(lump.yearMonth),
    allocationMethod: lump.allocationMethod,
    loanId: lump.allocationMethod === "specificLoan" ? Number(lump.loanId) : null
  };
}
