"use strict";

const root = document.body.dataset.root || "";
const english = document.body.dataset.english === "true";
const search = document.querySelector("#grammar-search");

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fold(text) {
  return String(text).normalize("NFKC").toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/[〜~]/g, "").replace(/\s+/g, " ").trim();
}

function grammarCard(record) {
  const card = element("a", "grammar-card");
  card.href = root + record.path;
  const top = element("div", "card-top");
  for (const level of record.levels) top.append(element("span", "level " + level.toLowerCase(), level));
  const arrow = element("span", "card-arrow", "↗");
  arrow.setAttribute("aria-hidden", "true");
  top.append(arrow);
  const title = element("h3", "", record.expression);
  title.lang = "ja";
  const reading = element("p", "card-reading", record.reading);
  reading.lang = "ja";
  const footer = element("div", "card-footer");
  const count = record.sources.length;
  footer.append(element("span", "", `${count} ${count === 1 ? "source" : "sources"}`));
  footer.append(element("span", "", "Read explanations →"));
  card.append(top, title, reading, element("p", "card-meaning", record.summary), footer);
  return card;
}

if (search) {
  const form = search.closest("form");
  const source = document.querySelector("#source-filter");
  const buttons = [...document.querySelectorAll("[data-level]")];
  const grid = document.querySelector("#grammar-results");
  const count = document.querySelector("#result-count");
  const more = document.querySelector("#load-more");
  const empty = document.querySelector("#search-empty");
  const error = document.querySelector("#search-error");
  const params = new URLSearchParams(location.search);
  let level = params.get("level") || "";
  let records = null;
  let shown = 36;
  let matches = [];
  search.value = params.get("q") || "";
  if ([...source.options].some(option => option.value === params.get("source"))) source.value = params.get("source");
  if (!buttons.some(button => button.dataset.level === level)) level = "";

  function render(reset = true) {
    if (!records) return;
    if (reset) shown = 36;
    const words = fold(search.value).split(" ").filter(Boolean);
    matches = records.filter(record => (!level || record.levels.includes(level)) &&
      (!source.value || record.sources.includes(source.value)) && words.every(word => record.search.includes(word)));
    if (words.length) {
      const query = fold(search.value);
      const rank = record => fold(record.expression) === query ? 0 : fold(record.expression).startsWith(query) ? 1 : 2;
      matches.sort((a, b) => rank(a) - rank(b));
    }
    const fragment = document.createDocumentFragment();
    for (const record of matches.slice(0, shown)) fragment.append(grammarCard(record));
    grid.replaceChildren(fragment);
    count.textContent = `${matches.length.toLocaleString()} grammar ${matches.length === 1 ? "entry" : "entries"}`;
    empty.hidden = matches.length > 0;
    more.hidden = shown >= matches.length;
    for (const button of buttons) {
      const active = button.dataset.level === level;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    const query = new URLSearchParams();
    if (search.value) query.set("q", search.value);
    if (level) query.set("level", level);
    if (source.value) query.set("source", source.value);
    history.replaceState(null, "", location.pathname + (query.size ? "?" + query : "") + location.hash);
  }

  async function load() {
    error.hidden = true;
    try {
      const response = await fetch(root + (english ? "en/" : "") + "search.json");
      if (!response.ok) throw new Error("Search is unavailable");
      records = await response.json();
      for (const record of records) record.search = fold(record.terms + " " + record.summary);
      render();
    } catch {
      error.hidden = false;
    }
  }

  form.addEventListener("submit", event => { event.preventDefault(); render(); });
  search.addEventListener("input", () => render());
  source.addEventListener("change", () => render());
  for (const button of buttons) button.addEventListener("click", () => { level = button.dataset.level; render(); });
  more.addEventListener("click", () => { shown += 36; render(false); });
  document.querySelector("#clear-filters").addEventListener("click", () => {
    search.value = ""; source.value = ""; level = ""; render(); search.focus();
  });
  document.querySelector("#retry-search").addEventListener("click", load);
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) &&
        !document.activeElement.isContentEditable) { event.preventDefault(); search.focus(); }
  });
  load();
}

const furigana = document.querySelector("#furigana-toggle");
if (furigana) furigana.addEventListener("click", () => {
  const hidden = document.body.classList.toggle("hide-furigana");
  furigana.setAttribute("aria-pressed", String(hidden));
  furigana.textContent = hidden ? "Show furigana" : "Hide furigana";
});

/* ── Display preferences: theme and text size, persisted in localStorage ── */
const doc = document.documentElement;
const THEME_KEY = "bg-theme";
const SIZE_KEY = "bg-size";
const SIZES = [87.5, 93.75, 100, 112.5, 125, 140];
const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const MARKS = {};
for (const button of document.querySelectorAll(".theme-switch [data-theme-mode]")) MARKS[button.dataset.themeMode] = button.querySelector("svg").outerHTML;
const LABELS = { light: "Light theme", dark: "Dark theme", system: "Match device theme" };

function store(key, value) { try { localStorage.setItem(key, value); } catch { /* this visit only */ } }
function stored(key) { try { return localStorage.getItem(key); } catch { return null; } }

function themeMode() {
  const mode = stored(THEME_KEY);
  return mode === "light" || mode === "dark" ? mode : "system";
}

