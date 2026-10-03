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

// Krátké oznámení dole
let _casovac = 0;
export function oznam(text, chyba = false) {
  let el = document.getElementById("oznameni");
  if (!el) {
    el = h("div", { id: "oznameni", role: "status", "aria-live": "polite" });
    document.body.append(el);
  }
  el.textContent = text;
  el.className = chyba ? "videt chyba" : "videt";
  clearTimeout(_casovac);
  _casovac = setTimeout(() => { el.className = ""; }, chyba ? 6000 : 3000);
}

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
  return h("label", { class: "pole" }, h("span", { text: popis }), vstup, napoveda && h("small", { text: napoveda }));
}

export async function zkopiruj(text) {
  try {
    await navigator.clipboard.writeText(text);
    oznam("Zkopírováno do schránky");
  } catch {
    oznam("Kopírování se nepovedlo", true);
  }
}
