// Správce projektů ILD – webová verze. Data týmu ve Firebase (stejná jako v programu),
// soubory projektů zůstávají v počítačích (web ukazuje jen cesty).

import { ChybaOblaku, Oblak } from "./oblak.js";
import {
  BARVA_REALIZACE, BARVY_TERMINU, C_DOVOLENA, Dovolene, NEAKTIVNI, Osobni, STATUS_BARVY, Tym, barvaTerminu, cislo,
  datumKratce, dnes, hodinyText, iso, jeHotovo, nazevProjektu, novyTermin, noveId, podtitulProjektu, popisRozsahu,
  rozsah, ted, zIso, zaznamTerminu, zaznamZmeny,
} from "./data.js";
import { Cashflow, dialogFaktury, menuFaktury, otevriReport } from "./cashflow.js";
import { otevriExport } from "./export.js";
import * as FIN from "./finance.js";
import { Kalendar } from "./kalendar.js";
import { SLOUPCE, dialogProjektu, menuProjektu, prepniSloupec, tabulkaProjektu, viditelneSloupce } from "./projekty.js";
import { h, ikona, menu, okno, oznam, pole, vymen, zavriMenu, zavriPopup, zkopiruj } from "./ui.js";
import { Posta, TYM, konverzaceS, protejsek } from "./zpravy.js";

// Jen přes https (hesla, tokeny; šifrování v prohlížeči jinde ani nejde) – web ho sám nevynucuje.
if (window.location.protocol === "http:" && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
  window.location.replace(`https://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`);
  throw new Error("Přesměrování na https.");
}

// Stránka nesmí běžet v cizím rámu (clickjacking) – GitHub Pages neumí hlavičku frame-ancestors.
if (window.top !== window.self) {
  document.documentElement.replaceChildren();
  throw new Error("Stránka nesmí být vložená do rámu.");
}

const oblak = new Oblak();
const tym = new Tym(oblak);
let posta = null;
let osobni = null;            // osobní nastavení (soukromé termíny, filtr a vzhled kalendáře) – jako v programu
let posledniProjekt = "";
let pohled = null;            // {klic, obnov}
const koren = document.getElementById("aplikace");
const kolator = new Intl.Collator("cs");

const sDiakritikou = (t) => String(t || "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");

function chybaText(e) {
  return e instanceof ChybaOblaku ? e.message : "Něco se nepovedlo. Zkus to znovu.";
}

async function proved(akce, hotovo = "") {
  try {
    await akce();
    if (hotovo) oznam(hotovo);
    return true;
  } catch (e) {
    oznam(chybaText(e), true);
    return false;
  }
}

// --- přihlášení ------------------------------------------------------------------------------

function logo(trida = "logo") {
  return h("img", { src: "logo.png", alt: "ILD", class: trida, width: 408, height: 513 });
}

function ukazPrihlaseni(hlaska = "") {
  tym.zastav();
  posta?.zastav();
  document.title = "Správce projektů ILD";
  const jmeno = h("input", { name: "username", autocomplete: "username", required: true, autocapitalize: "none",
    spellcheck: false, placeholder: "jan.novak" });
  const heslo = h("input", { name: "password", type: "password", autocomplete: "current-password" });
  const zustat = h("input", { type: "checkbox" });
  const chyba = h("p", { class: "chyba-formulare", role: "alert", text: hlaska });
  const tlacitko = h("button", { class: "tlacitko hlavni siroke", type: "submit", text: "Přihlásit se" });
  const formular = h("form", {
    class: "prihlaseni karta",
    onsubmit: async (ev) => {
      ev.preventDefault();
      chyba.textContent = "";
      if (!heslo.value) {
        chyba.textContent = "Na webu se přihlašuje s heslem. Když ho nemáš, požádej správce, ať ti ho nastaví.";
        return;
      }
      tlacitko.disabled = true;
      tlacitko.textContent = "Přihlašuji…";
      try {
        const clen = await oblak.prihlas(jmeno.value.trim(), heslo.value, zustat.checked);
        heslo.value = "";
        await spust(clen);
      } catch (e) {
        chyba.textContent = chybaText(e);
        tlacitko.disabled = false;
        tlacitko.textContent = "Přihlásit se";
      }
    },
  },
  logo("logo-prihlaseni"),
  h("h1", { text: "Správce projektů" }),
  pole("Přihlašovací jméno", jmeno),
  pole("Heslo", heslo),
  h("label", { class: "zaskrtavatko" }, zustat, h("span", { text: "Zůstat přihlášen na tomto zařízení" })),
  chyba, tlacitko,
  h("p", { class: "tiche", text: "Stejné jméno a heslo jako v programu na počítači." }));
  vymen(koren, h("div", { class: "obrazovka-prihlaseni" }, formular));
  jmeno.focus();
}

// --- po přihlášení -----------------------------------------------------------------------------

async function spust(clen) {
  vymen(koren, h("div", { class: "nacitani" }, logo("logo-nacitani"), h("p", { text: "Načítám data týmu…" })));
  tym.ja = { id: clen.id, role: clen.role, jmeno: "" };
  osobni = new Osobni(oblak, clen.id);
  await Promise.all([tym.nacti(), osobni.nacti()]);
  tym.ja.jmeno = tym.jmeno(clen.id, "");
  posta = new Posta(oblak, clen.id);
  postavKostru();
  tym.sleduj((stav) => ukazSpojeni(stav));
  tym.pri(() => { tym.ja.jmeno = tym.jmeno(clen.id, tym.ja.jmeno); pohled?.obnov?.(); obnovOdznak(); });
  posta.pri(() => { obnovOdznak(); if (pohled?.klic === "zpravy") pohled.obnov?.(); });
  let odklad = 0;
  osobni.pri(() => { clearTimeout(odklad); odklad = setTimeout(() => pohled?.obnov?.(), 40); });
  posta.spust();
  window.addEventListener("hashchange", trasa);
  trasa();
}

const NAVIGACE = [
  ["projekty", "Projekty", "projekty"],
  ["kalendar", "Kalendář", "kalendar"],
  ["dovolena", "Dovolená", "dovolena"],
  ["zpravy", "Zprávy", "zpravy"],
];

let odznak = null;
let tecka = null;

function postavKostru() {
  odznak = h("span", { class: "odznak", hidden: true });
  tecka = h("span", { class: "spojeni", title: "Připojuji…" });
  const odkazy = NAVIGACE.map(([klic, nazev, ik]) => h("a", { href: `#/${klic}`, class: "nav-odkaz", dataset: { klic } },
    ikona(ik), h("span", { text: nazev }), klic === "zpravy" ? odznak : null));
  const uzivatel = h("button", {
    type: "button", class: "nav-uzivatel", title: tym.ja.jmeno || "Uživatel",
    onclick: () => okno(tym.ja.jmeno || "Uživatel", [
      h("p", { text: tym.jeSpravce ? "Správce" : "Uživatel" }),
      h("p", { class: "tiche", text: "Soubory projektů se otevírají v programu na počítači. Na webu jsou data týmu: projekty, úkoly, termíny, dovolená a zprávy." }),
      pozvankaInstalace ? h("button", { type: "button", class: "tlacitko siroke", onclick: async () => {
        pozvankaInstalace.prompt();
        await pozvankaInstalace.userChoice.catch(() => null);
        pozvankaInstalace = null;
      } }, ikona("plus"), "Nainstalovat jako aplikaci") : null,
    ], [{ text: "Odhlásit se", nebezpecne: true, akce: odhlas }, { text: "Zavřít" }]),
  }, h("span", { class: "kolecko", text: inicialy(tym.ja.jmeno) }), tecka);
  vymen(koren, h("nav", { class: "lista" }, h("a", { href: "#/projekty", class: "nav-logo", "aria-label": "Projekty" }, logo("logo-lista")),
    odkazy, h("div", { class: "mezera" }), uzivatel), h("main", { id: "obsah" }));
}

