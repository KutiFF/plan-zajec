/*
 * PL: Obsługa formatowania tekstu: kolor, wyróżnienie i rozmiar czcionki.
 * Funkcje zachowują zaznaczenie podczas korzystania z paska narzędzi.
 * EN: Text formatting support: color, highlight, and font size.
 * These functions preserve the selection while the toolbar is being used.
 */

const ZWSP = "\u200B";
let savedHost = null; // PL: Ostatnie pole edycji. EN: Last editable host.
let pendingFormat = null; // PL: Format dla kolejnego tekstu. EN: Format for new text.
let pendingBusy = false;

/* PL: Funkcje pomocnicze. EN: Helper functions. */

function getEditableHost(node) {
  if (!node) return null;
  let el = node.nodeType === 3 ? node.parentNode : node;
  while (el && el !== document.body) {
    if (el.getAttribute && el.getAttribute("contenteditable") === "true") return el;
    el = el.parentNode;
  }
  return null;
}

function isEmptyHost(host) {
  return host.textContent.split(ZWSP).join("").trim() === "";
}

/* PL: Zapisywanie i przywracanie zaznaczenia wraz z fokusem.
 * EN: Save and restore the selection together with focus. */

function saveSelection() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const sheet = document.getElementById("a4-sheet");
  if (!sheet || !sheet.contains(range.commonAncestorContainer)) return;
  // PL: Klon nie znika po kliknięciu palety. EN: A clone survives palette clicks.
  savedRange = range.cloneRange();
  savedHost = getEditableHost(range.startContainer);
}

function restoreSelection() {
  if (!savedRange || !document.contains(savedRange.startContainer)) return false;
  if (savedHost && document.activeElement !== savedHost) {
    try {
      savedHost.focus({ preventScroll: true });
    } catch (e) {
      savedHost.focus();
    }
  }
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRange);
  return true;
}

document.addEventListener("selectionchange", () => {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const sheet = document.getElementById("a4-sheet");
  if (!sheet || !sheet.contains(range.commonAncestorContainer)) return;
  savedRange = range.cloneRange();
  savedHost = getEditableHost(range.startContainer);
  updateToolbarFromSelection(range.startContainer);
  applyPendingAtCaret();
});

/* PL: Pasek pokazuje format spod kursora. EN: Show caret formatting in the toolbar. */

function updateToolbarFromSelection(node) {
  if (!node) return;
  let el = node.nodeType === 3 ? node.parentNode : node;
  if (!el || !el.getAttribute) return;
  const host = getEditableHost(el);
  if (!host) return;

  const isCarrier = !!(el.dataset && el.dataset.fmt === "1");
  // PL: Istniejący tekst przejmuje kontrolę nad stanem paska.
  // EN: Existing text becomes the source of the toolbar state.
  if (!isCarrier && !isEmptyHost(host)) pendingFormat = null;

  const style = window.getComputedStyle(el);

  const pt = Math.round(parseFloat(style.fontSize) * 0.75);
  if (pt) document.getElementById("fontSizeInput").value = pt;

  if (style.color) {
    currentTextColor = style.color;
    document.getElementById("textColorIndicator").style.backgroundColor = style.color;
  }

  const bg = style.backgroundColor;
  const none = !bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)";
  currentBgColor = none ? "transparent" : bg;
  document.getElementById("bgColorIndicator").style.backgroundColor = none ? "transparent" : bg;
}

/* PL: Pusty nośnik przechowuje format dla nowo wpisywanego tekstu.
 * EN: An empty carrier stores formatting for newly typed text. */

function setPendingFormat(obj) {
  pendingFormat = Object.assign({}, pendingFormat || {}, obj);
}

function insertFormatCarrier() {
  const sel = window.getSelection();
  if (!sel.rangeCount || !pendingFormat) return;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return;
  const host = getEditableHost(range.startContainer);
  if (!host) return;

  let el =
    range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer;
  let span = el && el.dataset && el.dataset.fmt === "1" && el.textContent === ZWSP ? el : null;

  pendingBusy = true;
  if (!span) {
    span = document.createElement("span");
    span.dataset.fmt = "1";
    if (el && el.tagName === "SPAN" && el.style) span.style.cssText = el.style.cssText;
    span.appendChild(document.createTextNode(ZWSP));
    range.insertNode(span);
  }
  if (pendingFormat.color) span.style.color = pendingFormat.color;
  if (pendingFormat.fontSize) span.style.fontSize = pendingFormat.fontSize;
  if (Object.prototype.hasOwnProperty.call(pendingFormat, "backgroundColor")) {
    span.style.backgroundColor = pendingFormat.backgroundColor;
  }

  const r = document.createRange();
  r.setStart(span.firstChild, span.firstChild.length);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
  savedRange = r.cloneRange();
  savedHost = host;
  pendingBusy = false;
}

