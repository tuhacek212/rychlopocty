// Stavba stránky jen z prvků: text z databáze jde vždy jako textContent, nikdy jako HTML (žádné XSS).
// Vzhled a chování drobných prvků je převzaté z programu (vzhled.py): ikony, nabídky, okna,
// oznámení, bubliny s nápovědou, přepínač – web má být od programu na počítači k nerozeznání.

export function h(tag, vlastnosti = {}, ...deti) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(vlastnosti || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "style" && typeof v === "object") {
      for (const [vl, hodnota] of Object.entries(v)) el.style.setProperty(vl.startsWith("--") ? vl : vl.replace(/[A-Z]/g, (z) => `-${z.toLowerCase()}`), hodnota);
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

// --- ikony: stejné obrysové kresby jako vzhled.nakresli_ikonu (souřadnice 0–1) ---------------------
// L = čára, R = obdélník se zaoblením, C = kruh, F = plný kruh, B = kruh s výplní pozadí,
// P = lomená čára (Z na konci = uzavřená), A = oblouk (obdélník, start, rozsah ve stupních jako v Qt),
// D = cesta [["M", x, y], ["L", x, y], ["Q", …], ["C", …], ["ARC", x, y, w, h, start, rozsah], ["Z"]]
const IKONY = {
  plus: [["L", .5, .2, .5, .8], ["L", .2, .5, .8, .5]],
  minus: [["L", .2, .5, .8, .5]],
  dots: [["F", .25, .5, .075], ["F", .5, .5, .075], ["F", .75, .5, .075]],
  search: [["C", .44, .44, .25], ["L", .63, .63, .84, .84]],
  settings: [["L", .14, .28, .86, .28], ["L", .14, .5, .86, .5], ["L", .14, .72, .86, .72],
    ["B", .34, .28, .085], ["B", .66, .5, .085], ["B", .42, .72, .085]],
  refresh: [["A", .2, .2, .6, .6, 40, 290], ["P", [.78, .16], [.8, .34], [.62, .36]]],
  folder: [["P", [.1, .28], [.1, .8], [.9, .8], [.9, .36], [.5, .36], [.42, .24], [.1, .24], [.1, .28]]],
  file: [["P", [.24, .1], [.6, .1], [.8, .3], [.8, .9], [.24, .9], "Z"], ["P", [.6, .1], [.6, .3], [.8, .3]]],
  calendar: [["R", .13, .2, .74, .66, .12], ["L", .13, .42, .87, .42], ["L", .34, .12, .34, .28], ["L", .66, .12, .66, .28]],
  note: [["R", .18, .12, .64, .76, .1], ["L", .32, .34, .68, .34], ["L", .32, .5, .68, .5], ["L", .32, .66, .54, .66]],
  history: [["C", .5, .5, .34], ["L", .5, .3, .5, .5], ["L", .5, .5, .64, .6]],
  grid: [["R", .14, .14, .3, .3, .07], ["R", .56, .14, .3, .3, .07], ["R", .14, .56, .3, .3, .07], ["R", .56, .56, .3, .3, .07]],
  eye: [["D", ["M", .08, .5], ["Q", .5, .08, .92, .5], ["Q", .5, .92, .08, .5]], ["C", .5, .5, .12]],
  trash: [["L", .18, .26, .82, .26], ["P", [.26, .26], [.3, .86], [.7, .86], [.74, .26]], ["P", [.4, .26], [.42, .14], [.58, .14], [.6, .26]]],
  "chevron-left": [["P", [.62, .2], [.34, .5], [.62, .8]]],
  "chevron-right": [["P", [.38, .2], [.66, .5], [.38, .8]]],
  "chevron-down": [["P", [.22, .38], [.5, .66], [.78, .38]]],
  download: [["L", .5, .14, .5, .64], ["P", [.3, .46], [.5, .66], [.7, .46]], ["L", .18, .84, .82, .84]],
  link: [["R", .1, .36, .44, .28, .14], ["R", .46, .36, .44, .28, .14]],
  x: [["L", .26, .26, .74, .74], ["L", .74, .26, .26, .74]],
  check: [["P", [.2, .52], [.42, .72], [.8, .3]]],
  spark: [["P", [.5, .1], [.6, .4], [.9, .5], [.6, .6], [.5, .9], [.4, .6], [.1, .5], [.4, .4], "Z"]],
  today: [["R", .13, .2, .74, .66, .12], ["L", .13, .42, .87, .42], ["F", .5, .64, .09]],
  power: [["A", .2, .22, .6, .6, 120, 300], ["L", .5, .12, .5, .46]],
  edit: [["P", [.2, .8], [.24, .62], [.66, .2], [.8, .34], [.38, .76], "Z"]],
  pin: [["C", .5, .4, .2], ["P", [.36, .55], [.5, .88], [.64, .55]]],
  sun: [["C", .5, .5, .17], ["L", .5, .08, .5, .2], ["L", .5, .8, .5, .92], ["L", .08, .5, .2, .5], ["L", .8, .5, .92, .5],
    ["L", .2, .2, .28, .28], ["L", .72, .72, .8, .8], ["L", .2, .8, .28, .72], ["L", .72, .28, .8, .2]],
  moon: [["D", ["M", .62, .12], ["ARC", .12, .12, .76, .76, 70, 250], ["Q", .34, .56, .62, .12]]],
  sidebar: [["R", .12, .18, .76, .64, .08], ["L", .38, .18, .38, .82]],
  sort: [["L", .3, .16, .3, .84], ["P", [.14, .66], [.3, .84], [.46, .66]], ["L", .58, .3, .88, .3], ["L", .58, .5, .8, .5], ["L", .58, .7, .72, .7]],
  files: [["P", [.3, .08], [.58, .08], [.76, .26], [.76, .74], [.3, .74], "Z"], ["P", [.2, .24], [.2, .92], [.64, .92]]],
  external: [["P", [.46, .2], [.2, .2], [.2, .8], [.8, .8], [.8, .54]], ["L", .5, .5, .84, .16], ["P", [.6, .16], [.84, .16], [.84, .4]]],
  preview: [["R", .1, .16, .8, .68, .08], ["L", .56, .16, .56, .84], ["L", .66, .34, .8, .34], ["L", .66, .5, .8, .5]],
  mail: [["R", .1, .22, .8, .56, .08], ["P", [.12, .26], [.5, .56], [.88, .26]]],
  share: [["C", .72, .22, .1], ["C", .28, .5, .1], ["C", .72, .78, .1], ["L", .37, .45, .63, .27], ["L", .37, .55, .63, .73]],
  copy: [["R", .32, .3, .52, .58, .08], ["P", [.2, .72], [.2, .12], [.64, .12]]],
  task: [["R", .16, .16, .68, .68, .12], ["P", [.32, .5], [.45, .63], [.7, .36]]],
  user: [["C", .5, .34, .17], ["A", .18, .58, .64, .56, 0, 180]],
  users: [["C", .38, .36, .14], ["A", .1, .6, .56, .5, 0, 180], ["C", .7, .3, .11], ["A", .56, .52, .36, .4, 20, 160]],
  key: [["C", .3, .6, .16], ["L", .42, .48, .84, .16], ["L", .72, .25, .82, .38], ["L", .62, .33, .7, .44]],
  filter: [["P", [.12, .2], [.88, .2], [.58, .54], [.58, .82], [.42, .9], [.42, .54], "Z"]],
  print: [["R", .14, .38, .72, .32, .08], ["P", [.28, .38], [.28, .14], [.72, .14], [.72, .38]], ["P", [.28, .6], [.28, .86], [.72, .86], [.72, .6]]],
  shield: [["P", [.5, .1], [.84, .24], [.8, .56], [.5, .9], [.2, .56], [.16, .24], "Z"]],
  lock: [["R", .2, .44, .6, .44, .08], ["A", .32, .14, .36, .5, 0, 180], ["L", .32, .39, .32, .44], ["L", .68, .39, .68, .44]],
  bell: [["D", ["M", .2, .7], ["C", .3, .58, .26, .2, .5, .2], ["C", .74, .2, .7, .58, .8, .7], ["Z"]], ["L", .5, .12, .5, .2],
    ["A", .42, .7, .16, .14, 180, 180]],
  palette: [["D", ["M", .5, .12], ["C", .92, .12, .94, .58, .72, .6], ["C", .58, .62, .6, .86, .46, .88], ["C", .2, .88, .1, .66, .12, .46],
    ["C", .14, .26, .3, .12, .5, .12]], ["F", .34, .36, .06], ["F", .54, .28, .06], ["F", .28, .58, .06]],
  project: [["R", .12, .16, .76, .68, .08], ["L", .12, .36, .88, .36], ["L", .26, .52, .6, .52], ["L", .26, .66, .48, .66]],
  chart: [["L", .14, .86, .86, .86], ["R", .2, .52, .14, .34, .03], ["R", .43, .3, .14, .56, .03], ["R", .66, .42, .14, .44, .03]],
  chat: [["D", ["M", .26, .7], ["L", .2, .88], ["L", .42, .7], ["L", .74, .7], ["Q", .88, .7, .88, .56], ["L", .88, .28],
    ["Q", .88, .14, .74, .14], ["L", .26, .14], ["Q", .12, .14, .12, .28], ["L", .12, .56], ["Q", .12, .7, .26, .7]],
  ["L", .3, .36, .7, .36], ["L", .3, .5, .58, .5]],
  send: [["P", [.1, .46], [.9, .12], [.6, .9], [.46, .56], "Z"], ["L", .46, .56, .9, .12]],
  reply: [["P", [.4, .2], [.14, .46], [.4, .72]], ["D", ["M", .14, .46], ["L", .56, .46], ["Q", .86, .46, .86, .76]]],
  smile: [["C", .5, .5, .38], ["D", ["M", .34, .6], ["Q", .5, .76, .66, .6]], ["F", .38, .42, .05], ["F", .62, .42, .05]],
  // jen na webu – návod k instalaci (Sdílet v iPhonu, nabídka prohlížeče, telefon)
  "share-up": [["P", [.36, .38], [.22, .38], [.22, .88], [.78, .88], [.78, .38], [.64, .38]], ["L", .5, .1, .5, .6], ["P", [.34, .25], [.5, .1], [.66, .25]]],
  menu: [["L", .18, .3, .82, .3], ["L", .18, .5, .82, .5], ["L", .18, .7, .82, .7]],
  phone: [["R", .28, .08, .44, .84, .1], ["L", .44, .8, .56, .8]],
};

// dřívější názvy ikon webu → kresby programu
const ALIASY = {
  projekty: "folder", kalendar: "calendar", dovolena: "sun", zpravy: "chat", zpet: "chevron-left", vpred: "chevron-right",
  odeslat: "send", odhlasit: "power", hledat: "search", kopirovat: "copy", slozka: "folder", soubor: "file", zavrit: "x",
  smazat: "trash", historie: "history", filtr: "filter", export: "print", upravit: "edit", hotovo: "check", zamek: "lock",
  otevrit: "external", tisk: "print", lupa_plus: "plus", uzivatel: "user", nastaveni: "settings", vice: "dots",
  sdilet: "share-up", nabidka: "menu", telefon: "phone",
};

const NS = "http://www.w3.org/2000/svg";
const f = (x) => +x.toFixed(4);

function bodOblouku(x, y, w, hh, uhel) {
  const r = (uhel * Math.PI) / 180;
  return [x + w / 2 + (w / 2) * Math.cos(r), y + hh / 2 - (hh / 2) * Math.sin(r)];
}

function oblouk(x, y, w, hh, start, rozsah, sCarou) {
  const [x1, y1] = bodOblouku(x, y, w, hh, start);
  const [x2, y2] = bodOblouku(x, y, w, hh, start + rozsah);
  return `${sCarou ? "L" : "M"} ${f(x1)} ${f(y1)} A ${f(w / 2)} ${f(hh / 2)} 0 ${Math.abs(rozsah) > 180 ? 1 : 0} ${rozsah > 0 ? 0 : 1} ${f(x2)} ${f(y2)}`;
}

function prvekIkony(op) {
  const [druh, ...a] = op;
  const el = (tag, atr) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(atr)) e.setAttribute(k, v); return e; };
  if (druh === "L") return el("path", { d: `M ${a[0]} ${a[1]} L ${a[2]} ${a[3]}` });
  if (druh === "R") return el("rect", { x: a[0], y: a[1], width: a[2], height: a[3], rx: a[4] ?? .08 });
  if (druh === "C") return el("circle", { cx: a[0], cy: a[1], r: a[2] });
  if (druh === "F") return el("circle", { cx: a[0], cy: a[1], r: a[2], fill: "currentColor", stroke: "none" });
  if (druh === "B") return el("circle", { cx: a[0], cy: a[1], r: a[2], class: "vypln-pozadi" });
  if (druh === "A") return el("path", { d: oblouk(...a, false) });
  if (druh === "P") {
    const zavrit = a[a.length - 1] === "Z";
    const body = zavrit ? a.slice(0, -1) : a;
    return el("path", { d: body.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ") + (zavrit ? " Z" : "") });
  }
  if (druh === "D") {
    return el("path", { d: a.map(([p, ...c]) => (p === "ARC" ? oblouk(...c, true) : `${p} ${c.join(" ")}`)).join(" ") });
  }
  return null;
}

export function ikona(jmeno, trida = "ikona", velikost = 16) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 1 1");
  svg.setAttribute("class", trida);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("stroke-width", String(f(Math.max(1.4 / velikost, 1 / 11))));
  for (const op of IKONY[ALIASY[jmeno] || jmeno] || []) {
    const e = prvekIkony(op);
    if (e) svg.append(e);
  }
  return svg;
}

