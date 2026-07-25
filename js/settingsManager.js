import { getSettings, saveSettings } from "./db.js";
import { getCurrentYearMonth } from "./validation.js";

export async function loadSettingsIntoForm(form) {
  const settings = await getSettings();
  form.elements.simulationStartDate.value = settings.startDate || getCurrentYearMonth();
  form.elements.maxSimulationYears.value = settings.maxSimulationYears;
  form.elements.rolloverEnabled.checked = settings.rolloverEnabled;
  form.elements.rolloverStrategy.value = settings.rolloverStrategy;
  toggleRolloverStrategy(form);
  return settings;
}

export function toggleRolloverStrategy(form) {
  form.elements.rolloverStrategy.disabled = !form.elements.rolloverEnabled.checked;
}

export async function saveSettingsFromForm(form) {
  return saveSettings({
    startDate: form.elements.simulationStartDate.value,
    maxSimulationYears: form.elements.maxSimulationYears.value,
    rolloverEnabled: form.elements.rolloverEnabled.checked,
    rolloverStrategy: form.elements.rolloverStrategy.value
  });
}
