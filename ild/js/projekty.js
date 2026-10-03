// Správa projektů jako v programu (prehled.PrehledProjektu + dialogy.DialogProjektu): tabulka Všech
// projektů se stejnými sloupci, nový projekt, úprava údajů a stavu, odstranění. Texty historie stejné
// jako v programu („Projekt založen“, „Upraveny údaje projektu“, „Stav změněn na: …“).

import { NEAKTIVNI, STATUSY, STATUS_BARVY, dnes, jeHotovo, nazevProjektu, noveId, rozsah, ted, zIso, zaznamZmeny, datumKratce } from "./data.js";
import * as F from "./finance.js";
import { h, menu, okno, oznam, pole } from "./ui.js";

const kolator = new Intl.Collator("cs");
const KLIC_SLOUPCU = "ild-sloupce-projektu";

export const SLOUPCE = [
  ["stav", "Stav", true], ["lokalita", "Lokalita", true], ["investor", "Investor", true], ["nazev", "Název", true],
  ["cislo", "Číslo", true], ["termin", "Nejbližší termín", true], ["zmena", "Změněno", true], ["provozni", "Provozní soubor", false],
  ["poznamky", "Poznámek", false], ["posledni_poznamka", "Poslední poznámka", false], ["odkazy", "Odkazů", false], ["ukoly", "Úkoly", true],
  ["fakturovano", "Vyfakturováno", false], ["neuhrazeno", "Neuhrazeno", false], ["saldo", "Saldo", false], ["zalozeno", "Založeno", true],
];

export function viditelneSloupce() {
  try {
    const ulozene = JSON.parse(window.localStorage.getItem(KLIC_SLOUPCU) || "null");
    if (Array.isArray(ulozene)) return SLOUPCE.filter(([k]) => ulozene.includes(k));
  } catch { /* výchozí */ }
  return SLOUPCE.filter(([, , v]) => v);
}

export function prepniSloupec(klic) {
  const nyni = viditelneSloupce().map(([k]) => k);
  const nove = nyni.includes(klic) ? nyni.filter((k) => k !== klic) : [...nyni, klic];
  try { window.localStorage.setItem(KLIC_SLOUPCU, JSON.stringify(nove)); } catch { /* nic */ }
}

const casText = (cas) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(cas || ""));
  return m ? `${+m[3]}. ${+m[2]}. ${m[1]}` : "";
};

function nejblizsi(p) {
  const d = zIso(dnes());
  let nej = null;
  for (const t of Array.isArray(p.harmonogram) ? p.harmonogram : []) {
    const rz = rozsah(t);
    if (!rz || rz[1] < d || jeHotovo(t)) continue;
    if (!nej || rz[0] < nej[0]) nej = [rz[0], t];
  }
  return nej;
}

// hodnota buňky: [text, klíč řazení]
export function bunka(p, klic) {
  const hist = Array.isArray(p.historie) ? p.historie : [];
  const pozn = (Array.isArray(p.poznamky) ? p.poznamky : []).filter((x) => x && x.text);
  switch (klic) {
    case "stav": return [p.status || "", STATUSY.indexOf(p.status)];
    case "lokalita": return [p.lokalita || "", (p.lokalita || "").toLowerCase()];
    case "investor": return [p.investor || "", (p.investor || "").toLowerCase()];
    case "nazev": return [p.nazev || "", (p.nazev || "").toLowerCase()];
    case "cislo": return [p.cislo || "", p.cislo || ""];
    case "termin": { const n = nejblizsi(p); return n ? [`${datumKratce(n[0])} ${n[1].nazev || ""}`, +n[0]] : ["", Infinity]; }
    case "zmena": { const c = hist.length ? hist[hist.length - 1].cas : ""; return [casText(c), c || ""]; }
    case "provozni": return [p.provozni_soubor || p.provozni_cel || "", (p.provozni_soubor || "").toLowerCase()];
    case "poznamky": return [pozn.length ? String(pozn.length) : "", pozn.length];
    case "posledni_poznamka": {
      const x = [...pozn].sort((a, b) => String(b.cas || "").localeCompare(String(a.cas || "")))[0];
      return [x ? x.text.split("\n")[0].slice(0, 80) : "", x?.cas || ""];
    }
    case "odkazy": { const n = (p.odkazy || []).length; return [n ? String(n) : "", n]; }
    case "ukoly": {
      const u = (Array.isArray(p.ukoly) ? p.ukoly : []).filter((x) => x && !x.hotovo).length;
      return [u ? String(u) : "", u];
    }
    case "fakturovano": case "neuhrazeno": case "saldo": {
      if (!F.maCashflow(p) || !F.platne(p).length) return ["", -Infinity];
      const s = F.souhrn(p);
      const x = klic === "fakturovano" ? s.vyfakturovano : klic === "neuhrazeno" ? s.pohledavky : F.saldo(s);
      return [F.formatujCastku(x, s.mena, false, klic === "saldo"), x];
    }
    case "zalozeno": return [casText(p.zalozeno), p.zalozeno || ""];
    default: return ["", ""];
  }
}