// --- oznámení dole uprostřed okna (vzhled.Toast) ------------------------------------------------
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
  _casovac = setTimeout(() => { el.className = ""; }, akce ? 6000 : chyba ? 5000 : 3200);
}

// --- nabídka (QMenu): polozky = [{text, ikona, akce, nebezpecne, zakazano, zaskrtnuto, podmenu} | "-" | {nadpis}] ---
let _menu = [];
export function zavriMenu(od = 0) {
  for (const m of _menu.splice(od)) m.remove();
}

export function menu(x, y, polozky, uroven = 0) {
  zavriMenu(uroven);
  const el = h("div", { class: "menu", role: "menu", tabindex: "-1" });
  const tlacitka = [];
  for (const p of polozky.filter(Boolean)) {
    if (p === "-") { el.append(h("div", { class: "menu-cara", role: "separator" })); continue; }
    if (p.nadpis) { el.append(h("div", { class: "menu-nadpis", text: p.nadpis })); continue; }
    const znak = p.zaskrtnuto != null ? (p.zaskrtnuto ? ikona("check", "ikona") : h("span", { class: "ikona" }))
      : p.ikona ? ikona(p.ikona, `ikona${p.nebezpecne ? " cervena" : p.zelena ? " zelena" : ""}`) : h("span", { class: "ikona" });
    const b = h("button", { type: "button", role: p.zaskrtnuto != null ? "menuitemcheckbox" : "menuitem",
      "aria-checked": p.zaskrtnuto != null ? String(!!p.zaskrtnuto) : null,
      class: `${p.nebezpecne ? "nebezpecne" : ""}${p.podmenu ? " s-podmenu" : ""}`, disabled: !!p.zakazano,
      onclick: (ev) => {
        if (p.podmenu) { otevriPod(ev.currentTarget); return; }
        zavriMenu();
        p.akce?.();
      },
      onmouseenter: (ev) => {
        ev.currentTarget.focus({ preventScroll: true });
        if (p.podmenu) otevriPod(ev.currentTarget); else zavriMenu(uroven + 1);
      } }, znak, h("span", { class: "menu-text", text: p.text }),
    p.zkratka ? h("span", { class: "menu-zkratka", text: p.zkratka }) : null,
    p.podmenu ? ikona("chevron-right", "ikona sipka") : null);
    function otevriPod(tl) {
      const r = tl.getBoundingClientRect();
      menu(r.right + 2, r.top - 5, p.podmenu, uroven + 1);
    }
    tlacitka.push(b);
    el.append(b);
  }
  el.addEventListener("keydown", (ev) => {
    const i = tlacitka.indexOf(document.activeElement);
    const povolene = tlacitka.filter((t) => !t.disabled);
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      const j = povolene.indexOf(tlacitka[i]);
      const dalsi = povolene[(j + (ev.key === "ArrowDown" ? 1 : -1) + povolene.length) % povolene.length];
      dalsi?.focus();
    } else if (ev.key === "ArrowRight" && tlacitka[i]?.classList.contains("s-podmenu")) {
      tlacitka[i].click();
      _menu[uroven + 1]?.querySelector("button:not([disabled])")?.focus();
    } else if (ev.key === "ArrowLeft" && uroven > 0) {
      zavriMenu(uroven);
    }
  });
  el.addEventListener("contextmenu", (ev) => ev.preventDefault());
  document.body.append(el);
  const r = el.getBoundingClientRect();
  const [horni, dolni] = viditelnyPruh();
  el.style.left = `${Math.max(4, Math.min(x, window.innerWidth - r.width - 4))}px`;
  el.style.top = `${Math.max(horni + 4, Math.min(y, dolni - r.height - 4))}px`;
  _menu[uroven] = el;
  if (!uroven) el.focus?.();
  return el;
}

