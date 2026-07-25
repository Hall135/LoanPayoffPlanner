export const PAYOFF_EPSILON = 0.005;

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function isYearMonth(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ""));
}

export function assertLoanInput(input) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Loan name is required.");
  assertNonNegative(input.principal, "Principal");
  assertNonNegative(input.accruedInterest, "Accrued interest");
  assertNonNegative(input.apr, "APR");
  assertNonNegative(input.minimumPayment, "Minimum payment");
  assertNonNegative(input.additionalPayment, "Additional payment");
  if (!["simple", "compound"].includes(input.interestType)) throw new Error("Choose a valid interest type.");
  const day = Number(input.paymentDay);
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error("Payment day must be between 1 and 31.");
  return true;
}

export function assertLumpSumInput(input) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Lump-sum amount must be greater than zero.");
  if (!isYearMonth(input.yearMonth)) throw new Error("Choose a valid lump-sum month.");
  if (!["specificLoan", "avalanche", "snowball"].includes(input.allocationMethod)) throw new Error("Choose a valid lump-sum allocation method.");
  if (input.allocationMethod === "specificLoan" && (input.loanId === "" || input.loanId === null || input.loanId === undefined)) {
    throw new Error("Choose a target loan for a specific-loan lump sum.");
  }
  return true;
}

export function assertSettingsInput(input) {
  if (!isYearMonth(input.startDate)) throw new Error("Choose a valid simulation start month.");
  const years = Number(input.maxSimulationYears);
  if (!Number.isInteger(years) || years < 1 || years > 100) throw new Error("Maximum simulation years must be an integer between 1 and 100.");
  if (!["avalanche", "snowball"].includes(input.rolloverStrategy)) throw new Error("Choose a valid rollover strategy.");
  return true;
}

export function assertNonNegative(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a non-negative number.`);
}

export function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number(value || 0));
}

export function formatYearMonth(yearMonth) {
  if (!isYearMonth(yearMonth)) return "—";
  const [year, month] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}
