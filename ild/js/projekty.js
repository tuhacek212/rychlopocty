// Správa projektů jako v programu (prehled.PrehledProjektu + dialogy.DialogProjektu): tabulka Všech
// projektů se stejnými sloupci, šířkami a barvami, nový projekt, úprava údajů a stavu, odstranění.
// Texty historie stejné jako v programu („Projekt založen“, „Upraveny údaje projektu“, „Stav změněn na: …“).

import { NEAKTIVNI, STATUSY, dnes, nazevProjektu, noveId, ted, zIso, zaznamZmeny, datumKratce } from "./data.js";
import * as F from "./finance.js";
import { h, menu, menuPod, okno, oznam, pole } from "./ui.js";
import { casHezky, nejblizsiTermin, odznakStavu, relativniText } from "./vzhled.js";
import { otevriReport } from "./cashflow.js";

const kolator = new Intl.Collator("cs");
const KLIC_SLOUPCU = "ild-sloupce-projektu";
const KLIC_SIREK = "ild-sirky-sloupcu";
const KLIC_PISMENEM = "ild-stav-pismenem";

// klíč, záhlaví, výchozí šířka, výchozí viditelnost (PrehledProjektu.SLOUPCE)
export const SLOUPCE = [
  ["stav", "Stav", 120, true], ["lokalita", "Lokalita", 150, true], ["investor", "Investor", 220, true], ["nazev", "Název", 260, true],
  ["cislo", "Číslo", 90, true], ["termin", "Nejbližší termín", 230, true], ["zmena", "Změněno", 110, true],
  ["provozni", "Provozní soubor", 160, false], ["poznamky", "Poznámek", 80, false], ["posledni_poznamka", "Poslední poznámka", 280, false],
  ["odkazy", "Odkazů", 70, false], ["ukoly", "Úkoly", 80, true], ["fakturovano", "Vyfakturováno", 150, false],
  ["neuhrazeno", "Neuhrazeno", 120, false], ["saldo", "Saldo", 120, false], ["zalozeno", "Založeno", 110, true],
];

const cti = (klic, vychozi) => { try { return JSON.parse(window.localStorage.getItem(klic) || "null") ?? vychozi; } catch { return vychozi; } };
const zapis = (klic, hodnota) => { try { window.localStorage.setItem(klic, JSON.stringify(hodnota)); } catch { /* nic */ } };

export function viditelneSloupce() {
  const ulozene = cti(KLIC_SLOUPCU, null);
  if (Array.isArray(ulozene)) return SLOUPCE.filter(([k]) => ulozene.includes(k));
  return SLOUPCE.filter(([, , , v]) => v);
}

export function prepniSloupec(klic) {
  const nyni = viditelneSloupce().map(([k]) => k);
  if (nyni.includes(klic) && nyni.length <= 1) return;   // aspoň jeden sloupec musí zůstat
  zapis(KLIC_SLOUPCU, nyni.includes(klic) ? nyni.filter((k) => k !== klic) : [...nyni, klic]);
}

const sirkaSloupce = (klic) => {
  const s = cti(KLIC_SIREK, {});
  return Number.isFinite(s?.[klic]) ? s[klic] : klic === "stav" && cti(KLIC_PISMENEM, false) ? 52 : SLOUPCE.find(([k]) => k === klic)?.[2] || 100;
};

const casText = (cas) => {
  const d = zIso(String(cas || "").slice(0, 10));
  return d ? datumKratce(d, true) : "";
};