// Nabídka pod tlačítkem (InstantPopup u QToolButton)
export function menuPod(tlacitko, polozky) {
  const r = tlacitko.getBoundingClientRect();
  return menu(r.left, r.bottom + 1, polozky);
}

// --- rozbalovací panel u tlačítka (QFrame#popover): vrátí {el, zavri, umisti} -------------------------
let _popup = null;
export function zavriPopup() {
  _popup?.zavri();
}

export function popup(kotva, obsah, priZavreni = () => {}, { trida = "", vlevo = false } = {}) {
  zavriPopup();
  const el = h("div", { class: `popup ${trida}`, role: "dialog" }, obsah);
  document.body.append(el);
  const umisti = () => {
    const k = kotva.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const [horni, dolni] = viditelnyPruh();
    const x = vlevo ? k.left : k.right - r.width;
    el.style.left = `${Math.max(8, Math.min(x, window.innerWidth - r.width - 8))}px`;
    const dole = k.bottom + 2;
    el.style.top = `${Math.max(horni + 8, dole + r.height > dolni - 8 ? dolni - r.height - 8 : dole)}px`;
  };
  umisti();
  const venku = (ev) => { if (!el.contains(ev.target) && !kotva.contains(ev.target) && !ev.target.closest?.(".menu, dialog")) zavri(); };
  const klavesa = (ev) => { if (ev.key === "Escape") zavri(); };
  function zavri() {
    el.remove();
    document.removeEventListener("pointerdown", venku, true);
    document.removeEventListener("keydown", klavesa);
    window.removeEventListener("resize", umisti);
    kotva.classList?.remove("otevreno");
    if (_popup?.el === el) _popup = null;
    priZavreni();
  }
  setTimeout(() => document.addEventListener("pointerdown", venku, true), 0);
  document.addEventListener("keydown", klavesa);
  window.addEventListener("resize", umisti);
  kotva.classList?.add("otevreno");
  _popup = { el, zavri, umisti };
  return _popup;
}

