import { formatYearMonth } from "./validation.js";

export function downloadText(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportDatabaseJson(data) {
  downloadText(`loan_payoff_planner_backup_${dateStamp()}.json`, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
}

export function loanCsv(result, loanId) {
  const header = ["Month", "YearMonth", "Principal", "AccruedInterest", "TotalBalance", "InterestAdded", "InterestPaid", "PrincipalPaid", "PaymentApplied"];
  const rows = result.snapshots.map((snapshot) => {
    const loan = snapshot.loans.find((item) => item.id === Number(loanId));
    if (!loan) return null;
    return [snapshot.monthNumber, snapshot.yearMonth, loan.principal, loan.accruedInterest, loan.totalBalance, loan.interestAdded, loan.interestPaidThisMonth, loan.principalPaidThisMonth, loan.paymentAppliedThisMonth];
  }).filter(Boolean);
  return toCsv([header, ...rows]);
}

export function portfolioCsv(result) {
  const header = ["Month", "YearMonth", "TotalPrincipal", "TotalAccruedInterest", "TotalRemainingDebt", "TotalInterestAdded", "TotalPaymentsApplied"];
  const rows = result.snapshots.map((snapshot) => [
    snapshot.monthNumber,
    snapshot.yearMonth,
    snapshot.totalPrincipal,
    snapshot.totalAccruedInterest,
    snapshot.totalDebt,
    snapshot.totalInterestAdded,
    snapshot.totalPaymentsApplied
  ]);
  return toCsv([header, ...rows]);
}

export function exportCanvasPng(canvas, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export function safeFilename(name) {
  return String(name || "loan").trim().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "loan";
}

function toCsv(rows) {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