// --- dialog projektu (nový / úprava údajů) ---------------------------------------------------------

export function dialogProjektu(tym, projekt = null, poZalozeni = () => {}) {
  const p = projekt || {};
  const nazev = h("input", { value: p.nazev || "", maxlength: 200, required: true });
  const cislo = h("input", { value: p.cislo || "", maxlength: 60 });
  const lokalita = h("input", { value: p.lokalita || "", maxlength: 200 });
  const investor = h("input", { value: p.investor || "", maxlength: 200 });
  const provozni = h("input", { value: p.provozni_soubor || p.provozni_cel || "", maxlength: 200 });
  const status = h("select", {}, STATUSY.map((s) => h("option", { value: s, text: s, selected: s === (p.status || STATUSY[0]) })));
  const zaklad = String(tym.nastaveni.defaultni_slozka_projektu || "").trim();
  const slozka = h("input", { maxlength: 500, placeholder: zaklad ? `${zaklad.replace(/[\\/]+$/, "")}\\…` : "např. P:\\Projekty\\Brno" });
  const novy = !projekt;
  okno(novy ? "Nový projekt" : "Upravit údaje projektu", [
    pole("Název projektu", nazev), h("div", { class: "dve-pole" }, pole("Číslo zakázky", cislo), pole("Stav", status)),
    h("div", { class: "dve-pole" }, pole("Lokalita", lokalita), pole("Investor", investor)),
    pole("Provozní soubor", provozni),
    novy ? pole("Složka projektu (nepovinné)", slozka, "Web na disky nevidí – složku nezaloží. Zadej cestu k existující složce, nebo ji přidej později v programu.") : null,
  ], [
    { text: "Zrušit" },
    { text: novy ? "Založit projekt" : "Uložit", hlavni: true, akce: async () => {
      const udaje = { nazev: nazev.value.trim(), cislo: cislo.value.trim(), lokalita: lokalita.value.trim(), investor: investor.value.trim(),
        provozni_soubor: provozni.value.trim(), provozni_cel: provozni.value.trim(), status: status.value };
      if (!udaje.nazev) { nazev.focus(); throw new Error("Doplň název projektu."); }
      if (novy) {
        const nov = { id: noveId(), nazev: udaje.nazev, cislo: udaje.cislo, status: udaje.status || STATUSY[0], poznamka: "", odkazy: [],
          skryte: [], harmonogram: [], historie: [], poznamky: [], ukoly: [], faktury: [], zalozeno: ted(),
          lokalita: udaje.lokalita, investor: udaje.investor, provozni_soubor: udaje.provozni_soubor, provozni_cel: udaje.provozni_cel };
        if (slozka.value.trim()) nov.odkazy.push({ popis: "Složka projektu", cesta: slozka.value.trim() });
        zaznamZmeny(nov, "Projekt založen", tym.ja?.jmeno);
        await tym.zalozProjekt(nov);
        oznam(`Projekt „${udaje.nazev}“ založen`);
        poZalozeni(nov.id);
        return;
      }
      await tym.upravProjekt(projekt.id, (pp) => {
        const zmena = ["nazev", "cislo", "lokalita", "investor", "provozni_soubor", "status"].some((k) => (pp[k] || "") !== udaje[k]);
        if (!zmena) return false;
        Object.assign(pp, udaje);
      }, "Upraveny údaje projektu");
      oznam("Údaje uloženy");
    } },
  ]);
  nazev.focus();
}