document.addEventListener("pointerdown", (ev) => { if (_menu.length && !_menu.some((m) => m.contains(ev.target))) zavriMenu(); }, true);
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") zavriMenu(); });
window.addEventListener("blur", () => zavriMenu());

// --- okno (QDialog): titulková lišta jako ve Windows (barvy motivu), nadpis, obsah, tlačítka vpravo dole ---

// Lišta s názvem okna a křížkem; tažením za ni se okno posouvá.
export function titulekOkna(dialog, nadpis, zavri) {
  const text = h("span", { class: "okno-titulek-text", text: nadpis });
  const lista = h("div", { class: "okno-titulek" },
    h("img", { src: "ikona.png", alt: "", class: "okno-titulek-ikona", width: 16, height: 16 }), text,
    h("button", { type: "button", class: "okno-zavrit", tabindex: "-1", "aria-label": "Zavřít", onclick: zavri }, ikona("x", "ikona", 10)));
  let tah = null;
  lista.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0 || ev.target.closest("button") || kompaktni()) return;   // list zespodu (telefon) se neposouvá
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(dialog.style.transform || "") || [0, 0, 0];
    tah = { x: ev.clientX - +m[1], y: ev.clientY - +m[2] };
    lista.setPointerCapture(ev.pointerId);
  });
  lista.addEventListener("pointermove", (ev) => {
    if (tah) dialog.style.transform = `translate(${ev.clientX - tah.x}px, ${ev.clientY - tah.y}px)`;
  });
  lista.addEventListener("pointerup", () => { tah = null; });
  lista.nastav = (t) => { text.textContent = t; };
  return lista;
}

