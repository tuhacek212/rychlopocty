// Stavba stránky jen z prvků: text z databáze jde vždy jako textContent, nikdy jako HTML (žádné XSS).

export function h(tag, vlastnosti = {}, ...deti) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(vlastnosti || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "style" && typeof v === "object") {
      for (const [vl, hodnota] of Object.entries(v)) el.style.setProperty(vl.replace(/[A-Z]/g, (z) => `-${z.toLowerCase()}`), hodnota);
    }
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  pripoj(el, deti);
  return el;
}

function pripoj(el, deti) {
  for (const d of deti.flat(Infinity)) {
    if (d == null || d === false) continue;
    el.append(d instanceof Node ? d : document.createTextNode(String(d)));
  }
}

export function vymen(el, ...deti) {
  el.replaceChildren();
  pripoj(el, deti);
  return el;
}

// Ikony: jednoduché SVG cesty (bez externích souborů)
const IKONY = {
  projekty: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  kalendar: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 2v4M16 2v4",
  dovolena: "M12 3v2M5.6 5.6l1.4 1.4M3 12h2M18.4 5.6 17 7M21 12h-2M7 12a5 5 0 0 1 10 0M3 17h18M6 21h12",
  zpravy: "M4 5h16v11H8l-4 4z",
  zpet: "M15 18l-6-6 6-6",
  vpred: "M9 18l6-6-6-6",
  plus: "M12 5v14M5 12h14",
  odeslat: "M4 12l16-8-6 16-2-6z",
  odhlasit: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  hledat: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4",
  kopirovat: "M8 8h11v12H8zM5 16V4h11",
  slozka: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  soubor: "M6 3h8l4 4v14H6zM14 3v4h4",
  zavrit: "M6 6l12 12M18 6 6 18",
  smazat: "M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3",
  historie: "M12 7v5l3 2M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4",
  filtr: "M4 5h16l-6 7v6l-4 2v-8z",
  export: "M12 4v11M7 10l5 5 5-5M5 20h14",
  upravit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  hotovo: "M5 12l5 5 9-10",
  zamek: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  otevrit: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  tisk: "M7 9V4h10v5M7 17H5v-7h14v7h-2M8 14h8v6H8z",
  lupa_plus: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4M11 8v6M8 11h6",
};

export function ikona(jmeno, trida = "ikona") {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", trida);
  svg.setAttribute("aria-hidden", "true");
  const cesta = document.createElementNS(ns, "path");
  cesta.setAttribute("d", IKONY[jmeno] || "");
  svg.append(cesta);
  return svg;
}

// Krátké oznámení dole (akce = {text, fn} – např. „Vrátit“)
let _casovac = 0;
export function oznam(text, chyba = false, akce = null) {
  let el = document.getElementById("oznameni");
  if (!el) {
    el = h("div", { id: "oznameni", role: "status", "aria-live": "polite" });
    document.body.append(el);
  }
  vymen(el, h("span", { text }), akce ? h("button", { type: "button", class: "oznameni-akce", text: akce.text,
    onclick: () => { el.className = ""; akce.fn(); } }) : null);
  el.className = chyba ? "videt chyba" : "videt";
  clearTimeout(_casovac);
  _casovac = setTimeout(() => { el.className = ""; }, chyba || akce ? 7000 : 3000);
}

// Nabídka na místě (pravé tlačítko): polozky = [{text, akce, nebezpecne, zakazano} | "-" | {nadpis}]
let _menu = null;
export function zavriMenu() {
  _menu?.remove();
  _menu = null;
}

export function menu(x, y, polozky) {
  zavriMenu();
  const el = h("div", { class: "menu", role: "menu" }, polozky.filter(Boolean).map((p) => {
    if (p === "-") return h("div", { class: "menu-cara", role: "separator" });
    if (p.nadpis) return h("div", { class: "menu-nadpis", text: p.nadpis });
    return h("button", { type: "button", role: "menuitem", class: p.nebezpecne ? "nebezpecne" : "", disabled: !!p.zakazano,
      onclick: () => { zavriMenu(); p.akce?.(); } }, p.ikona ? ikona(p.ikona) : null, h("span", { text: p.text }));
  }));
  document.body.append(el);
  const r = el.getBoundingClientRect();
  el.style.left = `${Math.max(4, Math.min(x, window.innerWidth - r.width - 4))}px`;
  el.style.top = `${Math.max(4, Math.min(y, window.innerHeight - r.height - 4))}px`;
  _menu = el;
  el.querySelector("button:not([disabled])")?.focus({ preventScroll: true });
}

