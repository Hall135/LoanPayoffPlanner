import { addLoan, deleteLoan, getAllLoans, getLoan, updateLoan } from "./db.js";
import { formatCurrency } from "./validation.js";

export function populatePaymentDaySelect(select) {
  select.innerHTML = "";
  for (let day = 1; day <= 31; day += 1) select.add(new Option(String(day), String(day)));
  select.value = "1";
}

export function loanFromForm(form) {
  return {
    id: form.elements.loanId.value || undefined,
    name: form.elements.loanName.value,
    principal: form.elements.loanPrincipal.value,
    accruedInterest: form.elements.loanAccruedInterest.value,
    apr: form.elements.loanApr.value,
    interestType: form.elements.loanInterestType.value,
    minimumPayment: form.elements.loanMinimumPayment.value,
    additionalPayment: form.elements.loanAdditionalPayment.value,
    paymentDay: form.elements.loanPaymentDay.value
  };
}

export async function saveLoanFromForm(form) {
  const data = loanFromForm(form);
  return data.id ? updateLoan(data) : addLoan(data);
}

export function resetLoanForm(form) {
  form.reset();
  form.elements.loanId.value = "";
  form.elements.loanAccruedInterest.value = "0";
  form.elements.loanAdditionalPayment.value = "0";
  form.elements.loanPaymentDay.value = "1";
}

export async function populateLoanForm(form, id) {
  const loan = await getLoan(id);
  if (!loan) throw new Error("Loan not found.");
  form.elements.loanId.value = loan.id;
  form.elements.loanName.value = loan.name;
  form.elements.loanPrincipal.value = loan.principal;
  form.elements.loanAccruedInterest.value = loan.accruedInterest;
  form.elements.loanApr.value = loan.apr;
  form.elements.loanInterestType.value = loan.interestType;
  form.elements.loanMinimumPayment.value = loan.minimumPayment;
  form.elements.loanAdditionalPayment.value = loan.additionalPayment;
  form.elements.loanPaymentDay.value = loan.paymentDay;
  return loan;
}

export async function renderLoanList(container, { onEdit, onDelete }) {
  const loans = await getAllLoans();
  container.innerHTML = "";
  if (!loans.length) {
    container.innerHTML = '<p class="muted">No loans added yet.</p>';
    return loans;
  }
  loans.forEach((loan) => {
    const item = document.createElement("article");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-item-top">
        <div>
          <h3>${escapeHtml(loan.name)}</h3>
          <p class="item-meta">${loan.interestType === "compound" ? "Monthly compounding" : "Simple interest"} · ${loan.apr}% APR · Payment day ${loan.paymentDay}</p>
        </div>
        <div class="item-actions">
          <button class="button secondary" type="button" data-action="edit">Edit</button>
          <button class="button danger" type="button" data-action="delete">Delete</button>
        </div>
      </div>
      <p class="item-meta">Principal ${formatCurrency(loan.principal)} · Accrued interest ${formatCurrency(loan.accruedInterest)} · Monthly payment ${formatCurrency(Number(loan.minimumPayment) + Number(loan.additionalPayment))}</p>`;
    item.querySelector('[data-action="edit"]').addEventListener("click", () => onEdit(loan.id));
    item.querySelector('[data-action="delete"]').addEventListener("click", () => onDelete(loan));
    container.append(item);
  });
  return loans;
}

export { deleteLoan, getAllLoans };

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
