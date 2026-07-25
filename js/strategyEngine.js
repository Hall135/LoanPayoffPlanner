import { PAYOFF_EPSILON } from "./validation.js";

export const STRATEGIES = Object.freeze({ AVALANCHE: "avalanche", SNOWBALL: "snowball" });

export function getActiveLoans(loans) {
  return loans.filter((loan) => !loan.isPaidOff && loan.totalBalance > PAYOFF_EPSILON);
}

export function sortLoansByStrategy(loans, strategy) {
  const active = [...getActiveLoans(loans)];
  if (strategy === STRATEGIES.AVALANCHE) {
    return active.sort((a, b) => (b.apr - a.apr) || (a.creationOrder - b.creationOrder));
  }
  if (strategy === STRATEGIES.SNOWBALL) {
    return active.sort((a, b) => (a.totalBalance - b.totalBalance) || (a.creationOrder - b.creationOrder));
  }
  throw new Error(`Unknown payoff strategy: ${strategy}`);
}

export function getTargetLoan(loans, strategy) {
  return sortLoansByStrategy(loans, strategy)[0] || null;
}

export function getNewlyPaidOffLoans(previousLoans, currentLoans) {
  const previous = new Map(previousLoans.map((loan) => [loan.id, loan]));
  return currentLoans.filter((current) => {
    const prior = previous.get(current.id);
    return prior && !prior.isPaidOff && current.isPaidOff;
  });
}
