import { PAYOFF_EPSILON, roundMoney } from "./validation.js";

export function createRuntimeLoan(loan) {
  const principal = roundMoney(loan.principal);
  const accruedInterest = roundMoney(loan.accruedInterest);
  const totalBalance = roundMoney(principal + accruedInterest);
  return {
    id: Number(loan.id),
    creationOrder: Number(loan.creationOrder),
    name: loan.name,
    apr: Number(loan.apr),
    interestType: loan.interestType,
    compoundingFrequency: loan.compoundingFrequency || "monthly",
    minimumPayment: roundMoney(loan.minimumPayment),
    additionalPayment: roundMoney(loan.additionalPayment),
    principal,
    accruedInterest,
    totalBalance,
    startingAccruedInterest: accruedInterest,
    totalInterestPaid: 0,
    totalPrincipalPaid: 0,
    totalInterestAccrued: 0,
    payoffMonth: null,
    payoffDate: null,
    rolloverBudgetReleased: false,
    isPaidOff: totalBalance <= PAYOFF_EPSILON
  };
}

export function cloneLoans(loans) {
  return loans.map((loan) => ({ ...loan }));
}

export function applyInterest(loan) {
  if (loan.isPaidOff) return 0;
  const rate = calculateMonthlyRate(loan);
  let interestAdded;
  if (loan.interestType === "simple") {
    interestAdded = roundMoney(loan.principal * rate);
  } else if (loan.interestType === "compound") {
    interestAdded = roundMoney((loan.principal + loan.accruedInterest) * rate);
  } else {
    throw new Error(`Unsupported interest type: ${loan.interestType}`);
  }
  loan.accruedInterest = roundMoney(loan.accruedInterest + interestAdded);
  loan.totalInterestAccrued = roundMoney(loan.totalInterestAccrued + interestAdded);
  refreshTotals(loan);
  return interestAdded;
}

export function applyPayment(loan, amount) {
  let remaining = roundMoney(amount);
  if (remaining <= 0) return { paymentApplied: 0, interestPaid: 0, principalPaid: 0, excessAmount: 0 };
  if (loan.isPaidOff || loan.totalBalance <= PAYOFF_EPSILON) {
    return { paymentApplied: 0, interestPaid: 0, principalPaid: 0, excessAmount: remaining };
  }

  const interestPaid = roundMoney(Math.min(remaining, loan.accruedInterest));
  loan.accruedInterest = roundMoney(loan.accruedInterest - interestPaid);
  remaining = roundMoney(remaining - interestPaid);

  const principalPaid = roundMoney(Math.min(remaining, loan.principal));
  loan.principal = roundMoney(loan.principal - principalPaid);
  remaining = roundMoney(remaining - principalPaid);

  loan.totalInterestPaid = roundMoney(loan.totalInterestPaid + interestPaid);
  loan.totalPrincipalPaid = roundMoney(loan.totalPrincipalPaid + principalPaid);
  refreshTotals(loan);

  return {
    paymentApplied: roundMoney(interestPaid + principalPaid),
    interestPaid,
    principalPaid,
    excessAmount: remaining
  };
}

export function updatePayoffStatus(loan, monthNumber, yearMonth) {
  if (loan.isPaidOff) return false;
  if (loan.totalBalance <= PAYOFF_EPSILON) {
    loan.principal = 0;
    loan.accruedInterest = 0;
    loan.totalBalance = 0;
    loan.isPaidOff = true;
    loan.payoffMonth = monthNumber;
    loan.payoffDate = yearMonth;
    return true;
  }
  return false;
}

export function createLoanSnapshot(loan, activity = {}) {
  return {
    id: loan.id,
    name: loan.name,
    principal: loan.principal,
    accruedInterest: loan.accruedInterest,
    totalBalance: loan.totalBalance,
    totalInterestPaid: loan.totalInterestPaid,
    totalPrincipalPaid: loan.totalPrincipalPaid,
    totalInterestAccrued: loan.totalInterestAccrued,
    isPaidOff: loan.isPaidOff,
    payoffMonth: loan.payoffMonth,
    payoffDate: loan.payoffDate,
    interestAdded: roundMoney(activity.interestAdded || 0),
    interestPaidThisMonth: roundMoney(activity.interestPaid || 0),
    principalPaidThisMonth: roundMoney(activity.principalPaid || 0),
    paymentAppliedThisMonth: roundMoney(activity.paymentApplied || 0)
  };
}

export function calculatePortfolioBalance(loans) {
  return roundMoney(loans.reduce((sum, loan) => sum + loan.totalBalance, 0));
}

export function calculatePortfolioInterestPaid(loans) {
  return roundMoney(loans.reduce((sum, loan) => sum + loan.totalInterestPaid, 0));
}

export function calculatePortfolioPrincipalPaid(loans) {
  return roundMoney(loans.reduce((sum, loan) => sum + loan.totalPrincipalPaid, 0));
}

export function allLoansPaidOff(loans) {
  return loans.every((loan) => loan.isPaidOff || loan.totalBalance <= PAYOFF_EPSILON);
}

export function calculateMonthlyRate(loan) {
  if (loan.compoundingFrequency !== "monthly") throw new Error(`Unsupported compounding frequency: ${loan.compoundingFrequency}`);
  return loan.apr / 100 / 12;
}

export function refreshTotals(loan) {
  loan.totalBalance = roundMoney(loan.principal + loan.accruedInterest);
  return loan.totalBalance;
}

export { roundMoney };
