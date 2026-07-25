import { getAllLoans, getAllLumpSums, getSettings } from "./db.js";
import { runSimulation } from "./simulationEngine.js";
import { formatCurrency, formatYearMonth } from "./validation.js";
import { downloadText, exportCanvasPng, loanCsv, portfolioCsv, safeFilename } from "./exportManager.js";

const chartInstances = new Map();

initAnalysisPage();
registerServiceWorker();

async function initAnalysisPage() {
  const status = document.querySelector("#analysisStatus");
  const empty = document.querySelector("#analysisEmpty");
  const content = document.querySelector("#analysisContent");
  try {
    await waitForChart();
    const [loans, lumpSums, settings] = await Promise.all([getAllLoans(), getAllLumpSums(), getSettings()]);
    if (!loans.length) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }

    const result = runSimulation({ loans, lumpSums, settings });
    empty.hidden = true;
    content.hidden = false;
    renderWarnings(result.warnings);
    renderMetrics(loans, result);
    renderSummaryTable(loans, result);
    renderCombinedChart(result);
    renderLoanSections(loans, result);
    bindExports(loans, result);
  } catch (error) {
    status.innerHTML = `<div class="status error">Unable to build the analysis: ${escapeHtml(error.message)}</div>`;
  }
}

function renderWarnings(warnings) {
  const container = document.querySelector("#warningList");
  container.innerHTML = "";
  if (!warnings.length) return;
  warnings.forEach((warning) => {
    const item = document.createElement("div");
    item.className = "warning";
    item.textContent = `⚠ ${warning.message}`;
    container.append(item);
  });
}

function renderMetrics(loans, result) {
  const currentDebt = loans.reduce((sum, loan) => sum + Number(loan.principal) + Number(loan.accruedInterest), 0);
  const metrics = [
    ["Loans", String(loans.length)],
    ["Current debt", formatCurrency(currentDebt)],
    ["Projected payoff", result.summary.projectedPayoffDate ? formatYearMonth(result.summary.projectedPayoffDate) : "Not within limit"],
    ["Months simulated", String(result.summary.monthsSimulated)],
    ["Interest paid", formatCurrency(result.summary.totalInterestPaid)]
  ];
  const container = document.querySelector("#metricGrid");
  container.innerHTML = metrics.map(([label, value]) => `<article class="metric"><div class="metric-label">${label}</div><div class="metric-value">${value}</div></article>`).join("");
}

function renderSummaryTable(loans, result) {
  const original = new Map(loans.map((loan) => [loan.id, loan]));
  const warningsByLoan = new Map();
  result.warnings.filter((warning) => warning.loanId).forEach((warning) => {
    const list = warningsByLoan.get(warning.loanId) || [];
    list.push(warning);
    warningsByLoan.set(warning.loanId, list);
  });
  const body = document.querySelector("#summaryTableBody");
  body.innerHTML = result.loanResults.map((loan) => {
    const source = original.get(loan.id);
    const currentBalance = Number(source.principal) + Number(source.accruedInterest);
    const status = loan.isPaidOff ? "Paid off" : loan.remainingBalance > 0 ? "Not paid off" : "—";
    const warning = warningsByLoan.has(loan.id) ? " ⚠" : "";
    return `<tr>
      <td>${escapeHtml(loan.name)}${warning}</td>
      <td>${formatCurrency(currentBalance)}</td>
      <td>${loan.payoffDate ? formatYearMonth(loan.payoffDate) : "—"}</td>
      <td>${loan.payoffMonth ?? "—"}</td>
      <td>${formatCurrency(loan.totalInterestPaid)}</td>
      <td>${status}</td>
    </tr>`;
  }).join("");
}

function renderCombinedChart(result) {
  const canvas = document.querySelector("#combinedChart");
  destroyChart("combined");
  chartInstances.set("combined", new Chart(canvas, {
    type: "line",
    data: {
      labels: result.snapshots.map((snapshot) => formatYearMonth(snapshot.yearMonth)),
      datasets: [{ label: "Combined remaining debt", data: result.snapshots.map((snapshot) => snapshot.totalDebt), borderColor: "#f1f1f1", backgroundColor: "rgba(241,241,241,.12)", borderWidth: 2, tension: .2, fill: true, pointRadius: 2 }]
    },
    options: chartOptions("Combined remaining debt")
  }));
}

