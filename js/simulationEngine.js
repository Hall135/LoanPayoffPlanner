import {
  createRuntimeLoan,
  cloneLoans,
  applyInterest,
  applyPayment,
  updatePayoffStatus,
  createLoanSnapshot,
  calculatePortfolioBalance,
  calculatePortfolioInterestPaid,
  calculatePortfolioPrincipalPaid,
  allLoansPaidOff,
  roundMoney
} from "./simulationModels.js";
import { STRATEGIES, getTargetLoan, getNewlyPaidOffLoans, getActiveLoans } from "./strategyEngine.js";
import { PAYOFF_EPSILON, assertSettingsInput, formatYearMonth } from "./validation.js";

export function runSimulation({ loans, lumpSums, settings }) {
  assertSettingsInput(settings);
  const runtimeLoans = [...loans]
    .sort((a, b) => a.creationOrder - b.creationOrder)
    .map(createRuntimeLoan);
  const scheduledLumpSums = [...lumpSums].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth) || a.id - b.id);
  const warnings = [];
  const warningKeys = new Set();
  const snapshots = [];
  const start = parseYearMonth(settings.startDate);
  const maxMonths = Number(settings.maxSimulationYears) * 12;
  let permanentStrategyBudget = 0;

  if (!runtimeLoans.length) {
    return { summary: emptySummary(), snapshots, loanResults: [], warnings };
  }

  for (let index = 0; index < maxMonths; index += 1) {
    const monthNumber = index + 1;
    const yearMonth = buildYearMonth(start, index);
    const activity = createActivityLedger(runtimeLoans);
    const previousState = cloneLoans(runtimeLoans);
    const activeAtMonthStart = runtimeLoans.filter((loan) => !loan.isPaidOff);
    let currentMonthExcessPool = 0;

    // 1. Interest accrual.
    for (const loan of activeAtMonthStart) {
      const interestAdded = applyInterest(loan);
      activity.get(loan.id).interestAdded = roundMoney(activity.get(loan.id).interestAdded + interestAdded);
      const normalPayment = roundMoney(loan.minimumPayment + loan.additionalPayment);
      if (normalPayment + PAYOFF_EPSILON < interestAdded) {
        pushWarning(warnings, warningKeys, {
          type: "NEGATIVE_AMORTIZATION",
          loanId: loan.id,
          message: `${loan.name}: its normal monthly payment is less than this month's accrued interest.`
        });
      }
    }

    // 2. Scheduled lump sums. Lumps happen before regular monthly payments.
    const monthLumps = scheduledLumpSums.filter((lump) => lump.yearMonth === yearMonth);
    for (const lump of monthLumps) {
      const result = processLumpSum(runtimeLoans, lump, activity);
      if (settings.rolloverEnabled) currentMonthExcessPool = roundMoney(currentMonthExcessPool + result.excessAmount);
    }

    // 3. Regular payments. Use the loans that were active at the start of this month.
    // If a lump sum paid one off first, applyPayment returns its full scheduled payment as excess.
    for (const loan of activeAtMonthStart) {
      const scheduledPayment = roundMoney(loan.minimumPayment + loan.additionalPayment);
      const result = applyPayment(loan, scheduledPayment);
      recordPayment(activity, loan.id, result);
      if (settings.rolloverEnabled) currentMonthExcessPool = roundMoney(currentMonthExcessPool + result.excessAmount);
      updatePayoffStatus(loan, monthNumber, yearMonth);
    }

    // 4. Apply the permanent strategy budget exactly once this month.
    if (settings.rolloverEnabled && permanentStrategyBudget > PAYOFF_EPSILON) {
      const result = allocateByStrategy(runtimeLoans, permanentStrategyBudget, settings.rolloverStrategy, activity, monthNumber, yearMonth);
      currentMonthExcessPool = roundMoney(currentMonthExcessPool + result.excessAmount);
    }

    // 5. Reallocate only actual same-month excess cash until it is exhausted or no loans remain.
    if (settings.rolloverEnabled && currentMonthExcessPool > PAYOFF_EPSILON) {
      currentMonthExcessPool = allocateCurrentMonthExcess(runtimeLoans, currentMonthExcessPool, settings.rolloverStrategy, activity, monthNumber, yearMonth);
    }

    // 6. Final payoff update and release of future budget only.
    runtimeLoans.forEach((loan) => updatePayoffStatus(loan, monthNumber, yearMonth));
    const newlyPaid = getNewlyPaidOffLoans(previousState, runtimeLoans);
    if (settings.rolloverEnabled) {
      for (const loan of newlyPaid) {
        if (!loan.rolloverBudgetReleased) {
          permanentStrategyBudget = roundMoney(permanentStrategyBudget + loan.minimumPayment + loan.additionalPayment);
          loan.rolloverBudgetReleased = true;
        }
      }
    }

    snapshots.push(createMonthlySnapshot(runtimeLoans, activity, yearMonth, monthNumber));

    if (allLoansPaidOff(runtimeLoans)) break;
    if (monthNumber === maxMonths) {
      pushWarning(warnings, warningKeys, {
        type: "SIMULATION_LIMIT",
        message: `The ${settings.maxSimulationYears}-year simulation limit was reached before every loan was paid off.`
      });
    }
  }

  return {
    summary: buildSummary(runtimeLoans, snapshots, permanentStrategyBudget),
    snapshots,
    loanResults: buildLoanResults(runtimeLoans),
    warnings
  };
}