// obsah = prvky, tlačítka = [{text, hlavni, nebezpecne, ikona, akce}] (akce vrátí false = nezavírat)
export function okno(nadpis, obsah, tlacitka = [], { trida = "", titulek = null, bezNadpisu = false } = {}) {
  const dialog = h("dialog", { class: `okno ${trida}` });
  const zavri = () => { dialog.close(); dialog.remove(); };
  const chyba = h("p", { class: "chyba-formulare", role: "alert" });
  const lista = tlacitka.length ? h("div", { class: "okno-tlacitka" }, tlacitka.map((t) => h("button", {
    type: "button", class: t.hlavni ? "tlacitko hlavni" : t.nebezpecne ? "tlacitko nebezpecne" : "tlacitko",
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
  }, t.ikona ? ikona(t.ikona) : null, t.text))) : null;
  const titulniLista = titulekOkna(dialog, titulek || nadpis, zavri);
  const h2 = h("h2", { text: nadpis });
  vymen(dialog, titulniLista,
    h("div", { class: "okno-telo" },
      bezNadpisu ? null : h("div", { class: "okno-hlavicka" }, h2),
      h("div", { class: "okno-obsah" }, obsah, chyba), lista));
  dialog.addEventListener("cancel", (ev) => { ev.preventDefault(); zavri(); });
  // Enter v jednořádkovém poli = hlavní tlačítko (setDefault v programu)
  dialog.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || ev.isComposing || !(ev.target instanceof HTMLInputElement) || ev.target.type === "checkbox") return;
    const hlavni = lista?.querySelector(".tlacitko.hlavni");
    if (hlavni && !hlavni.disabled) { ev.preventDefault(); hlavni.click(); }
  });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, zavri, chyba, nadpis: (t) => { h2.textContent = t; titulniLista.nastav(t); } };
}