// PL: Wybrany format obowiązuje również w kolejnej pustej komórce.
// EN: The selected format also applies in the next empty cell.
function applyPendingAtCaret() {
  if (!pendingFormat || pendingBusy) return;
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return;
  const host = getEditableHost(range.startContainer);
  if (!host || !isEmptyHost(host)) return;
  const el =
    range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer;
  if (el && el.dataset && el.dataset.fmt === "1") return;
  insertFormatCarrier();
}

/* PL: Kolory tekstu i wyróżnienia. EN: Text and highlight colors. */

function toggleColorMenu(menuId) {
  saveSelection();
  const menu = document.getElementById(menuId);
  const isHidden = menu.classList.contains("hidden");
  document.getElementById("textColorMenu").classList.add("hidden");
  document.getElementById("bgColorMenu").classList.add("hidden");
  if (isHidden) menu.classList.remove("hidden");
}

function applyColor(event, command, value, indicatorId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  applyCurrentColor(command, indicatorId, value);
  document.getElementById("textColorMenu").classList.add("hidden");
  document.getElementById("bgColorMenu").classList.add("hidden");
}

function applyCurrentColor(command, indicatorId, forceValue = null) {
  const value = forceValue || (command === "foreColor" ? currentTextColor : currentBgColor);
  if (command === "foreColor") currentTextColor = value;
  else currentBgColor = value;
  document.getElementById(indicatorId).style.backgroundColor =
    value === "transparent" ? "transparent" : value;

  // PL: Paleta nie może odebrać fokusu komórce. EN: The palette must not steal cell focus.
  if (!restoreSelection()) return;

  const sel = window.getSelection();
  const range = sel.getRangeAt(0);

  if (range.collapsed) {
    setPendingFormat(
      command === "foreColor"
        ? { color: value }
        : { backgroundColor: value === "transparent" ? "" : value },
    );
    insertFormatCarrier();
  } else {
    document.execCommand("styleWithCSS", false, true);
    if (command === "foreColor") {
      document.execCommand("foreColor", false, value);
    } else if (value === "transparent") {
      clearHighlight(range);
    } else {
      document.execCommand("hiliteColor", false, value);
    }
    saveSelection();
  }
  saveState(true);
}

function clearHighlight(range) {
  const host =
    getEditableHost(range.commonAncestorContainer) || document.getElementById("a4-sheet");
  const hit = Array.prototype.slice.call(host.querySelectorAll("*")).filter((el) => {
    try {
      return range.intersectsNode(el);
    } catch (e) {
      return false;
    }
  });
  document.execCommand("hiliteColor", false, "transparent");
  hit.forEach((el) => {
    if (el.style) el.style.backgroundColor = "";
    if (el.hasAttribute && el.hasAttribute("bgcolor")) el.removeAttribute("bgcolor");
  });
}

/* PL: Pogrubienie, kursywa i podkreślenie. EN: Bold, italic, and underline. */

function formatText(command, value = null) {
  if (!restoreSelection()) return;
  document.execCommand("styleWithCSS", false, true);
  document.execCommand(command, false, value);
  saveSelection();
  saveState(true);
}

/* PL: Rozmiar czcionki. EN: Font size. */

function changeFontSize(delta) {
  const input = document.getElementById("fontSizeInput");
  let val = parseInt(input.value) || 11;
  val = Math.min(72, Math.max(1, val + delta));
  input.value = val;
  applyExactFontSize(val);
}

