const APP_ICONS = {
  settings:
    '<svg class="app-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.7 2.5h4.6l.55 2.25c.52.15 1.02.35 1.48.61l1.98-1.2 2.5 2.5-1.2 1.98c.26.46.46.96.61 1.48l2.25.55v3.66l-2.25.55c-.15.52-.35 1.02-.61 1.48l1.2 1.98-2.5 2.5-1.98-1.2c-.46.26-.96.46-1.48.61l-.55 2.25H9.7l-.55-2.25c-.52-.15-1.02-.35-1.48-.61l-1.98 1.2-2.5-2.5 1.2-1.98a8 8 0 0 1-.61-1.48l-2.25-.55v-3.66l2.25-.55c.15-.52.35-1.02.61-1.48l-1.2-1.98 2.5-2.5 1.98 1.2c.46-.26.96-.46 1.48-.61z"/><circle cx="12" cy="12.5" r="3"/></svg>',
  help: '<svg class="app-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 1 1 4.5 2c-1.1.9-2 1.3-2 2.5"/><path d="M12 17h.01"/></svg>',
  edit: '<svg class="app-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"/><path d="m14.5 6.5 3 3"/></svg>',
  view: '<svg class="app-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.6 12S6 6.7 12 6.7 21.4 12 21.4 12 18 17.3 12 17.3 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="2.3"/></svg>',
  export:
    '<svg class="app-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  more: '<svg class="app-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
};
function placeAppActions() {
  const toolbar = document.getElementById("toolbar");
  const help = toolbar.querySelector('button[onclick="openHelp()"]');
  const settings = document.getElementById("settingsAnchor");
  const modeButton = document.getElementById("modeButton");
  const exportWrap = toolbar.querySelector(".export-button").parentElement;
  document.getElementById("globalActions").append(help, settings);
  document.getElementById("documentActions").append(modeButton, exportWrap);
  document.body.append(document.getElementById("importFileInput"));
  toolbar.querySelector(".command-row > .toolbar-right").remove();
  help.innerHTML = APP_ICONS.help;
  help.title = "Pomoc i skróty (F1)";
  const gear = settings.querySelector('button[onclick="toggleSettings()"]');
  gear.innerHTML = APP_ICONS.settings;
  gear.setAttribute("aria-expanded", "false");
  exportWrap.querySelector(".export-button").innerHTML =
    APP_ICONS.export + '<span>Eksport</span><span aria-hidden="true">⌄</span>';
  exportWrap.querySelector(".export-button").setAttribute("aria-controls", "optionsDropdown");
  exportWrap.querySelector(".export-button").setAttribute("aria-expanded", "false");
  document.getElementById("mobileEditTab").querySelector("span").innerHTML = APP_ICONS.edit;
  document.getElementById("mobileViewTab").querySelector("span").innerHTML = APP_ICONS.view;
  document.querySelector(".preview-feedback > span").innerHTML = APP_ICONS.help;
}
function isTabletViewport() {
  return window.innerWidth > 720 && window.innerWidth <= 1240;
}
function usesMobileLayout() {
  return window.innerWidth <= 720 || (isTabletViewport() && settings?.tabletLayout !== "desktop");
}
function syncResponsiveClass() {
  const mobile = usesMobileLayout();
  document.documentElement.classList.toggle("mobile-layout", mobile);
  if (!mobile) document.getElementById("settingsBackdrop").classList.add("hidden");
  const exportWrap = document.querySelector("#optionsDropdown")?.parentElement;
  const host =
    mobile && !document.body.classList.contains("mobile-previewing")
      ? document.getElementById(mode === "view" ? "mobileViewExport" : "mobileEditExport")
      : document.getElementById("documentActions");
  if (exportWrap && host && exportWrap.parentElement !== host) {
    document.getElementById("optionsDropdown").classList.add("hidden");
    exportWrap.querySelector(".export-button").setAttribute("aria-expanded", "false");
    host.appendChild(exportWrap);
  }
  scheduleMobileEntries();
  scheduleMobileOverview();
  requestAnimationFrame(() => {
    resizePreview();
    syncPreviewScrollbars();
  });
}
const TABLET_NOTICE_KEY = "planZajecTabletLayoutNoticeV11";
function maybeShowTabletLayoutNotice() {
  if (!isTabletViewport() || settings.tabletLayout === "desktop") return;
  try {
    if (localStorage.getItem(TABLET_NOTICE_KEY)) return;
    localStorage.setItem(TABLET_NOTICE_KEY, "1");
  } catch (e) {}
  showModal(
    "Na tablecie domyślnie działa wygodny układ mobilny Edytuj / Podgląd. W Ustawieniach możesz w każdej chwili przełączyć go na układ komputerowy.",
    true,
  );
}
placeAppActions();
const times = [
  "8.00-9.30",
  "9.45-11.15",
  "11.30-13.00",
  "13.00-13.45" /* PL: Przerwa. EN: Break. */,
  "13.45-15.15",
  "15.30-17.00",
  "17.15-18.45",
  "19.00-20.30",
];