export function pole(popis, vstup, napoveda = "") {
  // <label> jen kolem jednoho pole – kolem skupiny tlačítek by prohlížeč klik přeposlal na první z nich
  const jednoPole = vstup instanceof HTMLInputElement || vstup instanceof HTMLSelectElement || vstup instanceof HTMLTextAreaElement;
  return h(jednoPole ? "label" : "div", { class: "pole" }, h("span", { text: popis }), vstup, napoveda && h("small", { text: napoveda }));
}

// Přepínač zapnuto / vypnuto (vzhled.Prepinac – jako ve Windows 11)
export function prepinac(zapnuto, zmena, popis = "") {
  const b = h("button", { type: "button", role: "switch", class: "prepinac", "aria-checked": String(!!zapnuto), "aria-label": popis || null,
    onclick: () => {
      const nove = b.getAttribute("aria-checked") !== "true";
      b.setAttribute("aria-checked", String(nove));
      zmena(nove);
    } });
  b.hodnota = () => b.getAttribute("aria-checked") === "true";
  return b;
}

export async function zkopiruj(text) {
  try {
    await navigator.clipboard.writeText(text);
    oznam("Zkopírováno do schránky");
  } catch {
    oznam("Kopírování se nepovedlo", true);
  }
}

// --- bubliny s nápovědou (QToolTip) a popisky lišty aktivit (PopisekAktivity) ---------------------
// Atribut title se při najetí přesune do data-tip (prohlížeč by ukázal svůj vlastní tooltip).
let _tip = null, _tipCas = 0, _tipCil = null;
const jemnyUkazatel = () => window.matchMedia("(pointer: fine)").matches;

