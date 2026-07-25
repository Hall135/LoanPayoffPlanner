import { exportDatabase, importDatabase } from "./db.js";
import { populatePaymentDaySelect, saveLoanFromForm, resetLoanForm, populateLoanForm, renderLoanList, deleteLoan, getAllLoans } from "./loanManager.js";
import { saveLumpSumFromForm, resetLumpSumForm, toggleTargetLoan, populateLoanOptions, populateLumpSumForm, renderLumpSumList, deleteLumpSum } from "./lumpSumManager.js";
import { loadSettingsIntoForm, saveSettingsFromForm, toggleRolloverStrategy } from "./settingsManager.js";
import { exportDatabaseJson } from "./exportManager.js";

if (document.body.dataset.page === "manage") initManagementPage();
registerServiceWorker();

async function initManagementPage() {
  const loanForm = document.querySelector("#loanForm");
  const lumpForm = document.querySelector("#lumpForm");
  const settingsForm = document.querySelector("#settingsForm");
  const statusRegion = document.querySelector("#statusRegion");
  const loanList = document.querySelector("#loanList");
  const lumpList = document.querySelector("#lumpList");
  const loanFormTitle = document.querySelector("#loanFormTitle");
  const lumpFormTitle = document.querySelector("#lumpFormTitle");
  const cancelLoanEdit = document.querySelector("#cancelLoanEdit");
  const cancelLumpEdit = document.querySelector("#cancelLumpEdit");

  populatePaymentDaySelect(loanForm.elements.loanPaymentDay);
  resetLoanForm(loanForm);
  resetLumpSumForm(lumpForm);
  await loadSettingsIntoForm(settingsForm);
  await refreshLists();

  loanForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveLoanFromForm(loanForm);
      showStatus(statusRegion, "Loan saved.", "success");
      resetLoanEdit();
      await refreshLists();
    } catch (error) { showStatus(statusRegion, error.message, "error"); }
  });

  lumpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveLumpSumFromForm(lumpForm);
      showStatus(statusRegion, "Lump sum saved.", "success");
      resetLumpEdit();
      await refreshLists();
    } catch (error) { showStatus(statusRegion, error.message, "error"); }
  });

  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveSettingsFromForm(settingsForm);
      showStatus(statusRegion, "Simulation settings saved.", "success");
    } catch (error) { showStatus(statusRegion, error.message, "error"); }
  });

  lumpForm.elements.lumpAllocationMethod.addEventListener("change", () => toggleTargetLoan(lumpForm));
  settingsForm.elements.rolloverEnabled.addEventListener("change", () => toggleRolloverStrategy(settingsForm));
  cancelLoanEdit.addEventListener("click", resetLoanEdit);
  cancelLumpEdit.addEventListener("click", resetLumpEdit);

  document.querySelector("#exportJson").addEventListener("click", async () => {
    try { exportDatabaseJson(await exportDatabase()); showStatus(statusRegion, "JSON backup downloaded.", "success"); }
    catch (error) { showStatus(statusRegion, error.message, "error"); }
  });

  document.querySelector("#importJson").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importDatabase(JSON.parse(text));
      showStatus(statusRegion, "Import complete. Existing saved data was replaced.", "success");
      resetLoanEdit();
      resetLumpEdit();
      await loadSettingsIntoForm(settingsForm);
      await refreshLists();
    } catch (error) { showStatus(statusRegion, `Import failed: ${error.message}`, "error"); }
    finally { event.target.value = ""; }
  });

  async function refreshLists() {
    const loans = await getAllLoans();
    populateLoanOptions(lumpForm.elements.lumpLoanId, loans, lumpForm.elements.lumpLoanId.value);
    toggleTargetLoan(lumpForm);
    await renderLoanList(loanList, {
      onEdit: async (id) => {
        try {
          await populateLoanForm(loanForm, id);
          loanFormTitle.textContent = "Edit loan";
          cancelLoanEdit.hidden = false;
          loanForm.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (error) { showStatus(statusRegion, error.message, "error"); }
      },
      onDelete: async (loan) => {
        if (!window.confirm(`Delete ${loan.name}? Any lump sums specifically assigned to it will also be deleted.`)) return;
        try { await deleteLoan(loan.id); showStatus(statusRegion, "Loan deleted.", "success"); resetLoanEdit(); await refreshLists(); }
        catch (error) { showStatus(statusRegion, error.message, "error"); }
      }
    });
    await renderLumpSumList(lumpList, loans, {
      onEdit: (lump) => {
        populateLumpSumForm(lumpForm, lump);
        lumpFormTitle.textContent = "Edit lump sum";
        cancelLumpEdit.hidden = false;
        lumpForm.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      onDelete: async (lump) => {
        if (!window.confirm(`Delete the ${lump.amount} lump sum scheduled for ${lump.yearMonth}?`)) return;
        try { await deleteLumpSum(lump.id); showStatus(statusRegion, "Lump sum deleted.", "success"); resetLumpEdit(); await refreshLists(); }
        catch (error) { showStatus(statusRegion, error.message, "error"); }
      }
    });
  }

  function resetLoanEdit() {
    resetLoanForm(loanForm);
    loanFormTitle.textContent = "Add loan";
    cancelLoanEdit.hidden = true;
  }
  function resetLumpEdit() {
    resetLumpSumForm(lumpForm);
    lumpFormTitle.textContent = "Add lump sum";
    cancelLumpEdit.hidden = true;
  }
}

function showStatus(container, message, type) {
  container.innerHTML = `<div class="status ${type}">${escapeHtml(message)}</div>`;
  window.setTimeout(() => { container.innerHTML = ""; }, 6500);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch((error) => console.warn("Service worker registration failed", error)));
}
