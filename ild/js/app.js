// Správce projektů ILD – webová verze. Data týmu ve Firebase (stejná jako v programu),
// soubory projektů zůstávají v počítačích (web ukazuje jen cesty).

import { ChybaOblaku, Oblak } from "./oblak.js";
import {
  BARVA_REALIZACE, BARVY_TERMINU, C_DOVOLENA, DNY, Dovolene, MESICE, NEAKTIVNI, STATUS_BARVY, Tym, barvaTerminu, cislo, datumKratce, dnes, hodinyText, iso, jeHotovo, nazevProjektu, novyTermin,
  noveId, podtitulProjektu, popisRozsahu, pridejDny, rozsah, svatkyDne, ted, zIso, zaznamTerminu, zaznamZmeny,
} from "./data.js";
import { h, ikona, okno, oznam, pole, vymen, zkopiruj } from "./ui.js";
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
  await tym.nacti();
  tym.ja.jmeno = tym.jmeno(clen.id, "");
  posta = new Posta(oblak, clen.id);
  postavKostru();
  tym.sleduj((stav) => ukazSpojeni(stav));
  tym.pri(() => { tym.ja.jmeno = tym.jmeno(clen.id, tym.ja.jmeno); pohled?.obnov?.(); obnovOdznak(); });
  posta.pri(() => { obnovOdznak(); if (pohled?.klic === "zpravy") pohled.obnov?.(); });
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
  const [klic, parametr] = casti;
  const obsah = document.getElementById("obsah");
  if (!obsah) return;
  const pohledy = { projekty: pohledProjekty, projekt: pohledProjekt, kalendar: pohledKalendar,
    dovolena: pohledDovolena, zpravy: pohledZpravy };
  const tvorba = pohledy[klic] || pohledProjekty;
  pohled = tvorba(parametr || "") || null;
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

let filtrProjektu = { text: "", vse: false };

