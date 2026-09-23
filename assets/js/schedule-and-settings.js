/* PL: Ustawienia planu. EN: Schedule settings. */

const SETTINGS_KEY = "planZajecUstawieniaV1";
const DEFAULT_SETTINGS = {
  font: "'Roboto', sans-serif",
  fontSize: 11,
  rowH: 40,
  lineColor: "#000000",
  thickW: 3,
  headBg: "#e5e7eb",
  defaultMode: "auto",
  parityDate: "",
  parityKind: "even",
  autoFit: true,
  compactDays: true,
  moveHeaders: false,
  smartEntrySuggestions: true,
  showOmuAlwaysInView: false,
  tabletLayout: "mobile",
};
let settings = Object.assign({}, DEFAULT_SETTINGS);

function applySettings() {
  const r = document.documentElement.style;
  r.setProperty("--font-main", settings.font);
  r.setProperty("--base-font", settings.fontSize + "pt");
  r.setProperty("--row-h", settings.rowH + "px");
  r.setProperty("--line-color", settings.lineColor);
  r.setProperty("--thick-w", settings.thickW + "px");
  r.setProperty("--head-bg", settings.headBg);
  document.body.classList.toggle("headers-fixed", !settings.moveHeaders);
  if (!settings.autoFit) {
    applyAutofitScale(1);
    updateAutofitBadge(1, false);
  }
  scheduleLayout();
}

function fillSettingsForm() {
  document.getElementById("setFont").value = settings.font;
  document.getElementById("setFontSize").value = settings.fontSize;
  document.getElementById("setRowH").value = settings.rowH;
  document.getElementById("setLineColor").value = settings.lineColor;
  document.getElementById("setHeadBg").value = settings.headBg;
  document.getElementById("setThickW").value = settings.thickW;
  document.getElementById("setMoveHeaders").checked = !!settings.moveHeaders;
  document.getElementById("setCompactDays").checked = !!settings.compactDays;
  document.getElementById("setSmartEntrySuggestions").checked =
    !!settings.smartEntrySuggestions;
  applyEntrySuggestionPreference();
  document.getElementById("setAutoFit").checked = !!settings.autoFit;
  document.getElementById("autoFitToggle").checked = !!settings.autoFit;
  document.getElementById("setOmuEnabled").checked = omuState.enabled;
  document.getElementById("setShowOmuAlways").checked = !!settings.showOmuAlwaysInView;
  document.getElementById("quickShowOmuInput").checked = !!settings.showOmuAlwaysInView;
  document.getElementById("setDefaultMode").value =
    settings.defaultMode === "edit" ? "edit" : "auto";
  document.getElementById("setTabletLayout").value =
    settings.tabletLayout === "desktop" ? "desktop" : "mobile";
  document.getElementById("setParityDate").value = settings.parityDate || "";
  document.getElementById("setParityKind").value = settings.parityKind === "odd" ? "odd" : "even";
}

function updateSetting(key, value) {
  if (["fontSize", "rowH", "thickW"].indexOf(key) !== -1) {
    value = parseFloat(value);
    if (isNaN(value)) return;
  }
  if (key === "fontSize") value = Math.max(6, Math.min(24, value));
  if (key === "rowH") value = Math.max(20, Math.min(120, value));
  if (key === "thickW") value = Math.max(1, Math.min(8, value));
  settings[key] = value;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings();
  fillSettingsForm();
  saveState(false);
  if (key === "showOmuAlwaysInView") renderOmu();
  if (key === "smartEntrySuggestions") applyEntrySuggestionPreference();
  if (key === "tabletLayout") syncResponsiveClass();
  if (
    key === "defaultMode" ||
    key === "parityDate" ||
    key === "parityKind" ||
    key === "showOmuAlwaysInView"
  )
    refreshTemporalView();
}

function resetSettings() {
  settings = Object.assign({}, DEFAULT_SETTINGS);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings();
  fillSettingsForm();
  syncResponsiveClass();
  saveState(false);
}

function toggleSettings() {
  const panel = document.getElementById("settingsPanel");
  const hidden = panel.classList.contains("hidden");
  if (!hidden) return closeSettings();
  panel.classList.remove("hidden");
  document.querySelector("#settingsAnchor > button").setAttribute("aria-expanded", "true");
  fillSettingsForm();
  if (document.documentElement.classList.contains("mobile-layout")) {
    document.getElementById("settingsBackdrop").classList.remove("hidden");
    requestAnimationFrame(() => panel.querySelector(".settings-close").focus());
  }
}

function closeSettings(restoreFocus = true) {
  document.getElementById("settingsPanel").classList.add("hidden");
  document.getElementById("settingsBackdrop").classList.add("hidden");
  const trigger = document.querySelector("#settingsAnchor > button");
  trigger.setAttribute("aria-expanded", "false");
  if (restoreFocus) trigger.focus();
}

function initSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved) settings = Object.assign({}, DEFAULT_SETTINGS, saved);
  } catch (e) {
    /* PL: W razie błędu zostają wartości domyślne. EN: Keep defaults on error. */
  }
  applySettings();
  fillSettingsForm();
}

function updateParityReference() {
  settings.parityDate = document.getElementById("setParityDate").value;
  settings.parityKind = document.getElementById("setParityKind").value;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  persistWeeks();
  refreshTemporalView();
}
function weekNumberSince(reference, now) {
  const [year, month, day] = reference.split("-").map(Number);
  if (
    !year ||
    !month ||
    !day ||
    new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== reference
  )
    return null;
  const anchor = Date.UTC(year, month - 1, day);
  const current = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const monday = (utc) => utc - ((new Date(utc).getUTCDay() + 6) % 7) * 86400000;
  return Math.round((monday(current) - monday(anchor)) / 604800000);
}
function parityForDate(now) {
  const hasReference =
    typeof settings.parityDate === "string" &&
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(settings.parityDate) &&
    ["even", "odd"].includes(settings.parityKind);
  if (hasReference) {
    const offset = weekNumberSince(settings.parityDate, now);
    if (offset !== null)
      return Math.abs(offset) % 2 === 0
        ? settings.parityKind
        : settings.parityKind === "even"
          ? "odd"
          : "even";
  }
  // PL: Domyślnie używamy parzystości tygodnia ISO (poniedziałek–niedziela).
  // Data odniesienia ma pierwszeństwo, gdy uczelnia liczy tygodnie inaczej.
  // EN: Use ISO week parity by default (Monday–Sunday). A configured reference
  // date takes precedence when the university counts weeks differently.
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const isoDay = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - isoDay);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return isoWeek % 2 === 0 ? "even" : "odd";
}
function parityUsesReference() {
  return (
    typeof settings.parityDate === "string" &&
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(settings.parityDate) &&
    ["even", "odd"].includes(settings.parityKind)
  );
}
let browsedDate = null;
function dateFromInput(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(year, month - 1, day, 12);
  return result.getFullYear() === year &&
    result.getMonth() === month - 1 &&
    result.getDate() === day
    ? result
    : null;
}
function viewedDate() {
  return dateFromInput(browsedDate) || new Date();
}
function mondayFor(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}
function addDays(date, count) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}
function polishDate(date) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
function weekRelativeText(date) {
  const today = new Date();
  const midnight = (value) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((midnight(date) - midnight(today)) / 86400000);
  const dayText =
    days === 0
      ? "Dzisiaj"
      : days === 1
        ? "Jutro"
        : days === -1
          ? "Wczoraj"
          : days > 0
            ? `Za ${days} dni`
            : `${Math.abs(days)} dni temu`;
  const weeks = Math.round((mondayFor(date) - mondayFor(today)) / 604800000);
  const weekText =
    weeks === 0
      ? "ten tydzień"
      : weeks === 1
        ? "za tydzień"
        : weeks === -1
          ? "tydzień temu"
          : weeks > 0
            ? `za ${weeks} tygodnie`
            : `${Math.abs(weeks)} tygodnie temu`;
  return `${dayText} · ${weekText}`;
}
function updateWeekNavigator(date) {
  const nav = document.getElementById("weekNavigator");
  const visible = mode === "view" && (weekMode || omuState.enabled);
  nav.classList.toggle("hidden", !visible);
  if (!visible) return;
  document.getElementById("weekDatePicker").value = localDateString(date);
  const start = mondayFor(date),
    end = addDays(start, 6);
  document.getElementById("weekRangeText").textContent =
    `${polishDate(start)} – ${polishDate(end)}`;
  document.getElementById("weekRelativeText").textContent = weekRelativeText(date);
  const quick = document.getElementById("quickShowOmu");
  quick.classList.toggle("hidden", !omuState.enabled);
  document.getElementById("quickShowOmuInput").checked = !!settings.showOmuAlwaysInView;
}
function browseWeek(direction) {
  const date = addDays(viewedDate(), Number(direction) * 7);
  browsedDate = localDateString(date);
  refreshTemporalView();
}
function setBrowseDate(value) {
  const date = dateFromInput(value);
  if (!date) return;
  browsedDate = localDateString(date);
  refreshTemporalView();
}
function returnToToday() {
  browsedDate = null;
  refreshTemporalView();
}
function stateHasLessons(state) {
  if (!state?.table) return false;
  const template = document.createElement("template");
  template.innerHTML = state.table;
  return [...template.content.querySelectorAll("td[data-col]")].some(
    (cell) =>
      cell.textContent.replace(/\u200B/g, "").trim() && !cell.classList.contains("auto-break"),
  );
}
function hasPlanData() {
  return (
    omuState.entries.length > 0 ||
    [weekStates.common, weekStates.even, weekStates.odd].some(stateHasLessons)
  );
}
function hasAreaModulesThisWeek(now = viewedDate()) {
  return omuState.enabled && omuState.entries.some((entry) => entryOccursThisWeek(entry, now));
}
function startFirstEntry() {
  const cell = tbody.querySelector('td[data-col="0"]:not(.auto-break)');
  if (!cell) return;
  document.getElementById("previewFeedback").classList.add("hidden");
  activeCell = cell;
  activePart = null;
  openEntryModal(null, cell.querySelector(".cell-content"));
}
function applyModeToHeaders() {
  document
    .querySelectorAll("#header-zone [contenteditable], #scheduleTable thead [contenteditable]")
    .forEach((el) => el.setAttribute("contenteditable", mode === "edit" ? "true" : "false"));
}
function setMode(next) {
  const feedback = document.getElementById("previewFeedback");
  if (next === "view" && mode === "edit") saveState(false);
  if (
    next === "view" &&
    !usesMobileLayout() &&
    !stateHasLessons(weekStates[currentWeek]) &&
    !hasAreaModulesThisWeek()
  ) {
    document.getElementById("previewFeedbackText").textContent = hasPlanData()
      ? "Ten plan tygodniowy nie zawiera jeszcze zajęć. Dodaj wpis albo wybierz tydzień, w którym masz zajęcia."
      : "Plan jest pusty. Dodaj pierwsze zajęcia, aby otworzyć podgląd.";
    feedback.classList.remove("hidden");
    requestAnimationFrame(() => feedback.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    next = "edit";
  } else if (next === "view") feedback.classList.add("hidden");
  mode = next;
  document.body.classList.toggle("view-mode", mode === "view");
  document.getElementById("modeButton").textContent = mode === "view" ? "Edytuj plan" : "Podgląd";
  document
    .getElementById("modeButton")
    .setAttribute("aria-label", mode === "view" ? "Przejdź do edycji" : "Przejdź do podglądu");
  document
    .getElementById("mobileEditTab")
    .setAttribute("aria-current", mode === "edit" ? "page" : "false");
  document
    .getElementById("mobileViewTab")
    .setAttribute("aria-current", mode === "view" ? "page" : "false");
  closeAllCellMenus();
  applyModeToHeaders();
  renderOmu();
  refreshTemporalView();
  syncResponsiveClass();
  scheduleLayout();
  scheduleMobileEntries();
}
function toggleMode() {
  setMode(mode === "view" ? "edit" : "view");
}
function timeMinutes(text) {
  const parts = text.match(/^(\d{1,2})[.:](\d{2})$/);
  return parts ? Number(parts[1]) * 60 + Number(parts[2]) : null;
}
function refreshTemporalView() {
  if (!document.getElementById("scheduleTable")) return;
  const realNow = new Date();
  const now = viewedDate();
  const stamp = localDateString(now);
  const isToday = stamp === localDateString(realNow);
  // PL: Nawigacja po tygodniach nie przenosi poświaty na oglądany dzień.
  // Wyróżnienie bieżącej godziny dotyczy tylko realnego dnia i tygodnia.
  // EN: Week navigation must not move the current-time highlight to the viewed
  // date. Highlight only the real day and week reported by the device clock.
  const sameCalendarWeek = mondayFor(now).getTime() === mondayFor(realNow).getTime();
  const day = mode === "view" && sameCalendarWeek ? realNow.getDay() - 1 : -1;
  if (document.getElementById("omuSection").dataset.date !== stamp) renderOmu();
  highlightOmu(isToday ? realNow : null);
  if (mode === "view" && weekMode) {
    const expected = parityForDate(now);
    if (expected && expected !== currentWeek && weekStates[expected]) {
      currentWeek = expected;
      loadStateStr(JSON.stringify(weekStates[expected]));
      updateWeekUI();
      history = [JSON.stringify(weekStates[expected])];
      historyIndex = 0;
      persistWeeks();
    }
  }
  document
    .querySelectorAll("#scheduleTable .today-col, #scheduleTable .current-slot")
    .forEach((el) => el.classList.remove("today-col", "current-slot"));
  if (mode === "view" && day >= 0 && day < days) {
    document.querySelectorAll("#scheduleTable thead th")[day + 1]?.classList.add("today-col");
    const minutes = realNow.getHours() * 60 + realNow.getMinutes();
    times.forEach((range, row) => {
      let cell = getCell(row, day);
      if (cell?.style.display === "none")
        cell = [...tbody.children[row].querySelectorAll("td[data-col]")].find(
          (owner) =>
            owner.style.display !== "none" &&
            Number(owner.dataset.col) <= day &&
            Number(owner.dataset.col) + owner.colSpan > day,
        );
      if (!cell) {
        for (let before = row - 1; before >= 0; before--) {
          const owner = getCell(before, day);
          if (owner && owner.style.display !== "none" && before + owner.rowSpan > row) {
            cell = owner;
            break;
          }
        }
      }
      if (cell) cell.classList.add("today-col");
      const [start, end] = range.split("-").map(timeMinutes);
      if (isToday && minutes >= start && minutes < end) cell?.classList.add("current-slot");
    });
  }
  const status = document.getElementById("viewWeekStatus");
  if (!status) return;
  status.classList.toggle("hidden", mode !== "view");
  status.textContent = !weekMode
    ? "Plan tygodniowy"
    : `Tydzień ${currentWeek === "even" ? "parzysty" : "nieparzysty"} · ${parityUsesReference() ? "według daty odniesienia" : "według numeru tygodnia w kalendarzu"}`;
  updateWeekNavigator(now);
  scheduleMobileOverview();
}
function openHelp() {
  document.getElementById("helpModal").classList.replace("hidden", "flex");
}
function closeHelp() {
  document.getElementById("helpModal").classList.replace("flex", "hidden");
}

function announce(message) {
  document.getElementById("saveStatus").textContent = message;
}
function chooseImport() {
  document.getElementById("importFileInput").click();
}
const dayNames = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek"];
let editingOmuId = null;
let draftOmuDates = [];
function validDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return !isNaN(date) && date.toISOString().slice(0, 10) === value;
}
function localDateString(date) {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}
function displayDate(value) {
  return value.slice(8, 10) + "." + value.slice(5, 7) + "." + value.slice(0, 4);
}
function weekdayForDate(value) {
  return (new Date(value + "T12:00:00Z").getUTCDay() + 6) % 7;
}
function addIsoDays(value, daysToAdd) {
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}
function validWeeklyRange(start, end, day) {
  return (
    validDateString(start) &&
    validDateString(end) &&
    start <= end &&
    weekdayForDate(start) === day &&
    weekdayForDate(end) === day &&
    weekNumberSince(start, dateFromInput(end)) !== null
  );
}
function normalizeOmu(raw) {
  const result = { enabled: !!raw?.enabled, entries: [] };
  if (!Array.isArray(raw?.entries)) return result;
  for (const entry of raw.entries.slice(0, 150)) {
    if (!entry || typeof entry !== "object") continue;
    const day = Number(entry.day),
      start = String(entry.start || ""),
      end = String(entry.end || "");
    if (
      !Number.isInteger(day) ||
      day < 0 ||
      day >= days ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(end) ||
      start >= end ||
      typeof entry.subject !== "string" ||
      !entry.subject.trim()
    )
      continue;
    const repeat = ["dates", "range", "count"].includes(entry.repeat)
      ? entry.repeat
      : "weekly";
    const dates = [
      ...new Set(Array.isArray(entry.dates) ? entry.dates.filter(validDateString) : []),
    ].sort();
    if (
      repeat === "dates" &&
      (!dates.length || dates.some((d) => (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7 !== day))
    )
      continue;
    const rangeStart = String(entry.rangeStart || "");
    const rangeEnd = String(entry.rangeEnd || "");
    const countStart = String(entry.countStart || "");
    const occurrences = Number(entry.occurrences);
    if (repeat === "range" && !validWeeklyRange(rangeStart, rangeEnd, day)) continue;
    if (
      repeat === "count" &&
      (!validDateString(countStart) ||
        weekdayForDate(countStart) !== day ||
        !Number.isInteger(occurrences) ||
        occurrences < 1 ||
        occurrences > 150)
    )
      continue;
    result.entries.push({
      id: typeof entry.id === "string" ? entry.id.slice(0, 80) : "omu-" + result.entries.length,
      block: entry.block === "2" ? "2" : "1",
      day,
      start,
      end,
      subject: entry.subject.trim().slice(0, 200),
      group: String(entry.group || "").slice(0, 80),
      teacher: String(entry.teacher || "").slice(0, 200),
      room: String(entry.room || "").slice(0, 200),
      other: !!entry.other,
      remote: !!entry.remote,
      note: String(entry.note || "").slice(0, 240),
      repeat,
      dates,
      rangeStart: repeat === "range" ? rangeStart : "",
      rangeEnd: repeat === "range" ? rangeEnd : "",
      countStart: repeat === "count" ? countStart : "",
      occurrences: repeat === "count" ? occurrences : 0,
    });
  }
  return result;
}

// PL: Moduły są wspólne dla całego planu; termin decyduje wyłącznie o widoczności.
// EN: Area modules are shared by the whole schedule; dates only control visibility.
function entryOccursOnDate(entry, value) {
  if (!validDateString(value) || weekdayForDate(value) !== entry.day) return false;
  if (entry.repeat === "weekly") return true;
  if (entry.repeat === "dates") return entry.dates.includes(value);
  if (entry.repeat === "range") return value >= entry.rangeStart && value <= entry.rangeEnd;
  if (entry.repeat === "count") {
    const last = addIsoDays(entry.countStart, (entry.occurrences - 1) * 7);
    return value >= entry.countStart && value <= last;
  }
  return false;
}
function dateOccursThisWeek(value, now) {
  return weekNumberSince(value, now) === 0;
}
function entryOccursThisWeek(entry, now) {
  if (entry.repeat === "weekly") return true;
  if (entry.repeat === "dates") return entry.dates.some((value) => dateOccursThisWeek(value, now));
  const monday = localDateString(mondayFor(now));
  const sunday = localDateString(addDays(mondayFor(now), 6));
  if (entry.repeat === "range") return entry.rangeStart <= sunday && entry.rangeEnd >= monday;
  if (entry.repeat === "count") {
    const last = addIsoDays(entry.countStart, (entry.occurrences - 1) * 7);
    return entry.countStart <= sunday && last >= monday;
  }
  return false;
}
function occurrenceSummary(entry, now = viewedDate()) {
  if (entry.repeat === "weekly") return "Co tydzień";
  if (entry.repeat === "range")
    return `Co tydzień: ${displayDate(entry.rangeStart)} – ${displayDate(entry.rangeEnd)}`;
  if (entry.repeat === "count")
    return `Co tydzień: ${entry.occurrences} spotk. od ${displayDate(entry.countStart)}`;
  const dates = settings.showOmuAlwaysInView
    ? entry.dates
    : entry.dates.filter((date) => mode === "edit" || dateOccursThisWeek(date, now));
  return dates.map(displayDate).join(", ");
}
function visibleOmuEntries(now = viewedDate()) {
  if (!omuState.enabled) return [];
  return omuState.entries.filter(
    (entry) =>
      mode === "edit" ||
      settings.showOmuAlwaysInView ||
      entryOccursThisWeek(entry, now),
  );
}
function toggleOmu(enabled) {
  omuState.enabled = enabled;
  document.getElementById("omuEnabled").checked = enabled;
  document.getElementById("setOmuEnabled").checked = enabled;
  saveState(true);
  refreshTemporalView();
}
function openOmu(id = null) {
  if (mode === "view") setMode("edit");
  document.getElementById("settingsPanel").classList.add("hidden");
  document.getElementById("omuBankLabel").textContent =
    "Wspólne dla tygodni parzystych i nieparzystych";
  document.getElementById("omuEnabled").checked = omuState.enabled;
  refreshEntrySuggestions();
  renderOmuList();
  selectOmuEntry(id);
  document.getElementById("omuModal").classList.replace("hidden", "flex");
  document.getElementById("omuSubject").focus();
}
function closeOmu() {
  document.getElementById("omuModal").classList.replace("flex", "hidden");
}
function renderOmuList() {
  const list = document.getElementById("omuList");
  list.replaceChildren();
  for (const entry of omuState.entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ui-button omu-list-item";
    button.textContent = "Blok " + entry.block + " · " + entry.subject;
    button.setAttribute("aria-pressed", String(entry.id === editingOmuId));
    button.onclick = () => selectOmuEntry(entry.id);
    list.appendChild(button);
  }
  const add = document.createElement("button");
  add.type = "button";
  add.className = "ui-button";
  add.textContent = "+ Nowy wpis";
  add.onclick = () => selectOmuEntry(null);
  list.appendChild(add);
}
function selectOmuEntry(id) {
  const entry = omuState.entries.find((e) => e.id === id);
  editingOmuId = entry?.id || null;
  const nextBlock = omuState.entries.some((e) => e.block === "1") ? "2" : "1";
  document.getElementById("omuBlock").value = entry?.block || nextBlock;
  document.getElementById("omuDay").value = String(entry?.day ?? 0);
  document.getElementById("omuStart").value =
    entry?.start || (nextBlock === "1" ? "13:45" : "16:15");
  document.getElementById("omuEnd").value = entry?.end || (nextBlock === "1" ? "16:00" : "18:30");
  document.getElementById("omuSubject").value = entry?.subject || "";
  document.getElementById("omuGroup").value = entry?.group || "";
  document.getElementById("omuRepeat").value = entry?.repeat || "weekly";
  document.getElementById("omuRangeStart").value = entry?.rangeStart || "";
  document.getElementById("omuRangeEnd").value = entry?.rangeEnd || "";
  document.getElementById("omuCountStart").value = entry?.countStart || "";
  document.getElementById("omuOccurrences").value = String(entry?.occurrences || 1);
  document.getElementById("omuNote").value = entry?.note || "";
  const teacher = parseTeacher(entry?.teacher || "");
  document.getElementById("omuTeacherPrefix").value = entry?.teacher ? teacher.prefix : "";
  document.getElementById("omuTeacherUniversity").checked = teacher.universityProfessor;
  document.getElementById("omuTeacher").value = teacher.name;
  document.getElementById("omuPlaceMode").value = entry?.remote ? "remote" : "onsite";
  document.getElementById("omuRoom").value = entry?.room || "";
  document.getElementById("omuAltPlace").checked = !!entry?.other;
  document.getElementById("omuDelete").classList.toggle("hidden", !entry);
  draftOmuDates = [...(entry?.dates || [])];
  document.getElementById("omuDateInput").value = "";
  updateOmuDateFields();
  updateOmuPlaceFields();
  renderOmuDates();
  renderOmuList();
}
function setOmuBlockDefaults() {
  const first = document.getElementById("omuBlock").value === "1";
  document.getElementById("omuStart").value = first ? "13:45" : "16:15";
  document.getElementById("omuEnd").value = first ? "16:00" : "18:30";
}
function updateOmuDateFields() {
  const repeat = document.getElementById("omuRepeat").value;
  document
    .getElementById("omuDateFields")
    .classList.toggle("hidden", repeat !== "dates");
  document.getElementById("omuRangeFields").classList.toggle("hidden", repeat !== "range");
  document.getElementById("omuCountFields").classList.toggle("hidden", repeat !== "count");
}
function updateOmuPlaceFields() {
  document
    .getElementById("omuPlaceFields")
    .classList.toggle("hidden", document.getElementById("omuPlaceMode").value === "remote");
}
function addOmuDate() {
  const value = document.getElementById("omuDateInput").value;
  if (!validDateString(value)) {
    showModal("Wybierz datę spotkania.", true);
    return;
  }
  const day = (new Date(value + "T12:00:00Z").getUTCDay() + 6) % 7;
  if (day !== Number(document.getElementById("omuDay").value)) {
    showModal("Data musi przypadać na wybrany dzień tygodnia.", true);
    return;
  }
  if (!draftOmuDates.includes(value)) draftOmuDates.push(value);
  draftOmuDates.sort();
  renderOmuDates();
  document.getElementById("omuDateInput").value = "";
}
function renderOmuDates() {
  const root = document.getElementById("omuDates");
  root.replaceChildren();
  for (const date of draftOmuDates) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "date-chip";
    button.textContent = displayDate(date) + " ×";
    button.setAttribute("aria-label", "Usuń datę " + displayDate(date));
    button.onclick = () => {
      draftOmuDates = draftOmuDates.filter((d) => d !== date);
      renderOmuDates();
    };
    root.appendChild(button);
  }
}
function omuEntriesOverlap(a, b) {
  if (a.day !== b.day || a.start >= b.end || b.start >= a.end) return false;
  const occurrenceDates = (entry) => {
    if (entry.repeat === "weekly") return null;
    if (entry.repeat === "dates") return entry.dates;
    const start = entry.repeat === "range" ? entry.rangeStart : entry.countStart;
    const limit = entry.repeat === "range" ? 150 : entry.occurrences;
    const dates = [];
    for (let index = 0, date = start; index < limit; index += 1, date = addIsoDays(date, 7)) {
      if (entry.repeat === "range" && date > entry.rangeEnd) break;
      dates.push(date);
    }
    return dates;
  };
  const first = occurrenceDates(a);
  const second = occurrenceDates(b);
  return first === null || second === null || first.some((date) => second.includes(date));
}
async function saveOmuEntry() {
  const value = (id) => document.getElementById(id).value.trim();
  const candidate = {
    id:
      editingOmuId ||
      "omu-" +
        (globalThis.crypto?.randomUUID?.() ||
          Date.now() + "-" + Math.random().toString(36).slice(2)),
    block: value("omuBlock"),
    day: Number(value("omuDay")),
    start: value("omuStart"),
    end: value("omuEnd"),
    subject: value("omuSubject"),
    group: value("omuGroup"),
    repeat: value("omuRepeat"),
    dates: [...draftOmuDates],
    rangeStart: value("omuRangeStart"),
    rangeEnd: value("omuRangeEnd"),
    countStart: value("omuCountStart"),
    occurrences: Number(value("omuOccurrences")),
    teacher: value("omuTeacher")
      ? formatTeacher(
          value("omuTeacherPrefix"),
          value("omuTeacher"),
          document.getElementById("omuTeacherUniversity").checked,
        )
      : "",
    remote: value("omuPlaceMode") === "remote",
    other: document.getElementById("omuAltPlace").checked,
    note: value("omuNote"),
  };
  const unaddedDate = value("omuDateInput");
  if (candidate.teacher && !value("omuTeacherPrefix")) {
    showModal("Wybierz tytuł prowadzącego moduł.", true);
    return;
  }
  if (
    candidate.repeat === "dates" &&
    validDateString(unaddedDate) &&
    !candidate.dates.includes(unaddedDate)
  )
    candidate.dates.push(unaddedDate);
  candidate.room = candidate.remote ? "" : normalizeRoom(value("omuRoom"), candidate.other);
  const normalized = normalizeOmu({ enabled: true, entries: [candidate] }).entries[0];
  if (!normalized) {
    showModal(
      "Wpisz nazwę i poprawne godziny. Daty, zakres oraz liczba spotkań muszą pasować do wybranego dnia tygodnia.",
      true,
    );
    return;
  }
  if (
    omuState.entries.some((e) => e.id !== candidate.id && omuEntriesOverlap(e, normalized)) &&
    !(await showModal(
      "Ten moduł nakłada się godzinami i terminami na inny wpis. Zapisać mimo to?",
    ))
  )
    return;
  const index = omuState.entries.findIndex((e) => e.id === normalized.id);
  if (index < 0) omuState.entries.push(normalized);
  else omuState.entries[index] = normalized;
  omuState.enabled = true;
  editingOmuId = normalized.id;
  document.getElementById("omuEnabled").checked = true;
  document.getElementById("setOmuEnabled").checked = true;
  saveState(true);
  renderOmuList();
  closeOmu();
  announce("Zapisano moduł obszarowy.");
}
async function deleteOmuEntry() {
  if (!editingOmuId || !(await showModal("Usunąć wybrany moduł?"))) return;
  omuState.entries = omuState.entries.filter((e) => e.id !== editingOmuId);
  editingOmuId = null;
  saveState(true);
  selectOmuEntry(null);
  announce("Usunięto moduł. Możesz go przywrócić przez Cofnij.");
}
function renderOmu() {
  const section = document.getElementById("omuSection");
  if (!section) return;
  const displayedDate = viewedDate();
  section.replaceChildren();
  section.dataset.date = localDateString(displayedDate);
  section.classList.toggle("hidden", !omuState.enabled);
  if (!omuState.enabled) return;
  const title = document.createElement("h2");
  title.className = "omu-section-title";
  title.textContent = "Moduły kształcenia obszarowego · godziny indywidualne";
  section.appendChild(title);
  const entries = visibleOmuEntries(displayedDate).sort(
    (a, b) => a.start.localeCompare(b.start) || a.day - b.day || a.block.localeCompare(b.block),
  );
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "omu-empty";
    empty.textContent =
      mode === "edit"
        ? "Dodaj moduł przyciskiem „Moduły obszarowe”. Udział w dwóch blokach nie jest wymagany."
        : "Brak spotkań modułów obszarowych w tym tygodniu.";
    section.appendChild(empty);
    return;
  }
  const table = document.createElement("table");
  table.className = "omu-table";
  const group = document.createElement("colgroup");
  group.innerHTML = document.getElementById("dayColumns").innerHTML;
  table.appendChild(group);
  const body = document.createElement("tbody");
  table.appendChild(body);
  const slots = [...new Set(entries.map((e) => e.start + "–" + e.end))];
  for (const slot of slots) {
    const tr = document.createElement("tr"),
      time = document.createElement("td");
    time.className = "time-col";
    time.textContent = slot;
    tr.appendChild(time);
    for (let day = 0; day < days; day++) {
      const td = document.createElement("td");
      tr.appendChild(td);
      for (const entry of entries.filter((e) => e.day === day && e.start + "–" + e.end === slot)) {
        const card = document.createElement("div");
        card.className = "omu-card";
        card.dataset.omuId = entry.id;
        if (mode === "edit") {
          card.tabIndex = 0;
          card.setAttribute("role", "button");
          card.setAttribute("aria-label", "Edytuj moduł obszarowy: " + entry.subject);
          card.onclick = () => openOmu(entry.id);
          card.onkeydown = (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              openOmu(entry.id);
            }
          };
        }
        const line = (className, text) => {
          if (!text) return;
          const el = document.createElement("div");
          el.className = className;
          el.textContent = text;
          card.appendChild(el);
        };
        line("omu-day-name", dayNames[day] + " · blok " + entry.block);
        line("entry-subject", entry.subject);
        line(
          "entry-meta",
          [entry.group ? "Grupa " + entry.group : "", entry.note].filter(Boolean).join(" · "),
        );
        line("entry-teacher", entry.teacher);
        line(
          entry.remote ? "entry-remote" : entry.other ? "entry-room entry-room-alt" : "entry-room",
          entry.remote ? "ZDALNIE" : entry.room,
        );
        line("omu-dates", occurrenceSummary(entry, displayedDate));
        td.appendChild(card);
      }
    }
    body.appendChild(tr);
  }
  section.appendChild(table);
  highlightOmu(localDateString(displayedDate) === localDateString(new Date()) ? new Date() : null);
}
function highlightOmu(now) {
  const today = now ? localDateString(now) : "",
    minutes = now ? now.getHours() * 60 + now.getMinutes() : -1;
  document.querySelectorAll("[data-omu-id]").forEach((card) => {
    const entry = omuState.entries.find((e) => e.id === card.dataset.omuId);
    const active =
      mode === "view" &&
      now &&
      entry &&
      entry.day === now.getDay() - 1 &&
      minutes >= timeMinutes(entry.start) &&
      minutes < timeMinutes(entry.end) &&
      entryOccursOnDate(entry, today);
    card.classList.toggle("omu-current", !!active);
  });
}

function readProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY));
  } catch (e) {
    return null;
  }
}
function openWelcome(editing = false) {
  closeSettings(false);
  const profile = readProfile() || {};
  const existingCourse = document
    .querySelector("#header-left [contenteditable]")
    ?.textContent.trim();
  document.getElementById("profileCourse").value =
    profile.course || (editing && existingCourse !== "Twój kierunek" ? existingCourse : "") || "";
  for (const [id, key, defaultValue] of [
    ["profileYear", "year", "I"],
    ["profileDegree", "degree", "I"],
    ["profileAttendance", "attendance", "stacjonarne"],
    ["profileSemester", "semester", "zimowy"],
  ])
    document.getElementById(id).value = profile[key] || defaultValue;
  document.getElementById("profileSemesterNumber").value = profile.semesterNumber || "";
  const year = new Date().getFullYear();
  setAcademicYearField(
    profile.academicYear ||
      (editing
        ? (document
            .querySelector("#header-right [contenteditable]")
            ?.textContent.match(/\d{4}\/\d{4}/) || [])[0]
        : "") ||
      `${year}/${year + 1}`,
  );
  document.getElementById("welcomeTitle").textContent = editing
    ? "Zmień nagłówki studiów"
    : "Witaj! Przygotuj nagłówek planu";
  document.getElementById("welcomeModal").classList.replace("hidden", "flex");
  document.getElementById("profileCourse").focus();
}
function normalizeAcademicYear(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (!match) return null;
  const start = Number(match[1]),
    end = Number(match[2]);
  return end === start + 1 ? { start, end } : null;
}
function setAcademicYearField(value) {
  const fallbackStart = new Date().getFullYear();
  const parsed = normalizeAcademicYear(value) || {
    start: fallbackStart,
    end: fallbackStart + 1,
  };
  const normalized = `${parsed.start}/${parsed.end}`;
  document.getElementById("profileAcademicYear").value = normalized;
  document.getElementById("profileAcademicYearDisplay").textContent = normalized;
}
function changeAcademicYear(delta) {
  const current = normalizeAcademicYear(document.getElementById("profileAcademicYear").value);
  const start = (current ? current.start : new Date().getFullYear()) + (delta < 0 ? -1 : 1);
  setAcademicYearField(`${start}/${start + 1}`);
}
function skipWelcome() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...readProfile(), done: true }));
  document.getElementById("welcomeModal").classList.replace("flex", "hidden");
}
function applyProfile(profile, save = true) {
  const left = document.querySelector("#header-left [contenteditable]");
  const right = document.querySelector("#header-right [contenteditable]");
  if (profile.course) {
    const title = document.createElement("h1");
    title.className = "font-bold text-xl leading-tight";
    title.textContent = profile.course.toLocaleUpperCase("pl");
    left.replaceChildren(title);
  }
  const degree =
    profile.degree === "jednolite" ? "jednolite studia magisterskie" : `${profile.degree} stopnia`;
  right.replaceChildren(
    document.createTextNode(
      `Rozkład zajęć, semestr ${profile.semesterNumber ? profile.semesterNumber + " " : ""}${profile.semester}, rok akademicki ${profile.academicYear}`,
    ),
    document.createElement("br"),
    document.createTextNode(`${profile.year} ROK studia ${profile.attendance} ${degree}`),
  );
  if (save) {
    saveState(true);
    // PL: Treść nagłówków jest wspólna, ale każdy wariant zachowuje ich pozycje.
    // EN: Header content is shared, while each variant keeps its own positions.
    for (const key of ["common", "even", "odd"])
      if (key !== currentWeek && weekStates[key]) {
        weekStates[key].headerLeftHTML = document.getElementById("header-left").innerHTML;
        weekStates[key].headerRightHTML = document.getElementById("header-right").innerHTML;
      }
    persistWeeks();
  }
}
function saveWelcome() {
  const profile = {
    course: document.getElementById("profileCourse").value.trim(),
    year: document.getElementById("profileYear").value,
    degree: document.getElementById("profileDegree").value,
    attendance: document.getElementById("profileAttendance").value,
    semester: document.getElementById("profileSemester").value,
    semesterNumber: document.getElementById("profileSemesterNumber").value,
    academicYear: document.getElementById("profileAcademicYear").value.trim(),
    done: true,
  };
  if (!profile.course || !/^\d{4}\/\d{4}$/.test(profile.academicYear)) {
    showModal("Wpisz kierunek i rok akademicki w formacie 2025/2026.", true);
    return;
  }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  applyProfile(profile);
  document.getElementById("welcomeModal").classList.replace("flex", "hidden");
}

document.addEventListener("click", (e) => {
  const panel = document.getElementById("settingsPanel");
  if (!panel || panel.classList.contains("hidden")) return;
  if (
    !e.target.closest("#settingsPanel") &&
    !e.target.closest('button[onclick*="toggleSettings"]')
  ) {
    closeSettings(false);
  }
});