function skryjTip() {
  clearTimeout(_tipCas);
  _tip?.remove();
  _tip = null;
  _tipCil = null;
}

document.addEventListener("mouseover", (ev) => {
  if (!jemnyUkazatel()) return;
  const cil = ev.target.closest?.("[title], [data-tip], [data-popisek]");
  if (cil === _tipCil) return;
  skryjTip();
  if (!cil) return;
  if (cil.hasAttribute("title")) {
    cil.dataset.tip = cil.getAttribute("title");
    cil.removeAttribute("title");
  }
  _tipCil = cil;
  if (cil.dataset.popisek) {
    // lišta aktivit: tmavá bublina se šipkou hned vpravo od ikony
    const r = cil.getBoundingClientRect();
    _tip = h("div", { class: "popisek-aktivity", role: "tooltip" }, h("strong", { text: cil.dataset.popisek }),
      cil.dataset.zkratka ? h("span", { text: cil.dataset.zkratka }) : null);
    document.body.append(_tip);
    _tip.style.left = `${r.right + 2}px`;
    _tip.style.top = `${r.top + r.height / 2 - _tip.offsetHeight / 2}px`;
    return;
  }
  const text = cil.dataset.tip;
  if (!text) return;
  const x = ev.clientX, y = ev.clientY;
  _tipCas = setTimeout(() => {
    if (_tipCil !== cil || !cil.isConnected) return;
    _tip = h("div", { class: "bublina-tip", role: "tooltip", text });
    document.body.append(_tip);
    const r = _tip.getBoundingClientRect();
    _tip.style.left = `${Math.max(4, Math.min(x + 2, window.innerWidth - r.width - 4))}px`;
    _tip.style.top = `${y + 20 + r.height > window.innerHeight - 4 ? y - r.height - 6 : y + 20}px`;
  }, 700);
});
document.addEventListener("pointerdown", skryjTip, true);
document.addEventListener("wheel", skryjTip, { passive: true, capture: true });
document.addEventListener("keydown", skryjTip, true);

// --- telefon a tablet -------------------------------------------------------------------------------
// Kompaktní rozvržení = úzká obrazovka (telefon) nebo nízká na dotyk (telefon na šířku): seznam projektů
// je vysouvací panel a okna listy zespodu. Stejná podmínka je v app.css.
export const KOMPAKTNI = "(max-width: 760px), (max-height: 520px) and (pointer: coarse)";
export function kompaktni() {
  return window.matchMedia(KOMPAKTNI).matches;
}

// Viditelná část stránky [nahoře, dole] v souřadnicích okna – bez lišt prohlížeče a klávesnice
// (100vh je v telefonu počítá i pod nimi, proto tam okna a tlačítka mizela).
function viditelnyPruh() {
  const vyska = document.documentElement.clientHeight || window.innerHeight;
  const vv = window.visualViewport;
  if (!vv || Math.abs(vv.scale - 1) > 0.01) return [0, vyska];
  const horni = Math.max(0, Math.min(vyska, vv.offsetTop));
  return [horni, Math.max(horni, Math.min(vyska, vv.offsetTop + vv.height))];
}

const jeTextovePole = (el) => el instanceof HTMLTextAreaElement || el?.isContentEditable
  || (el instanceof HTMLInputElement && ["text", "search", "email", "number", "password", "tel", "url"].includes(el.type));

