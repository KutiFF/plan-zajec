// PL: Interfejs ma osobny motyw; dokument A4 nie korzysta z tych tokenów.
// EN: The interface has its own theme; the A4 document does not use these tokens.
const APP_THEME_KEY = "planZajecAppThemeV09";
const systemTheme = window.matchMedia?.("(prefers-color-scheme: dark)");
function applyAppTheme() {
  let chosen = "system";
  try {
    chosen = localStorage.getItem(APP_THEME_KEY) || "system";
  } catch (e) {}
  if (!["system", "light", "dark"].includes(chosen)) chosen = "system";
  document.documentElement.dataset.theme =
    chosen === "system" ? (systemTheme?.matches ? "dark" : "light") : chosen;
  document.getElementById("appTheme").value = chosen;
  document.getElementById("settingTheme").value = chosen;
}
function setAppTheme(chosen) {
  if (!["system", "light", "dark"].includes(chosen)) return;
  try {
    localStorage.setItem(APP_THEME_KEY, chosen);
  } catch (e) {}
  applyAppTheme();
}
systemTheme?.addEventListener?.("change", applyAppTheme);

// PL: Skala dotyczy tylko podglądu; druk zawsze używa arkusza 297 × 210 mm.
// EN: Scaling affects only the preview; printing always uses a 297 × 210 mm sheet.
let previewZoom = null;
function resizePreview() {
  const scroll = document.getElementById("previewScroll"),
    sheet = document.getElementById("a4-sheet"),
    stage = document.getElementById("previewStage");
  if (!scroll || !sheet || !stage) return;
  const available = scroll.clientWidth;
  if (!available) return;
  const upper = window.innerWidth >= 2400 ? 1.55 : window.innerWidth >= 1850 ? 1.2 : 1;
  const fit = Math.min(upper, Math.max(0.25, (available - 2) / sheet.offsetWidth));
  const zoom = previewZoom === null ? fit : previewZoom;
  sheet.style.transform = `scale(${zoom})`;
  stage.style.width = Math.ceil(sheet.offsetWidth * zoom) + "px";
  stage.style.height = Math.ceil(sheet.offsetHeight * zoom) + "px";
  document.getElementById("previewZoomText").textContent =
    previewZoom === null ? "Dopasuj" : Math.round(zoom * 100) + "%";
  requestAnimationFrame(syncPreviewScrollbars);
}
function syncPreviewScrollbars() {
  const scroll = document.getElementById("previewScroll"),
    top = document.getElementById("previewTopScroll"),
    track = document.getElementById("previewTopScrollTrack");
  if (!scroll || !top || !track) return;
  track.style.width = scroll.scrollWidth + "px";
  top.classList.toggle("hidden", scroll.scrollWidth <= scroll.clientWidth + 1);
  top.scrollLeft = scroll.scrollLeft;
}
function changePreviewZoom(delta) {
  const sheet = document.getElementById("a4-sheet"),
    scroll = document.getElementById("previewScroll");
  const upper = window.innerWidth >= 2400 ? 1.55 : window.innerWidth >= 1850 ? 1.2 : 1;
  const fit = Math.min(upper, Math.max(0.25, (scroll.clientWidth - 2) / sheet.offsetWidth));
  previewZoom = Math.max(
    0.3,
    Math.min(1.8, Math.round(((previewZoom ?? fit) + delta) * 100) / 100),
  );
  resizePreview();
}
function fitPreviewZoom() {
  previewZoom = null;
  resizePreview();
}
let mobileA4ReturnMode = "edit",
  mobileA4ReturnWeek = null;