export async function nastavStav(tym, id, status) {
  try {
    await tym.upravProjekt(id, (p) => { if (p.status === status) return false; p.status = status; }, `Stav změněn na: ${status}`);
    oznam(`Stav: ${status}`);
  } catch (e) { oznam(e?.message || "Nepovedlo se.", true); }
}

export function odstranProjekt(tym, p, poSmazani = () => {}) {
  okno("Odstranit projekt?", [h("p", { text: `Odstranit projekt „${p.nazev || nazevProjektu(p)}“ ze seznamu?` }),
    h("p", { class: "tiche", text: "Smaže se jen záznam v aplikaci. Soubory na disku zůstanou." })], [
    { text: "Zrušit" },
    { text: "Odstranit", nebezpecne: true, akce: async () => { await tym.smazProjekt(p.id); oznam("Projekt odstraněn"); poSmazani(); } },
  ]);
}

export function menuProjektu(x, y, tym, p, otevrit) {
  menu(x, y, [
    { nadpis: nazevProjektu(p) },
    { text: "Otevřít", ikona: "otevrit", akce: () => otevrit(p.id) },
    { text: "Upravit údaje…", ikona: "upravit", akce: () => dialogProjektu(tym, p) },
    "-",
    ...STATUSY.map((s) => ({ text: `${s === p.status ? "✓ " : ""}Stav: ${s}`, zakazano: s === p.status, akce: () => nastavStav(tym, p.id, s) })),
    "-",
    F.maCashflow(p) ? { text: "Cashflow zakázky", akce: () => { window.location.hash = `#/projekt/${encodeURIComponent(p.id)}/cashflow`; } } : null,
    { text: "Odstranit…", ikona: "smazat", nebezpecne: true, akce: () => odstranProjekt(tym, p) },
  ]);
}

export function tabulkaProjektu(tym, projekty, stavRazeni, otevrit, prekresli) {
  const sloupce = viditelneSloupce();
  const [klic, smer] = stavRazeni.razeni;
  const radky = projekty.map((p) => ({ p, hodnoty: Object.fromEntries(sloupce.map(([k]) => [k, bunka(p, k)])) }));
  radky.sort((a, b) => {
    const x = (a.hodnoty[klic] || bunka(a.p, klic))[1], y = (b.hodnoty[klic] || bunka(b.p, klic))[1];
    const r = typeof x === "string" && typeof y === "string" ? kolator.compare(x, y) : x < y ? -1 : x > y ? 1 : 0;
    return r * smer || kolator.compare(nazevProjektu(a.p), nazevProjektu(b.p));
  });
  return h("div", { class: "tabulka-obal karta tabulka-projektu" }, h("table", { class: "tabulka projekty" },
    h("thead", {}, h("tr", {}, sloupce.map(([k, t]) => h("th", { onclick: () => { stavRazeni.razeni = [k, klic === k ? -smer : 1]; prekresli(); } },
      t, klic === k ? (smer > 0 ? " ▲" : " ▼") : "")), h("th", {}))),
    h("tbody", {}, radky.map(({ p, hodnoty }) => h("tr", { class: NEAKTIVNI.has(p.status) ? "neaktivni" : "", onclick: () => otevrit(p.id),
      oncontextmenu: (ev) => { ev.preventDefault(); menuProjektu(ev.clientX, ev.clientY, tym, p, otevrit); } },
    sloupce.map(([k]) => k === "stav"
      ? h("td", {}, h("span", { class: "stitek-stavu maly", style: { "--barva": STATUS_BARVY[p.status] || "#667085" }, text: p.status || "" }))
      : h("td", { class: ["fakturovano", "neuhrazeno", "saldo", "poznamky", "odkazy", "ukoly"].includes(k) ? "vpravo" : "", text: hodnoty[k][0] })),
    h("td", {}, h("button", { type: "button", class: "ikonove male", "aria-label": "Akce s projektem",
      onclick: (ev) => { ev.stopPropagation(); const r = ev.currentTarget.getBoundingClientRect(); menuProjektu(r.left, r.bottom, tym, p, otevrit); } }, "⋯")))))));
}