function paintTheme(mode) {
  const dark = mode === "dark" || (mode === "system" && !!darkQuery && darkQuery.matches);
  doc.dataset.theme = dark ? "dark" : "light";
  doc.dataset.themeChoice = mode;
  const ground = getComputedStyle(doc).getPropertyValue("--ground").trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && ground) meta.content = ground;
  for (const button of document.querySelectorAll(".theme-switch [data-theme-mode]")) {
    button.setAttribute("aria-pressed", String(button.dataset.themeMode === mode));
  }
  const cycle = document.querySelector(".theme-cycle");
  if (cycle) {
    cycle.querySelector(".cycle-mark").innerHTML = MARKS[mode] || "";
    cycle.setAttribute("aria-label", `${LABELS[mode]} (tap to change)`);
    cycle.title = LABELS[mode];
  }
}

function setTheme(mode) {
  store(THEME_KEY, mode);
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (document.startViewTransition && !reduced) document.startViewTransition(() => paintTheme(mode));
  else paintTheme(mode);
}

function sizeStep() {
  const step = Number(stored(SIZE_KEY));
  return Number.isInteger(step) && step >= 0 && step < SIZES.length && stored(SIZE_KEY) !== null ? step : 2;
}

function paintSize(step) {
  doc.dataset.size = String(step);
  const value = document.querySelector(".size-value");
  if (value) value.textContent = `${Math.round(SIZES[step])}%`;
  const [smaller, larger] = document.querySelectorAll("[data-size-step]");
  if (smaller) smaller.disabled = step === 0;
  if (larger) larger.disabled = step === SIZES.length - 1;
}

paintTheme(themeMode());
paintSize(sizeStep());
for (const button of document.querySelectorAll(".theme-switch [data-theme-mode]")) {
  button.addEventListener("click", () => setTheme(button.dataset.themeMode));
}
const cycleButton = document.querySelector(".theme-cycle");
if (cycleButton) cycleButton.addEventListener("click", () => {
  const order = ["light", "dark", "system"];
  setTheme(order[(order.indexOf(themeMode()) + 1) % order.length]);
});
if (darkQuery) darkQuery.addEventListener("change", () => { if (themeMode() === "system") paintTheme("system"); });
for (const button of document.querySelectorAll("[data-size-step]")) {
  button.addEventListener("click", () => {
    const step = Math.min(SIZES.length - 1, Math.max(0, sizeStep() + Number(button.dataset.sizeStep)));
    store(SIZE_KEY, String(step));
    paintSize(step);
  });
}
window.addEventListener("storage", event => {
  if (event.key === THEME_KEY) paintTheme(themeMode());
  if (event.key === SIZE_KEY) paintSize(sizeStep());
});

/* ── Entry contents: drawer on narrow sheets, scroll-spy everywhere ── */
const tocPanel = document.querySelector("#toc");
const fab = document.querySelector(".toc-fab");
if (tocPanel && fab) {
  const backdrop = document.querySelector(".toc-backdrop");
  const closeButton = tocPanel.querySelector(".toc-close");
  const drawer = window.matchMedia("(max-width: 1000px)");
  const isOpen = () => document.body.classList.contains("toc-open");

  function openToc() {
    if (!drawer.matches) { tocPanel.querySelector("a")?.focus(); return; }
    document.body.classList.add("toc-open");
    backdrop.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    const current = tocPanel.querySelector('.toc-list > li > a[aria-current="true"]');
    if (current) current.scrollIntoView({ block: "center" });
    (current || closeButton).focus({ preventScroll: true });
  }
  function closeToc(returnFocus = true) {
    if (!isOpen()) return;
    document.body.classList.remove("toc-open");
    backdrop.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    if (returnFocus) fab.focus({ preventScroll: true });
  }
  fab.addEventListener("click", () => (isOpen() ? closeToc() : openToc()));
  closeButton.addEventListener("click", () => closeToc());
  backdrop.addEventListener("click", () => closeToc());
  tocPanel.addEventListener("click", event => { if (event.target.closest("a")) closeToc(false); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && isOpen()) { event.preventDefault(); closeToc(); return; }
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && (event.key === "t" || event.key === "c")) {
      event.preventDefault();
      isOpen() ? closeToc() : openToc();
    }
  });
  drawer.addEventListener("change", () => { if (!drawer.matches) closeToc(false); });

  // scroll-spy: mark the source (and usage) currently under the reading line
  const sourceLinks = [...tocPanel.querySelectorAll(".toc-list > li > a")];
  const senseLinks = [...tocPanel.querySelectorAll(".toc-senses a")];
  const sections = sourceLinks.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
  const senses = senseLinks.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
  const where = fab.querySelector(".fab-where");
  let ticking = false;
  function currentOf(nodes) {
    const line = (parseFloat(getComputedStyle(doc).scrollPaddingTop) || 80) + 40;
    let found = null;
    for (const node of nodes) { if (node.getBoundingClientRect().top <= line) found = node; else break; }
    return found;
  }
  function spy() {
    ticking = false;
    const section = currentOf(sections);
    const sense = currentOf(senses.filter(node => !section || section.contains(node)));
    sourceLinks.forEach(link => link.setAttribute("aria-current", String(!!section && link.hash === "#" + section.id)));
    senseLinks.forEach(link => link.setAttribute("aria-current", String(!!sense && link.hash === "#" + sense.id)));
    if (where) where.textContent = section ? `${String(sections.indexOf(section) + 1).padStart(2, "0")} / ${String(sections.length).padStart(2, "0")}` : "";
    const active = tocPanel.querySelector('.toc-list > li > a[aria-current="true"]');
    const list = tocPanel.querySelector(".toc-list");
    if (active && !drawer.matches && list.scrollHeight > list.clientHeight) {
      const a = active.getBoundingClientRect(), l = list.getBoundingClientRect();
      if (a.top < l.top || a.bottom > l.bottom) list.scrollTop += a.top - l.top - l.height / 3;
    }
  }
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
  window.addEventListener("resize", spy);
  spy();
}