function applyExactFontSize(sizePt) {
  sizePt = parseInt(sizePt) || 11;
  sizePt = Math.min(72, Math.max(1, sizePt));
  document.getElementById("fontSizeInput").value = sizePt;

  if (!restoreSelection()) return;

  const sel = window.getSelection();
  const range = sel.getRangeAt(0);

  if (range.collapsed) {
    setPendingFormat({ fontSize: sizePt + "pt" });
    insertFormatCarrier();
  } else {
    document.execCommand("styleWithCSS", false, false);
    document.execCommand("fontSize", false, "7");
    document.querySelectorAll('font[size="7"]').forEach((font) => {
      font.removeAttribute("size");
      font.style.fontSize = sizePt + "pt";
    });
    document.execCommand("styleWithCSS", false, true);
    saveSelection();
  }
  saveState(true);
}

(function () {
  const input = document.getElementById("fontSizeInput");
  if (!input) return;
  input.addEventListener("focus", function () {
    this.select();
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      applyExactFontSize(this.value);
    }
  });
})();

/* PL: Usuwanie pustych nośników po wyjściu z komórki.
 * EN: Remove empty carriers after leaving a cell. */

document.getElementById("a4-sheet").addEventListener("focusout", (e) => {
  const next = e.relatedTarget;
  // PL: Przejście do paska lub palety nie kończy edycji.
  // EN: Moving to the toolbar or palette does not finish editing.
  if (!next || (next.closest && next.closest("#toolbar"))) return;
  const host = e.target;
  if (!host || !host.querySelectorAll) return;
  host.querySelectorAll('span[data-fmt="1"]').forEach((s) => {
    if (s.textContent === ZWSP) s.remove();
  });
  if (
    host.getAttribute &&
    host.getAttribute("contenteditable") === "true" &&
    host.innerHTML.trim() === ""
  ) {
    host.innerHTML = "<br>";
  }
});

/*
 * PL: Ramki komórek, cofanie podziału i ustawienia planu.
 * EN: Cell borders, split removal, and schedule settings.
 */

function closeAllCellMenus() {
  document.querySelectorAll(".cell-menu").forEach((m) => {
    m.classList.add("hidden");
    m.classList.remove("flex");
    m.closest(".cell-controls-wrapper").classList.remove("menu-open");
    m.closest(".cell-controls-wrapper")
      .querySelector(".cell-hamburger")
      .setAttribute("aria-expanded", "false");
  });
}
function toggleCellMenu(btn) {
  const wrapper = btn.closest(".cell-controls-wrapper");
  const menu = wrapper.querySelector(".cell-menu");
  const cell = wrapper.closest("td");
  const hidden = menu.classList.contains("hidden");
  closeAllCellMenus();
  if (!hidden) return;
  const thick = cell.classList.contains("thick-border");
  menu.querySelectorAll(".menu-if-thick").forEach((el) => {
    el.classList.toggle("hidden", !thick);
    el.classList.toggle("flex", thick);
  });
  const label = menu.querySelector(".border-action-label");
  if (label) label.textContent = thick ? "Usuń pogrubioną ramkę" : "Pogrub ramkę";
  const split = !!cell.querySelector(".split-wrap");
  menu.querySelectorAll(".menu-if-split").forEach((el) => el.classList.toggle("hidden", !split));
  menu.querySelectorAll(".menu-if-unsplit").forEach((el) => el.classList.toggle("hidden", split));
  menu
    .querySelectorAll(".menu-if-merged")
    .forEach((el) => el.classList.toggle("hidden", cell.rowSpan < 2));
  const breakPicker = menu.querySelector(".menu-if-autobreak");
  if (breakPicker) {
    const autoBreak = cell.classList.contains("auto-break");
    breakPicker.classList.toggle("hidden", !autoBreak);
    if (autoBreak) {
      const select = breakPicker.querySelector("select");
      select.replaceChildren();
      for (
        let col = Number(cell.dataset.col);
        col < Number(cell.dataset.col) + cell.colSpan;
        col++
      ) {
        const option = document.createElement("option");
        option.value = String(col);
        option.textContent =
          document
            .querySelectorAll("#scheduleTable thead th")
            [col + 1]?.querySelector("[contenteditable]")?.textContent || `Dzień ${col + 1}`;
        select.appendChild(option);
      }
    }
  }
  menu.querySelectorAll(".side-btn").forEach((b) => {
    const on = cell.classList.contains("nb-" + b.dataset.side);
    b.classList.toggle("bg-blue-100", on);
    b.classList.toggle("border-blue-400", on);
  });
  menu.classList.remove("hidden");
  menu.classList.add("flex");
  menu.style.top = "100%";
  menu.style.bottom = "auto";
  if (
    menu.getBoundingClientRect().bottom >
    document.getElementById("a4-sheet").getBoundingClientRect().bottom - 10
  ) {
    menu.style.top = "auto";
    menu.style.bottom = "100%";
  }
  wrapper.classList.add("menu-open");
  btn.setAttribute("aria-expanded", "true");
  // PL: Menu ma pozostać w oknie także przy dolnym wierszu.
  // EN: Keep the menu inside the viewport, including on the last row.
  menu.style.top = "";
  menu.style.bottom = "";
  if (menu.getBoundingClientRect().bottom > window.innerHeight - 8) {
    menu.style.top = "auto";
    menu.style.bottom = "100%";
  }
}
function toggleSide(btn, side) {
  const cell = cellForMenuAction(btn);
  clearAutoBreaks();
  if (!cell.classList.contains("thick-border")) {
    updateAutoBreaks();
    return;
  }
  cell.classList.toggle("nb-" + side);
  saveState(true);
  toggleCellMenu(btn.closest(".cell-controls-wrapper").querySelector(".cell-hamburger"));
}