// hodnota buňky: {text, razeni, barva?, tip?}
export function bunka(p, klic) {
  const hist = Array.isArray(p.historie) ? p.historie : [];
  const pozn = (Array.isArray(p.poznamky) ? p.poznamky : []).filter((x) => x && x.text);
  const dnesek = zIso(dnes());
  switch (klic) {
    case "stav": return { text: p.status || "", razeni: [STATUSY.indexOf(p.status) < 0 ? 99 : STATUSY.indexOf(p.status), (p.nazev || "").toLowerCase()], tip: p.status };
    case "lokalita": return { text: p.lokalita || "", razeni: (p.lokalita || "").toLowerCase() };
    case "investor": return { text: p.investor || "", razeni: (p.investor || "").toLowerCase() };
    case "nazev": return { text: p.nazev || "", razeni: (p.nazev || "").toLowerCase(),
      tip: [p.nazev, p.lokalita, p.investor, p.status].filter(Boolean).join("\n") };
    case "cislo": return { text: p.cislo || "", razeni: p.cislo || "" };
    case "termin": {
      const n = nejblizsiTermin(p, dnesek);
      if (!n) return { text: "—", razeni: Infinity, barva: "var(--c-faint)" };
      const [text, barva] = relativniText(n[1], n[2], dnesek);
      return { text: `${datumKratce(n[1], n[1].getFullYear() !== dnesek.getFullYear())} · ${n[0].nazev || ""}`, razeni: +n[1], barva,
        tip: `${text} – ${n[0].nazev || ""}` };
    }
    case "zmena": { const c = hist.length ? hist[hist.length - 1].cas : ""; return { text: c ? casHezky(c).split("  ")[0] : "", razeni: c || "" }; }
    case "provozni": return { text: p.provozni_soubor || p.provozni_cel || "", razeni: (p.provozni_soubor || p.provozni_cel || "").toLowerCase() };
    case "poznamky": return { text: pozn.length ? String(pozn.length) : "", razeni: pozn.length };
    case "posledni_poznamka": {
      const x = pozn[pozn.length - 1];
      return { text: x ? x.text.replace(/\n/g, " ") : "", razeni: x?.cas || "", tip: x?.text || "" };
    }
    case "odkazy": { const n = (p.odkazy || []).length; return { text: n ? String(n) : "", razeni: n }; }
    case "ukoly": {
      const vse = (Array.isArray(p.ukoly) ? p.ukoly : []).filter((x) => x && typeof x === "object");
      const otevrene = vse.filter((x) => !x.hotovo);
      return { text: otevrene.length ? `${otevrene.length} z ${vse.length}` : vse.length ? "✓" : "", razeni: otevrene.length,
        barva: otevrene.length ? "var(--c-warning)" : "var(--c-primary-dark)", tip: otevrene.slice(0, 12).map((u) => `☐ ${u.text}`).join("\n") };
    }
    case "fakturovano": case "neuhrazeno": case "saldo": {
      if (!F.maCashflow(p) || !F.platne(p).length) return { text: "", razeni: -Infinity };
      const s = F.souhrn(p);
      const x = klic === "fakturovano" ? s.vyfakturovano : klic === "neuhrazeno" ? s.pohledavky : F.saldo(s);
      return { text: F.formatujCastku(x, s.mena, false, klic === "saldo"), razeni: x };
    }
    case "zalozeno": return { text: casText(p.zalozeno), razeni: p.zalozeno || "", tip: p.zalozeno ? casHezky(p.zalozeno) : "Datum založení není známé" };
    default: return { text: "", razeni: "" };
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
    novy ? pole("Složka projektu (nepovinné)", slozka, "Cesta k existující složce na disku firmy – web složky nezakládá.") : null,
  ], [
    { text: "Zrušit" },
    { text: novy ? "Založit projekt" : "Uložit", hlavni: true, ikona: novy ? "plus" : "check", akce: async () => {
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
  } catch (e) { oznam(e?.message || "Nepovedlo se.", true); }
}

export function odstranProjekt(tym, p, poSmazani = () => {}) {
  okno("Odstranit projekt ze seznamu?", [h("p", { text: `Odstranit projekt „${p.nazev || nazevProjektu(p)}“ ze seznamu?` }),
    h("p", { class: "tiche", text: "Smaže se jen záznam v aplikaci. Soubory na disku zůstanou." })], [
    { text: "Zrušit" },
    { text: "Odstranit", nebezpecne: true, ikona: "trash", akce: async () => { await tym.smazProjekt(p.id); oznam("Projekt odstraněn"); poSmazani(); } },
  ]);
}

// PrehledProjektu._napln_menu_projektu
function polozkyProjektu(tym, p, otevrit, cashflow = true) {
  const slozka = (p.odkazy || []).find((o) => o && o.cesta);
  return [
    { text: "Otevřít projekt", ikona: "chevron-right", akce: () => otevrit(p.id) },
    cashflow && F.maCashflow(p) ? { text: "Cashflow zakázky", ikona: "chart", akce: () => otevrit(p.id, "cashflow") } : null,
    { text: "Upravit údaje projektu…", ikona: "edit", akce: () => dialogProjektu(tym, p) },
    { text: "Stav", ikona: "grid", podmenu: STATUSY.map((s) => ({ text: s, zaskrtnuto: s === p.status, akce: () => nastavStav(tym, p.id, s) })) },
    { text: "Otevřít složku projektu", ikona: "folder", zakazano: !slozka, akce: () => {
      const a = h("a", { href: `ild-soubor:otevrit?cesta=${encodeURIComponent(slozka.cesta)}&projekt=${encodeURIComponent(p.id)}`, hidden: true });
      document.body.append(a); a.click(); a.remove();
    } },
    "-",
    { text: "Odstranit projekt ze seznamu…", ikona: "trash", nebezpecne: true, akce: () => odstranProjekt(tym, p) },
  ];
}

export function menuProjektu(x, y, tym, p, otevrit, cashflow = true) {
  menu(x, y, polozkyProjektu(tym, p, otevrit, cashflow));
}

// Tabulka všech projektů (QTreeWidget): klik vybere řádek, dvojklik / Enter otevře, pravé = menu,
// záhlaví řadí, tažením hrany záhlaví se mění šířka. Vrátí {el, menuVice(kotva)}.
export function tabulkaProjektu(tym, projekty, stav, otevrit, prekresli, cashflow = true) {
  const sloupce = viditelneSloupce();
  const [klic, smer] = stav.razeni;
  const pismenem = cti(KLIC_PISMENEM, false);
  const radky = projekty.map((p) => ({ p, hodnoty: Object.fromEntries(sloupce.map(([k]) => [k, bunka(p, k)])) }));
  const porovnej = (x, y) => (Array.isArray(x) ? porovnej(x[0], y[0]) || porovnej(x[1], y[1])
    : typeof x === "string" && typeof y === "string" ? kolator.compare(x, y) : x < y ? -1 : x > y ? 1 : 0);
  radky.sort((a, b) => porovnej((a.hodnoty[klic] || bunka(a.p, klic)).razeni, (b.hodnoty[klic] || bunka(b.p, klic)).razeni) * smer
    || kolator.compare(nazevProjektu(a.p), nazevProjektu(b.p)));

  const vyber = (id) => {
    stav.vybrany = id;
    for (const tr of telo.children) tr.classList.toggle("vybrany", tr.dataset.id === id);
  };
  const colgroup = h("colgroup", {}, sloupce.map(([k]) => h("col", { dataset: { k }, style: { width: `${sirkaSloupce(k)}px` } })));
  const zahlavi = h("tr", {}, sloupce.map(([k, t], i) => {
    const uchyt = h("span", { class: "uchyt" });
    uchyt.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const col = colgroup.children[i];
      const x0 = ev.clientX, w0 = col.getBoundingClientRect().width || sirkaSloupce(k);
      let w = w0;
      const pohyb = (e) => { w = Math.max(30, w0 + e.clientX - x0); col.style.width = `${w}px`; };
      const konec = () => {
        document.removeEventListener("pointermove", pohyb);
        document.removeEventListener("pointerup", konec);
        zapis(KLIC_SIREK, { ...cti(KLIC_SIREK, {}), [k]: Math.round(w) });
      };
      document.addEventListener("pointermove", pohyb);
      document.addEventListener("pointerup", konec);
    });
    return h("th", { onclick: () => { stav.razeni = [k, klic === k ? -smer : 1]; prekresli(); },
      oncontextmenu: (ev) => { ev.preventDefault(); menu(ev.clientX, ev.clientY, menuSloupcu(prekresli)); } },
    t, klic === k ? h("i", { class: `sipka-razeni ${smer > 0 ? "nahoru" : "dolu"}` }) : null, uchyt);
  }));
  const telo = h("tbody", {}, radky.map(({ p, hodnoty }) => h("tr", {
    class: `${NEAKTIVNI.has(p.status) ? "neaktivni" : ""}${p.id === stav.vybrany ? " vybrany" : ""}`, dataset: { id: p.id }, tabindex: "-1",
    onclick: () => vyber(p.id),
    ondblclick: () => otevrit(p.id),
    onkeydown: (ev) => { if (ev.key === "Enter") otevrit(p.id); },
    oncontextmenu: (ev) => { ev.preventDefault(); vyber(p.id); menuProjektu(ev.clientX, ev.clientY, tym, p, otevrit, cashflow); } },
  sloupce.map(([k]) => {
    const b = hodnoty[k];
    if (k === "stav") {
      return h("td", { class: "b-stav", title: b.tip }, h("span", { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
        odznakStavu(p.status, 18), pismenem ? null : b.text));
    }
    return h("td", { class: `b-${k}${["fakturovano", "neuhrazeno", "saldo"].includes(k) ? " vpravo" : ""}`, text: b.text,
      title: b.tip || null, style: b.barva ? { color: b.barva } : null });
  }))));
  if (!radky.length) telo.append(h("tr", {}, h("td", { colspan: sloupce.length, class: "tiche", text: "Žádný projekt neodpovídá." })));
  const tabulka = h("table", {}, colgroup, h("thead", {}, zahlavi), telo);

  return {
    el: tabulka,
    menuVice(kotva) {
      const p = stav.vybrany ? tym.projekt(stav.vybrany) : null;
      menuPod(kotva, [
        p ? { nadpis: p.nazev || "Vybraný projekt" } : null,
        ...(p ? polozkyProjektu(tym, p, otevrit, cashflow) : []),
        { nadpis: "Všechny projekty" },
        cashflow ? { text: "Cashflow…", ikona: "chart", akce: () => otevriReport({ tym }) } : null,
        { text: "Sloupce", ikona: "grid", podmenu: menuSloupcu(prekresli) },
      ]);
    },
  };
}

function menuSloupcu(prekresli) {
  const videt = viditelneSloupce().map(([k]) => k);
  return [
    { nadpis: "Zobrazené sloupce" },
    ...SLOUPCE.map(([k, t]) => ({ text: t, zaskrtnuto: videt.includes(k), akce: () => { prepniSloupec(k); prekresli(); } })),
    "-",
    { text: "Stav jen písmenem (P / R / O / M)", zaskrtnuto: !!cti(KLIC_PISMENEM, false), akce: () => {
      const nove = !cti(KLIC_PISMENEM, false);
      zapis(KLIC_PISMENEM, nove);
      const s = cti(KLIC_SIREK, {});
      s.stav = nove ? 52 : 120;
      zapis(KLIC_SIREK, s);
      prekresli();
    } },
    { text: "Obnovit výchozí sloupce", ikona: "refresh", akce: () => {
      for (const k of [KLIC_SLOUPCU, KLIC_SIREK, KLIC_PISMENEM]) { try { window.localStorage.removeItem(k); } catch { /* nic */ } }
      prekresli();
    } },
  ];
}
