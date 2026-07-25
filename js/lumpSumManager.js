import { addLumpSum, deleteLumpSum, getAllLumpSums, updateLumpSum } from "./db.js";
import { formatCurrency, formatYearMonth } from "./validation.js";

export function lumpSumFromForm(form) {
  return {
    id: form.elements.lumpId.value || undefined,
    amount: form.elements.lumpAmount.value,
    yearMonth: form.elements.lumpYearMonth.value,
    allocationMethod: form.elements.lumpAllocationMethod.value,
    loanId: form.elements.lumpLoanId.value
  };
}

export async function saveLumpSumFromForm(form) {
  const data = lumpSumFromForm(form);
  return data.id ? updateLumpSum(data) : addLumpSum(data);
}

export function resetLumpSumForm(form) {
  form.reset();
  form.elements.lumpId.value = "";
  toggleTargetLoan(form);
}

export function toggleTargetLoan(form) {
  const specific = form.elements.lumpAllocationMethod.value === "specificLoan";
  form.querySelector("#lumpTargetLoanWrap").classList.toggle("hidden", !specific);
  form.elements.lumpLoanId.disabled = !specific;
}

export function populateLoanOptions(select, loans, selectedId = "") {
  select.innerHTML = "";
  if (!loans.length) {
    select.add(new Option("Add a loan first", ""));
    select.disabled = true;
    return;
  }
  select.disabled = false;
  loans.forEach((loan) => select.add(new Option(loan.name, String(loan.id), false, String(loan.id) === String(selectedId))));
}

export function populateLumpSumForm(form, lumpSum) {
  form.elements.lumpId.value = lumpSum.id;
  form.elements.lumpAmount.value = lumpSum.amount;
  form.elements.lumpYearMonth.value = lumpSum.yearMonth;
  form.elements.lumpAllocationMethod.value = lumpSum.allocationMethod;
  form.elements.lumpLoanId.value = lumpSum.loanId ?? "";
  toggleTargetLoan(form);
}

export async function renderLumpSumList(container, loans, { onEdit, onDelete }) {
  const lumpSums = await getAllLumpSums();
  const lookup = new Map(loans.map((loan) => [Number(loan.id), loan.name]));
  container.innerHTML = "";
  if (!lumpSums.length) {
    container.innerHTML = '<p class="muted">No lump sums scheduled.</p>';
    return lumpSums;
  }
  lumpSums.forEach((lump) => {
    const item = document.createElement("article");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-item-top">
        <div><h3>${formatCurrency(lump.amount)}</h3><p class="item-meta">${formatYearMonth(lump.yearMonth)}</p></div>
        <div class="item-actions">
          <button class="button secondary" type="button" data-action="edit">Edit</button>
          <button class="button danger" type="button" data-action="delete">Delete</button>
        </div>
      </div>
      <p class="item-meta">${describeMethod(lump, lookup)}</p>`;
    item.querySelector('[data-action="edit"]').addEventListener("click", () => onEdit(lump));
    item.querySelector('[data-action="delete"]').addEventListener("click", () => onDelete(lump));
    container.append(item);
  });
  return lumpSums;
}

export { deleteLumpSum };

function describeMethod(lump, lookup) {
  if (lump.allocationMethod === "avalanche") return "Avalanche allocation";
  if (lump.allocationMethod === "snowball") return "Snowball allocation";
  return `Specific loan: ${lookup.get(Number(lump.loanId)) || "Missing loan"}`;
}