function rowCellsOf(cell) {
  const tr = cell.closest("tr");
  return Array.prototype.slice.call(tr.children).filter((td) => td.style.display !== "none");
}

// PL: Jedna ramka wokół wiersza bez wewnętrznych pionowych linii.
// EN: One frame around the row without inner vertical lines.
function applyRowFrame(btn) {
  const cell = cellForMenuAction(btn);
  clearAutoBreaks();
  const cells = rowCellsOf(cell);
  cells.forEach((td, i) => {
    td.classList.add("thick-border");
    td.classList.remove("nb-left", "nb-right");
    if (i > 0) td.classList.add("nb-left");
    if (i < cells.length - 1) td.classList.add("nb-right");
  });
  saveState(true);
}

function resetRowFrame(btn) {
  const cell = cellForMenuAction(btn);
  clearAutoBreaks();
  rowCellsOf(cell).forEach((td) => td.classList.remove("nb-left", "nb-right"));
  saveState(true);
}

// PL: Ponowne scalenie podzielonej komórki. EN: Merge a split cell again.
function unsplitCell(btn) {
  const cell = cellForMenuAction(btn);
  clearAutoBreaks();
  const content = cell.querySelector(".cell-content");
  const parts = [...content.querySelectorAll(".split-wrap > .cell-part")];
  if (parts.length !== 2) {
    updateAutoBreaks();
    return;
  }
  content.innerHTML =
    parts
      .map((part) => part.innerHTML.trim())
      .filter((html) => html && html.toLowerCase() !== "<br>")
      .join("<br>") || "<br>";
  closeAllCellMenus();
  saveState(true);
}