const days = 5;
const tbody = document.getElementById("scheduleBody");
// PL: Klucz pozostaje zgodny ze starszym zapisem, aby migracja nie usuwała danych.
// EN: Keep the legacy-compatible key so migration does not discard user data.
const STORAGE_KEY = "planZajecStateV7";
const WEEKS_KEY = "planZajecWeeksV08";
const PREVIOUS_WEEKS_KEY = "planZajecWeeksV07";
const V06_WEEKS_KEY = "planZajecWeeksV06";
const OLDER_WEEKS_KEY = "planZajecWeeksV05";
const PROFILE_KEY = "planZajecProfileV07";
let mode = "edit";
let currentWeek = "common";
let weekMode = false;
let parityUsed = false;
let weekStates = { common: null, even: null, odd: null };
let activeCell = null;
let activePart = null;
let omuState = { enabled: false, entries: [] };
let lastDividedWeek = "even";

// PL: Zapamiętany wybór i bieżące kolory edytora.
// EN: Saved selection and current editor colors.
let savedRange = null;
let currentTextColor = "#000000";
let currentBgColor = "transparent";

// PL: Budowanie bazowej tabeli planu.
// EN: Build the base schedule table.
function initTable() {
  tbody.innerHTML = "";
  times.forEach((time, rowIndex) => {
    const tr = document.createElement("tr");
    if (rowIndex === 3) tr.className = "row-przerwa";

    const tdTime = document.createElement("td");
    tdTime.className = "time-col";
    tdTime.textContent = time;
    tr.appendChild(tdTime);

    for (let colIndex = 0; colIndex < days; colIndex++) {
      const td = document.createElement("td");
      td.dataset.row = rowIndex;
      td.dataset.col = colIndex;

      const contentDiv = document.createElement("div");
      contentDiv.className = "cell-content w-full h-full outline-none safe-wrap";
      contentDiv.removeAttribute("contenteditable");
      contentDiv.innerHTML = "<br>";

      td.appendChild(contentDiv);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  setupCellControls();
  updateAutoBreaks();
}

// PL: Menu kontekstowe komórek. EN: Cell context menu.
function setupCellControls() {
  tbody.querySelectorAll("td").forEach((cell) => {
    if (cell.dataset.col !== undefined) cell.tabIndex = 0;
    cell.querySelector(".cell-controls-wrapper")?.remove();
    const wrapper = document.createElement("div");
    wrapper.className = "cell-controls-wrapper no-print absolute top-0.5 right-0.5 z-20";
    const time = cell.classList.contains("time-col");
    wrapper.innerHTML = `
                    <button type="button" class="cell-hamburger w-5 h-5 bg-white border border-gray-300 rounded shadow-sm opacity-70 hover:opacity-100" onclick="toggleCellMenu(this)" aria-label="Opcje komórki" aria-expanded="false" title="Opcje komórki">${APP_ICONS.more}</button>
                    <div class="cell-menu hidden flex-col absolute right-0 top-full mt-1 bg-white border border-gray-200 shadow-xl z-50 rounded text-left">
                        <label class="menu-if-autobreak hidden px-3 py-2 text-xs bg-blue-50">Dzień w tej przerwie
                            <select class="break-day-select w-full border rounded mt-1" aria-label="Wybierz dzień dla działania"></select>
                        </label>
                        ${
                          time
                            ? ""
                            : `<button class="w-full text-left px-3 py-2 text-xs text-blue-700 hover:bg-blue-50 font-semibold" onclick="openEntryModal(this)"><i class="fas fa-plus mr-1"></i> Dodaj / edytuj z formularza</button>
                        <button class="w-full text-left px-3 py-2 text-xs hover:bg-blue-50" onclick="openManualModal(this)"><i class="fas fa-pen mr-1"></i> Edytuj ręcznie</button>
                        <button class="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b" onclick="clearCellFormatting(this)"><i class="fas fa-eraser mr-1"></i> Wyczyść pole</button>`
                        }
                        <button class="w-full text-left px-3 py-2 text-xs hover:bg-blue-50" onclick="toggleThickBorder(this)"><i class="far fa-square mr-1"></i> <span class="border-action-label">Pogrub ramkę</span></button>
                        <div class="menu-if-thick hidden flex-col bg-blue-50 border-b">
                            <button class="w-full text-left px-3 py-2 text-xs hover:bg-blue-100" onclick="applyRowFrame(this)">Ramka wokół wiersza</button>
                            <button class="w-full text-left px-3 py-2 text-xs hover:bg-blue-100" onclick="resetRowFrame(this)">Przywróć linie w wierszu</button>
                            <div class="px-3 py-2"><div class="text-[10px] text-gray-600 mb-1">Ukryj krawędź pogrubionej ramki</div>
                            <div class="flex gap-1">${["top", "bottom", "left", "right"].map((side, i) => `<button class="side-btn w-7 h-6 border rounded text-[10px]" data-side="${side}" onclick="toggleSide(this,'${side}')" title="${["Górna", "Dolna", "Lewa", "Prawa"][i]}"><i class="fas fa-arrow-${["up", "down", "left", "right"][i]}"></i></button>`).join("")}</div></div>
                        </div>
                        ${
                          time
                            ? ""
                            : `<div class="menu-merge-actions flex flex-col border-t">
                            <button class="w-full text-left px-3 py-2 text-xs hover:bg-blue-50" onclick="mergeCellUp(this)">Połącz w górę</button>
                            <button class="w-full text-left px-3 py-2 text-xs hover:bg-blue-50" onclick="mergeCellDown(this)">Połącz w dół</button></div>
                            <button class="menu-if-merged hidden w-full text-left px-3 py-2 text-xs text-red-600 border-t" onclick="resetCellSpan(this)">Rozdziel połączone wiersze</button>
                            <div class="menu-if-unsplit flex flex-col border-t">
                                <button class="w-full text-left px-3 py-2 text-xs hover:bg-blue-50" onclick="splitCellHorizontal(this)"><span class="inline-block w-4">│</span> Podziel na lewo / prawo</button>
                                <button class="w-full text-left px-3 py-2 text-xs hover:bg-blue-50" onclick="splitCellVertical(this)"><span class="inline-block w-4">─</span> Podziel na górę / dół</button></div>
                            <button class="menu-if-split hidden w-full text-left px-3 py-2 text-xs text-red-600 border-t" onclick="unsplitCell(this)">Usuń podział</button>`
                        }
                    </div>`;
    cell.appendChild(wrapper);
  });
}

function toggleOptionsDropdown(btn) {
  const dropdown = document.getElementById("optionsDropdown");
  if (!dropdown.classList.contains("hidden")) {
    dropdown.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");
    return;
  }
  const rect = btn.getBoundingClientRect();
  const menuWidth = Math.min(245, window.innerWidth - 16);
  dropdown.classList.remove("hidden");
  const menuHeight = dropdown.getBoundingClientRect().height;
  dropdown.style.left = `${Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))}px`;
  dropdown.style.top = `${rect.bottom + 6 + menuHeight > window.innerHeight ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6}px`;
  btn.setAttribute("aria-expanded", "true");
}

tbody.addEventListener("click", (e) => {
  if (mode === "view") return;
  if (e.target.closest(".cell-controls-wrapper")) return;
  let cell = e.target.closest("td[data-col]");
  if (!cell || !tbody.contains(cell)) return;
  if (cell.classList.contains("auto-break")) {
    cell = breakCellAtPointer(cell, e.clientX);
    clearAutoBreaks();
  }
  activeCell = cell;
  cell.focus();
  activePart = e.target.closest(".cell-part") || null;
  openEntryModal(null, activePart || cell.querySelector(".cell-content"));
});
// PL: Synchronizacja formatowania z pozycją kursora.
// EN: Synchronize formatting with the caret position.

document.addEventListener("selectionchange", () => {
  const sel = window.getSelection();
  if (sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const sheet = document.getElementById("a4-sheet");
    if (sheet.contains(range.commonAncestorContainer)) {
      savedRange = range;
      updateToolbarFromSelection(range.commonAncestorContainer);
    }
  }
});

// PL: Odczytuje styl spod kursora i aktualizuje kontrolki paska narzędzi.
// EN: Read the style at the caret and update toolbar controls.
function updateToolbarFromSelection(node) {
  if (node.nodeType === 3) node = node.parentNode;
  if (!node) return;
  const cell = node.closest(".cell-content");
  if (!cell) return;

  const style = window.getComputedStyle(node);

  if (style.fontSize) {
    const pt = Math.round(parseFloat(style.fontSize) * 0.75);
    document.getElementById("fontSizeInput").value = pt;
  }

  if (style.color) {
    document.getElementById("textColorIndicator").style.backgroundColor = style.color;
    currentTextColor = style.color;
  }

  if (style.backgroundColor) {
    const bg = style.backgroundColor;
    if (bg === "rgba(0, 0, 0, 0)" || bg === "transparent") {
      document.getElementById("bgColorIndicator").style.backgroundColor = "transparent";
      currentBgColor = "transparent";
    } else {
      document.getElementById("bgColorIndicator").style.backgroundColor = bg;
      currentBgColor = bg;
    }
  }
}

function restoreSelection() {
  if (savedRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
}

function toggleColorMenu(menuId) {
  saveSelection();
  const menu = document.getElementById(menuId);
  const isHidden = menu.classList.contains("hidden");

  document.getElementById("textColorMenu").classList.add("hidden");
  document.getElementById("bgColorMenu").classList.add("hidden");

  if (isHidden) menu.classList.remove("hidden");
}

function saveSelection() {
  const sel = window.getSelection();
  if (sel.getRangeAt && sel.rangeCount) {
    savedRange = sel.getRangeAt(0);
  }
}

function applyColor(event, command, value, indicatorId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (command === "foreColor") currentTextColor = value;
  if (command === "backColor") currentBgColor = value;

  document.getElementById(indicatorId).style.backgroundColor =
    value === "transparent" ? "transparent" : value;

  applyCurrentColor(command, indicatorId, value);

  document.getElementById("textColorMenu").classList.add("hidden");
  document.getElementById("bgColorMenu").classList.add("hidden");
}

function applyCurrentColor(command, indicatorId, forceValue = null) {
  restoreSelection();

  let value = forceValue || (command === "foreColor" ? currentTextColor : currentBgColor);

  document.execCommand("styleWithCSS", false, true);

  const sel = window.getSelection();
  if (sel.rangeCount > 0 && sel.getRangeAt(0).collapsed) {
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    span.innerHTML = "&#8203;";

    let parent = range.commonAncestorContainer;
    if (parent.nodeType === 3) parent = parent.parentNode;
    if (parent && parent.tagName === "SPAN") {
      span.style.cssText = parent.style.cssText;
    }

    if (command === "foreColor") span.style.color = value;
    if (command === "backColor")
      span.style.backgroundColor = value === "transparent" ? "transparent" : value;

    range.insertNode(span);
    range.setStart(span.firstChild, 1);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    if (command === "backColor") {
      const bg = value === "transparent" ? "rgba(0,0,0,0)" : value;
      document.execCommand("backColor", false, bg);
      document.execCommand("hiliteColor", false, bg);
    } else {
      document.execCommand(command, false, value);
    }
  }
  saveState(true);
}

// PL: Zamykanie otwartych menu po kliknięciu poza nimi.
// EN: Close open menus when the user clicks outside them.
document.addEventListener("click", (e) => {
  if (!e.target.closest(".cell-controls-wrapper")) {
    closeAllCellMenus();
  }
  if (
    !e.target.closest("#optionsDropdown") &&
    !e.target.closest('button[onclick*="toggleOptionsDropdown"]')
  ) {
    const dropdown = document.getElementById("optionsDropdown");
    if (dropdown && !dropdown.classList.contains("hidden")) {
      dropdown.classList.add("hidden");
      document.querySelector(".export-button").setAttribute("aria-expanded", "false");
    }
  }
  if (!e.target.closest(".color-dropdown-container")) {
    document.getElementById("textColorMenu").classList.add("hidden");
    document.getElementById("bgColorMenu").classList.add("hidden");
  }
});

// PL: Pasek nie powinien odbierać fokusu edytowanej komórce.
// EN: Keep the toolbar from stealing focus from the edited cell.
document.getElementById("toolbar").addEventListener("mousedown", function (e) {
  if (
    e.target.tagName !== "INPUT" &&
    e.target.tagName !== "SELECT" &&
    !e.target.closest("#settingsPanel")
  ) {
    e.preventDefault();
  }
});

// PL: Formatowanie tekstu i rozmiaru czcionki.
// EN: Text and font-size formatting.
function formatText(command, value = null) {
  restoreSelection();
  document.execCommand("styleWithCSS", false, true);
  document.execCommand(command, false, value);
  saveState(true);
}

function changeFontSize(delta) {
  const input = document.getElementById("fontSizeInput");
  let val = parseInt(input.value) || 11;
  val += delta;
  if (val < 1) val = 1;
  if (val > 72) val = 72;
  input.value = val;
  applyExactFontSize(val);
}

function applyExactFontSize(sizePt) {
  restoreSelection();
  const sel = window.getSelection();

  if (sel.rangeCount > 0 && sel.getRangeAt(0).collapsed) {
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    span.innerHTML = "&#8203;";

    let parent = range.commonAncestorContainer;
    if (parent.nodeType === 3) parent = parent.parentNode;
    if (parent && parent.tagName === "SPAN") {
      span.style.cssText = parent.style.cssText;
    }

    span.style.fontSize = sizePt + "pt";

    range.insertNode(span);
    range.setStart(span.firstChild, 1);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    document.execCommand("styleWithCSS", false, false);
    document.execCommand("fontSize", false, "7");
    const fonts = document.querySelectorAll('font[size="7"]');
    fonts.forEach((font) => {
      font.removeAttribute("size");
      font.style.fontSize = sizePt + "pt";
    });
    document.execCommand("styleWithCSS", false, true);
  }
  saveState(true);
}

// PL: Łączenie i dzielenie komórek. EN: Merge and split cells.
async function mergeCellDown(btn) {
  const cell = cellForMenuAction(btn);
  clearAutoBreaks();
  const col = parseInt(cell.dataset.col);
  const row = parseInt(cell.dataset.row);
  const rowspan = parseInt(cell.getAttribute("rowspan") || 1);
  const targetRow = row + rowspan;

  if (targetRow >= times.length) {
    updateAutoBreaks();
    return;
  }

  const targetCell = getCell(targetRow, col);
  if (!targetCell || targetCell.style.display === "none") {
    updateAutoBreaks();
    return;
  }

  const targetContent = targetCell
    .querySelector(".cell-content")
    .innerText.split("\u200B")
    .join("")
    .trim();
  if (targetContent !== "") {
    const confirm = await showModal("Komórka poniżej zawiera tekst. Zastąpić go?");
    if (!confirm) {
      updateAutoBreaks();
      return;
    }
  }

  cell.setAttribute("rowspan", rowspan + parseInt(targetCell.getAttribute("rowspan") || 1));
  targetCell.style.display = "none";
  saveState(true);
}

async function mergeCellUp(btn) {
  const cell = cellForMenuAction(btn);
  clearAutoBreaks();
  const col = parseInt(cell.dataset.col);
  const row = parseInt(cell.dataset.row);

  if (row === 0) {
    updateAutoBreaks();
    return;
  }

  let targetRow = row - 1;
  let targetCell = getCell(targetRow, col);

  while (targetCell && targetCell.style.display === "none" && targetRow > 0) {
    targetRow--;
    targetCell = getCell(targetRow, col);
  }

  if (!targetCell || targetCell.style.display === "none") {
    updateAutoBreaks();
    return;
  }

  const currentContent = cell
    .querySelector(".cell-content")
    .innerText.split("\u200B")
    .join("")
    .trim();
  if (currentContent !== "") {
    const confirm = await showModal(
      "Twoja obecna komórka zawiera tekst, który zniknie po podłączeniu w górę. Kontynuować?",
    );
    if (!confirm) {
      updateAutoBreaks();
      return;
    }
  }

  const currentSpan = parseInt(cell.getAttribute("rowspan") || 1);
  const targetSpan = parseInt(targetCell.getAttribute("rowspan") || 1);

  targetCell.setAttribute("rowspan", targetSpan + currentSpan);
  cell.style.display = "none";
  saveState(true);
}

function resetCellSpan(btn) {
  const cell = cellForMenuAction(btn);
  clearAutoBreaks();
  const rowspan = parseInt(cell.getAttribute("rowspan") || 1);
  if (rowspan === 1) {
    updateAutoBreaks();
    return;
  }

  const row = parseInt(cell.dataset.row);
  const col = parseInt(cell.dataset.col);

  cell.setAttribute("rowspan", 1);

  for (let i = 1; i < rowspan; i++) {
    const hiddenCell = getCell(row + i, col);
    if (hiddenCell) hiddenCell.style.display = "";
  }
  saveState(true);
}

function toggleThickBorder(btn) {
  const cell = cellForMenuAction(btn);
  clearAutoBreaks();
  cell.classList.toggle("thick-border");
  if (!cell.classList.contains("thick-border"))
    cell.classList.remove("nb-top", "nb-bottom", "nb-left", "nb-right");
  closeAllCellMenus();
  saveState(true);
}

function splitCellHorizontal(btn) {
  splitCellOnce(btn, "horizontal");
}
function splitCellVertical(btn) {
  splitCellOnce(btn, "vertical");
}
function splitCellOnce(btn, direction) {
  const cell = cellForMenuAction(btn);
  clearAutoBreaks();
  const contentDiv = cell.querySelector(".cell-content");
  if (!contentDiv || contentDiv.querySelector(".split-wrap")) {
    updateAutoBreaks();
    return;
  }
  const first = document.createElement("div");
  first.className = "cell-part";
  first.innerHTML = contentDiv.innerHTML;
  const second = document.createElement("div");
  second.className = "cell-part";
  second.innerHTML = "<br>";
  const split = document.createElement("div");
  split.className = "split-wrap " + direction;
  split.style.display = "flex";
  if (direction === "vertical") split.style.flexDirection = "column";
  split.append(first, second);
  contentDiv.replaceChildren(split);
  closeAllCellMenus();
  saveState(true);
}

function getCell(row, col) {
  const tr = tbody.children[row];
  if (!tr) return null;
  return tr.querySelector(`td[data-col="${col}"]`);
}

// PL: PRZERWA jest wyliczana z pustych pól i nie trafia do zapisanej treści.
// EN: BREAK is derived from empty cells and is not stored as cell content.
function clearAutoBreaksIn(root) {
  root.querySelectorAll(".auto-break").forEach((cell) => {
    cell.classList.remove("auto-break");
    cell.removeAttribute("colspan");
    cell.querySelector(".cell-content").innerHTML = "<br>";
  });
  root.querySelectorAll("[data-auto-hidden]").forEach((cell) => {
    cell.style.display = "";
    delete cell.dataset.autoHidden;
  });
}
function clearAutoBreaks() {
  clearAutoBreaksIn(tbody);
}
function breakCellAtPointer(cell, pointerX) {
  if (!cell.classList.contains("auto-break")) return cell;
  const rect = cell.getBoundingClientRect();
  const fraction = Math.min(0.999, Math.max(0, (pointerX - rect.left) / Math.max(1, rect.width)));
  return getCell(3, Number(cell.dataset.col) + Math.floor(fraction * cell.colSpan));
}
function cellForMenuAction(btn) {
  const cell = btn.closest("td");
  if (!cell.classList.contains("auto-break")) return cell;
  const choice = cell.querySelector(".break-day-select")?.value;
  return getCell(3, Number(choice ?? cell.dataset.col)) || cell;
}
function breakCellAvailable(cell) {
  if (!cell || cell.style.display === "none" || cell.rowSpan !== 1 || cell.colSpan !== 1)
    return false;
  if (cell.querySelector(".split-wrap")) return false;
  return !cell
    .querySelector(".cell-content")
    .textContent.replace(/\u200B/g, "")
    .trim();
}
function updateAutoBreaks() {
  clearAutoBreaks();
  let start = -1;
  const addGroup = (end) => {
    if (start < 0) return;
    const first = getCell(3, start);
    first.classList.add("auto-break");
    first.colSpan = end - start;
    first.querySelector(".cell-content").textContent = "PRZERWA";
    for (let col = start + 1; col < end; col++) {
      const cell = getCell(3, col);
      cell.dataset.autoHidden = "1";
      cell.style.display = "none";
    }
    start = -1;
  };
  for (let col = 0; col <= days; col++) {
    const available = col < days && breakCellAvailable(getCell(3, col));
    if (available && start < 0) start = col;
    if (!available) addGroup(col);
  }
}

// PL: Przeciąganie nagłówków dokumentu. EN: Document-header drag and drop.
const headerZone = document.getElementById("header-zone");
let activeDragElement = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

document.addEventListener("mousedown", (e) => {
  const handle = e.target.closest(".drag-handle");
  if (!handle || !settings.moveHeaders || mode === "view") return;

  isDragging = true;
  activeDragElement = handle.closest(".draggable-header");

  const rect = activeDragElement.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;

  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if (!isDragging || !activeDragElement) return;

  const parentRect = headerZone.getBoundingClientRect();

  let newX = e.clientX - parentRect.left - dragOffsetX;
  let newY = e.clientY - parentRect.top - dragOffsetY;

  const elWidth = activeDragElement.offsetWidth;

  if (newX < 0) newX = 0;
  if (newX + elWidth > parentRect.width) newX = parentRect.width - elWidth;
  if (newY < 0) newY = 0;
  if (newY > 300) newY = 300;

  activeDragElement.style.left = "auto";
  activeDragElement.style.right = "auto";
  activeDragElement.style.left = newX + "px";
  activeDragElement.style.top = newY + "px";

  updateHeaderZoneHeight();
});

document.addEventListener("mouseup", () => {
  if (isDragging) saveState(true);
  isDragging = false;
  activeDragElement = null;
});

function updateHeaderZoneHeight() {
  if (!settings.moveHeaders) {
    headerZone.style.minHeight = "";
    return;
  }
  const maxBottom = Math.max(
    ...[...headerZone.querySelectorAll(".draggable-header")].map(
      (el) => (parseInt(el.style.top, 10) || 0) + el.offsetHeight,
    ),
  );

  headerZone.style.minHeight = maxBottom + 10 + "px";
}

// PL: Wspólny dialog potwierdzenia. EN: Shared confirmation dialog.
function showModal(message, isInfo = false) {
  return new Promise((resolve) => {
    const modal = document.getElementById("customModal");
    const modalText = document.getElementById("modalText");
    const btnYes = document.getElementById("modalBtnYes");
    const btnNo = document.getElementById("modalBtnNo");
    const modalIcon = document.getElementById("modalIcon");
    const previousFocus = document.activeElement;

    modalText.innerText = message;

    if (isInfo) {
      btnNo.style.display = "none";
      btnYes.innerText = "OK";
      modalIcon.className = "fas fa-info-circle text-blue-500 text-3xl mb-3";
    } else {
      btnNo.style.display = "inline-block";
      btnYes.innerText = "Tak";
      modalIcon.className = "fas fa-exclamation-triangle text-yellow-500 text-3xl mb-3";
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    const cleanup = () => {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      modal.removeEventListener("keydown", onKeydown);
      btnYes.replaceWith(btnYes.cloneNode(true));
      btnNo.replaceWith(btnNo.cloneNode(true));
      if (previousFocus?.isConnected) previousFocus.focus();
    };

    const onKeydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
        resolve(false);
      } else if (e.key === "Tab") {
        const first = isInfo ? btnYes : btnNo;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          btnYes.focus();
        } else if (!e.shiftKey && document.activeElement === btnYes) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    modal.addEventListener("keydown", onKeydown);
    btnYes.focus();

    document.getElementById("modalBtnYes").addEventListener("click", () => {
      cleanup();
      resolve(true);
    });

    document.getElementById("modalBtnNo").addEventListener("click", () => {
      cleanup();
      resolve(false);
    });
  });
}

function confirmClear() {
  document.getElementById("resetProfile").checked = false;
  document.getElementById("resetModal").classList.replace("hidden", "flex");
}
function closeReset() {
  document.getElementById("resetModal").classList.replace("flex", "hidden");
}
function performReset() {
  const eraseProfile = document.getElementById("resetProfile").checked;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(WEEKS_KEY);
  localStorage.removeItem(PREVIOUS_WEEKS_KEY);
  localStorage.removeItem(OLDER_WEEKS_KEY);
  localStorage.removeItem(V06_WEEKS_KEY);
  if (eraseProfile) {
    localStorage.removeItem(PROFILE_KEY);
    location.reload();
    return;
  }
  omuState = { enabled: false, entries: [] };
  initTable();
  currentWeek = "common";
  weekMode = false;
  parityUsed = false;
  document.getElementById("weekLabelText").textContent = "Plan tygodniowy";
  weekStates.common = snapshotState();
  weekStates.even = structuredClone(weekStates.common);
  weekStates.odd = structuredClone(weekStates.common);
  updateWeekUI();
  history = [JSON.stringify(weekStates.common)];
  historyIndex = 0;
  persistWeeks();
  closeReset();
  setMode("edit");
}

// PL: Dopasowanie tekstu do strony (autofit). Gdy treść przekracza stałe
// wymiary A4, czcionki są proporcjonalnie zmniejszane aż do uzyskania jednej
// strony. Po zwolnieniu miejsca wraca skala 100%.
// EN: Text-to-page autofit. When content exceeds the fixed A4 dimensions,
// fonts are reduced proportionally until everything fits on one page. The
// scale returns to 100% when enough room becomes available.
const AUTOFIT_MIN_SCALE = 0.5;
let autofitTimer = null;
let exportInProgress = false;

let layoutTimer = null;
let fitting = false;
function scheduleLayout() {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(() => {
    compactColumns();
    updateHeaderZoneHeight();
    scheduleAutofit();
  }, 40);
}
function scheduleAutofit() {
  if (exportInProgress || fitting) return;
  clearTimeout(autofitTimer);
  autofitTimer = setTimeout(autoFitToPage, 80);
}
function compactColumns() {
  const cols = document.getElementById("dayColumns");
  const names = [...document.querySelectorAll("#scheduleTable thead th")].slice(1);
  const used = Array.from({ length: days }, (_, col) =>
    [...tbody.querySelectorAll(`td[data-col="${col}"]`)].some(
      (cell) =>
        !cell.classList.contains("auto-break") &&
        !!cell
          .querySelector(".cell-content")
          ?.textContent.replace(/\u200B/g, "")
          .trim(),
    ),
  );
  for (const entry of visibleOmuEntries()) used[entry.day] = true;
  const hasAny = used.some(Boolean);
  cols.replaceChildren();
  const timeCol = document.createElement("col");
  timeCol.style.width = "104px";
  cols.appendChild(timeCol);
  names.forEach((th, i) => {
    const col = document.createElement("col");
    if (settings.compactDays && hasAny && !used[i]) {
      const name = th.querySelector("[contenteditable]");
      const probe = document.createElement("span");
      const style = getComputedStyle(name || th);
      probe.style.cssText =
        "position:fixed;visibility:hidden;white-space:nowrap;pointer-events:none";
      probe.style.font = style.font;
      probe.textContent = name?.textContent || "";
      document.body.appendChild(probe);
      col.style.width = Math.ceil(Math.max(78, probe.getBoundingClientRect().width + 22)) + "px";
      probe.remove();
    }
    cols.appendChild(col);
  });
  document
    .querySelectorAll(".omu-table colgroup")
    .forEach((group) => (group.innerHTML = cols.innerHTML));
}

// PL: Zachowaj ręcznie ustawione rozmiary jako wartości bazowe skali 100%,
// aby autofit mógł je zmniejszać i później wiernie przywracać.
// EN: Preserve manually selected sizes as the 100% scale baseline so autofit
// can reduce them and later restore them accurately.
function captureOriginalFontSizes() {
  document.querySelectorAll('#scheduleBody [style*="font-size"]').forEach((el) => {
    if (!el.dataset.origFs) el.dataset.origFs = el.style.fontSize;
  });
}

function applyAutofitScale(scale) {
  document.documentElement.style.setProperty("--autofit-scale", scale.toFixed(3));
  document.querySelectorAll("#scheduleBody [data-orig-fs]").forEach((el) => {
    const orig = parseFloat(el.dataset.origFs);
    if (!isNaN(orig)) el.style.fontSize = (orig * scale).toFixed(2) + "pt";
  });
}

function sheetOverflows() {
  const sheet = document.getElementById("a4-sheet");
  return sheet.scrollHeight > sheet.clientHeight + 1;
}

function fitsAtScale(scale) {
  applyAutofitScale(scale);
  return !sheetOverflows();
}

function autoFitToPage() {
  if (exportInProgress || fitting) return;
  fitting = true;
  captureOriginalFontSizes();

  if (fitsAtScale(1)) {
    updateAutofitBadge(1, false);
    fitting = false;
    return;
  }

  if (!fitsAtScale(AUTOFIT_MIN_SCALE)) {
    updateAutofitBadge(AUTOFIT_MIN_SCALE, true);
    fitting = false;
    return;
  }

  let lo = AUTOFIT_MIN_SCALE,
    hi = 1;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    if (fitsAtScale(mid)) lo = mid;
    else hi = mid;
  }
  fitsAtScale(lo);
  updateAutofitBadge(lo, false);
  fitting = false;
}

function updateAutofitBadge(scale, stillOverflows) {
  document.documentElement.dataset.a4Fit = stillOverflows
    ? "overflow"
    : Math.round(scale * 100).toString();
}