function openMobileDocumentPreview() {
  mobileA4ReturnMode = mode;
  mobileA4ReturnWeek = mode === "edit" ? currentWeek : null;
  document.getElementById("optionsDropdown").classList.add("hidden");
  document.querySelector(".export-button").setAttribute("aria-expanded", "false");
  if (mode !== "view") setMode("view");
  toggleMobilePreview(true);
}
function toggleMobilePreview(open, nextMode = null) {
  const wasOpen = document.body.classList.contains("mobile-previewing");
  document.body.classList.toggle("mobile-previewing", !!open);
  if (!open && (nextMode || wasOpen)) {
    setMode(nextMode || mobileA4ReturnMode);
    if (mode === "edit" && mobileA4ReturnWeek && weekMode && currentWeek !== mobileA4ReturnWeek)
      switchWeek(mobileA4ReturnWeek);
    mobileA4ReturnWeek = null;
  }
  syncResponsiveClass();
  if (open) requestAnimationFrame(resizePreview);
}
let mobileOverviewMode = "today",
  mobileOverviewTimer,
  expandedWeekKey = "",
  expandedPreviewDays = new Set();
function setMobileOverviewMode(next) {
  if (!["today", "week"].includes(next)) return;
  mobileOverviewMode = next;
  renderMobileOverview();
}
function browseMobileOverview(direction) {
  if (mobileOverviewMode === "week") browseWeek(direction);
  else setBrowseDate(localDateString(addDays(viewedDate(), Number(direction))));
}
function scheduleMobileOverview() {
  clearTimeout(mobileOverviewTimer);
  mobileOverviewTimer = setTimeout(renderMobileOverview, 0);
}
function scheduleCellForDay(row, day) {
  let cell = getCell(row, day);
  if (cell && cell.style.display !== "none") return cell;
  cell = [...(tbody.children[row]?.querySelectorAll("td[data-col]") || [])].find(
    (td) =>
      td.style.display !== "none" &&
      Number(td.dataset.col) <= day &&
      Number(td.dataset.col) + td.colSpan > day,
  );
  if (cell) return cell;
  for (let before = row - 1; before >= 0; before--) {
    const owner = [...tbody.children[before].querySelectorAll("td[data-col]")].find(
      (td) =>
        td.style.display !== "none" &&
        Number(td.dataset.col) <= day &&
        Number(td.dataset.col) + td.colSpan > day &&
        before + td.rowSpan > row,
    );
    if (owner) return owner;
  }
  return null;
}
function cellLessonsForDay(day) {
  const entries = [],
    seen = new Set();
  for (let row = 0; row < times.length; row++) {
    const cell = scheduleCellForDay(row, day);
    if (!cell || seen.has(cell)) continue;
    seen.add(cell);
    const startRow = Number(cell.dataset.row);
    const endRow = Math.min(times.length - 1, startRow + cell.rowSpan - 1);
    const start = times[startRow].split("-")[0],
      end = times[endRow].split("-")[1];
    if (cell.classList.contains("auto-break")) {
      if (settings.showBreaksInMobilePreview)
        entries.push({ start, end, subject: "Przerwa", isBreak: true });
      continue;
    }
    const parts = [...cell.querySelectorAll(".cell-part")];
    for (const part of parts.length
      ? parts
      : [cell.querySelector(".cell-content")].filter(Boolean)) {
      const blocks = [...part.querySelectorAll(".entry-block")];
      for (const block of blocks)
        entries.push({
          start,
          end,
          subject: block.querySelector(".entry-subject")?.textContent.trim() || "",
          type: [
            capitalizeLessonType(block.querySelector(".entry-meta")?.textContent),
            block.querySelector(".entry-group")?.textContent.trim() || "",
          ]
            .filter(Boolean)
            .join(" · "),
          teacher: block.querySelector(".entry-teacher")?.textContent.trim() || "",
          room: block.querySelector(".entry-room,.entry-room-alt")?.textContent.trim() || "",
          remote: block.dataset.remote === "1" || !!block.querySelector(".entry-remote"),
        });
      const manuals = [...part.querySelectorAll(".manual-entry")];
      if (manuals.length)
        manuals.forEach((item) => {
          const subject = item.textContent.replace(/\u200B/g, "").trim();
          if (subject) entries.push({ start, end, subject });
        });
      else if (!blocks.length) {
        const subject = part.textContent.replace(/\u200B/g, "").trim();
        if (subject) entries.push({ start, end, subject });
      }
    }
  }
  return entries;
}
function dayLessons(day, date) {
  if (day < 0 || day >= days) return [];
  const entries = cellLessonsForDay(day);
  const dateKey = localDateString(date);
  for (const entry of visibleOmuEntries(date)) {
    if (entry.day !== day) continue;
    const otherDate = !entryOccursOnDate(entry, dateKey);
    if (otherDate && !settings.showOmuAlwaysInView) continue;
    entries.push({
      start: entry.start,
      end: entry.end,
      subject: entry.subject,
      type: [
        `Moduł obszarowy · blok ${entry.block}`,
        entry.group ? `Grupa ${entry.group}` : "",
        entry.note,
      ]
        .filter(Boolean)
        .join(" · "),
      teacher: entry.teacher,
      room: entry.room,
      remote: entry.remote,
      otherDate,
    });
  }
  const actualEntries = entries.filter((entry) => !entry.isBreak && !entry.otherDate);
  const firstStart = actualEntries.length
    ? Math.min(...actualEntries.map((entry) => timeMinutes(entry.start)))
    : null;
  const lastEnd = actualEntries.length
    ? Math.max(...actualEntries.map((entry) => timeMinutes(entry.end)))
    : null;
  return entries
    .filter(
      (entry) =>
        !entry.isBreak ||
        (firstStart !== null &&
          timeMinutes(entry.start) >= firstStart &&
          timeMinutes(entry.end) <= lastEnd),
    )
    .sort(
      (a, b) =>
        timeMinutes(a.start) - timeMinutes(b.start) || timeMinutes(a.end) - timeMinutes(b.end),
    );
}
function mobileLessonCard(lesson, state) {
  const card = document.createElement("article");
  card.className =
    "mobile-lesson" + (lesson.isBreak ? " break" : "") + (state ? " " + state : "");
  const time = document.createElement("time");
  time.textContent = lesson.start.replace(".", ":") + "–" + lesson.end.replace(".", ":");
  const body = document.createElement("div");
  body.className = "mobile-lesson-body";
  const subject = document.createElement("strong");
  subject.textContent = lesson.subject;
  body.appendChild(subject);
  const line = (text, className = "") => {
    if (!text) return;
    const p = document.createElement("p");
    p.className = className;
    p.textContent = text;
    body.appendChild(p);
  };
  line(lesson.type, "mobile-lesson-kind");
  line(lesson.teacher);
  line(lesson.remote ? "Zdalnie" : lesson.room);
  if (lesson.otherDate)
    line("Moduł obszarowy · inny termin (pokazano wszystkie moduły)", "mobile-lesson-kind");
  if (state === "current")
    line(lesson.isBreak ? "Trwa teraz" : "Teraz", "mobile-lesson-kind");
  if (state === "next") line("Następne zajęcia", "mobile-lesson-kind");
  card.append(time, body);
  return card;
}
function remainingTimeText(minutes) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return (
    [hours ? `${hours} godz.` : "", rest ? `${rest} min` : ""].filter(Boolean).join(" ") ||
    "mniej niż minutę"
  );
}
function lessonDayTimeStatus(date, lessons, now = new Date()) {
  if (localDateString(date) !== localDateString(now)) return "";
  const actual = lessons.filter((lesson) => !lesson.isBreak && !lesson.otherDate);
  if (!actual.length) return "";
  const minutes = now.getHours() * 60 + now.getMinutes();
  const lastEnd = Math.max(...actual.map((lesson) => timeMinutes(lesson.end)));
  if (minutes >= lastEnd) return "Dzisiejsze zajęcia już się zakończyły.";
  const current = actual.find(
    (lesson) => minutes >= timeMinutes(lesson.start) && minutes < timeMinutes(lesson.end),
  );
  const next = actual.find((lesson) => timeMinutes(lesson.start) > minutes);
  const lead = current
    ? `Do końca zajęć: ${remainingTimeText(timeMinutes(current.end) - minutes)}`
    : next
      ? `Do następnych zajęć: ${remainingTimeText(timeMinutes(next.start) - minutes)}`
      : "";
  return [lead, `Do końca dnia zajęciowego: ${remainingTimeText(lastEnd - minutes)}`]
    .filter(Boolean)
    .join(" · ");
}
function setTimeStatus(element, text) {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("hidden", !text);
}
function updateDesktopTimeStatus(viewed, now = new Date()) {
  const element = document.getElementById("desktopTimeStatus");
  if (mode !== "view" || usesMobileLayout()) return setTimeStatus(element, "");
  const day = now.getDay() - 1;
  const text =
    day >= 0 && day < days ? lessonDayTimeStatus(viewed, dayLessons(day, now), now) : "";
  setTimeStatus(element, text);
}
function renderMobileOverview() {
  const root = document.getElementById("mobileOverviewList");
  if (!root || mode !== "view" || !usesMobileLayout()) return;
  const date = viewedDate(),
    today = new Date(),
    weekday = (date.getDay() + 6) % 7;
  const todayView = mobileOverviewMode === "today",
    todayKey = localDateString(today);
  root.replaceChildren();
  document.getElementById("mobileTodayTab").setAttribute("aria-selected", String(todayView));
  document.getElementById("mobileWeekTab").setAttribute("aria-selected", String(!todayView));
  document.getElementById("mobileTodayTab").textContent = "Dzisiaj";
  document.getElementById("mobileOverviewDatePicker").value = localDateString(date);
  const navButtons = document.querySelectorAll(".mobile-overview-nav button");
  navButtons[0].setAttribute("aria-label", todayView ? "Poprzedni dzień" : "Poprzedni tydzień");
  navButtons[1].setAttribute("aria-label", todayView ? "Następny dzień" : "Następny tydzień");
  const label = document.getElementById("mobileOverviewDate"),
    note = document.getElementById("mobileOverviewNote"),
    timeStatus = document.getElementById("mobileTimeStatus");
  const parity = weekMode
    ? ` · tydzień ${parityForDate(date) === "even" ? "parzysty" : "nieparzysty"}`
    : "";
  if (todayView) {
    label.textContent =
      polishDate(date) + " · " + new Intl.DateTimeFormat("pl-PL", { weekday: "long" }).format(date);
    note.textContent = weekRelativeText(date) + parity;
    const lessons = dayLessons(weekday, date),
      nowMinutes = today.getHours() * 60 + today.getMinutes();
    setTimeStatus(timeStatus, lessonDayTimeStatus(date, lessons, today));
    const sameDay = localDateString(date) === todayKey;
    const nextIndex = sameDay
      ? lessons.findIndex((item) => timeMinutes(item.start) > nowMinutes && !item.otherDate)
      : -1;
    if (!lessons.length) {
      const empty = document.createElement("div");
      empty.className = "mobile-empty";
      empty.textContent = "Brak zajęć w tym dniu. Sprawdź widok Tydzień albo wybierz inną datę.";
      root.appendChild(empty);
    }
    lessons.forEach((item, index) => {
      const start = timeMinutes(item.start),
        end = timeMinutes(item.end);
      const state =
        sameDay && !item.otherDate
          ? nowMinutes >= start && nowMinutes < end
            ? "current"
            : index === nextIndex
              ? "next"
              : nowMinutes >= end
                ? "past"
                : ""
          : "";
      root.appendChild(mobileLessonCard(item, state));
    });
    return;
  }
  const monday = mondayFor(date),
    weekKey = localDateString(monday);
  const realWeek = mondayFor(today);
  const todayDay = today.getDay() - 1;
  setTimeStatus(
    timeStatus,
    monday.getTime() === realWeek.getTime() && todayDay >= 0 && todayDay < days
      ? lessonDayTimeStatus(today, dayLessons(todayDay, today), today)
      : "",
  );
  label.textContent = `${polishDate(monday)} – ${polishDate(addDays(monday, 6))}`;
  note.textContent =
    (weekMode
      ? `Tydzień ${parityForDate(date) === "even" ? "parzysty" : "nieparzysty"}`
      : "Plan tygodniowy") +
    " · " +
    weekRelativeText(date).split(" · ")[1];
  const daysData = Array.from({ length: days }, (_, day) => ({
    day,
    date: addDays(monday, day),
    entries: dayLessons(day, addDays(monday, day)),
  }));
  if (expandedWeekKey !== weekKey) {
    expandedWeekKey = weekKey;
    const chosen =
      weekday < days ? weekday : (daysData.find((item) => item.entries.length)?.day ?? 0);
    expandedPreviewDays = new Set([chosen]);
  }
  for (const item of daysData) {
    const section = document.createElement("details");
    section.className =
      "mobile-week-day" + (localDateString(item.date) === todayKey ? " today" : "");
    section.open = expandedPreviewDays.has(item.day);
    const summary = document.createElement("summary"),
      title = document.createElement("strong"),
      meta = document.createElement("span");
    title.textContent =
      dayNames[item.day] +
      " · " +
      new Intl.DateTimeFormat("pl-PL", {
        day: "numeric",
        month: "short",
      }).format(item.date);
    const count = item.entries.filter((entry) => !entry.isBreak).length;
    meta.textContent = count
      ? `${count} ${count === 1 ? "wpis" : count < 5 ? "wpisy" : "wpisów"} · ${item.entries[0].start}–${item.entries.at(-1).end}`
      : "Wolne";
    summary.append(title, meta);
    section.appendChild(summary);
    const list = document.createElement("div");
    list.className = "mobile-overview-list";
    if (!count) {
      const empty = document.createElement("div");
      empty.className = "mobile-empty";
      empty.textContent = "Bez zajęć";
      list.appendChild(empty);
    } else
      item.entries.forEach((entry) => {
        const sameDay = localDateString(item.date) === todayKey;
        const nowMinutes = today.getHours() * 60 + today.getMinutes();
        const current =
          sameDay &&
          !entry.otherDate &&
          nowMinutes >= timeMinutes(entry.start) &&
          nowMinutes < timeMinutes(entry.end);
        list.appendChild(mobileLessonCard(entry, current ? "current" : ""));
      });
    section.appendChild(list);
    section.addEventListener("toggle", () => {
      if (section.open) expandedPreviewDays.add(item.day);
      else expandedPreviewDays.delete(item.day);
    });
    root.appendChild(section);
  }
}
const MOBILE_BREAK_NOTICE_KEY = "planZajecMobileBreakNoticeV13";
function maybeShowMobileBreakNotice() {
  if (!usesMobileLayout() || window.innerWidth > 720) return;
  try {
    if (localStorage.getItem(MOBILE_BREAK_NOTICE_KEY)) return;
    localStorage.setItem(MOBILE_BREAK_NOTICE_KEY, "1");
  } catch (error) {}
  showModal(
    "Podgląd mobilny pokazuje przerwy pomiędzy zajęciami. Możesz je ukryć w Ustawieniach, wyłączając opcję „Pokazuj przerwy w podglądzie mobilnym”.",
    true,
  );
}
let mobileDay = Math.max(0, Math.min(4, new Date().getDay() - 1)),
  mobileTimer;