function pohledProjekty() {
  const hledani = h("input", { type: "search", placeholder: "Hledat projekt…", value: filtrProjektu.text,
    "aria-label": "Hledat projekt", oninput: () => { filtrProjektu.text = hledani.value; obnov(); } });
  const prepinac = segment([["aktivni", "Aktivní"], ["vse", "Všechny"]], filtrProjektu.vse ? "vse" : "aktivni",
    (v) => { filtrProjektu.vse = v === "vse"; obnov(); });
  const seznam = h("div", { class: "seznam-projektu" });
  const pocet = h("p", { class: "tiche" });

  function obnov() {
    const slova = sDiakritikou(filtrProjektu.text).split(/\s+/).filter(Boolean);
    const projekty = tym.projekty.filter((p) => filtrProjektu.vse || !NEAKTIVNI.has(p.status)).filter((p) => {
      const text = sDiakritikou([p.nazev, p.lokalita, p.cislo, p.investor, p.provozni].join(" "));
      return slova.every((s) => text.includes(s));
    }).sort((a, b) => kolator.compare(nazevProjektu(a), nazevProjektu(b)));
    pocet.textContent = projekty.length ? "" : "Žádný projekt neodpovídá.";
    vymen(seznam, projekty.map((p) => {
      const ukoly = otevreneUkoly(p).length;
      const termin = nejblizsiTermin(p);
      return h("a", { class: "karta projekt", href: `#/projekt/${encodeURIComponent(p.id)}` },
        h("span", { class: "pruh-stavu", style: { background: STATUS_BARVY[p.status] || "var(--tiche)" } }),
        h("div", { class: "projekt-text" },
          h("strong", { text: nazevProjektu(p) }),
          h("span", { class: "tiche", text: podtitulProjektu(p) }),
          h("div", { class: "projekt-udaje" },
            h("span", { class: "stitek-stavu", text: p.status || "" }),
            ukoly ? h("span", { text: `☐ ${ukoly} ${ukoly === 1 ? "úkol" : ukoly < 5 ? "úkoly" : "úkolů"}` }) : null,
            termin ? h("span", {}, h("i", { class: "tecka", style: { background: barvaTerminu(termin[1]) } }),
              `${datumKratce(termin[0])} ${termin[1].nazev || tym.nazevDruhu(termin[1])}`) : null)));
    }));
  }

  obnov();
  return { el: h("section", { class: "pohled" }, hlavicka("Projekty", prepinac),
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

function pohledProjekt(id) {
  const zahlavi = h("div");
  const ukoly = h("div", { class: "seznam" });
  const terminy = h("div", { class: "seznam" });
  const poznamky = h("div", { class: "seznam" });
  const odkazy = h("div", { class: "seznam" });
  const historie = h("div", { class: "seznam" });
  let ukazHotove = false, ukazProbehle = false, poznamekVidet = 5;

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
    if (!p) {
      vymen(zahlavi, h("p", { text: "Projekt nebyl nalezen (možná byl smazán)." }));
      for (const el of [ukoly, terminy, poznamky, odkazy, historie]) el.replaceChildren();
      return;
    }
    vymen(zahlavi, h("div", { class: "zahlavi-projektu" },
      h("a", { href: "#/projekty", class: "zpet" }, ikona("zpet"), "Projekty"),
      h("h1", { text: nazevProjektu(p) }),
      h("p", { class: "tiche", text: podtitulProjektu(p) }),
      p.status ? h("span", { class: "stitek-stavu", style: { "--barva": STATUS_BARVY[p.status] || "#667085" }, text: p.status }) : null));

    // úkoly
    const vsechny = (Array.isArray(p.ukoly) ? p.ukoly : []).filter((u) => u && u.id);
    const hotove = vsechny.filter((u) => u.hotovo);
    vymen(ukoly, vsechny.filter((u) => !u.hotovo).map((u) => radekUkolu(id, u)),
      !vsechny.length ? h("p", { class: "tiche", text: "Žádné úkoly." }) : null,
      hotove.length ? h("button", { type: "button", class: "odkaz", text: `${ukazHotove ? "Skrýt" : "Zobrazit"} hotové (${hotove.length})`,
        onclick: () => { ukazHotove = !ukazHotove; obnov(); } }) : null,
      ukazHotove ? hotove.map((u) => radekUkolu(id, u)) : null);

    // termíny
    const dnesek = zIso(dnes());
    const vse = (Array.isArray(p.harmonogram) ? p.harmonogram : []).filter((t) => t && rozsah(t))
      .sort((a, b) => rozsah(a)[0] - rozsah(b)[0]);
    const budouci = vse.filter((t) => rozsah(t)[1] >= dnesek);
    const probehle = vse.filter((t) => rozsah(t)[1] < dnesek).reverse();
    vymen(terminy, budouci.map((t) => radekTerminu(t, () => detailTerminu(id, t.id))),
      !budouci.length ? h("p", { class: "tiche", text: "Žádné nadcházející termíny." }) : null,
      probehle.length ? h("button", { type: "button", class: "odkaz", text: `${ukazProbehle ? "Skrýt" : "Zobrazit"} proběhlé (${probehle.length})`,
        onclick: () => { ukazProbehle = !ukazProbehle; obnov(); } }) : null,
      ukazProbehle ? probehle.map((t) => radekTerminu(t, () => detailTerminu(id, t.id))) : null);

    // poznámky (nejnovější nahoře)
    const pozn = (Array.isArray(p.poznamky) ? p.poznamky : []).filter((x) => x && x.text)
      .sort((a, b) => String(b.cas || "").localeCompare(String(a.cas || "")));
    vymen(poznamky, pozn.slice(0, poznamekVidet).map((x) => h("article", { class: "poznamka" },
      h("p", { class: "text-poznamky", text: x.text }),
      h("small", { class: "tiche", text: [casText(x.cas), x.autor].filter(Boolean).join(" · ") }))),
    !pozn.length ? h("p", { class: "tiche", text: "Žádné poznámky." }) : null,
    pozn.length > poznamekVidet ? h("button", { type: "button", class: "odkaz", text: `Zobrazit další (${pozn.length - poznamekVidet})`,
      onclick: () => { poznamekVidet += 20; obnov(); } }) : null);

    // složky a soubory projektu (jen cesty – soubory jsou v počítačích)
    const ods = (Array.isArray(p.odkazy) ? p.odkazy : []).filter((o) => o && o.cesta);
    vymen(odkazy, ods.map((o) => h("div", { class: "radek odkaz-slozky" },
      ikona(/\.[a-z0-9]{1,5}$/i.test(o.cesta) ? "soubor" : "slozka"),
      h("div", { class: "radek-text" }, h("strong", { text: o.popis || o.cesta.split(/[\\/]/).filter(Boolean).pop() || o.cesta }),
        h("small", { class: "tiche cesta", text: o.cesta })),
      h("button", { type: "button", class: "ikonove", title: "Kopírovat cestu", "aria-label": "Kopírovat cestu",
        onclick: () => zkopiruj(o.cesta) }, ikona("kopirovat")))),
    !ods.length ? h("p", { class: "tiche", text: "Projekt nemá žádné složky." }) : null);

    const hist = (Array.isArray(p.historie) ? p.historie : []).filter((x) => x && x.text).slice(-30).reverse();
    vymen(historie, hist.map((x) => h("div", { class: "radek-historie" },
      h("small", { class: "tiche", text: [casText(x.cas), x.kdo].filter(Boolean).join(" · ") }), h("span", { text: x.text }))),
    !hist.length ? h("p", { class: "tiche", text: "Zatím nic." }) : null);
  }

  obnov();
  const el = h("section", { class: "pohled projekt-detail" }, zahlavi,
    h("div", { class: "mrizka-projektu" },
      h("div", { class: "sloupec" },
        karta("Úkoly", null, formUkolu, ukoly),
        karta("Poznámky", null, formPoznamky, poznamky)),
      h("div", { class: "sloupec" },
        karta("Termíny", h("button", { type: "button", class: "tlacitko male", onclick: () => dialogTerminu(id) }, ikona("plus"), "Termín"), terminy),
        karta("Složky a soubory", null, odkazy, h("p", { class: "tiche male", text: "Soubory otevřeš v programu na počítači – tady můžeš zkopírovat cestu." })),
        h("details", { class: "karta" }, h("summary", { text: "Historie projektu" }), historie))));
  return { el, obnov };
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
  return h("label", { class: `radek ukol${u.hotovo ? " hotovo" : ""}` }, box, h("span", { text: u.text }));
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

let nastaveniKalendare = { neaktivni: false, dovolene: true };

function polozkyKalendare() {
  const vysledek = [];
  for (const p of tym.projekty) {
    if (!nastaveniKalendare.neaktivni && NEAKTIVNI.has(p.status)) continue;
    for (const t of Array.isArray(p.harmonogram) ? p.harmonogram : []) {
      const rz = rozsah(t);
      if (rz) vysledek.push({ rz, nazev: t.nazev || tym.nazevDruhu(t), barva: barvaTerminu(t), kde: nazevProjektu(p),
        hotovo: jeHotovo(t), klik: () => detailTerminu(p.id, t.id) });
    }
  }
  for (const t of tym.hodnota("terminy_bez_projektu") || []) {
    const rz = rozsah(t);
    if (rz) vysledek.push({ rz, nazev: t.nazev || tym.nazevDruhu(t), barva: barvaTerminu(t), kde: "Bez projektu", hotovo: jeHotovo(t) });
  }
  if (nastaveniKalendare.dovolene) {
    for (const t of tym.hodnota("dovolene") || []) {
      const rz = rozsah(t);
      if (rz) vysledek.push({ rz, nazev: `Dovolená – ${tym.jmeno(t.uzivatel, "nevím kdo")}`, barva: C_DOVOLENA, kde: "Dovolené",
        hotovo: false, dovolena: true });
    }
  }
  return vysledek;
}

function pohledKalendar(parametr) {
  const m = /^(\d{4})-(\d{2})$/.exec(parametr);
  const dnesek = zIso(dnes());
  const mesic = m ? new Date(+m[1], +m[2] - 1, 1) : new Date(dnesek.getFullYear(), dnesek.getMonth(), 1);
  let vybrany = m ? (dnesek.getMonth() === mesic.getMonth() && dnesek.getFullYear() === mesic.getFullYear() ? dnesek : mesic) : dnesek;
  const klicMesice = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const predchozi = new Date(mesic.getFullYear(), mesic.getMonth() - 1, 1);
  const dalsi = new Date(mesic.getFullYear(), mesic.getMonth() + 1, 1);
  const mrizka = h("div", { class: "mesic", role: "grid" });
  const den = h("div", { class: "den-detail" });
  const volby = h("div", { class: "volby-kalendare" },
    zaskrtavatko("I realizované a mrtvé projekty", nastaveniKalendare.neaktivni, (v) => { nastaveniKalendare.neaktivni = v; obnov(); }),
    zaskrtavatko("Dovolené", nastaveniKalendare.dovolene, (v) => { nastaveniKalendare.dovolene = v; obnov(); }));

  function obnov() {
    const polozky = polozkyKalendare();
    const prvni = pridejDny(mesic, -((mesic.getDay() + 6) % 7));
    const bunky = [...DNY.map((d) => h("div", { class: "nazev-dne", text: d }))];
    for (let i = 0; i < 42; i++) {
      const d = pridejDny(prvni, i);
      if (i >= 35 && d.getMonth() !== mesic.getMonth()) break;
      const dne = polozky.filter((x) => x.rz[0] <= d && x.rz[1] >= d);
      const svatky = svatkyDne(d, ["cz", "sk"]);
      const tyden = (d.getDay() + 6) % 7;
      const tridy = ["bunka", d.getMonth() !== mesic.getMonth() ? "mimo" : "", tyden >= 5 ? "vikend" : "",
        svatky.length ? "svatek" : "", iso(d) === iso(dnesek) ? "dnes" : "", iso(d) === iso(vybrany) ? "vybrany" : ""].filter(Boolean).join(" ");
      bunky.push(h("button", { type: "button", class: tridy, title: svatky.map(([s, n]) => `${n}${s === "sk" ? " (SK)" : ""}`).join(" · ") || null,
        onclick: () => { vybrany = d; obnov(); } },
      h("span", { class: "cislo-dne", text: d.getDate() }),
      h("span", { class: "pruhy" }, dne.slice(0, 3).map((x) => h("span", { class: `pruh${x.hotovo ? " hotovo" : ""}`,
        style: { "--barva": x.barva }, text: x.nazev })), dne.length > 3 ? h("span", { class: "vic", text: `+${dne.length - 3}` }) : null),
      h("span", { class: "tecky" }, dne.slice(0, 4).map((x) => h("i", { class: "tecka", style: { background: x.barva } })))));
    }
    vymen(mrizka, bunky);
    const dne = polozky.filter((x) => x.rz[0] <= vybrany && x.rz[1] >= vybrany).sort((a, b) => kolator.compare(a.kde, b.kde));
    const svatky = svatkyDne(vybrany, ["cz", "sk"]);
    vymen(den, h("h2", { text: `${DNY[(vybrany.getDay() + 6) % 7]} ${datumKratce(vybrany, true)}` }),
      svatky.map(([s, n]) => h("p", { class: "svatek-text", text: `${n}${s === "sk" ? " (SK)" : ""}` })),
      dne.map((x) => h("button", { type: "button", class: `radek termin${x.hotovo ? " hotovo" : ""}`, onclick: x.klik || null, disabled: !x.klik },
        h("i", { class: "tecka", style: { background: x.barva } }),
        h("div", { class: "radek-text" }, h("strong", { text: x.nazev }),
          h("small", { class: "tiche", text: [popisRozsahu(x.rz[0], x.rz[1]), x.kde].join(" · ") })))),
      !dne.length && !svatky.length ? h("p", { class: "tiche", text: "Nic naplánováno." }) : null);
  }

  obnov();
  const navigace = h("div", { class: "navigace-mesice" },
    h("a", { class: "ikonove", href: `#/kalendar/${klicMesice(predchozi)}`, "aria-label": "Předchozí měsíc" }, ikona("zpet")),
    h("a", { class: "tlacitko male", href: `#/kalendar/${klicMesice(dnesek)}`, text: "Dnes" }),
    h("a", { class: "ikonove", href: `#/kalendar/${klicMesice(dalsi)}`, "aria-label": "Další měsíc" }, ikona("vpred")));
  return { el: h("section", { class: "pohled" },
    hlavicka(`${MESICE[mesic.getMonth()][0].toUpperCase()}${MESICE[mesic.getMonth()].slice(1)} ${mesic.getFullYear()}`, navigace),
    volby, h("div", { class: "kalendar-rozlozeni" }, h("div", { class: "karta mesic-karta" }, mrizka), h("div", { class: "karta" }, den))), obnov };
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
        (z.odkazy || []).map((o) => h("button", { type: "button", class: "odkaz-zpravy", title: `${o.cesta}\n(klik = kopírovat cestu)`,
          onclick: () => zkopiruj(o.cesta) }, ikona(o.slozka ? "slozka" : "soubor"), h("span", { text: o.nazev }))),
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
  if (document.visibilityState === "visible" && pohled?.klic === "zpravy") pohled.obnov?.();
});

// --- start ------------------------------------------------------------------------------------

oblak.priOdhlaseni = (text) => ukazPrihlaseni(text);

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
