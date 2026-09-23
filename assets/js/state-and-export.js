// PL: Historia zmian i zapis lokalny (cofnij / ponów / localStorage).
// EN: Change history and local persistence (undo / redo / localStorage).
let history = [];
let historyIndex = -1;
let isUndoing = false;

// PL: W wydaniach do 1.2.0 moduły były zapisywane osobno w każdym wariancie
// tygodnia. Łączymy je raz, zachowując wszystkie różne wpisy użytkownika.
// EN: Until 1.2.0 modules were stored in each week variant. Merge them once
// while retaining every distinct user entry.
function legacyAreaModuleKey(entry) {
  const { id, ...content } = entry;
  return JSON.stringify(content);
}
function migrateLegacyAreaModules(weeks) {
  const merged = { enabled: false, entries: [] };
  const seen = new Set();
  const usedIds = new Set();
  for (const state of Object.values(weeks || {})) {
    const legacy = normalizeOmu(state?.omu);
    merged.enabled ||= legacy.enabled;
    for (const original of legacy.entries) {
      const key = legacyAreaModuleKey(original);
      if (seen.has(key)) continue;
      const entry = structuredClone(original);
      if (usedIds.has(entry.id)) entry.id = `${entry.id}-migrated-${merged.entries.length + 1}`;
      seen.add(key);
      usedIds.add(entry.id);
      merged.entries.push(entry);
    }
  }
  return merged;
}
function sharedAreaModules(stored, weeks) {
  return stored?.areaModules
    ? normalizeOmu(stored.areaModules)
    : migrateLegacyAreaModules(weeks);
}

function snapshotState() {
  const clone = tbody.cloneNode(true);
  clearAutoBreaksIn(clone);
  clone
    .querySelectorAll(".today-col,.current-slot,.keyboard-active")
    .forEach((el) => el.classList.remove("today-col", "current-slot", "keyboard-active"));
  clone.querySelectorAll(".cell-controls-wrapper").forEach((el) => el.remove());
  clone.querySelectorAll("[data-orig-fs]").forEach((el) => {
    el.style.fontSize = el.dataset.origFs;
    delete el.dataset.origFs;
  });
  const headClone = document.querySelector("thead").cloneNode(true);
  headClone
    .querySelectorAll(".today-col,.current-slot")
    .forEach((el) => el.classList.remove("today-col", "current-slot"));
  headClone
    .querySelectorAll("[contenteditable]")
    .forEach((el) => el.setAttribute("contenteditable", "true"));
  const copyHeader = (id) => {
    const node = document.getElementById(id).cloneNode(true);
    node
      .querySelectorAll("[contenteditable]")
      .forEach((el) => el.setAttribute("contenteditable", "true"));
    return node.innerHTML;
  };
  return {
    table: clone.innerHTML,
    thead: headClone.innerHTML,
    headerLeftHTML: copyHeader("header-left"),
    headerRightHTML: copyHeader("header-right"),
    headerLeftStyle: document.getElementById("header-left").getAttribute("style"),
    headerRightStyle: document.getElementById("header-right").getAttribute("style"),
    headerWeekHTML: copyHeader("header-week"),
    headerWeekStyle: document.getElementById("header-week").getAttribute("style"),
    omu: structuredClone(omuState),
  };
}

function persistWeeks() {
  localStorage.setItem(
    WEEKS_KEY,
    JSON.stringify({
      version: "1.2",
      selected: currentWeek,
      weekMode,
      parityUsed,
      weeks: weekStates,
      areaModules: structuredClone(omuState),
      settings,
      lastDividedWeek,
    }),
  );
}

function saveState(addToHistory = true) {
  if (isUndoing) return;
  updateAutoBreaks();
  const state = snapshotState();
  const stateStr = JSON.stringify(state);
  weekStates[currentWeek] = state;
  persistWeeks();
  renderOmu();
  scheduleLayout();
  scheduleMobileEntries();
  if (addToHistory) {
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }
    if (history.length > 0 && history[history.length - 1] === stateStr) return;

    history.push(stateStr);
    if (history.length > 50) history.shift();
    historyIndex = history.length - 1;
  }
}