function scheduleMobileEntries() {
  clearTimeout(mobileTimer);
  mobileTimer = setTimeout(renderMobileEntries, 0);
}
function renderMobileEntries() {
  const tabs = document.getElementById("mobileDayTabs"),
    list = document.getElementById("mobileDayEntries");
  if (!tabs || !list || !tbody.rows.length) return;
  const names = ["Pon.", "Wt.", "Śr.", "Czw.", "Pt."];
  tabs.replaceChildren();
  list.replaceChildren();
  for (let day = 0; day < days; day++) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.textContent = names[day];
    tab.setAttribute("aria-selected", String(day === mobileDay));
    tab.setAttribute("aria-label", ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek"][day]);
    tab.onclick = () => {
      mobileDay = day;
      renderMobileEntries();
    };
    tabs.appendChild(tab);
  }
  for (let row = 0; row < times.length; row++) {
    const cell = scheduleCellForDay(row, mobileDay);
    const content = cell?.querySelector(".cell-content");
    const isBreak = !!cell?.classList.contains("auto-break");
    const text = isBreak ? "" : content?.textContent?.replace(/\u200B/g, "").trim() || "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mobile-entry" + (text ? "" : " empty") + (isBreak ? " break-entry" : "");
    const time = document.createElement("span");
    time.className = "entry-time";
    time.textContent = times[row].replace("-", "–");
    const summary = document.createElement("span");
    summary.className = "entry-summary";
    const subjects = [
      ...(cell?.querySelectorAll(".entry-block .entry-subject,.manual-entry") || []),
    ]
      .map((el) => el.textContent.trim())
      .filter(Boolean);
    summary.textContent = subjects.length
      ? subjects.join(" · ")
      : text || (row === 3 ? "Przerwa" : "Dodaj zajęcia");
    if (subjects.length === 1) {
      const teacher = cell.querySelector(".entry-block .entry-teacher")?.textContent.trim();
      const place = cell
        .querySelector(".entry-block .entry-remote,.entry-block .entry-room")
        ?.textContent.trim();
      const group = cell.querySelector(".entry-block .entry-group")?.textContent.trim();
      const detail = [group, teacher, place].filter(Boolean).join(" · ");
      if (detail) {
        const small = document.createElement("small");
        small.textContent = detail;
        summary.appendChild(small);
      }
    }
    button.append(time, summary);
    button.setAttribute("aria-label", time.textContent + ": " + summary.textContent);
    button.onclick = () => {
      let target = getCell(row, mobileDay);
      if (scheduleCellForDay(row, mobileDay)?.classList.contains("auto-break")) clearAutoBreaks();
      target = scheduleCellForDay(row, mobileDay);
      if (!target) return;
      activeCell = target;
      activePart = null;
      openEntryModal(
        null,
        target.querySelector(".cell-part") || target.querySelector(".cell-content"),
      );
    };
    list.appendChild(button);
  }
}