// CSS proměnné --vv-vyska / --vv-horni / --vv-spodni (viditelná část) a třída „klavesnice“ na <html>
// (telefon: lišta dole se při psaní schová, okna zůstanou nad klávesnicí – i na iPhonu, kde se stránka nezmenší).
let _maxVyska = 0, _sirkaMereni = 0, _snimek = 0;
function zmerObrazovku() {
  _snimek = 0;
  const vyska = document.documentElement.clientHeight || window.innerHeight;
  const [horni, dolni] = viditelnyPruh();
  if (window.innerWidth !== _sirkaMereni) { _sirkaMereni = window.innerWidth; _maxVyska = 0; }
  _maxVyska = Math.max(_maxVyska, dolni - horni);
  const s = document.documentElement.style;
  s.setProperty("--vyska-okna", `${Math.round(vyska)}px`);
  s.setProperty("--vv-vyska", `${Math.round(dolni - horni)}px`);
  s.setProperty("--vv-horni", `${Math.round(horni)}px`);
  s.setProperty("--vv-spodni", `${Math.round(vyska - dolni)}px`);
  document.documentElement.classList.toggle("klavesnice", jeTextovePole(document.activeElement) && dolni - horni < _maxVyska * 0.85);
}
function zmerPozdeji() {
  if (!_snimek) _snimek = requestAnimationFrame(zmerObrazovku);
}
zmerObrazovku();
window.addEventListener("resize", zmerPozdeji);
window.addEventListener("orientationchange", () => setTimeout(zmerObrazovku, 300));
window.visualViewport?.addEventListener("resize", zmerPozdeji);
window.visualViewport?.addEventListener("scroll", zmerPozdeji);
document.addEventListener("focusin", () => setTimeout(zmerObrazovku, 350));   // klávesnice vyjíždí chvíli
document.addEventListener("focusout", () => setTimeout(zmerObrazovku, 50));

// Podržení prstu = pravé tlačítko. Android po podržení pošle contextmenu sám, iPhone a iPad ne – nabídky
// „na pravé tlačítko“ (projekt v seznamu, úkol, poznámka, odkaz, faktura…) by tam chyběly.
// Kalendář má podržení vlastní (přesun termínu, výběr dnů).
let _podrzeni = null;
function zrusPodrzeni() {
  if (_podrzeni) clearTimeout(_podrzeni.casovac);
  _podrzeni = null;
}
document.addEventListener("touchstart", (ev) => {
  zrusPodrzeni();
  const cil = ev.target instanceof Element ? ev.target : null;
  if (ev.touches.length !== 1 || !cil || cil.closest(".kal-mesice, input, textarea, select, [contenteditable], .menu, .okno-titulek")) return;
  const t = ev.touches[0];
  const stav = { x: t.clientX, y: t.clientY, nativni: false, vyvolano: false };
  stav.casovac = setTimeout(() => {
    if (_podrzeni !== stav || stav.nativni || !cil.isConnected) return;
    stav.vyvolano = true;
    navigator.vibrate?.(12);
    cil.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: stav.x, clientY: stav.y, button: 2, buttons: 2 }));
  }, 550);
  _podrzeni = stav;
}, { passive: true });
document.addEventListener("touchmove", (ev) => {
  const t = ev.touches[0];
  if (_podrzeni && t && Math.hypot(t.clientX - _podrzeni.x, t.clientY - _podrzeni.y) > 10) zrusPodrzeni();
}, { passive: true });
document.addEventListener("touchend", (ev) => {
  if (_podrzeni?.vyvolano && ev.cancelable) ev.preventDefault();   // po nabídce už žádný klik na položku pod prstem
  zrusPodrzeni();
}, { passive: false });
document.addEventListener("touchcancel", zrusPodrzeni, { passive: true });
document.addEventListener("contextmenu", (ev) => { if (_podrzeni && ev.isTrusted) _podrzeni.nativni = true; }, true);