let entryModalTarget = null;
let manualTarget = null;
function resolveEntryTarget(cell, preferred) {
  if (preferred && cell.contains(preferred) && preferred.classList.contains("cell-part"))
    return preferred;
  return cell.querySelector(".cell-part") || cell.querySelector(".cell-content");
}
function openQuickEntry() {
  if (mode === "view") return;
  const cell =
    activeCell && document.contains(activeCell) && activeCell.style.display !== "none"
      ? activeCell
      : getCell(0, 0);
  openEntryModal(null, resolveEntryTarget(cell, activePart));
}
function selectedPalette() {
  return document.querySelector('input[name="entrySubjectColor"]:checked')?.value || "auto";
}
function updateSubjectColorFields() {
  const palette = selectedPalette();
  document.getElementById("entrySubjectCustom").classList.toggle("hidden", palette !== "custom");
  const paletteTextColors = {
    auto: "#111827",
    none: "#111827",
    yellow: "#111827",
    cyan: "#111827",
    pink: "#111827",
    red: "#dc2626",
    custom: "#111827",
  };
  document.querySelectorAll('#entryPalette input[name="entrySubjectColor"]').forEach((input) => {
    const swatch = input.nextElementSibling;
    if (swatch) {
      const color = paletteTextColors[input.value] || "#111827";
      swatch.style.color = color;
      swatch.style.webkitTextFillColor = color;
    }
  });
  const preview = document.getElementById("subjectPreview");
  const kind = selectedSubjectStyle(document.getElementById("entryType").value, palette);
  const sample = document.createElement("span");
  sample.textContent =
    document.getElementById("entrySubject").value.trim() || "Podgląd nazwy przedmiotu";
  if (["yellow", "cyan", "pink", "red"].includes(kind)) sample.className = "subject-color-" + kind;
  if (kind === "red") sample.style.color = "#dc2626";
  else if (kind !== "custom") sample.style.color = "#111827";
  if (kind === "custom") {
    sample.style.backgroundColor = document.getElementById("entrySubjectBg").value;
    sample.style.color = document.getElementById("entrySubjectFg").value;
  }
  preview.replaceChildren(sample);
}
function parseTeacher(value) {
  let name = (value || "").trim().replace(/\s+/g, " ");
  const hadUniversity = /,?\s*prof\.?\s*UŚ\s*$/i.test(name);
  if (hadUniversity) name = name.replace(/,?\s*prof\.?\s*UŚ\s*$/i, "").trim();
  let prefix = "dr";
  const leading =
    /^(prof\.?\s*UŚ\s*dr\s*hab\.?|prof\.?\s*UŚ\s*dr\.?|prof\.?\s*dr\s*hab\.?|dr\s*hab\.?|prof\.?\s*UŚ|prof\.?|dr\.?|mgr\.?)\s+/i.exec(
      name,
    );
  if (leading) {
    prefix = leading[1]
      .replace(/\s+/g, " ")
      .replace(/^(dr|mgr|prof)(?=\s|$)/i, (m) => m.toLowerCase())
      .replace(/\bhab\.?/i, "hab.")
      .replace(/UŚ/i, "UŚ")
      .trim();
    name = name.slice(leading[0].length).trim();
  }
  if (hadUniversity && !/^prof\. UŚ/.test(prefix))
    prefix = "prof. UŚ " + (prefix === "dr" || prefix === "dr hab." ? prefix : "");
  prefix = prefix
    .trim()
    .replace(/^dr\.$/, "dr")
    .replace(/^mgr\.$/, "mgr")
    .replace(/^prof(?=\s|$)/, "prof.");
  return { prefix, name };
}
function formatTeacher(prefix, name) {
  const parsed = parseTeacher(name);
  const chosen = prefix === undefined ? parsed.prefix : prefix;
  return [chosen, parsed.name].filter(Boolean).join(" ").trim();
}
function updateTeacherPreview() {
  const name = document.getElementById("entryTeacher").value;
  document.getElementById("teacherPreview").textContent = name.trim()
    ? "W planie: " + formatTeacher(document.getElementById("entryTeacherPrefix").value, name)
    : "";
}
function updateRoomField() {
  const remote = document.getElementById("entryRemote").checked;
  const other = document.getElementById("entryAltPlace").checked;
  document.getElementById("entryPlaceFields").classList.toggle("hidden", remote);
  document.getElementById("entryRoomLabel").textContent = other
    ? "Adres / miejsce (opcjonalnie)"
    : "Numer sali lub aula (opcjonalnie)";
  document.getElementById("entryRoom").placeholder = other
    ? "np. Bankowa 11B, pokój 213"
    : "np. 147 lub Aula 1";
}
function typeUsesGroup(type) {
  return !/^\s*wykład\b/i.test(type || "");
}
function updateEntryGroupField() {
  const field = document.getElementById("entryGroupField");
  field.classList.toggle("hidden", !typeUsesGroup(document.getElementById("entryType").value));
}
function normalizeRoom(value, other = false) {
  const room = value.trim().replace(/\s+/g, " ");
  if (other) return room;
  if (/^\d+[a-z]?(?:[\/-]\d+[a-z]?)?$/i.test(room)) return "Sala " + room;
  if (/^sala\s+/i.test(room)) return "Sala " + room.replace(/^sala\s+/i, "");
  if (/^aula(?:\s+|$)/i.test(room)) return "Aula" + room.slice(4);
  return room;
}
function openEntryModal(btn, preferred) {
  if (mode === "view") return;
  const cell = btn ? cellForMenuAction(btn) : preferred?.closest("td");
  if (!cell) return;
  if (btn?.closest("td")?.classList.contains("auto-break")) clearAutoBreaks();
  activeCell = cell;
  entryModalTarget = resolveEntryTarget(cell, preferred || activePart);
  closeAllCellMenus();
  const entry = entryModalTarget.querySelector(".entry-block");
  const fields = {
    entrySubject: ".entry-subject",
    entryType: ".entry-meta",
    entryGroup: ".entry-group",
    entryTeacher: ".entry-teacher",
    entryRoom: ".entry-room, .entry-room-alt",
  };
  for (const [id, selector] of Object.entries(fields))
    document.getElementById(id).value = entry?.querySelector(selector)?.textContent || "";
  const teacher = parseTeacher(document.getElementById("entryTeacher").value);
  const prefix = entry?.dataset.teacherPrefix ?? teacher.prefix;
  const prefixInput = document.getElementById("entryTeacherPrefix");
  prefixInput.value = [...prefixInput.options].some((option) => option.value === prefix)
    ? prefix
    : "dr";
  document.getElementById("entryTeacher").value = teacher.name;
  updateTeacherPreview();
  const other = !!entry?.querySelector(".entry-room-alt");
  document.getElementById("entryAltPlace").checked = other;
  if (!other)
    document.getElementById("entryRoom").value = document
      .getElementById("entryRoom")
      .value.replace(/^Sala\s+(?=\d)/i, "");
  document.getElementById("entryRemote").checked = entry
    ? entry.dataset.remote === "1" || !!entry.querySelector(".entry-remote")
    : document.querySelectorAll("#scheduleTable thead th")[Number(cell.dataset.col) + 1]?.dataset
        .remote === "1";
  updateRoomField();
  updateEntryGroupField();
  const palette = entry?.dataset.subjectColor || "auto";
  const radio = document.querySelector(
    `input[name="entrySubjectColor"][value="${["auto", "none", "yellow", "cyan", "pink", "red", "custom"].includes(palette) ? palette : "auto"}"]`,
  );
  radio.checked = true;
  document.getElementById("entrySubjectBg").value = entry?.dataset.subjectBg || "#fde047";
  document.getElementById("entrySubjectFg").value = entry?.dataset.subjectFg || "#111827";
  updateSubjectColorFields();
  document.getElementById("entryModalTitle").textContent = entry
    ? "Edytuj zajęcia"
    : "Dodaj zajęcia";
  const day =
    document
      .querySelectorAll("#scheduleTable thead th")
      [Number(cell.dataset.col) + 1]?.querySelector("[contenteditable]")
      ?.textContent.trim() || "";
  const week =
    currentWeek === "common"
      ? "co tydzień"
      : "tydzień " + (currentWeek === "even" ? "parzysty" : "nieparzysty");
  document.getElementById("entryTargetLabel").textContent =
    `${day} · ${times[Number(cell.dataset.row)]} · ${week}${entryModalTarget.classList.contains("cell-part") ? " · część " + ([...entryModalTarget.parentElement.children].indexOf(entryModalTarget) + 1) : ""}`;
  document.getElementById("entryModal").classList.replace("hidden", "flex");
  document.getElementById("entrySubject").focus();
}
function closeEntryModal() {
  document.getElementById("entryModal").classList.replace("flex", "hidden");
  updateAutoBreaks();
  if (activeCell && document.contains(activeCell)) activeCell.focus();
}
function escapeHtmlEntry(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
function capitalizeLessonType(value) {
  const text = String(value || "").trim();
  return text ? text.charAt(0).toLocaleUpperCase("pl-PL") + text.slice(1) : "";
}
function selectedSubjectStyle(type, palette) {
  if (palette !== "auto") return palette;
  if (/lektorat/i.test(type)) return "red";
  if (/ścieżka dydaktyczna|sciezka dydaktyczna/i.test(type)) return "yellow";
  return "none";
}
async function submitEntryModal() {
  const subject = document.getElementById("entrySubject").value.trim();
  const type = capitalizeLessonType(document.getElementById("entryType").value);
  const group = typeUsesGroup(type) ? document.getElementById("entryGroup").value.trim() : "";
  const teacherName = document.getElementById("entryTeacher").value.trim();
  const teacherPrefix = document.getElementById("entryTeacherPrefix").value;
  const teacher = formatTeacher(teacherPrefix, teacherName);
  const other = document.getElementById("entryAltPlace").checked;
  const remote = document.getElementById("entryRemote").checked;
  const room = remote ? "" : normalizeRoom(document.getElementById("entryRoom").value, other);
  const palette = selectedPalette();
  const bg = document.getElementById("entrySubjectBg").value;
  const fg = document.getElementById("entrySubjectFg").value;
  if (!subject || !teacherName) {
    showModal("Uzupełnij przedmiot oraz prowadzącego. Sala jest opcjonalna.", true);
    return;
  }
  if (!entryModalTarget || !document.contains(entryModalTarget)) {
    closeEntryModal();
    return;
  }
  const target = entryModalTarget;
  const hadEntry = !!target.querySelector(".entry-block");
  const generatedBreak = target.closest("td")?.classList.contains("auto-break");
  if (!hadEntry && !generatedBreak && target.textContent.replace(/\u200B/g, "").trim()) {
    const ok = await showModal("Zastąpić dotychczasową treść tej części komórki?");
    if (!ok) return;
  }
  if (generatedBreak) clearAutoBreaks();
  const kind = selectedSubjectStyle(type, palette);
  const validColor = /^#[0-9a-f]{6}$/i;
  const custom = kind === "custom" && validColor.test(bg) && validColor.test(fg);
  const subjectClass = ["yellow", "cyan", "pink", "red"].includes(kind)
    ? ` subject-color-${kind}`
    : "";
  const subjectStyle = custom ? ` style="background-color:${bg};color:${fg}"` : "";
  target.innerHTML =
    '<div class="entry-block" data-remote="' +
    (remote ? "1" : "0") +
    '" data-teacher-prefix="' +
    escapeHtmlEntry(teacherPrefix) +
    '" data-subject-color="' +
    escapeHtmlEntry(palette) +
    '"' +
    (custom ? ' data-subject-bg="' + bg + '" data-subject-fg="' + fg + '"' : "") +
    '><div class="entry-subject"><span class="' +
    subjectClass.trim() +
    '"' +
    subjectStyle +
    ">" +
    escapeHtmlEntry(subject) +
    "</span></div>" +
    (type ? '<div class="entry-meta">' + escapeHtmlEntry(type) + "</div>" : "") +
    (group ? '<div class="entry-group">Grupa ' + escapeHtmlEntry(group) + "</div>" : "") +
    '<div class="entry-teacher">' +
    escapeHtmlEntry(teacher) +
    "</div>" +
    (remote
      ? '<div class="entry-remote">ZDALNIE</div>'
      : room
        ? '<div class="entry-room' +
          (other ? " entry-room-alt" : "") +
          '">' +
          escapeHtmlEntry(room) +
          "</div>"
        : "") +
    "</div>";
  closeEntryModal();
  saveState(true);
}
function openManualModal(btn) {
  const cell = cellForMenuAction(btn);
  if (btn.closest("td").classList.contains("auto-break")) clearAutoBreaks();
  manualTarget = resolveEntryTarget(cell, activePart);
  activeCell = cell;
  closeAllCellMenus();
  document.getElementById("manualText").value = manualTarget.innerText
    .replace(/\u200B/g, "")
    .trim();
  document.getElementById("manualModal").classList.replace("hidden", "flex");
  document.getElementById("manualText").focus();
}
function closeManualModal() {
  document.getElementById("manualModal").classList.replace("flex", "hidden");
  updateAutoBreaks();
  if (activeCell && document.contains(activeCell)) activeCell.focus();
}
function saveManualEdit() {
  if (!manualTarget || !document.contains(manualTarget)) return closeManualModal();
  if (manualTarget.closest("td")?.classList.contains("auto-break")) clearAutoBreaks();
  const text = document.getElementById("manualText").value;
  manualTarget.innerHTML = text
    ? '<div class="manual-entry">' + escapeHtmlEntry(text) + "</div>"
    : "<br>";
  closeManualModal();
  saveState(true);
}
function clearCellFormatting(btn) {
  const cell = cellForMenuAction(btn);
  clearAutoBreaks();
  const target = resolveEntryTarget(cell, activePart);
  target.innerHTML = "<br>";
  closeAllCellMenus();
  saveState(true);
}