// Rozbalovací panel u tlačítka (filtr…); vrátí funkci, která ho zavře
let _popup = null;
export function zavriPopup() {
  _popup?.zavri();
}

export function popup(kotva, obsah, priZavreni = () => {}) {
  zavriPopup();
  const el = h("div", { class: "popup", role: "dialog" }, obsah);
  document.body.append(el);
  const umisti = () => {
    const k = kotva.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(k.right - r.width, window.innerWidth - r.width - 8))}px`;
    const dole = k.bottom + 6;
    el.style.top = `${Math.max(8, dole + r.height > window.innerHeight - 8 ? window.innerHeight - r.height - 8 : dole)}px`;
  };
  umisti();
  const venku = (ev) => { if (!el.contains(ev.target) && !kotva.contains(ev.target) && !ev.target.closest?.(".menu")) zavri(); };
  const klavesa = (ev) => { if (ev.key === "Escape") zavri(); };
  function zavri() {
    el.remove();
    document.removeEventListener("pointerdown", venku, true);
    document.removeEventListener("keydown", klavesa);
    window.removeEventListener("resize", umisti);
    if (_popup?.el === el) _popup = null;
    priZavreni();
  }
  setTimeout(() => document.addEventListener("pointerdown", venku, true), 0);
  document.addEventListener("keydown", klavesa);
  window.addEventListener("resize", umisti);
  _popup = { el, zavri, umisti };
  return _popup;
}

document.addEventListener("pointerdown", (ev) => { if (_menu && !_menu.contains(ev.target)) zavriMenu(); }, true);
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") zavriMenu(); });
window.addEventListener("blur", zavriMenu);

// Okénko (dialog) – obsah = prvky, tlačítka = [{text, hlavni, akce}] (akce vrátí false = nezavírat)
export function okno(nadpis, obsah, tlacitka = []) {
  const dialog = h("dialog", { class: "okno" });
  const zavri = () => { dialog.close(); dialog.remove(); };
  const chyba = h("p", { class: "chyba-formulare", role: "alert" });
  const lista = h("div", { class: "okno-tlacitka" }, tlacitka.map((t) => h("button", {
    type: "button", class: t.hlavni ? "tlacitko hlavni" : t.nebezpecne ? "tlacitko nebezpecne" : "tlacitko",
    text: t.text,
    onclick: async (ev) => {
      if (!t.akce) return zavri();
      const tl = ev.currentTarget;
      tl.disabled = true;
      chyba.textContent = "";
      try {
        if ((await t.akce()) !== false) zavri();
      } catch (e) {
        chyba.textContent = e?.message || String(e);
      } finally {
        tl.disabled = false;
      }
    },
  })));
  vymen(dialog,
    h("div", { class: "okno-hlavicka" }, h("h2", { text: nadpis }),
      h("button", { type: "button", class: "ikonove", "aria-label": "Zavřít", onclick: zavri }, ikona("zavrit"))),
    h("div", { class: "okno-obsah" }, obsah, chyba), lista);
  dialog.addEventListener("cancel", (ev) => { ev.preventDefault(); zavri(); });
  dialog.addEventListener("click", (ev) => { if (ev.target === dialog) zavri(); });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, zavri, chyba };
}

export function pole(popis, vstup, napoveda = "") {
  // <label> jen kolem jednoho pole – kolem skupiny tlačítek by prohlížeč klik přeposlal na první z nich
  const jednoPole = vstup instanceof HTMLInputElement || vstup instanceof HTMLSelectElement || vstup instanceof HTMLTextAreaElement;
  return h(jednoPole ? "label" : "div", { class: "pole" }, h("span", { text: popis }), vstup, napoveda && h("small", { text: napoveda }));
}

export async function zkopiruj(text) {
  try {
    await navigator.clipboard.writeText(text);
    oznam("Zkopírováno do schránky");
  } catch {
    oznam("Kopírování se nepovedlo", true);
  }
}