function inicialy(jmeno) {
  return String(jmeno || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("") || "?";
}

function ukazSpojeni(stav) {
  if (!tecka) return;
  tecka.className = stav ? "spojeni pripojeno" : "spojeni";
  tecka.title = stav ? "Připojeno – změny kolegů se ukazují hned" : "Bez spojení se serverem";
}

function obnovOdznak() {
  if (!odznak || !posta) return;
  const n = posta.pocetNeprectenych();
  odznak.hidden = !n;
  odznak.textContent = String(n);
  document.title = `${n ? `(${n}) ` : ""}Správce projektů ILD`;
}

function odhlas() {
  tym.zastav();
  posta?.zastav();
  oblak.odhlas();
  window.location.replace(window.location.pathname);
}

// --- trasy ---------------------------------------------------------------------------------

function trasa() {
  const casti = window.location.hash.replace(/^#\/?/, "").split("/").map((c) => {
    try { return decodeURIComponent(c); } catch { return ""; }
  });
  const [klic, parametr, dalsi] = casti;
  const obsah = document.getElementById("obsah");
  if (!obsah) return;
  const pohledy = { projekty: pohledProjekty, projekt: pohledProjekt, kalendar: pohledKalendar,
    dovolena: pohledDovolena, zpravy: pohledZpravy };
  const tvorba = pohledy[klic] || pohledProjekty;
  pohled?.zrus?.();
  // okénka, nabídky a panely patří ke stránce, ze které se odchází
  for (const d of document.querySelectorAll("dialog.okno")) { d.close(); d.remove(); }
  zavriMenu();
  zavriPopup();
  pohled = tvorba(parametr || "", dalsi || "") || null;
  if (pohled) pohled.klic = pohledy[klic] ? klic : "projekty";
  for (const a of document.querySelectorAll(".nav-odkaz")) {
    const vybrany = a.dataset.klic === (pohled?.klic === "projekt" ? "projekty" : pohled?.klic);
    a.classList.toggle("vybrany", vybrany);
    if (vybrany) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  vymen(obsah, pohled?.el || "");
  obsah.scrollTop = 0;
  window.scrollTo(0, 0);
}

function hlavicka(nadpis, ...vpravo) {
  return h("header", { class: "hlavicka" }, h("h1", { text: nadpis }), h("div", { class: "hlavicka-vpravo" }, vpravo));
}

// --- projekty ----------------------------------------------------------------------------------

function nejblizsiTermin(p) {
  const dnesek = zIso(dnes());
  let nej = null;
  for (const t of Array.isArray(p.harmonogram) ? p.harmonogram : []) {
    const rz = rozsah(t);
    if (!rz || rz[1] < dnesek || jeHotovo(t)) continue;
    if (!nej || rz[0] < nej[0]) nej = [rz[0], t];
  }
  return nej;
}

const otevreneUkoly = (p) => (Array.isArray(p.ukoly) ? p.ukoly : []).filter((u) => u && !u.hotovo);

let filtrProjektu = { text: "", vse: false, pohled: "", razeni: ["nazev", 1] };

function pohledSeznamu() {
  if (!filtrProjektu.pohled) {
    try { filtrProjektu.pohled = window.localStorage.getItem("ild-pohled-projektu") || ""; } catch { /* nic */ }
    if (!["karty", "tabulka"].includes(filtrProjektu.pohled)) filtrProjektu.pohled = window.innerWidth >= 900 ? "tabulka" : "karty";
  }
  return filtrProjektu.pohled;
}

const otevritProjekt = (id) => { window.location.hash = `#/projekt/${encodeURIComponent(id)}`; };

function pohledProjekty() {
  const hledani = h("input", { type: "search", placeholder: "Hledat projekt…", value: filtrProjektu.text,
    "aria-label": "Hledat projekt", oninput: () => { filtrProjektu.text = hledani.value; obnov(); } });
  const prepinac = segment([["aktivni", "Aktivní"], ["vse", "Všechny"]], filtrProjektu.vse ? "vse" : "aktivni",
    (v) => { filtrProjektu.vse = v === "vse"; obnov(); });
  const pohledSeg = segment([["karty", "Karty"], ["tabulka", "Tabulka"]], pohledSeznamu(), (v) => {
    filtrProjektu.pohled = v;
    try { window.localStorage.setItem("ild-pohled-projektu", v); } catch { /* nic */ }
    obnov();
  });
  const novy = h("button", { type: "button", class: "tlacitko male hlavni", onclick: () => dialogProjektu(tym, null, otevritProjekt) },
    ikona("plus"), h("span", { class: "skryt-uzke", text: "Nový projekt" }));
  const vice = h("button", { type: "button", class: "ikonove", "aria-label": "Další volby", title: "Další volby",
    onclick: () => {
      const r = vice.getBoundingClientRect();
      const videt = viditelneSloupce().map(([k]) => k);
      menu(r.left, r.bottom, [
        { text: "Cashflow – report pro vedení…", ikona: "export", akce: () => otevriReport({ tym }) },
        ...(pohledSeznamu() === "tabulka" ? ["-", { nadpis: "Sloupce" },
          ...SLOUPCE.map(([k, nazev]) => ({ text: `${videt.includes(k) ? "✓ " : "    "}${nazev}`, akce: () => { prepniSloupec(k); obnov(); } }))] : []),
      ]);
    } }, "⋯");
  const seznam = h("div");
  const pocet = h("p", { class: "tiche" });

  function obnov() {
    const slova = sDiakritikou(filtrProjektu.text).split(/\s+/).filter(Boolean);
    const projekty = tym.projekty.filter((p) => filtrProjektu.vse || !NEAKTIVNI.has(p.status)).filter((p) => {
      const text = sDiakritikou([p.nazev, p.lokalita, p.cislo, p.investor, p.provozni_soubor].join(" "));
      return slova.every((s) => text.includes(s));
    }).sort((a, b) => kolator.compare(nazevProjektu(a), nazevProjektu(b)));
    pocet.textContent = projekty.length ? "" : "Žádný projekt neodpovídá.";
    if (pohledSeznamu() === "tabulka") {
      vymen(seznam, projekty.length ? tabulkaProjektu(tym, projekty, filtrProjektu, otevritProjekt, obnov) : null);
      return;
    }
    vymen(seznam, h("div", { class: "seznam-projektu" }, projekty.map((p) => {
      const ukoly = otevreneUkoly(p).length;
      const termin = nejblizsiTermin(p);
      return h("a", { class: "karta projekt", href: `#/projekt/${encodeURIComponent(p.id)}`,
        oncontextmenu: (ev) => { ev.preventDefault(); menuProjektu(ev.clientX, ev.clientY, tym, p, otevritProjekt); } },
      h("span", { class: "pruh-stavu", style: { background: STATUS_BARVY[p.status] || "var(--tiche)" } }),
      h("div", { class: "projekt-text" },
        h("strong", { text: nazevProjektu(p) }),
        h("span", { class: "tiche", text: podtitulProjektu(p) }),
        h("div", { class: "projekt-udaje" },
          h("span", { class: "stitek-stavu", text: p.status || "" }),
          ukoly ? h("span", { text: `☐ ${ukoly} ${ukoly === 1 ? "úkol" : ukoly < 5 ? "úkoly" : "úkolů"}` }) : null,
          termin ? h("span", {}, h("i", { class: "tecka", style: { background: barvaTerminu(termin[1]) } }),
            `${datumKratce(termin[0])} ${termin[1].nazev || tym.nazevDruhu(termin[1])}`) : null)),
      h("button", { type: "button", class: "ikonove male karta-akce", "aria-label": "Akce s projektem",
        onclick: (ev) => { ev.preventDefault(); ev.stopPropagation(); const r = ev.currentTarget.getBoundingClientRect(); menuProjektu(r.left, r.bottom, tym, p, otevritProjekt); } }, "⋯"));
    })));
  }

  obnov();
  return { el: h("section", { class: `pohled projekty-pohled` }, hlavicka("Projekty", prepinac, pohledSeg, novy, vice),
    h("div", { class: "hledani" }, ikona("hledat"), hledani), seznam, pocet), obnov };
}

function segment(volby, vybrana, zmena) {
  const el = h("div", { class: "segment", role: "group" });
  for (const [hodnota, text] of volby) {
    el.append(h("button", { type: "button", text, "aria-pressed": String(hodnota === vybrana),
      onclick: () => {
        for (const b of el.children) b.setAttribute("aria-pressed", "false");
        el.querySelector(`[data-h="${hodnota}"]`)?.setAttribute("aria-pressed", "true");
        zmena(hodnota);
      }, dataset: { h: hodnota } }));
  }
  return el;
}

// --- detail projektu ---------------------------------------------------------------------------

// Projekt má stejné tři záložky jako v programu: Přehled | Soubory | Harmonogram
const ZALOZKY = [["prehled", "Přehled"], ["soubory", "Soubory"], ["harmonogram", "Harmonogram"]];

function pohledProjekt(id, zalozka = "prehled") {
  if (!ZALOZKY.some(([k]) => k === zalozka) && zalozka !== "cashflow") zalozka = "prehled";
  const vybrana = zalozka === "cashflow" ? "harmonogram" : zalozka;
  posledniProjekt = id;
  const zahlavi = h("div");
  const zalozky = h("nav", { class: "zalozky", "aria-label": "Záložky projektu" }, ZALOZKY.map(([k, t]) => h("a", {
    href: `#/projekt/${encodeURIComponent(id)}/${k}`, class: k === vybrana ? "vybrana" : "", "aria-current": k === vybrana ? "page" : null, text: t })));
  const obnovZahlavi = () => {
    const p = tym.projekt(id);
    if (!p) { vymen(zahlavi, h("p", { text: "Projekt nebyl nalezen (možná byl smazán)." })); return false; }
    vymen(zahlavi, h("div", { class: "zahlavi-projektu" },
      h("a", { href: "#/projekty", class: "zpet" }, ikona("zpet"), "Projekty"),
      h("div", { class: "nadpis-projektu" }, h("h1", { text: nazevProjektu(p) }),
        p.status ? h("span", { class: "stitek-stavu", style: { "--barva": STATUS_BARVY[p.status] || "#667085" }, text: p.status }) : null),
      h("p", { class: "tiche", text: podtitulProjektu(p) })));
    return true;
  };
  obnovZahlavi();
  let telo;
  if (vybrana === "harmonogram") {
    // u zakázek R a O přepínač Termíny | Cashflow (jako v programu; osobně jde vypnout – nastavení „cashflow“)
    const sCashflow = () => FIN.maCashflow(tym.projekt(id)) && osobni.hodnota.cashflow !== false;
    const rezim = zalozka === "cashflow" && sCashflow() ? "cashflow" : "harmonogram";
    const prepinac = sCashflow() ? h("div", { class: "cf-prepinac" }, segment([["harmonogram", "Termíny"], ["cashflow", "Cashflow"]], rezim,
      (v) => { window.location.hash = `#/projekt/${encodeURIComponent(id)}/${v}`; })) : null;
    if (rezim === "cashflow") {
      const cf = new Cashflow({ tym, projektId: id, naKalendar: () => { window.location.hash = `#/projekt/${encodeURIComponent(id)}/harmonogram`; } });
      return { el: h("section", { class: "pohled projekt-detail" }, zahlavi, zalozky, prepinac, cf.el),
        obnov: () => { if (obnovZahlavi()) cf.obnov(); } };
    }
    const kal = new Kalendar({ tym, osobni, projektId: id, naProjekt: () => {},
      naExport: ({ obdobi }) => otevriExport({ tym, osobni, projektId: id, obdobi }),
      faktury: () => (sCashflow() && osobni.hodnota.faktury_v_kalendari !== false ? FIN.pruhyFaktur(tym.projekt(id)) : []),
      naFakturu: (fid, akce, x, y) => {
        if (akce === "upravit") dialogFaktury(tym, id, fid);
        else if (akce === "menu") menuFaktury(x, y, tym, id, fid);
        else if (akce === "cashflow") window.location.hash = `#/projekt/${encodeURIComponent(id)}/cashflow`;
        else if (akce === "nova") dialogFaktury(tym, id, null, { typ: FIN.VYDANA, termin: x });
      } });
    return { el: h("section", { class: "pohled projekt-detail kal-pohled" }, zahlavi, zalozky, prepinac, kal.el),
      obnov: () => { if (obnovZahlavi()) kal.obnov(); }, zrus: () => kal.zrus() };
  }
  telo = zalozka === "soubory" ? zalozkaSoubory(id) : zalozkaPrehled(id);
  return { el: h("section", { class: "pohled projekt-detail" }, zahlavi, zalozky, telo.el),
    obnov: () => { if (obnovZahlavi()) telo.obnov(); } };
}

function zalozkaPrehled(id) {
  const ukoly = h("div", { class: "seznam" });
  const terminy = h("div", { class: "seznam" });
  const poznamky = h("div", { class: "seznam" });
  const historie = h("div", { class: "seznam" });
  let ukazHotove = false, poznamekVidet = 5;

  const novyUkol = h("input", { placeholder: "Nový úkol…", "aria-label": "Nový úkol", maxlength: 500 });
  const formUkolu = h("form", { class: "radek-formulare", onsubmit: async (ev) => {
    ev.preventDefault();
    const text = novyUkol.value.trim();
    if (!text) return;
    novyUkol.value = "";
    const ok = await proved(() => tym.upravProjekt(id, (p) => {
      if (!Array.isArray(p.ukoly)) p.ukoly = [];
      p.ukoly.push({ id: noveId(), text, hotovo: false, vytvoreno: ted(), splneno: "" });
    }, `Přidán úkol: ${text}`));
    if (!ok) novyUkol.value = text;
  } }, novyUkol, h("button", { class: "tlacitko", type: "submit", "aria-label": "Přidat úkol" }, ikona("plus")));

  const novaPoznamka = h("textarea", { rows: 2, placeholder: "Nová poznámka…", "aria-label": "Nová poznámka", maxlength: 10000 });
  const formPoznamky = h("form", { class: "radek-formulare", onsubmit: async (ev) => {
    ev.preventDefault();
    const text = novaPoznamka.value.trim();
    if (!text) return;
    novaPoznamka.value = "";
    const ok = await proved(() => tym.upravProjekt(id, (p) => {
      if (!Array.isArray(p.poznamky)) p.poznamky = [];
      const pol = { id: noveId(), cas: ted(), text };
      if (tym.ja.jmeno) pol.autor = tym.ja.jmeno;
      p.poznamky.push(pol);
    }, "Přidána poznámka"), "Poznámka uložena");
    if (!ok) novaPoznamka.value = text;
  } }, novaPoznamka, h("button", { class: "tlacitko", type: "submit", "aria-label": "Uložit poznámku" }, ikona("plus")));

  function obnov() {
    const p = tym.projekt(id);
    if (!p) return;
    const vsechny = (Array.isArray(p.ukoly) ? p.ukoly : []).filter((u) => u && u.id);
    const hotove = vsechny.filter((u) => u.hotovo);
    vymen(ukoly, vsechny.filter((u) => !u.hotovo).map((u) => radekUkolu(id, u)),
      !vsechny.length ? h("p", { class: "tiche", text: "Žádné úkoly." }) : null,
      hotove.length ? h("button", { type: "button", class: "odkaz", text: `${ukazHotove ? "Skrýt" : "Zobrazit"} hotové (${hotove.length})`,
        onclick: () => { ukazHotove = !ukazHotove; obnov(); } }) : null,
      ukazHotove ? hotove.map((u) => radekUkolu(id, u)) : null);

    // nejbližší termíny (celý harmonogram je na záložce Harmonogram)
    const dnesek = zIso(dnes());
    const budouci = (Array.isArray(p.harmonogram) ? p.harmonogram : []).filter((t) => t && rozsah(t) && rozsah(t)[1] >= dnesek)
      .sort((a, b) => rozsah(a)[0] - rozsah(b)[0]);
    vymen(terminy, budouci.slice(0, 8).map((t) => radekTerminu(t, () => detailTerminu(id, t.id))),
      !budouci.length ? h("p", { class: "tiche", text: "Žádné nadcházející termíny." }) : null,
      h("a", { class: "odkaz", href: `#/projekt/${encodeURIComponent(id)}/harmonogram`, text: "Celý harmonogram ›" }));

    const pozn = (Array.isArray(p.poznamky) ? p.poznamky : []).filter((x) => x && x.text)
      .sort((a, b) => String(b.cas || "").localeCompare(String(a.cas || "")));
    vymen(poznamky, pozn.slice(0, poznamekVidet).map((x) => h("article", { class: "poznamka" },
      h("div", { class: "poznamka-obsah", ondblclick: () => upravPoznamku(id, x) },
        h("p", { class: "text-poznamky", text: x.text }),
        h("small", { class: "tiche", text: [casText(x.cas), x.autor].filter(Boolean).join(" · ") })),
      h("button", { type: "button", class: "ikonove male", "aria-label": "Akce s poznámkou",
        onclick: (ev) => { const r = ev.currentTarget.getBoundingClientRect(); menu(r.left, r.bottom, [
          { text: "Upravit…", ikona: "upravit", akce: () => upravPoznamku(id, x) },
          { text: "Smazat", ikona: "smazat", nebezpecne: true, akce: () => smazPoznamku(id, x) }]); } }, "⋯"))),
    !pozn.length ? h("p", { class: "tiche", text: "Žádné poznámky." }) : null,
    pozn.length > poznamekVidet ? h("button", { type: "button", class: "odkaz", text: `Zobrazit další (${pozn.length - poznamekVidet})`,
      onclick: () => { poznamekVidet += 20; obnov(); } }) : null);

    const hist = (Array.isArray(p.historie) ? p.historie : []).filter((x) => x && x.text).slice(-40).reverse();
    vymen(historie, hist.map((x) => h("div", { class: "radek-historie" },
      h("small", { class: "tiche", text: [casText(x.cas), x.kdo].filter(Boolean).join(" · ") }), h("span", { text: x.text }))),
    !hist.length ? h("p", { class: "tiche", text: "Zatím nic." }) : null);
  }

  obnov();
  return { el: h("div", { class: "mrizka-projektu" },
    h("div", { class: "sloupec" },
      karta("Úkoly", null, formUkolu, ukoly),
      karta("Poznámky", null, formPoznamky, poznamky)),
    h("div", { class: "sloupec" },
      karta("Nejbližší termíny", h("button", { type: "button", class: "tlacitko male", onclick: () => dialogTerminu(id) }, ikona("plus"), "Termín"), terminy),
      h("details", { class: "karta" }, h("summary", { text: "Historie projektu" }), historie))), obnov };
}

// --- soubory: odkazy, které otevře program na počítači (v práci nebo přes VPN) -----------------------

const PROTOKOL = "ild-soubor";

function otevriVPocitaci(cesta, projekt = "") {
  const url = `${PROTOKOL}:otevrit?cesta=${encodeURIComponent(cesta)}${projekt ? `&projekt=${encodeURIComponent(projekt)}` : ""}`;
  const a = h("a", { href: url, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  oznam("Otevírám v počítači – přes program Správce projektů (v síti firmy nebo přes VPN)");
}

const jeTelefon = () => window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(pointer: fine)").matches;

function dialogOdkazu(pid, odkaz = null, cestu = false) {
  const popis = h("input", { value: odkaz?.popis || "", maxlength: 200, placeholder: "např. Výkresy" });
  const cesta = h("input", { value: odkaz?.cesta || "", maxlength: 1000, placeholder: "např. P:\\Projekty\\Brno\\Výkresy" });
  okno(odkaz ? (cestu ? "Změnit cestu" : "Přejmenovat odkaz") : "Přidat složku nebo soubor", [
    odkaz && cestu ? null : pole("Název", popis), odkaz && !cestu ? null : pole("Cesta", cesta, "Cesta, jak ji vidí počítače v síti firmy (web na disky nevidí – nekontroluje, že existuje)."),
  ], [{ text: "Zrušit" }, { text: odkaz ? "Uložit" : "Přidat", hlavni: true, akce: async () => {
    const c = cesta.value.trim(), t = popis.value.trim() || c.split(/[\\/]/).filter(Boolean).pop() || c;
    if (!c) throw new Error("Doplň cestu.");
    if (!odkaz) {
      await tym.upravProjekt(pid, (p) => {
        if (!Array.isArray(p.odkazy)) p.odkazy = [];
        if (p.odkazy.some((o) => o.cesta === c)) throw new Error("Tahle cesta už v projektu je.");
        p.odkazy.push({ popis: t, cesta: c });
      }, `Přidán odkaz: ${t}`);
      return;
    }
    await tym.upravProjekt(pid, (p) => {
      const o = (p.odkazy || []).find((x) => x.cesta === odkaz.cesta);
      if (!o) throw new Error("Odkaz už v projektu není.");
      if (cestu) { if (o.cesta === c) return false; o.cesta = c; } else { if (o.popis === t) return false; o.popis = t; }
    }, `Změněn odkaz: ${cestu ? odkaz.popis || t : t}`);
  } }]);
  (odkaz && cestu ? cesta : popis).focus();
}

function odeberOdkaz(pid, odkaz) {
  okno("Odebrat z projektu?", [h("p", { text: `${odkaz.popis || odkaz.cesta}` }), h("p", { class: "tiche", text: "Odebere se jen odkaz v projektu – složka ani soubory na disku se nemažou." })], [
    { text: "Zrušit" },
    { text: "Odebrat", nebezpecne: true, akce: () => tym.upravProjekt(pid, (p) => {
      const i = (p.odkazy || []).findIndex((x) => x.cesta === odkaz.cesta);
      if (i < 0) return false;
      p.odkazy.splice(i, 1);
    }, `Odebrán odkaz: ${odkaz.popis || ""}`) },
  ]);
}

function zalozkaSoubory(id) {
  const seznam = h("div", { class: "seznam soubory" });
  function obnov() {
    const p = tym.projekt(id);
    if (!p) return;
    const ods = (Array.isArray(p.odkazy) ? p.odkazy : []).filter((o) => o && o.cesta);
    vymen(seznam, ods.map((o) => {
      const soubor = /\.[a-z0-9]{1,5}$/i.test(o.cesta);
      const nazev = o.popis || o.cesta.split(/[\\/]/).filter(Boolean).pop() || o.cesta;
      return h("div", { class: "radek odkaz-slozky" },
        h("button", { type: "button", class: "radek-hlavni", title: `${o.cesta}\nOtevřít v počítači`, onclick: () => otevriVPocitaci(o.cesta, id) },
          ikona(soubor ? "soubor" : "slozka"),
          h("div", { class: "radek-text" }, h("strong", { text: nazev }), h("small", { class: "tiche cesta", text: o.cesta }))),
        h("button", { type: "button", class: "ikonove", title: "Otevřít v počítači", "aria-label": `Otevřít ${nazev} v počítači`,
          onclick: () => otevriVPocitaci(o.cesta, id) }, ikona("otevrit")),
        h("button", { type: "button", class: "ikonove", title: "Kopírovat cestu", "aria-label": "Kopírovat cestu",
          onclick: () => zkopiruj(o.cesta) }, ikona("kopirovat")),
        h("button", { type: "button", class: "ikonove", "aria-label": "Další akce", title: "Další akce",
          onclick: (ev) => { const r = ev.currentTarget.getBoundingClientRect(); menu(r.left, r.bottom, [
            { nadpis: nazev },
            { text: "Přejmenovat…", ikona: "upravit", akce: () => dialogOdkazu(id, o) },
            { text: "Změnit cestu…", akce: () => dialogOdkazu(id, o, true) },
            "-",
            { text: "Odebrat z projektu", ikona: "smazat", nebezpecne: true, akce: () => odeberOdkaz(id, o) }]); } }, "⋯"));
    }), !ods.length ? h("p", { class: "tiche", text: "Projekt nemá žádné složky ani soubory." }) : null);
  }
  obnov();
  return { el: h("div", {}, karta("Složky a soubory projektu",
    h("button", { type: "button", class: "tlacitko male", onclick: () => dialogOdkazu(id, null) }, ikona("plus"), "Přidat"),
    h("p", { class: "tiche male napoveda-souboru", text: jeTelefon()
      ? "Na telefonu jde jen zkopírovat cestu – otevřít se dají na počítači s programem Správce projektů."
      : "Klik otevře složku nebo soubor na tomto počítači – přes program Správce projektů, v síti firmy nebo přes VPN. Prohlížeč se poprvé zeptá, jestli program smí otevřít." }),
    seznam)), obnov };
}

function karta(nadpis, akce, ...obsah) {
  return h("section", { class: "karta" }, h("div", { class: "karta-hlavicka" }, h("h2", { text: nadpis }), akce), obsah);
}

function casText(cas) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?/.exec(String(cas || ""));
  if (!m) return String(cas || "");
  return `${+m[3]}. ${+m[2]}. ${m[1]}${m[4] ? " " + m[4] : ""}`;
}

function radekUkolu(pid, u) {
  const box = h("input", { type: "checkbox", checked: !!u.hotovo, "aria-label": u.text,
    onchange: () => proved(() => tym.upravProjekt(pid, (p) => {
      const x = (p.ukoly || []).find((y) => y.id === u.id);
      if (!x) return false;
      x.hotovo = box.checked;
      x.splneno = box.checked ? ted() : "";
    }, `${box.checked ? "Splněn úkol: " : "Znovu otevřen úkol: "}${u.text}`)) });
  return h("div", { class: `radek ukol${u.hotovo ? " hotovo" : ""}` },
    h("label", { class: "ukol-text" }, box, h("span", { text: u.text })),
    h("button", { type: "button", class: "ikonove male", "aria-label": "Akce s úkolem",
      onclick: (ev) => { const r = ev.currentTarget.getBoundingClientRect(); menu(r.left, r.bottom, [
        { text: "Upravit…", ikona: "upravit", akce: () => upravUkol(pid, u) },
        { text: "Smazat", ikona: "smazat", nebezpecne: true, akce: () => smazUkol(pid, u) }]); } }, "⋯"));
}

function upravUkol(pid, u) {
  const pole2 = h("input", { value: u.text, maxlength: 500 });
  okno("Upravit úkol", [pole2], [{ text: "Zrušit" }, { text: "Uložit", hlavni: true, akce: async () => {
    const text = pole2.value.trim();
    if (!text) throw new Error("Úkol nesmí být prázdný.");
    await tym.upravProjekt(pid, (p) => {
      const x = (p.ukoly || []).find((y) => y.id === u.id);
      if (!x || x.text === text) return false;
      x.text = text;
    }, `Upraven úkol: ${text}`);
  } }]);
  pole2.focus();
}

async function smazUkol(pid, u) {
  let index = -1, smazany = null;
  const ok = await proved(() => tym.upravProjekt(pid, (p) => {
    index = (p.ukoly || []).findIndex((y) => y.id === u.id);
    if (index < 0) return false;
    smazany = p.ukoly.splice(index, 1)[0];
  }, `Smazán úkol: ${u.text}`));
  if (!ok || !smazany) return;
  oznam(`Úkol „${u.text.slice(0, 40)}“ smazán`, false, { text: "Vrátit", fn: () => proved(() => tym.upravProjekt(pid, (p) => {
    if (!Array.isArray(p.ukoly)) p.ukoly = [];
    if (p.ukoly.some((y) => y.id === smazany.id)) return false;
    p.ukoly.splice(Math.min(index, p.ukoly.length), 0, smazany);
  }, `Obnoven úkol: ${smazany.text}`)) });
}

function upravPoznamku(pid, x) {
  const pole2 = h("textarea", { rows: 6, maxlength: 10000 });
  pole2.value = x.text;
  okno("Upravit poznámku", [pole2], [{ text: "Zrušit" }, { text: "Uložit", hlavni: true, akce: async () => {
    const text = pole2.value.trim();
    if (!text) throw new Error("Poznámka nesmí být prázdná.");
    await tym.upravProjekt(pid, (p) => {
      const y = (p.poznamky || []).find((z) => z.id === x.id);
      if (!y || y.text === text) return false;
      y.text = text;
      y.cas = y.cas || ted();
    }, "Upravena poznámka");
  } }]);
  pole2.focus();
}

async function smazPoznamku(pid, x) {
  let index = -1, smazana = null;
  const ok = await proved(() => tym.upravProjekt(pid, (p) => {
    index = (p.poznamky || []).findIndex((z) => z.id === x.id);
    if (index < 0) return false;
    smazana = p.poznamky.splice(index, 1)[0];
  }, "Smazána poznámka"));
  if (!ok || !smazana) return;
  oznam("Poznámka smazána", false, { text: "Vrátit", fn: () => proved(() => tym.upravProjekt(pid, (p) => {
    if (!Array.isArray(p.poznamky)) p.poznamky = [];
    if (p.poznamky.some((z) => z.id === smazana.id)) return false;
    p.poznamky.splice(Math.min(index, p.poznamky.length), 0, smazana);
  }, "Obnovena poznámka")) });
}

function radekTerminu(t, klik, projekt = "") {
  const rz = rozsah(t);
  return h("button", { type: "button", class: `radek termin${jeHotovo(t) ? " hotovo" : ""}`, onclick: klik },
    h("i", { class: "tecka", style: { background: barvaTerminu(t) } }),
    h("div", { class: "radek-text" },
      h("strong", { text: t.nazev || tym.nazevDruhu(t) || "Termín" }),
      h("small", { class: "tiche", text: [rz ? popisRozsahu(rz[0], rz[1]) : "", projekt || tym.nazevDruhu(t)].filter(Boolean).join(" · ") })));
}

function detailTerminu(pid, tid) {
  const p = tym.projekt(pid);
  const t = (p?.harmonogram || []).find((x) => x.id === tid);
  if (!t) return;
  const rz = rozsah(t);
  const zmeny = (Array.isArray(t.zmeny) ? t.zmeny : []).slice(-8).reverse();
  okno(t.nazev || tym.nazevDruhu(t) || "Termín", [
    h("dl", { class: "udaje" },
      h("dt", { text: "Projekt" }), h("dd", { text: nazevProjektu(p) }),
      h("dt", { text: "Kdy" }), h("dd", { text: rz ? popisRozsahu(rz[0], rz[1]) : "—" }),
      h("dt", { text: "Druh" }), h("dd", {}, h("i", { class: "tecka", style: { background: barvaTerminu(t) } }), tym.nazevDruhu(t)),
      h("dt", { text: "Stav" }), h("dd", { text: jeHotovo(t) ? "Hotovo" : "Plánováno" }),
      t.poznamka ? [h("dt", { text: "Poznámka" }), h("dd", { class: "text-poznamky", text: t.poznamka })] : null),
    zmeny.length ? h("details", {}, h("summary", { text: "Historie termínu" }),
      zmeny.map((z) => h("div", { class: "radek-historie" }, h("small", { class: "tiche", text: [casText(z.cas), z.kdo].filter(Boolean).join(" · ") }),
        h("span", { text: z.text })))) : null,
  ], [
    { text: jeHotovo(t) ? "Znovu otevřít" : "Označit jako hotové", hlavni: true, akce: () => tym.upravProjekt(pid, (pr) => {
      const x = (pr.harmonogram || []).find((y) => y.id === tid);
      if (!x) return false;
      const hotovo = !jeHotovo(x);
      x.stav = hotovo ? "Dokončeno" : "Plánováno";
      zaznamTerminu(x, hotovo ? "Označen jako hotový" : "Znovu otevřen", tym.ja.jmeno);
      zaznamZmeny(pr, (hotovo ? "Hotovo: " : "Znovu otevřeno: ") + (x.nazev || ""), tym.ja.jmeno);
    }) },
    { text: "Zavřít" },
  ]);
}

function vyberDruhu(vybrana = BARVY_TERMINU[BARVY_TERMINU.length - 1]) {
  const sel = h("select", {}, BARVY_TERMINU.map((b) => h("option", { value: b, text: tym.vyznamBarvy(b), selected: b === vybrana })));
  return sel;
}

function dialogTerminu(pid) {
  const nazev = h("input", { maxlength: 200, placeholder: "např. Kontrolní den" });
  const od = h("input", { type: "date", value: dnes(), required: true });
  const doo = h("input", { type: "date" });
  const druh = vyberDruhu();
  const upresneni = h("input", { maxlength: 100, placeholder: "např. Jeřáby na stavbě" });
  const poleUpresneni = pole("Upřesnění (nepovinné)", upresneni);
  const poznamka = h("textarea", { rows: 3, maxlength: 5000 });
  const ukazUpresneni = () => { poleUpresneni.hidden = druh.value !== BARVA_REALIZACE; };
  druh.addEventListener("change", ukazUpresneni);
  ukazUpresneni();
  okno("Nový termín", [pole("Název", nazev), h("div", { class: "dve-pole" }, pole("Od", od), pole("Do (nepovinné)", doo)),
    pole("Druh", druh), poleUpresneni, pole("Poznámka", poznamka)], [
    { text: "Zrušit" },
    { text: "Přidat termín", hlavni: true, akce: async () => {
      const z = zIso(od.value);
      let k = zIso(doo.value) || z;
      if (!z) throw new Error("Vyber datum.");
      const z2 = k < z ? k : z;
      k = k < z ? z : k;
      const upr = druh.value === BARVA_REALIZACE ? upresneni.value.trim() : "";
      const jmeno = nazev.value.trim() || upr;
      if (!jmeno) throw new Error("Doplň název termínu.");
      const udaje = { nazev: jmeno, poznamka: poznamka.value.trim(), barva: druh.value, stav: "Plánováno", datum: iso(z2) };
      if (iso(k) !== iso(z2)) udaje.datum_do = iso(k);
      if (upr) udaje.upresneni = upr;
      await tym.upravProjekt(pid, (p) => {
        if (!Array.isArray(p.harmonogram)) p.harmonogram = [];
        p.harmonogram.push(novyTermin(udaje, tym.ja.jmeno));
      }, `Přidán termín: ${jmeno} (${popisRozsahu(z2, k)})`);
      oznam("Termín přidán");
    } },
  ]);
  nazev.focus();
}

// --- kalendář ----------------------------------------------------------------------------------

function pohledKalendar() {
  const kal = new Kalendar({ tym, osobni,
    naProjekt: (pid) => { window.location.hash = `#/projekt/${encodeURIComponent(pid)}/prehled`; },
    naExport: ({ obdobi, kalendar }) => otevriExport({ tym, osobni, kalendar, obdobi }),
    posledniProjekt: () => posledniProjekt });
  return { el: h("section", { class: "pohled kal-pohled" }, kal.el), obnov: () => kal.obnov(), zrus: () => kal.zrus() };
}

function zaskrtavatko(text, hodnota, zmena) {
  const box = h("input", { type: "checkbox", checked: hodnota, onchange: () => zmena(box.checked) });
  return h("label", { class: "zaskrtavatko" }, box, h("span", { text }));
}

// --- dovolená ----------------------------------------------------------------------------------

function pohledDovolena(parametr) {
  const rok = /^\d{4}$/.test(parametr) ? +parametr : new Date().getFullYear();
  const moje = h("div");
  const tymova = h("div");

  function obnov() {
    const dov = new Dovolene(tym.hodnota("dovolene"), tym.nastaveni);
    const b = dov.bilance(tym.ja.id, rok);
    const den = dov.den;
    vymen(moje, h("div", { class: "dlazdice" },
      dlazdice("Převod z loňska", hodinyText(b.prevod, den)),
      dlazdice("Nárok", hodinyText(b.narok, den)),
      dlazdice("Vyčerpáno", hodinyText(b.vycerpano, den)),
      dlazdice("Naplánováno", hodinyText(b.naplanovano, den)),
      dlazdice("Zbývá", hodinyText(b.zbyva, den), b.zbyva < 0 ? "zaporne" : "zvyraznene")),
    seznamDovolenych(dov, dov.cloveka(tym.ja.id), rok, false));
    if (!tym.jeSpravce) { tymova.replaceChildren(); return; }
    const lide = tym.aktivni.map((u) => u.id);
    for (const p of dov.seznam) if (!lide.includes(p.uzivatel || "") && dov.hodiny(p.uzivatel || "", rok).size) lide.push(p.uzivatel || "");
    const radky = lide.map((kdo) => ({ kdo, jmeno: tym.jmeno(kdo, "Bez přihlášení"), b: dov.bilance(kdo, rok) }))
      .sort((a, c) => kolator.compare(a.jmeno, c.jmeno));
    vymen(tymova, karta(`Celý tým ${rok}`, null,
      h("div", { class: "tabulka-obal" }, h("table", { class: "tabulka" },
        h("thead", {}, h("tr", {}, ["Jméno", "Převod", "Nárok", "Vyčerpáno", "Naplánováno", "Zbývá"].map((t) => h("th", { text: t })))),
        h("tbody", {}, radky.map((r) => h("tr", {}, h("td", { text: r.jmeno }),
          [r.b.prevod, r.b.narok, r.b.vycerpano, r.b.naplanovano].map((x) => h("td", { text: hodinyText(x, den) })),
          h("td", { class: r.b.zbyva < 0 ? "zaporne" : "zvyraznene", text: hodinyText(r.b.zbyva, den) })))))),
      h("p", { class: "tiche male", text: "Nárok a převod z loňska se nastavují v programu na počítači (Kalendář → Dovolené)." }),
      h("h3", { text: "Dovolené kolegů" }),
      seznamDovolenych(dov, dov.seznam.filter((p) => (p.uzivatel || "") !== tym.ja.id), rok, true)));
  }

  obnov();
  const navigace = h("div", { class: "navigace-mesice" },
    h("a", { class: "ikonove", href: `#/dovolena/${rok - 1}`, "aria-label": "Předchozí rok" }, ikona("zpet")),
    h("a", { class: "ikonove", href: `#/dovolena/${rok + 1}`, "aria-label": "Další rok" }, ikona("vpred")));
  return { el: h("section", { class: "pohled" }, hlavicka(`Dovolená ${rok}`, navigace),
    karta(tym.jeSpravce ? "Moje dovolená" : "Moje dovolená", h("button", { type: "button", class: "tlacitko male hlavni", onclick: dialogDovolene },
      ikona("plus"), "Naplánovat"), moje,
    h("p", { class: "tiche male", text: "Hodiny dovolené, v závorce přepočet na pracovní dny. Víkendy a státní svátky se nepočítají. Vyčerpáno = do dneška včetně." })),
    tymova), obnov };
}

function dlazdice(popis, hodnota, trida = "") {
  return h("div", { class: `dlazdice-polozka ${trida}` }, h("small", { text: popis }), h("strong", { text: hodnota }));
}

function seznamDovolenych(dov, seznam, rok, sJmenem) {
  const zacatek = new Date(rok, 0, 1), konec = new Date(rok, 11, 31);
  const vRoce = seznam.filter((p) => { const rz = rozsah(p); return rz && rz[1] >= zacatek && rz[0] <= konec; })
    .sort((a, c) => rozsah(a)[0] - rozsah(c)[0]);
  if (!vRoce.length) return h("p", { class: "tiche", text: sJmenem ? "Nikdo jiný nemá v tomto roce dovolenou." : "V tomto roce žádná dovolená." });
  return h("div", { class: "seznam" }, vRoce.map((p) => {
    const rz = rozsah(p);
    const smi = tym.jeSpravce || (p.uzivatel || "") === tym.ja.id;
    const hodin = dov.hodinPolozky(p);
    const denne = typeof p.hodin === "number" && p.hodin > 0 && p.hodin < dov.den ? ` · ${cislo(p.hodin)} h denně` : "";
    return h("div", { class: "radek" }, h("i", { class: "tecka", style: { background: C_DOVOLENA } }),
      h("div", { class: "radek-text" }, h("strong", { text: `${sJmenem ? tym.jmeno(p.uzivatel, "Bez přihlášení") + " · " : ""}${popisRozsahu(rz[0], rz[1])}` }),
        h("small", { class: "tiche", text: hodinyText(hodin, dov.den) + denne })),
      smi ? h("button", { type: "button", class: "ikonove", title: "Smazat", "aria-label": "Smazat dovolenou",
        onclick: () => okno("Smazat dovolenou?", [h("p", { text: `${sJmenem ? tym.jmeno(p.uzivatel) + ": " : ""}${popisRozsahu(rz[0], rz[1])}` })], [
          { text: "Zrušit" },
          { text: "Smazat", nebezpecne: true, akce: async () => {
            await tym.uprav("dovolene", (s) => {
              const i = s.findIndex((x) => x && x.id === p.id);
              if (i < 0) return false;
              if (!tym.jeSpravce && (s[i].uzivatel || "") !== tym.ja.id) throw new Error("Cizí dovolenou mazat nemůžeš.");
              s.splice(i, 1);
            });
            oznam("Dovolená smazána");
          } }]) }, ikona("smazat")) : null);
  }));
}

function dialogDovolene() {
  const dov = new Dovolene(tym.hodnota("dovolene"), tym.nastaveni);
  const od = h("input", { type: "date", value: dnes(), required: true });
  const doo = h("input", { type: "date" });
  const hodin = h("input", { type: "number", min: 0.5, max: dov.den, step: 0.5, value: dov.den });
  const kdo = tym.jeSpravce ? h("select", {}, tym.aktivni.map((u) => h("option", { value: u.id, text: u.jmeno, selected: u.id === tym.ja.id }))) : null;
  okno("Naplánovat dovolenou", [kdo ? pole("Pro koho", kdo) : null,
    h("div", { class: "dve-pole" }, pole("Od", od), pole("Do (nepovinné)", doo)),
    pole("Hodin denně", hodin, `Celý den = ${cislo(dov.den)} h, půlden = ${cislo(dov.den / 2)} h`)], [
    { text: "Zrušit" },
    { text: "Uložit", hlavni: true, akce: async () => {
      const z = zIso(od.value);
      if (!z) throw new Error("Vyber datum.");
      let k = zIso(doo.value) || z;
      const z2 = k < z ? k : z;
      k = k < z ? z : k;
      const h2 = Number(hodin.value);
      if (!(h2 > 0)) throw new Error("Zadej počet hodin denně.");
      const komu = kdo ? kdo.value : tym.ja.id;
      if (komu !== tym.ja.id && !tym.jeSpravce) throw new Error("Dovolenou kolegovi zadává jen správce.");
      const udaje = { nazev: "Dovolená", uzivatel: komu, barva: C_DOVOLENA, poznamka: "", stav: "Plánováno", datum: iso(z2) };
      if (iso(k) !== iso(z2)) udaje.datum_do = iso(k);
      if (h2 < dov.den) udaje.hodin = h2;
      await tym.uprav("dovolene", (s) => { s.push(novyTermin(udaje, tym.ja.jmeno)); });
      oznam("Dovolená uložena");
    } },
  ]);
}

// --- zprávy -------------------------------------------------------------------------------------

function pohledZpravy(parametr) {
  const vybrana = parametr || "";
  const seznam = h("div", { class: "konverzace" });
  const vlakno = h("div", { class: "vlakno", "aria-live": "polite" });
  const pole2 = h("textarea", { rows: 1, maxlength: 4000, placeholder: "Napiš zprávu…", "aria-label": "Zpráva" });
  const odeslat = h("button", { type: "submit", class: "tlacitko hlavni odeslat", "aria-label": "Odeslat" }, ikona("odeslat"));
  const prizpusob = () => { pole2.style.height = "auto"; pole2.style.height = `${Math.min(pole2.scrollHeight, 160)}px`; };
  pole2.addEventListener("input", prizpusob);
  pole2.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); formular.requestSubmit(); }
  });
  const formular = h("form", { class: "pole-zpravy", onsubmit: async (ev) => {
    ev.preventDefault();
    const text = pole2.value.trim();
    if (!text || !vybrana) return;
    pole2.value = "";
    prizpusob();
    const ok = await proved(() => posta.posli(vybrana, text));
    if (!ok && !pole2.value) pole2.value = text;
    pole2.focus();
  } }, pole2, odeslat);
  const nazevKonverzace = (k) => (k === TYM ? "Celý tým" : tym.jmeno(protejsek(k, tym.ja.id), "Kolega"));
  const hlavickaVlakna = h("div", { class: "hlavicka-vlakna" });
  let posledniPocet = -1;

  function obnov() {
    const konverzace = [TYM, ...tym.aktivni.filter((u) => u.id !== tym.ja.id).map((u) => konverzaceS(tym.ja.id, u.id))];
    for (const k of Object.keys(posta.schranka)) if (!konverzace.includes(k)) konverzace.push(k);
    konverzace.sort((a, b) => (a === TYM ? -1 : b === TYM ? 1 : 0) || (posta.schranka[b]?.cas || 0) - (posta.schranka[a]?.cas || 0)
      || kolator.compare(nazevKonverzace(a), nazevKonverzace(b)));
    vymen(seznam, konverzace.map((k) => {
      const meta = posta.schranka[k];
      const od = meta?.od === tym.ja.id ? "Ty: " : k === TYM && meta?.od ? `${tym.jmeno(meta.od).split(" ")[0]}: ` : "";
      return h("a", { href: `#/zpravy/${encodeURIComponent(k)}`, class: `radek-konverzace${k === vybrana ? " vybrany" : ""}${posta.neprecteno(k) ? " neprectene" : ""}` },
        h("span", { class: "kolecko", text: k === TYM ? "Tým" : inicialy(nazevKonverzace(k)) }),
        h("div", { class: "radek-text" }, h("strong", { text: nazevKonverzace(k) }),
          h("small", { class: "tiche", text: meta?.text ? od + meta.text : "Zatím bez zpráv" })),
        posta.neprecteno(k) ? h("i", { class: "neprecteno-tecka", "aria-label": "Nepřečteno" }) : null);
    }));
    if (!vybrana) return;
    vymen(hlavickaVlakna, h("a", { href: "#/zpravy", class: "ikonove jen-mobil", "aria-label": "Zpět" }, ikona("zpet")),
      h("strong", { text: nazevKonverzace(vybrana) }));
    const zpravy = posta.seznam(vybrana);
    const dole = vlakno.scrollHeight - vlakno.scrollTop - vlakno.clientHeight < 80;
    const prvky = [];
    let posledniDen = "";
    for (const z of zpravy) {
      const d = new Date(z.cas);
      const den = iso(d);
      if (den !== posledniDen) {
        posledniDen = den;
        prvky.push(h("div", { class: "oddelovac-dne", text: den === dnes() ? "Dnes" : datumKratce(d, true) }));
      }
      const moje = z.od === tym.ja.id;
      prvky.push(h("div", { class: `bublina${moje ? " moje" : ""}${z.chyba ? " chyba" : ""}` },
        !moje && vybrana === TYM ? h("small", { class: "odesilatel", text: tym.jmeno(z.od, "Kolega") }) : null,
        h("p", { text: z.text }),
        (z.odkazy || []).map((o) => h("div", { class: "odkaz-zpravy" },
          h("button", { type: "button", class: "odkaz-otevrit", title: `${o.cesta}\nOtevřít v počítači`, onclick: () => otevriVPocitaci(o.cesta, o.projekt) },
            ikona(o.slozka ? "slozka" : "soubor"), h("span", { text: o.nazev })),
          h("button", { type: "button", class: "ikonove male", title: "Kopírovat cestu", "aria-label": "Kopírovat cestu", onclick: () => zkopiruj(o.cesta) }, ikona("kopirovat")))),
        h("small", { class: "cas-zpravy", text: z.chyba ? "neodesláno" : z.ceka ? "odesílá se…" :
          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` })));
    }
    if (!zpravy.length) prvky.push(h("p", { class: "tiche prazdne", text: "Zatím žádné zprávy. Napiš první." }));
    vymen(vlakno, prvky);
    if (dole || posledniPocet !== zpravy.length) vlakno.scrollTop = vlakno.scrollHeight;
    posledniPocet = zpravy.length;
    if (document.visibilityState === "visible") posta.oznacPrectene(vybrana);
  }

  if (vybrana) posta.otevri(vybrana);
  obnov();
  const el = h("section", { class: `pohled zpravy${vybrana ? " s-vlaknem" : ""}` },
    h("div", { class: "panel-konverzaci" }, hlavicka("Zprávy"), seznam),
    vybrana ? h("div", { class: "panel-vlakna" }, hlavickaVlakna, vlakno, formular)
      : h("div", { class: "panel-vlakna prazdny" }, h("p", { class: "tiche", text: "Vyber konverzaci." })));
  if (vybrana) setTimeout(() => { vlakno.scrollTop = vlakno.scrollHeight; if (window.matchMedia("(pointer: fine)").matches) pole2.focus(); }, 0);
  return { el, obnov };
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (pohled?.klic === "zpravy") pohled.obnov?.();
  // osobní nastavení mohlo změnit jiné zařízení (program na počítači)
  osobni?.nacti().then(() => pohled?.obnov?.()).catch(() => {});
});

// --- start ------------------------------------------------------------------------------------

oblak.priOdhlaseni = (text) => ukazPrihlaseni(text);

// Instalovatelná aplikace (tablet, telefon, počítač): service worker drží stránku pro rychlý start;
// data týmu jdou vždy živě z Firebase (sw.js je necachuje).
let pozvankaInstalace = null;
window.addEventListener("beforeinstallprompt", (ev) => { ev.preventDefault(); pozvankaInstalace = ev; });
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

(async () => {
  try {
    const clen = await oblak.obnovRelaci();
    if (clen) return await spust(clen);
  } catch (e) {
    if (e.druh === "sit") {
      vymen(koren, h("div", { class: "nacitani" }, logo("logo-nacitani"),
        h("p", { text: "Bez spojení se serverem. Zkontroluj internet." }),
        h("button", { class: "tlacitko hlavni", type: "button", text: "Zkusit znovu", onclick: () => window.location.reload() })));
      return;
    }
    return ukazPrihlaseni(chybaText(e));
  }
  ukazPrihlaseni();
})();