function loadStateStr(stateStr, restoreAreaModules = false) {
  try {
    const state = JSON.parse(stateStr);
    if (restoreAreaModules && state.omu) omuState = normalizeOmu(state.omu);
    if (state.table) tbody.innerHTML = state.table;
    tbody.querySelectorAll(".entry-meta").forEach((element) => {
      element.textContent = capitalizeLessonType(element.textContent);
    });
    tbody
      .querySelectorAll("[contenteditable]")
      .forEach((el) => el.removeAttribute("contenteditable"));
    tbody.querySelectorAll(".split-wrap").forEach((split) => {
      split.classList.add(split.classList.contains("flex-col") ? "vertical" : "horizontal");
      [...split.children].forEach((part) => part.classList.add("cell-part"));
    });
    if (state.thead) document.querySelector("thead").innerHTML = state.thead;
    ensureRemoteHeaders(!state.thead);

    const hl = document.getElementById("header-left");
    const hr = document.getElementById("header-right");

    if (state.headerLeftHTML) hl.innerHTML = state.headerLeftHTML;
    if (state.headerRightHTML) hr.innerHTML = state.headerRightHTML;
    if (state.headerLeftStyle) hl.setAttribute("style", state.headerLeftStyle);
    if (state.headerRightStyle) hr.setAttribute("style", state.headerRightStyle);
    const hw = document.getElementById("header-week");
    if (state.headerWeekHTML) hw.innerHTML = state.headerWeekHTML;
    else
      hw.innerHTML =
        '<div class="drag-handle no-print" title="Przeciągnij"><i class="fas fa-arrows-alt text-[10px]"></i></div><div id="weekLabelText" contenteditable="true"></div>';
    hw.setAttribute("style", state.headerWeekStyle || "left: 43%; top: 48px;");
    if (!state.headerWeekHTML)
      document.getElementById("weekLabelText").textContent = defaultWeekLabel();
  } catch (e) {
    console.error("Błąd parsowania historii", e);
  }
  updateHeaderZoneHeight();
  setupCellControls();
  updateAutoBreaks();
  document.documentElement.style.setProperty("--autofit-scale", "1");
  updateAutofitBadge(1, false);
  savedRange = null;
  savedHost = null;
  activeCell = null;
  activePart = null;
  applyModeToHeaders();
  renderOmu();
  refreshTemporalView();
  scheduleLayout();
  scheduleMobileEntries();
}

function loadState() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(WEEKS_KEY));
  } catch (e) {}
  if (!stored) {
    try {
      stored = JSON.parse(localStorage.getItem(PREVIOUS_WEEKS_KEY));
    } catch (e) {}
  }
  if (!stored) {
    try {
      stored = JSON.parse(localStorage.getItem(V06_WEEKS_KEY));
    } catch (e) {}
  }
  if (!stored) {
    try {
      stored = JSON.parse(localStorage.getItem(OLDER_WEEKS_KEY));
    } catch (e) {}
  }
  if (stored && stored.weeks && stored.weeks.even && stored.weeks.odd) {
    weekStates = stored.weeks;
    lastDividedWeek = stored.lastDividedWeek === "odd" ? "odd" : "even";
    weekMode = typeof stored.weekMode === "boolean" ? stored.weekMode : true;
    parityUsed = typeof stored.parityUsed === "boolean" ? stored.parityUsed : true;
    weekStates.common ||= structuredClone(weekStates.even);
    currentWeek = weekMode ? (stored.selected === "odd" ? "odd" : "even") : "common";
    if (stored.settings) {
      settings = Object.assign({}, DEFAULT_SETTINGS, stored.settings);
      applySettings();
      fillSettingsForm();
    }
    omuState = sharedAreaModules(stored, weekStates);
    loadStateStr(JSON.stringify(weekStates[currentWeek]));
  } else {
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      const legacyState = JSON.parse(legacy);
      omuState = normalizeOmu(legacyState.omu);
      loadStateStr(legacy);
    }
    else {
      initTable();
      ensureRemoteHeaders(true);
    }
    weekStates.common = snapshotState();
    weekStates.even = blankStateFrom(weekStates.common, "even");
    weekStates.odd = blankStateFrom(weekStates.common, "odd");
  }
  updateWeekUI();
  history = [JSON.stringify(snapshotState())];
  historyIndex = 0;
  persistWeeks();
}