function processLumpSum(loans, lump, activity) {
  if (lump.allocationMethod === "specificLoan") {
    const loan = loans.find((candidate) => candidate.id === Number(lump.loanId));
    if (!loan) return { excessAmount: roundMoney(lump.amount) };
    const result = applyPayment(loan, lump.amount);
    recordPayment(activity, loan.id, result);
    return { excessAmount: result.excessAmount };
  }
  if (lump.allocationMethod === STRATEGIES.AVALANCHE || lump.allocationMethod === STRATEGIES.SNOWBALL) {
    return allocateByStrategy(loans, lump.amount, lump.allocationMethod, activity, null, null);
  }
  throw new Error(`Unknown lump-sum allocation method: ${lump.allocationMethod}`);
}

function allocateByStrategy(loans, amount, strategy, activity, monthNumber, yearMonth) {
  let remaining = roundMoney(amount);
  while (remaining > PAYOFF_EPSILON) {
    const target = getTargetLoan(loans, strategy);
    if (!target) break;
    const result = applyPayment(target, remaining);
    recordPayment(activity, target.id, result);
    if (monthNumber && yearMonth) updatePayoffStatus(target, monthNumber, yearMonth);
    remaining = roundMoney(result.excessAmount);
    if (result.paymentApplied <= PAYOFF_EPSILON) break;
  }
  return { excessAmount: remaining };
}

function allocateCurrentMonthExcess(loans, pool, strategy, activity, monthNumber, yearMonth) {
  let remaining = roundMoney(pool);
  while (remaining > PAYOFF_EPSILON && getActiveLoans(loans).length) {
    const result = allocateByStrategy(loans, remaining, strategy, activity, monthNumber, yearMonth);
    const after = roundMoney(result.excessAmount);
    if (after >= remaining - PAYOFF_EPSILON) break;
    remaining = after;
  }
  return remaining;
}

function createActivityLedger(loans) {
  return new Map(loans.map((loan) => [loan.id, { interestAdded: 0, interestPaid: 0, principalPaid: 0, paymentApplied: 0 }]));
}

function recordPayment(activity, loanId, result) {
  const entry = activity.get(loanId);
  if (!entry) return;
  entry.interestPaid = roundMoney(entry.interestPaid + result.interestPaid);
  entry.principalPaid = roundMoney(entry.principalPaid + result.principalPaid);
  entry.paymentApplied = roundMoney(entry.paymentApplied + result.paymentApplied);
}

function createMonthlySnapshot(loans, activity, yearMonth, monthNumber) {
  const loanSnapshots = loans.map((loan) => createLoanSnapshot(loan, activity.get(loan.id)));
  return {
    monthNumber,
    yearMonth,
    totalDebt: calculatePortfolioBalance(loans),
    totalPrincipal: roundMoney(loans.reduce((sum, loan) => sum + loan.principal, 0)),
    totalAccruedInterest: roundMoney(loans.reduce((sum, loan) => sum + loan.accruedInterest, 0)),
    totalInterestAdded: roundMoney(loanSnapshots.reduce((sum, loan) => sum + loan.interestAdded, 0)),
    totalPaymentsApplied: roundMoney(loanSnapshots.reduce((sum, loan) => sum + loan.paymentAppliedThisMonth, 0)),
    loans: loanSnapshots
  };
}

function buildSummary(loans, snapshots, permanentStrategyBudget) {
  const final = snapshots.at(-1);
  return {
    projectedPayoffDate: allLoansPaidOff(loans) ? latestPayoffDate(loans) : null,
    monthsSimulated: snapshots.length,
    totalDebtRemaining: final ? final.totalDebt : calculatePortfolioBalance(loans),
    totalInterestPaid: calculatePortfolioInterestPaid(loans),
    totalPrincipalPaid: calculatePortfolioPrincipalPaid(loans),
    permanentStrategyBudget
  };
}

function buildLoanResults(loans) {
  return loans.map((loan) => ({
    id: loan.id,
    name: loan.name,
    currentBalance: roundMoney(loan.principal + loan.accruedInterest),
    payoffDate: loan.payoffDate,
    payoffMonth: loan.payoffMonth,
    totalInterestPaid: loan.totalInterestPaid,
    totalPrincipalPaid: loan.totalPrincipalPaid,
    totalInterestAccrued: loan.totalInterestAccrued,
    remainingBalance: loan.totalBalance,
    isPaidOff: loan.isPaidOff
  }));
}

function pushWarning(warnings, keys, warning) {
  const key = `${warning.type}:${warning.loanId ?? "portfolio"}`;
  if (!keys.has(key)) {
    keys.add(key);
    warnings.push(warning);
  }
}

function parseYearMonth(yearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);
  return { year, month };
}

function buildYearMonth(start, offset) {
  const date = new Date(start.year, start.month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function latestPayoffDate(loans) {
  const dates = loans.map((loan) => loan.payoffDate).filter(Boolean).sort();
  return dates.at(-1) || null;
}

function emptySummary() {
  return { projectedPayoffDate: null, monthsSimulated: 0, totalDebtRemaining: 0, totalInterestPaid: 0, totalPrincipalPaid: 0, permanentStrategyBudget: 0 };
}

export function simulationDisclaimer() {
  return `This tool is a planning estimate. It uses monthly interest assumptions and may differ from a lender's statement timing. Last simulated month: ${formatYearMonth("2000-01")}.`;
}