function renderLoanSections(loans, result) {
  const original = new Map(loans.map((loan) => [loan.id, loan]));
  const warningsByLoan = new Map();
  result.warnings.filter((warning) => warning.loanId).forEach((warning) => {
    const list = warningsByLoan.get(warning.loanId) || [];
    list.push(warning);
    warningsByLoan.set(warning.loanId, list);
  });
  const container = document.querySelector("#loanCharts");
  container.innerHTML = "";

  result.loanResults.forEach((loanResult, index) => {
    const source = original.get(loanResult.id);
    const detail = document.createElement("details");
    detail.className = "loan-chart";
    detail.open = index === 0;
    detail.innerHTML = `
      <summary>
        <span><strong>${escapeHtml(loanResult.name)}</strong><span class="muted"> · ${loanResult.payoffDate ? `Payoff ${formatYearMonth(loanResult.payoffDate)}` : "Not paid off within limit"}</span></span>
        <span>${formatCurrency(loanResult.remainingBalance)} remaining</span>
      </summary>
      <div class="loan-chart-body">
        <div class="loan-stat-grid">
          <div class="loan-stat"><span>Current balance</span><strong>${formatCurrency(Number(source.principal) + Number(source.accruedInterest))}</strong></div>
          <div class="loan-stat"><span>Payoff date</span><strong>${loanResult.payoffDate ? formatYearMonth(loanResult.payoffDate) : "—"}</strong></div>
          <div class="loan-stat"><span>Interest paid</span><strong>${formatCurrency(loanResult.totalInterestPaid)}</strong></div>
          <div class="loan-stat"><span>Remaining balance</span><strong>${formatCurrency(loanResult.remainingBalance)}</strong></div>
        </div>
        <div class="loan-warning" data-warning-for="${loanResult.id}"></div>
        <div class="button-row compact-row">
          <button class="button secondary" data-csv-loan="${loanResult.id}" type="button">Export CSV</button>
          <button class="button secondary" data-png-loan="${loanResult.id}" type="button">Export PNG</button>
        </div>
        <div class="chart-wrap"><canvas id="loanChart-${loanResult.id}"></canvas></div>
      </div>`;
    container.append(detail);

    const loanWarnings = warningsByLoan.get(loanResult.id) || [];
    const warningElement = detail.querySelector(`[data-warning-for="${loanResult.id}"]`);
    warningElement.textContent = loanWarnings.map((warning) => `⚠ ${warning.message}`).join(" ");

    const snapshots = result.snapshots.map((snapshot) => snapshot.loans.find((entry) => entry.id === loanResult.id));
    const canvas = detail.querySelector(`#loanChart-${loanResult.id}`);
    destroyChart(`loan-${loanResult.id}`);
    chartInstances.set(`loan-${loanResult.id}`, new Chart(canvas, {
      type: "line",
      data: {
        labels: result.snapshots.map((snapshot) => formatYearMonth(snapshot.yearMonth)),
        datasets: [{ label: `${loanResult.name} remaining balance`, data: snapshots.map((snapshot) => snapshot?.totalBalance ?? 0), borderColor: "#f1f1f1", backgroundColor: "rgba(241,241,241,.12)", borderWidth: 2, tension: .2, fill: true, pointRadius: 2 }]
      },
      options: chartOptions(`${loanResult.name} remaining balance`)
    }));
  });
}

function bindExports(loans, result) {
  document.querySelector("#exportCombinedCsv").onclick = () => downloadText("combined_loan_projection.csv", portfolioCsv(result), "text/csv;charset=utf-8");
  document.querySelector("#exportCombinedPng").onclick = () => exportCanvasPng(document.querySelector("#combinedChart"), "combined_loan_projection.png");
  document.querySelector("#exportAllCsv").onclick = () => {
    downloadText("combined_loan_projection.csv", portfolioCsv(result), "text/csv;charset=utf-8");
    window.setTimeout(() => loans.forEach((loan, index) => window.setTimeout(() => {
      downloadText(`${safeFilename(loan.name)}_projection.csv`, loanCsv(result, loan.id), "text/csv;charset=utf-8");
    }, index * 220)), 250);
  };
  document.querySelectorAll("[data-csv-loan]").forEach((button) => {
    button.onclick = () => {
      const id = Number(button.dataset.csvLoan);
      const loan = loans.find((item) => item.id === id);
      downloadText(`${safeFilename(loan.name)}_projection.csv`, loanCsv(result, id), "text/csv;charset=utf-8");
    };
  });
  document.querySelectorAll("[data-png-loan]").forEach((button) => {
    button.onclick = () => {
      const id = Number(button.dataset.pngLoan);
      const loan = loans.find((item) => item.id === id);
      exportCanvasPng(document.querySelector(`#loanChart-${id}`), `${safeFilename(loan.name)}_projection.png`);
    };
  });
}

function chartOptions(title) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: "#f3f3f3" } }, title: { display: true, text: title, color: "#f3f3f3" } },
    scales: {
      x: { ticks: { color: "#b8b8b8", maxRotation: 45, minRotation: 45 }, grid: { color: "rgba(255,255,255,.10)" } },
      y: { ticks: { color: "#b8b8b8", callback: (value) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) }, grid: { color: "rgba(255,255,255,.10)" } }
    }
  };
}

function destroyChart(key) {
  chartInstances.get(key)?.destroy();
  chartInstances.delete(key);
}

async function waitForChart() {
  for (let attempts = 0; attempts < 50; attempts += 1) {
    if (window.Chart) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Chart.js did not load. Connect to the internet once so the PWA can cache the chart library.");
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