function defaultWeekLabel() {
  return currentWeek === "even"
    ? "Tydzień parzysty"
    : currentWeek === "odd"
      ? "Tydzień nieparzysty"
      : "Plan tygodniowy";
}
function ensureRemoteHeaders(newPlan = false) {
  const headers = [...document.querySelectorAll("#scheduleTable thead th")].slice(1);
  headers.forEach((th, index) => {
    const editable = th.querySelectorAll('[contenteditable="true"]')[1];
    if (!th.hasAttribute("data-remote")) {
      const oldLabel = editable?.textContent.trim().toUpperCase() === "ZDALNIE";
      th.dataset.remote = oldLabel ? "1" : "0";
      if (oldLabel && editable) editable.textContent = "";
    }
    if (editable) editable.remove();
    let badge = th.querySelector(".day-remote-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "day-remote-badge";
      badge.textContent = "ZDALNIE";
      th.appendChild(badge);
    }
    badge.classList.toggle("hidden", th.dataset.remote !== "1");
  });
}
function syncRemoteDayCheckboxes() {
  [...document.querySelectorAll("#remoteDays input[data-day]")].forEach((input) => {
    const header =
      document.querySelectorAll("#scheduleTable thead th")[Number(input.dataset.day) + 1];
    input.checked = header?.dataset.remote === "1";
  });
}
function setRemoteDay(index, enabled) {
  const header = document.querySelectorAll("#scheduleTable thead th")[index + 1];
  if (!header) return;
  header.dataset.remote = enabled ? "1" : "0";
  ensureRemoteHeaders();
  saveState(true);
}
function updateWeekUI() {
  document.getElementById("weekModeToggle").checked = weekMode;
  document.getElementById("weekSelectorWrap").classList.toggle("hidden", !weekMode);
  if (weekMode) document.getElementById("weekSelector").value = currentWeek;
  const copyButton = document.getElementById("copyWeeklyButton");
  copyButton.classList.toggle("hidden", !weekMode);
  copyButton.textContent =
    currentWeek === "even"
      ? "Kopiuj do nieparzystego"
      : currentWeek === "odd"
        ? "Kopiuj do parzystego"
        : "Skopiuj plan tygodniowy";
  syncRemoteDayCheckboxes();
}
function setDefaultWeekText(state, text) {
  const template = document.createElement("template");
  template.innerHTML = state.headerWeekHTML || "";
  const label = template.content.querySelector("#weekLabelText");
  if (label) label.textContent = text;
  state.headerWeekHTML = template.innerHTML;
}
function blankStateFrom(base, week) {
  const result = structuredClone(base);
  const template = document.createElement("template");
  template.innerHTML = base.table;
  template.content.querySelectorAll("td[data-col]").forEach((cell) => {
    const row = cell.dataset.row,
      col = cell.dataset.col;
    for (const attr of [...cell.attributes]) cell.removeAttribute(attr.name);
    cell.dataset.row = row;
    cell.dataset.col = col;
    cell.innerHTML = '<div class="cell-content w-full h-full outline-none safe-wrap"><br></div>';
  });
  result.table = template.innerHTML;
  result.omu = { enabled: false, entries: [] };
  setDefaultWeekText(
    result,
    week === "even"
      ? "Tydzień parzysty"
      : week === "odd"
        ? "Tydzień nieparzysty"
        : "Plan tygodniowy",
  );
  return result;
}
function toggleWeekMode(enabled) {
  if (enabled === weekMode) return;
  clearTimeout(typingTimer);
  saveState(true);
  const firstUse = enabled && !parityUsed;
  if (firstUse) {
    weekStates.even = blankStateFrom(weekStates.common, "even");
    weekStates.odd = blankStateFrom(weekStates.common, "odd");
    parityUsed = true;
  }
  if (!enabled) lastDividedWeek = currentWeek;
  weekMode = enabled;
  currentWeek = enabled ? lastDividedWeek : "common";
  loadStateStr(JSON.stringify(weekStates[currentWeek]));
  updateWeekUI();
  history = [JSON.stringify(snapshotState())];
  historyIndex = 0;
  persistWeeks();
  if (firstUse && stateHasLessons(weekStates.common)) openBankCopy("common");
  else if (enabled) announce("Otwarty osobny zapis tygodni parzystych i nieparzystych.");
}
function openBankCopy(source = currentWeek) {
  if (!weekMode) return;
  const target = document.getElementById("bankCopyTarget");
  const modal = document.getElementById("bankCopyModal");
  const title = document.getElementById("bankCopyTitle");
  const description = document.getElementById("bankCopyDescription");
  modal.dataset.source = source;
  if (source === "common") {
    title.textContent = "Skopiuj plan tygodniowy";
    description.textContent =
      "Plan tygodniowy i plan z podziałem mają oddzielne zapisy. Wybierz, gdzie skopiować zajęcia. Oryginał pozostanie w planie tygodniowym.";
    target.replaceChildren(
      new Option("Obu tygodni", "both"),
      new Option("Tygodnia parzystego", "even"),
      new Option("Tygodnia nieparzystego", "odd"),
    );
  } else {
    const sourceLabel = source === "even" ? "parzystego" : "nieparzystego";
    const targetWeek = source === "even" ? "odd" : "even";
    const targetLabel = targetWeek === "even" ? "parzystego" : "nieparzystego";
    title.textContent = "Skopiuj tydzień " + sourceLabel;
    description.textContent =
      "Skopiuj zajęcia z tygodnia " +
      sourceLabel +
      " do tygodnia " +
      targetLabel +
      ". Później możesz zmienić tylko różniące się wpisy.";
    target.replaceChildren(new Option("Tygodnia " + targetLabel, targetWeek));
  }
  modal.classList.replace("hidden", "flex");
}
function closeBankCopy() {
  const modal = document.getElementById("bankCopyModal");
  delete modal.dataset.source;
  modal.classList.replace("flex", "hidden");
}
async function copyWeeklyBank() {
  const modal = document.getElementById("bankCopyModal");
  const source = modal.dataset.source || currentWeek;
  const value = document.getElementById("bankCopyTarget").value;
  const targets = source === "common" && value === "both" ? ["even", "odd"] : [value];
  if (targets.some((key) => stateHasLessons(weekStates[key]))) {
    if (
      !(await showModal(
        "Zastąpić zajęcia w wybranych tygodniach kopią? Plan źródłowy pozostanie zapisany.",
      ))
    )
      return;
  }
  for (const key of targets) {
    weekStates[key] = structuredClone(weekStates[source]);
    setDefaultWeekText(
      weekStates[key],
      key === "even" ? "Tydzień parzysty" : "Tydzień nieparzysty",
    );
  }
  closeBankCopy();
  loadStateStr(JSON.stringify(weekStates[currentWeek]));
  updateWeekUI();
  history = [JSON.stringify(snapshotState())];
  historyIndex = 0;
  persistWeeks();
  announce("Skopiowano plan. Dalsze zmiany dotyczą tylko wybranego tygodnia.");
}