function registerOfflineShell() {
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker
    .register(new URL("./service-worker.js", location.href), { scope: "./" })
    .catch(() => {});
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("versionFooter").textContent =
    `Twój plan zajęć · wersja ${APP_VERSION} · 🤖 Vibe coding`;
  applyAppTheme();
  initSettings();
  loadState();
  document.getElementById("entrySubject").addEventListener("input", updateSubjectColorFields);
  document.getElementById("entryType").addEventListener("input", () => {
    updateSubjectColorFields();
    updateEntryGroupField();
  });
  setMode(settings.defaultMode === "edit" ? "edit" : hasPlanData() ? "view" : "edit");
  const profile = readProfile();
  if (!profile?.done) {
    if (hasPlanData()) localStorage.setItem(PROFILE_KEY, JSON.stringify({ done: true }));
    else openWelcome();
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshTemporalView();
  });
  setInterval(refreshTemporalView, 60000);
  window.addEventListener("resize", scheduleLayout);
  window.addEventListener("resize", resizePreview);
  syncResponsiveClass();
  if (readProfile()?.done) maybeShowTabletLayoutNotice();
  window.addEventListener("resize", syncResponsiveClass);
  if (window.ResizeObserver)
    new ResizeObserver(resizePreview).observe(document.getElementById("previewScroll"));
  const previewScroll = document.getElementById("previewScroll"),
    previewTopScroll = document.getElementById("previewTopScroll");
  previewScroll.addEventListener(
    "scroll",
    () => {
      if (previewTopScroll.scrollLeft !== previewScroll.scrollLeft)
        previewTopScroll.scrollLeft = previewScroll.scrollLeft;
    },
    { passive: true },
  );
  previewTopScroll.addEventListener(
    "scroll",
    () => {
      if (previewScroll.scrollLeft !== previewTopScroll.scrollLeft)
        previewScroll.scrollLeft = previewTopScroll.scrollLeft;
    },
    { passive: true },
  );
  if (document.fonts?.ready) document.fonts.ready.then(scheduleLayout);
  scheduleLayout();
  renderMobileEntries();
  requestAnimationFrame(resizePreview);
  registerOfflineShell();
});