function switchWeek(next) {
  if (!weekMode || (next !== "even" && next !== "odd") || next === currentWeek) return;
  clearTimeout(typingTimer);
  saveState(true);
  currentWeek = next;
  lastDividedWeek = next;
  loadStateStr(JSON.stringify(weekStates[next]));
  updateWeekUI();
  history = [JSON.stringify(snapshotState())];
  historyIndex = 0;
  persistWeeks();
}

function undo() {
  if (mode === "view") return;
  if (historyIndex > 0) {
    isUndoing = true;
    historyIndex--;
    loadStateStr(history[historyIndex], true);
    weekStates[currentWeek] = JSON.parse(history[historyIndex]);
    persistWeeks();
    setTimeout(() => (isUndoing = false), 50);
  }
}

function redo() {
  if (mode === "view") return;
  if (historyIndex < history.length - 1) {
    isUndoing = true;
    historyIndex++;
    loadStateStr(history[historyIndex], true);
    weekStates[currentWeek] = JSON.parse(history[historyIndex]);
    persistWeeks();
    setTimeout(() => (isUndoing = false), 50);
  }
}

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    for (const [id, close] of [
      ["backupModal", closeBackupExport],
      ["bankCopyModal", closeBankCopy],
      ["omuModal", closeOmu],
      ["helpModal", closeHelp],
      ["entryModal", closeEntryModal],
      ["manualModal", closeManualModal],
      ["resetModal", closeReset],
      ["welcomeModal", skipWelcome],
    ]) {
      if (!document.getElementById(id).classList.contains("hidden")) {
        e.preventDefault();
        close();
        return;
      }
    }
    closeAllCellMenus();
    closeSettings(false);
    document.getElementById("optionsDropdown").classList.add("hidden");
    document.querySelector(".export-button").setAttribute("aria-expanded", "false");
    return;
  }
  if (e.key === "F1") {
    e.preventDefault();
    openHelp();
    return;
  }
  if (
    e.ctrlKey &&
    e.key === "Enter" &&
    !document.getElementById("omuModal").classList.contains("hidden")
  ) {
    e.preventDefault();
    saveOmuEntry();
    return;
  }
  if (
    e.ctrlKey &&
    e.key === "Enter" &&
    !document.getElementById("entryModal").classList.contains("hidden")
  ) {
    e.preventDefault();
    submitEntryModal();
    return;
  }
  const inDialog = [
    "entryModal",
    "manualModal",
    "welcomeModal",
    "resetModal",
    "helpModal",
    "customModal",
    "backupModal",
    "bankCopyModal",
    "omuModal",
  ].some((id) => !document.getElementById(id).classList.contains("hidden"));
  if (inDialog) return;
  if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "a" && mode === "edit") {
    e.preventDefault();
    openQuickEntry();
    return;
  }
  if (e.ctrlKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    openBackupExport();
    return;
  }
  if (e.ctrlKey && e.key.toLowerCase() === "p") {
    e.preventDefault();
    exportToPDF();
    return;
  }
  const typing = e.target.closest("input, textarea, select") || e.target.isContentEditable;
  if (typing || mode === "view") return;
  if (e.ctrlKey && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
    e.preventDefault();
    (e.key.toLowerCase() === "y" || e.shiftKey ? redo : undo)();
    return;
  }
  if (e.ctrlKey && weekMode && (e.key === "PageUp" || e.key === "PageDown")) {
    e.preventDefault();
    switchWeek(e.key === "PageUp" ? "even" : "odd");
    return;
  }
  const cell = e.target.closest("#scheduleBody td[data-col]");
  if (!cell) return;
  activeCell = cell;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
    const dr = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    const dc = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    let row = Number(cell.dataset.row) + dr,
      col = Number(cell.dataset.col) + dc;
    while (row >= 0 && row < times.length && col >= 0 && col < days) {
      const next = getCell(row, col);
      if (next && next.style.display !== "none") {
        next.focus();
        activeCell = next;
        break;
      }
      row += dr;
      col += dc;
    }
  } else if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    openEntryModal(null, resolveEntryTarget(cell, activePart));
  } else if (e.key === "F2") {
    e.preventDefault();
    openManualModal(cell.querySelector(".cell-hamburger"));
  } else if ((e.key === "Delete" || e.key === "Backspace") && !e.ctrlKey) {
    e.preventDefault();
    clearCellFormatting(cell.querySelector(".cell-hamburger"));
  } else if (e.key === "F10" && e.shiftKey) {
    e.preventDefault();
    toggleCellMenu(cell.querySelector(".cell-hamburger"));
  }
});

let typingTimer;
document.getElementById("a4-sheet").addEventListener("input", () => {
  saveState(false);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    saveState(true);
  }, 500);
});

// PL: Kopia może zawierać jeden wariant albo wszystkie zapisane plany.
// EN: A backup can contain one variant or every saved schedule.
function downloadJSON(content, scope = "plan") {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(content, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "plan_zajec_" + scope + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
function openBackupExport() {
  saveState(false);
  const currentLabel =
    currentWeek === "even"
      ? "tydzień parzysty"
      : currentWeek === "odd"
        ? "tydzień nieparzysty"
        : "plan tygodniowy";
  document.querySelector('#backupScope option[value="current"]').textContent =
    "Aktualnie otwarty — " + currentLabel;
  document.getElementById("backupScope").value = "current";
  document.getElementById("backupIncludeSettings").checked = true;
  document.getElementById("optionsDropdown").classList.add("hidden");
  document.querySelector(".export-button").setAttribute("aria-expanded", "false");
  document.getElementById("backupModal").classList.replace("hidden", "flex");
  document.getElementById("backupScope").focus();
}
function closeBackupExport() {
  document.getElementById("backupModal").classList.replace("flex", "hidden");
}
function exportJSON() {
  saveState(false);
  const requested = document.getElementById("backupScope").value;
  const scope = requested === "current" ? currentWeek : requested;
  const includeSettings = document.getElementById("backupIncludeSettings").checked;
  const content =
    scope === "all"
      ? {
          version: APP_VERSION,
          exportScope: "all",
          selected: currentWeek,
          weekMode,
          parityUsed,
          weeks: structuredClone(weekStates),
          areaModules: structuredClone(omuState),
          lastDividedWeek,
        }
      : {
          version: APP_VERSION,
          exportScope: scope,
          state: structuredClone(weekStates[scope]),
          areaModules: structuredClone(omuState),
        };
  if (includeSettings) {
    content.settings = structuredClone(settings);
    content.profile = readProfile();
  }
  downloadJSON(content, scope === "all" ? "wszystkie" : scope);
  closeBackupExport();
}
function validateState(state) {
  if (
    !state ||
    typeof state.table !== "string" ||
    typeof state.thead !== "string" ||
    state.table.length > 1000000
  )
    throw new Error("Nieprawidłowy plan");
  const template = document.createElement("template");
  template.innerHTML = state.table;
  if (template.content.querySelectorAll("tr").length !== times.length)
    throw new Error("Nieprawidłowa liczba wierszy");
  const clean = { ...state, omu: normalizeOmu(state.omu) };
  if (Array.isArray(state.omu?.entries) && clean.omu.entries.length !== state.omu.entries.length)
    throw new Error("Nieprawidłowe dane modułów obszarowych");
  for (const key of ["table", "thead", "headerLeftHTML", "headerRightHTML", "headerWeekHTML"]) {
    if (typeof clean[key] === "string") clean[key] = sanitizeMarkup(clean[key]);
  }
  return clean;
}
function sanitizeMarkup(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content
    .querySelectorAll(
      "script,iframe,object,embed,svg,math,link,meta,img,form,input,button,style,template",
    )
    .forEach((el) => el.remove());
  template.content.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (
        /^on/i.test(attr.name) ||
        /^(href|src|srcset|formaction)$/i.test(attr.name) ||
        (attr.name === "style" && /url\s*\(/i.test(attr.value))
      )
        el.removeAttribute(attr.name);
    }
  });
  return template.innerHTML;
}
function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      let weeks, importedWeekMode, importedCurrentWeek, importedParityUsed;
      if (data.weeks) {
        weeks = {
          even: validateState(data.weeks.even),
          odd: validateState(data.weeks.odd),
          common: data.weeks.common
            ? validateState(data.weeks.common)
            : validateState(structuredClone(data.weeks.even)),
        };
        importedWeekMode = typeof data.weekMode === "boolean" ? data.weekMode : true;
        importedCurrentWeek = importedWeekMode
          ? data.selected === "odd"
            ? "odd"
            : "even"
          : "common";
        importedParityUsed = typeof data.parityUsed === "boolean" ? data.parityUsed : true;
      } else if (data.state && ["common", "even", "odd"].includes(data.exportScope)) {
        const scope = data.exportScope,
          state = validateState(data.state);
        weeks = {
          common: blankStateFrom(state, "common"),
          even: blankStateFrom(state, "even"),
          odd: blankStateFrom(state, "odd"),
        };
        weeks[scope] = state;
        importedWeekMode = scope !== "common";
        importedCurrentWeek = scope;
        importedParityUsed = scope !== "common";
      } else {
        const state = validateState(data);
        weeks = {
          common: state,
          even: validateState(structuredClone(state)),
          odd: validateState(structuredClone(state)),
        };
        importedWeekMode = false;
        importedCurrentWeek = "common";
        importedParityUsed = false;
      }
      weekStates = weeks;
      omuState = sharedAreaModules(data, weeks);
      weekMode = importedWeekMode;
      parityUsed = importedParityUsed;
      currentWeek = importedCurrentWeek;
      lastDividedWeek =
        data.lastDividedWeek === "odd" || (!data.lastDividedWeek && currentWeek === "odd")
          ? "odd"
          : "even";
      if (data.settings) settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
      if (data.profile && typeof data.profile === "object" && !Array.isArray(data.profile)) {
        const safe = {};
        for (const key of [
          "course",
          "year",
          "degree",
          "attendance",
          "semester",
          "semesterNumber",
          "academicYear",
        ])
          if (typeof data.profile[key] === "string") safe[key] = data.profile[key].slice(0, 200);
        localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...safe, done: true }));
      }
      applySettings();
      fillSettingsForm();
      loadStateStr(JSON.stringify(weekStates[currentWeek]));
      updateWeekUI();
      history = [JSON.stringify(snapshotState())];
      historyIndex = 0;
      persistWeeks();
      document.getElementById("welcomeModal").classList.replace("flex", "hidden");
      if (!readProfile()?.done) localStorage.setItem(PROFILE_KEY, JSON.stringify({ done: true }));
      setMode(settings.defaultMode === "edit" ? "edit" : hasPlanData() ? "view" : "edit");
      announce("Plan zaimportowany.");
    } catch (err) {
      showModal("Nieprawidłowy plik planu.", true);
    }
  };
  reader.readAsText(file);
  event.target.value = "";
  document.getElementById("optionsDropdown").classList.add("hidden");
}
function exportToPDF() {
  if (usesMobileLayout() && !document.body.classList.contains("mobile-previewing")) {
    openMobileDocumentPreview();
    return;
  }
  saveState(false);
  compactColumns();
  updateHeaderZoneHeight();
  autoFitToPage();
  document.getElementById("optionsDropdown").classList.add("hidden");
  closeAllCellMenus();
  if (sheetOverflows()) {
    showModal(
      "Plan zawiera zbyt dużo treści, aby zmieścić ją czytelnie na jednej kartce A4. Skróć wpisy lub zmniejsz wysokość wierszy w ustawieniach.",
      true,
    );
    return;
  }
  // PL: Natywny wydruk zachowuje HTML oraz wektorowy tekst i linie dokumentu.
  // EN: Native printing preserves the document HTML, vector text, and lines.
  window.print();
}
