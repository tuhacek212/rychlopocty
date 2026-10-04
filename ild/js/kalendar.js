// Kalendář jako v programu (kalendar.py + mrizka.py): plynulé měsíce s pruhy přes dny, zoom,
// filtr (stejné osobní nastavení jako v programu), historie termínů, export, přehled dne a detail
// termínu, úpravy, přetahování (posun i délka), výběr dnů tažením, nabídky na pravé tlačítko.
// Stejná komponenta je i harmonogramem projektu (projektId).

import {
  BARVA_REALIZACE, BARVY_TERMINU, BEZ_PROJEKTU, C_DOVOLENA, C_POZNAMKA, DNY, DOVOLENE, MESICE, NEAKTIVNI,
  OSTATNI_V_KALENDARI, POZNAMKY, SOUKROME, Dovolene, barvaTerminu, cislo, datumKratce, dnes, hlidejPrekryvDovolene,
  hodinDovoleneDenne,
  hodinyText, iso, jeHotovo, najdiDatumy, nastavRozsah, nazevProjektu, novyTermin, popisRozsahu,
  pridejDny, rozsah, svatkyDne, upravZdroj, zIso, zaznamTerminu,
} from "./data.js";
import { zmrazNavazane } from "./finance.js";
import { h, ikona, menu, okno, oznam, pole, popup, vymen, zavriPopup } from "./ui.js";

const DRUHY_ZDROJU = { [SOUKROME]: "soukrome", [DOVOLENE]: "dovolene", [BEZ_PROJEKTU]: "bez" };
const kolator = new Intl.Collator("cs");
const velke = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// Rozměry podle přiblížení (0 … 4, plynule) – mrizka.KalendarHarmonogramu.ZOOMY a _nastav_rozmery:
// menší buňky = víc měsíců vedle sebe, větší = víc termínů v jednom dni. Buňka má pevnou výšku,
// co se nevejde do drah, ukáže „+N“.
const ZOOMY = [
  { sirka: 150, sloupce: 4, bunka: 36, nadpis: 30, dny: 20, horni: 19, pruh: 6, drahy: 2, cislo: 11, tyden: 18 },
  { sirka: 230, sloupce: 3, bunka: 58, nadpis: 36, dny: 22, horni: 23, pruh: 10, drahy: 2, cislo: 12, tyden: 22 },
  { sirka: 330, sloupce: 2, bunka: 86, nadpis: 46, dny: 26, horni: 27, pruh: 16, drahy: 3, cislo: 13, tyden: 26 },
  { sirka: 460, sloupce: 2, bunka: 136, nadpis: 46, dny: 26, horni: 28, pruh: 18, drahy: 5, cislo: 13, tyden: 28 },
  { sirka: 680, sloupce: 1, bunka: 190, nadpis: 50, dny: 28, horni: 30, pruh: 19, drahy: 7, cislo: 14, tyden: 30 },
];
const OKRAJ_X = 22, OKRAJ_Y = 10, MEZERA_Y = 14;

function parametry(zoom, vz) {
  const zz = Math.max(0, Math.min(ZOOMY.length - 1, zoom));
  const i = Math.floor(zz), t = zz - i;
  let z = ZOOMY[i];
  if (i < ZOOMY.length - 1 && t >= 0.001) {
    const a = ZOOMY[i], b = ZOOMY[i + 1];
    z = Object.fromEntries(Object.keys(a).map((k) => [k, Math.round(a[k] + (b[k] - a[k]) * t)]));
    z.sloupce = a.sloupce;
  }
  const pismo = (vz.pismo || 100) / 100, vyska = (vz.vyska || 100) / 100;
  const pruh = Math.max(4, Math.round(z.pruh * vyska));
  const navic = Math.max(0, Math.round(z.cislo * (pismo - 1)));
  return {
    minSirka: z.sirka, maxSloupcu: z.sloupce, mezeraX: z.sirka >= 300 ? 36 : 22, nadpis: z.nadpis, dny: z.dny,
    bunka: z.bunka + (pruh - z.pruh) * z.drahy + navic, horni: z.horni + navic, pruh, rozestup: pruh >= 12 ? 3 : 2,
    drahy: z.drahy, tyden: vz.tydny ? z.tyden : 0, velky: z.nadpis >= 40, cislo: Math.round(z.cislo * pismo),
    pismoPruhu: Math.max(8, Math.min(Math.round((pruh >= 18 ? 12 : 11) * pismo), pruh - 3)),
    pismoSvatku: Math.round((z.cislo <= 13 ? 10 : 11) * pismo), pismoTydne: z.cislo <= 12 ? 10 : 11,
  };
}

const MESICE_GEN = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];
const DNY_CELE = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"];
const MESICE_ZKR = ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"];
const datumDlouze = (d) => `${d.getDate()}. ${MESICE_GEN[d.getMonth()]} ${d.getFullYear()}`;
const pocetDniText = (n) => `${n} ${n === 1 ? "den" : n >= 2 && n <= 4 ? "dny" : "dní"}`;
const dniVMesici = (m) => new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
const denTydne = (d) => (d.getDay() + 6) % 7;

// data.relativni_text
function relativni(z, k, dnesek) {
  if (z <= dnesek && dnesek <= k) return [+z !== +k ? "probíhá" : "dnes", "var(--c-primary-dark)"];
  if (k < dnesek) { const n = Math.round((dnesek - k) / 86400000); return [n > 1 ? `před ${pocetDniText(n)}` : "včera", "var(--c-danger)"]; }
  const n = Math.round((z - dnesek) / 86400000);
  return [n === 1 ? "zítra" : `za ${pocetDniText(n)}`, n <= 7 ? "var(--c-warning)" : "var(--c-muted)"];
}

// barva pruhu podle sytosti z Nastavení → Kalendář (KalendarHarmonogramu._barva_druhu)
function sytost(barva, procent) {
  if (!procent || Math.abs(procent - 100) < 1 || !/^#[0-9a-f]{6}$/i.test(barva)) return barva;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(barva.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let hue = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
  }
  s = Math.max(0, Math.min(1, s * procent / 100));
  return `hsl(${hue.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`;
}

function tydenRoku(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const prvni = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - prvni) / 86400000 - 3 + ((prvni.getDay() + 6) % 7)) / 7);
}

const pocetDni = (z, k) => Math.round((k - z) / 86400000);

// data.popis_zmen_terminu
export function popisZmen(tym, pred, po) {
  const casti = [];
  if ((pred.nazev || "") !== (po.nazev || "")) casti.push(`název: ${pred.nazev || "—"} → ${po.nazev || "—"}`);
  const r1 = rozsah(pred), r2 = rozsah(po);
  const t1 = r1 ? popisRozsahu(...r1) : "bez data", t2 = r2 ? popisRozsahu(...r2) : "bez data";
  if (t1 !== t2 || (r1 && r2 && (iso(r1[0]) !== iso(r2[0]) || iso(r1[1]) !== iso(r2[1])))) casti.push(`${t1} → ${t2}`);
  const b1 = barvaTerminu(pred), b2 = barvaTerminu(po);
  if (b1 !== b2) casti.push(`druh: ${tym.vyznamBarvy(b1) || b1} → ${tym.vyznamBarvy(b2) || b2}`);
  const u1 = b1 === BARVA_REALIZACE ? (pred.upresneni || "").trim() : "";
  const u2 = b2 === BARVA_REALIZACE ? (po.upresneni || "").trim() : "";
  if (u1 !== u2 && (u2 || b1 === b2)) casti.push(`upřesnění: ${u1 || "—"} → ${u2 || "—"}`);
  if (jeHotovo(pred) !== jeHotovo(po)) casti.push(jeHotovo(po) ? "hotovo" : "znovu otevřen");
  if ((pred.poznamka || "").trim() !== (po.poznamka || "").trim()) casti.push("poznámka");
  const h1 = pred.hodin || 0, h2 = po.hodin || 0;
  if (h1 !== h2) casti.push(`hodin denně: ${h1 || "celý den"} → ${h2 || "celý den"}`);
  return casti.length ? "Upraven: " + casti.join(" · ") : "";
}

export function filtrJeAktivni(nast) {
  return (nast.projekty === "vybrane" ? 1 : 0) + (nast.skryte_ostatni.length ? 1 : 0)
    + (nast.skryte_barvy.filter((b) => BARVY_TERMINU.includes(b)).length ? 1 : 0) + (nast.skryt_hotove ? 1 : 0);
}

// --- položky kalendáře ------------------------------------------------------------------------

// Projekty, které filtr ukazuje (kalendar._viditelne_projekty) – jen skutečné projekty
export function viditelneProjekty(tym, nast) {
  if (nast.projekty === "vybrane") {
    const vybrane = new Set(nast.vybrane_projekty);
    return tym.projekty.filter((p) => vybrane.has(p.id));
  }
  return tym.projekty.filter((p) => nast.vcetne_neaktivnich || !NEAKTIVNI.has(p.status));
}

export function sestavPolozky(tym, osobni, projektId = null) {
  const nast = osobni.kalendar();
  const ja = tym.ja?.id || "";
  const vysledek = [];
  const pridej = (pol, zdroj, projekt) => {
    const rz = rozsah(pol);
    if (!rz) return;
    const druh = projekt ? "projekt" : DRUHY_ZDROJU[zdroj];
    const barva = druh === "dovolene" ? C_DOVOLENA : barvaTerminu(pol);
    if (!projektId && druh !== "dovolene" && nast.skryte_barvy.includes(barva)) return;
    if (!projektId && nast.skryt_hotove && jeHotovo(pol)) return;
    const nazev = pol.nazev || tym.nazevDruhu(pol) || "Termín";
    let text = nazev;
    if (druh === "dovolene") text = `${tym.jmeno(pol.uzivatel, "Dovolená")} – ${nazev}`;
    else if (druh === "soukrome") text = `🔒 ${nazev}`;
    else if (projekt && !projektId) text = `${nazevProjektu(projekt)} · ${nazev}`;
    vysledek.push({ id: pol.id, pol, zdroj, projekt, druh, rz, barva, text, nazev,
      cizi: druh === "dovolene" && !tym.jeSpravce && (pol.uzivatel || "") !== ja });
  };
  if (projektId) {
    const p = tym.projekt(projektId);
    for (const pol of p?.harmonogram || []) if (pol?.id) pridej(pol, p.id, p);
    return vysledek;
  }
  const skryte = new Set(nast.skryte_ostatni);
  for (const p of viditelneProjekty(tym, nast)) {
    for (const pol of Array.isArray(p.harmonogram) ? p.harmonogram : []) if (pol?.id) pridej(pol, p.id, p);
    if (skryte.has(POZNAMKY)) continue;
    for (const pozn of Array.isArray(p.poznamky) ? p.poznamky : []) {
      const text = String(pozn?.text || "");
      const prvni = text.split("\n").map((r) => r.trim()).find(Boolean) || "Poznámka";
      for (const datum of najdiDatumy(text)) {
        const d = zIso(datum);
        vysledek.push({ id: `pozn:${p.id}:${pozn.id || ""}:${datum}`, pol: { nazev: prvni, datum, poznamka: text },
          zdroj: p.id, projekt: p, druh: "poznamka", rz: [d, d], barva: C_POZNAMKA, pevny: true,
          nazev: prvni.length <= 80 ? prvni : prvni.slice(0, 79) + "…",
          text: `${nazevProjektu(p)} · ${prvni.length <= 80 ? prvni : prvni.slice(0, 79) + "…"}` });
      }
    }
  }
  if (!skryte.has(BEZ_PROJEKTU)) for (const pol of tym.hodnota("terminy_bez_projektu") || []) if (pol?.id) pridej(pol, BEZ_PROJEKTU, null);
  if (!skryte.has(SOUKROME)) for (const pol of osobni.soukrome) pridej(pol, SOUKROME, null);
  if (!skryte.has(DOVOLENE)) for (const pol of tym.hodnota("dovolene") || []) if (pol?.id) pridej(pol, DOVOLENE, null);
  return vysledek;
}

// Kam termín může patřit (výběr v okénku a úpravách): [[hodnota, text]]
function moznostiKam(tym) {
  const ja = tym.ja?.id || "";
  const projekty = tym.projekty.filter((p) => !NEAKTIVNI.has(p.status)).sort((a, b) => kolator.compare(nazevProjektu(a), nazevProjektu(b)));
  const lide = tym.jeSpravce ? tym.aktivni : tym.aktivni.filter((u) => u.id === ja);
  return [
    ...projekty.map((p) => [p.id, nazevProjektu(p)]),
    [BEZ_PROJEKTU, "Bez projektu"],
    [SOUKROME, "🔒 Soukromý termín"],
    ...lide.map((u) => [`${DOVOLENE}:${u.id}`, `☀ Dovolená – ${u.jmeno}`]),
  ];
}

function kamPatri(polozka) {
  if (polozka.druh === "dovolene") return `${DOVOLENE}:${polozka.pol.uzivatel || ""}`;
  return polozka.zdroj;
}

const popisKam = (tym, kam) => {
  if (kam === BEZ_PROJEKTU) return "Bez projektu";
  if (kam === SOUKROME) return "Soukromý termín";
  if (kam.startsWith(DOVOLENE)) return `Dovolená – ${tym.jmeno(kam.split(":")[1], "nevím kdo")}`;
  const p = tym.projekt(kam);
  return p ? nazevProjektu(p) : "Projekt";
};

// --- komponenta --------------------------------------------------------------------------------

export class Kalendar {
  // faktury = () => pruhy faktur (finance.pruhyFaktur) do harmonogramu R a O; naFakturu(id, akce, x, y | termín)
  // vlevo = prvek na začátek lišty (přepínač Termíny | Cashflow), naDovolene(rok) = sluníčko (okno Dovolené),
  // naTermin(projekt, termín) = „Otevřít v harmonogramu projektu“
  constructor({ tym, osobni, projektId = null, naProjekt = () => {}, naExport = () => {}, posledniProjekt = () => "",
    faktury = null, naFakturu = () => {}, vlevo = null, naDovolene = null, naTermin = null }) {
    this.faktury = faktury;
    this.naFakturu = naFakturu;
    this.tym = tym;
    this.osobni = osobni;
    this.projektId = projektId;
    this.naProjekt = naProjekt;
    this.naExport = naExport;
    this.posledniProjekt = posledniProjekt;
    this.vlevo = vlevo;
    this.naDovolene = naDovolene;
    this.naTermin = naTermin;
    const dnesek = zIso(dnes());
    this.zacatek = new Date(dnesek.getFullYear(), dnesek.getMonth() - 12, 1);
    this.konec = new Date(dnesek.getFullYear(), dnesek.getMonth() + 13, 1); // bez
    this.den = dnesek;
    this.vybranyTermin = null;
    this.polozky = [];
    this.oznacene = null;   // [od, do] – výběr tažením / cíl přetažení
    this.boc = "den";       // den | termin | uprava
    this._vytvor();
  }

  get zoom() {
    const z = this.projektId ? this.osobni.hodnota.harmonogram_zoom : this.osobni.kalendar().zoom;
    return typeof z === "number" ? Math.max(0, Math.min(4, z)) : 2;
  }

  nastavZoom(z) {
    z = Math.round(Math.max(0, Math.min(4, z)) * 20) / 20;
    if (this.projektId) this.osobni.uprav((h) => { h.harmonogram_zoom = z; });
    else this.osobni.upravKalendar({ zoom: z });
    this.posuvnik.value = String(z);
    this.posuvnik.style.setProperty("--hodnota", `${(z / 4) * 100}%`);
    this._prekresli(true);
  }

  _vytvor() {
    // jedna lišta jako v programu: nadpis a souhrn vlevo, přiblížení · Filtr · Dovolené · Historie · Export vpravo
    this.souhrn = h("span", { class: "kal-souhrn" });
    this.posuvnik = h("input", { type: "range", min: 0, max: 4, step: 0.01, value: String(this.zoom), class: "kal-zoom",
      "aria-label": "Přiblížení", oninput: () => this.nastavZoom(Number(this.posuvnik.value)) });
    this.bFiltr = h("button", { type: "button", class: "ikonove kal-filtr", "aria-label": "Filtr",
      onclick: () => this._filtr() }, ikona("filter"), h("span", { class: "pocet" }));
    const nadpis = this.projektId ? null : h("button", { type: "button", class: "kal-nadpis", title: "Přejít na dnešek",
      onclick: () => this.jdiNaDnes() }, h("h1", { text: "Kalendář" }));
    this.lista = h("div", { class: "kal-lista" }, this.vlevo, nadpis, this.souhrn, h("div", { class: "mezera" }),
      h("span", { class: "kal-zoom-obal", title: "Přiblížení – posuň, nebo Ctrl + kolečko myši v kalendáři" },
        ikona("minus", "ikona", 12), this.posuvnik, ikona("plus", "ikona", 12)),
      this.projektId ? null : this.bFiltr,
      this.projektId || !this.naDovolene ? null : h("button", { type: "button", class: "ikonove", title: "Dovolené – plán na celý rok, kolik kdo má, export",
        "aria-label": "Dovolené", onclick: () => this.naDovolene(this.den.getFullYear()) }, ikona("sun")),
      this.projektId ? null : h("button", { type: "button", class: "ikonove", title: "Historie termínů – kdo který termín kdy změnil (nejnovější nahoře)",
        "aria-label": "Historie termínů", onclick: () => this._historie() }, ikona("history")),
      this.projektId
        ? h("button", { type: "button", class: "ikonove", title: "Export – PDF, Excel, tisk: kalendář nebo časový diagram",
          onclick: () => this.export() }, ikona("print"), h("span", { text: "Export" }))
        : h("button", { type: "button", class: "ikonove", "aria-label": "Export",
          title: "Export – PDF, Excel, tisk: kalendář nebo časový diagram, všechny zobrazené\nprojekty nebo jeden (výchozí podoba v Nastavení → Export a tisk)",
          onclick: () => this.export() }, ikona("print")));
    this.mesice = h("div", { class: "kal-mesice" });
    this.obal = h("div", { class: "kal-obal" }, this.mesice);
    this.bok = h("aside", { class: "kal-bok" });
    // hrana mezi kalendářem a bočním panelem jde táhnout (harmonogram.kalendar_s_bocnim_panelem)
    const hrana = h("div", { class: "kal-hrana" });
    const klicSirky = this.projektId ? "sirka_boku_harmonogramu" : "sirka_boku_kalendare";
    const sirkaBoku = (s) => { const v = Math.max(240, Math.min(640, parseInt(s, 10) || 330)); this.bok.style.setProperty("--sirka-boku", `${v}px`); return v; };
    sirkaBoku(this.osobni.hodnota[klicSirky]);
    hrana.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      const x0 = ev.clientX, w0 = this.bok.getBoundingClientRect().width;
      let w = w0;
      hrana.classList.add("tazena");
      const pohyb = (e) => { w = sirkaBoku(w0 - (e.clientX - x0)); };
      const konec = () => {
        document.removeEventListener("pointermove", pohyb);
        document.removeEventListener("pointerup", konec);
        hrana.classList.remove("tazena");
        if (Math.round(w) !== Math.round(w0)) this.osobni.uprav((n) => { n[klicSirky] = Math.round(w); });
      };
      document.addEventListener("pointermove", pohyb);
      document.addEventListener("pointerup", konec);
    });
    this.el = h("div", { class: `kal${this.projektId ? " harmonogram" : ""}` }, this.lista, h("div", { class: "kal-telo" }, this.obal, hrana, this.bok));

    this.obal.addEventListener("scroll", () => this._priRolovani(), { passive: true });
    this.obal.addEventListener("wheel", (ev) => {
      if (!ev.ctrlKey) return;
      ev.preventDefault();
      this.nastavZoom(this.zoom + (ev.deltaY < 0 ? 0.5 : -0.5));
    }, { passive: false });
    this.mesice.addEventListener("pointerdown", (ev) => this._dolu(ev));
    this.mesice.addEventListener("dblclick", (ev) => {
      const d = ev.target.closest(".kal-den[data-d]");
      if (d && !ev.target.closest(".kal-pruh")) this.novyTermin(zIso(d.dataset.d), zIso(d.dataset.d));
    });
    this.mesice.addEventListener("contextmenu", (ev) => this._kontext(ev));
    this.mesice.addEventListener("touchmove", (ev) => { if (this._tahDotykem) ev.preventDefault(); }, { passive: false });
    this.mesice.addEventListener("click", (ev) => {
      const vic = ev.target.closest(".kal-vic");
      if (vic) { this.vyberDen(zIso(vic.dataset.d)); return; }
      const pruh = ev.target.closest(".kal-pruh");
      if (pruh && !this._potlacKlik) { this.vyberTermin(pruh.dataset.id); return; }
      const den = ev.target.closest(".kal-den[data-d]");
      if (den && this._dotyk) this.vyberDen(zIso(den.dataset.d));   // myš vybírá už při puštění
    });
    this._sledovac = new ResizeObserver(() => {
      const sirka = this.obal.clientWidth;
      if (!sirka || sirka === this._sirka) return;
      const prvni = !this._sirka;
      this._sirka = sirka;
      this._prekresli(!prvni);
      if (prvni) this.jdiNa(this.den, false);   // až je kalendář na stránce – otevře se na dnešním měsíci
    });
    this._sledovac.observe(this.obal);
    this.obnov();
  }

  zrus() { this._sledovac.disconnect(); zavriPopup(); }

  obnov() {
    this.polozky = sestavPolozky(this.tym, this.osobni, this.projektId);
    const projekt = this.projektId ? this.tym.projekt(this.projektId) : null;
    for (const pol of this.faktury?.() || []) {
      const rz = rozsah(pol);
      if (rz) this.polozky.push({ id: pol.id, pol, zdroj: this.projektId, projekt, druh: "faktura", rz, barva: pol.barva,
        text: pol.nazev, nazev: pol.nazev, pevny: true });
    }
    this._mapa = new Map(this.polozky.map((p) => [p.id, p]));
    const terminu = this.polozky.filter((p) => !p.pevny).length;
    const faktur = this.polozky.filter((p) => p.druh === "faktura").length;
    const zPoznamek = this.polozky.length - terminu - faktur;
    const nast = this.osobni.kalendar();
    const aktivni = this.projektId ? 0 : filtrJeAktivni(nast);
    let text = `${terminu} ${terminu === 1 ? "termín" : terminu >= 2 && terminu <= 4 ? "termíny" : "termínů"}`;
    if (this.projektId) {
      const hotovych = this.polozky.filter((p) => !p.pevny && jeHotovo(p.pol)).length;
      if (hotovych) text += `  ·  ${hotovych} hotovo`;
    }
    if (zPoznamek) text += `  ·  ${zPoznamek} ${zPoznamek === 1 ? "datum" : zPoznamek <= 4 ? "data" : "dat"} z poznámek`;
    if (faktur) text += `  ·  ${faktur} ${faktur === 1 ? "faktura" : faktur <= 4 ? "faktury" : "faktur"}`;
    this.souhrn.textContent = text;
    this.bFiltr.classList.toggle("zapnuto", !!aktivni);
    this.bFiltr.querySelector(".pocet").textContent = aktivni ? String(aktivni) : "";
    this.bFiltr.dataset.tip = "Filtr – které projekty, soukromé termíny a dovolené, druhy termínů, hotové"
      + (aktivni ? "\n(něco je skryté)" : "");
    if (document.activeElement !== this.posuvnik) this.posuvnik.value = String(this.zoom);
    this.posuvnik.style.setProperty("--hodnota", `${(this.zoom / 4) * 100}%`);
    this._prekresli(true);
    if (this.boc === "uprava") return;   // rozepsané úpravy nerušit (změna od kolegy)
    if (this.boc === "termin" && this._mapa.has(this.vybranyTermin)) {
      this._ukazTermin(this._mapa.get(this.vybranyTermin));
    } else {
      this.boc = "den";
      this.vybranyTermin = null;
      this._ukazDen();
    }
  }

  // jen přebarví vybraný den / pruh (bez nového vykreslení – dvojklik musí trefit stejný prvek)
  _oznacVyber() {
    const den = iso(this.den);
    for (const el of this.mesice.querySelectorAll(".kal-den[data-d]")) el.classList.toggle("vybrany", el.dataset.d === den);
    for (const el of this.mesice.querySelectorAll(".kal-pruh")) el.classList.toggle("vybrany", el.dataset.id === this.vybranyTermin);
  }

  // --- vykreslení měsíců ---

  _kotva() {
    // měsíc nahoře ve viditelné části a jak daleko v něm (0–1) – KalendarHarmonogramu._kotva_posunu
    const vrch = this.obal.scrollTop;
    for (const m of this.mesice.children) {
      if (m.offsetTop - MEZERA_Y <= vrch && vrch < m.offsetTop + m.offsetHeight) {
        return [m.dataset.m, Math.max(0, (vrch - m.offsetTop) / Math.max(1, m.offsetHeight))];
      }
    }
    return null;
  }

  _prekresli(drzKotvu = false) {
    const kotva = drzKotvu ? this._kotva() : null;
    const vz = this.osobni.vzhled();
    const par = parametry(this.zoom, vz);
    this.staty = vz.svatky ? (vz.svatky_sk ? ["cz", "sk"] : ["cz"]) : [];
    this.mesice.className = `kal-mesice pruhy-${vz.pruhy}${vz.vikendy ? "" : " bez-vikendu"}`;
    // podklad víkendů a svátků podle výraznosti (KalendarHarmonogramu._podklady_dnu)
    const t = 0.015 + (0.2 * vz.vikendy_sila) / 100 + (vz.kontrast === "vyrazny" ? 0.03 : 0);
    const st = this.mesice.style;
    st.setProperty("--kal-vikend", `color-mix(in srgb, var(--c-text) ${(t * 100).toFixed(1)}%, var(--c-card))`);
    st.setProperty("--kal-svatek", `color-mix(in srgb, var(--c-danger) ${((t * 0.9 + 0.02) * 100).toFixed(1)}%, var(--c-card))`);
    st.setProperty("--c-mrizka", vz.kontrast === "vyrazny" ? "color-mix(in srgb, var(--c-faint) 55%, var(--c-mrizka))"
      : vz.kontrast === "jemny" ? "color-mix(in srgb, var(--c-mrizka) 47%, transparent)" : "var(--c-mrizka)");
    st.setProperty("--minule", vz.kontrast === "vyrazny" ? "var(--c-muted)" : "var(--c-disabled)");
    st.setProperty("--pruh", `${par.pruh}px`);
    st.setProperty("--pismo-pruhu", `${par.pismoPruhu}px`);
    st.setProperty("--r-pruhu", `${Math.min(3, par.pruh / 2)}px`);
    st.setProperty("--rad", `${Math.min(4, par.bunka / 8)}px`);
    this.parametry = par;
    this.vzhled = vz;
    // rozvržení: měsíce v řádcích vedle sebe (KalendarHarmonogramu._prepocitej)
    const w = Math.max(this.obal.clientWidth || 900, 320);
    const sloupce = Math.max(1, Math.min(par.maxSloupcu, Math.floor((w - 2 * OKRAJ_X + par.mezeraX) / (par.minSirka + par.mezeraX))));
    const sirkaM = (w - 2 * OKRAJ_X - (sloupce - 1) * par.mezeraX) / sloupce;
    const cw = (sirkaM - par.tyden) / 7;
    const dnesek = zIso(dnes());
    const mesice = [];
    for (let m = new Date(this.zacatek); m < this.konec; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) mesice.push(m);
    const prvky = [];
    let y = OKRAJ_Y;
    for (let i = 0; i < mesice.length; i += sloupce) {
      const radek = mesice.slice(i, i + sloupce);
      const tydnu = Math.max(...radek.map((m) => Math.ceil((denTydne(m) + dniVMesici(m)) / 7)));
      const vyska = par.nadpis + par.dny + tydnu * par.bunka;
      radek.forEach((m, c) => prvky.push(this._mesic(m, OKRAJ_X + c * (sirkaM + par.mezeraX), y, sirkaM, vyska, cw, par, vz, dnesek)));
      y += vyska + MEZERA_Y;
    }
    this.mesice.style.height = `${y + OKRAJ_Y}px`;
    vymen(this.mesice, prvky);
    if (kotva) {
      const el = [...this.mesice.children].find((m) => m.dataset.m === kotva[0]);
      if (el) this.obal.scrollTop = el.offsetTop + kotva[1] * el.offsetHeight;
    }
  }

  // Jeden měsíc jako v programu (KalendarHarmonogramu.paintEvent): nadpis „Říjen 2026“, dny v týdnu,
  // čísla týdnů vlevo, mřížka jen kolem dnů měsíce, buňky pevné výšky, pruhy v drahách celého měsíce.
  _mesic(m, x, y, sirkaM, vyska, cw, par, vz, dnesek) {
    const rok = m.getFullYear(), mesic = m.getMonth();
    const pocet = dniVMesici(m);
    const posledni = new Date(rok, mesic, pocet);
    const prvniSloupec = denTydne(m);
    const maly = par.bunka < 50;
    const bunka = (d) => { const idx = prvniSloupec + d.getDate() - 1; return [Math.floor(idx / 7), idx % 7]; };

    // dráhy přes celý měsíc (_drahy_mesice): od nejdřívějších a nejdelších
    const udalosti = this.polozky.filter((p) => p.rz[1] >= m && p.rz[0] <= posledni)
      .sort((a, b) => a.rz[0] - b.rz[0] || (b.rz[1] - b.rz[0]) - (a.rz[1] - a.rz[0]) || kolator.compare(a.nazev || "", b.nazev || ""));
    const konce = [];
    const preteceni = new Map();
    const pruhy = [];
    for (const p of udalosti) {
      let draha = konce.findIndex((e) => e < p.rz[0]);
      if (draha < 0) { konce.push(p.rz[1]); draha = konce.length - 1; } else konce[draha] = p.rz[1];
      const zz = p.rz[0] < m ? m : p.rz[0], kk = p.rz[1] > posledni ? posledni : p.rz[1];
      if (draha >= par.drahy) {
        for (let d = zz; d <= kk; d = pridejDny(d, 1)) preteceni.set(d.getDate(), (preteceni.get(d.getDate()) || 0) + 1);
        continue;
      }
      for (let d = zz; d <= kk;) {
        const konecTydne = pridejDny(d, 6 - denTydne(d));
        const segK = konecTydne < kk ? konecTydne : kk;
        const [r1, s1] = bunka(d), [, s2] = bunka(segK);
        const zac = +d === +p.rz[0], kon = +segK === +p.rz[1];
        const x1 = s1 * cw + (zac ? 4 : 0), x2 = (s2 + 1) * cw - (kon ? 4 : 0);
        pruhy.push({ p, zac, kon, left: x1, width: Math.max(6, x2 - x1), top: r1 * par.bunka + par.horni + draha * (par.pruh + par.rozestup) });
        d = pridejDny(segK, 1);
      }
    }

    const tydnu = Math.ceil((prvniSloupec + pocet) / 7);
    const oznacene = this.oznacene;
    const den = iso(this.den);
    const bunky = [];
    for (let i = 1; i <= pocet; i++) {
      const d = new Date(rok, mesic, i);
      const [radek, sloupec] = bunka(d);
      const di = iso(d);
      const svatky = this.staty.length ? svatkyDne(d, this.staty) : [];
      const vRozsahu = oznacene && d >= oznacene[0] && d <= oznacene[1];
      const kraj = vRozsahu && (+d === +oznacene[0] || +d === +oznacene[1]);
      const sNazvem = svatky.length && !kraj && cw >= 40;
      const tridy = ["kal-den", sloupec >= 5 ? "vikend" : "", svatky.length ? "svatek" : "", +d === +dnesek ? "dnes" : "",
        d < dnesek ? "minuly" : "", di === den ? "vybrany" : "", vRozsahu ? "oznaceny" : "", kraj ? "kraj" : "",
        sNazvem ? "s-nazvem" : "", sloupec === 6 || i === pocet ? "pravy" : "", i + 7 > pocet ? "spodni" : ""].filter(Boolean).join(" ");
      const navic = preteceni.get(i);
      const vlajky = sNazvem ? h("span", { class: "vlajky", style: { "--vv": `${Math.max(7, Math.min(11, par.cislo * 0.68))}px` } },
        svatky.map(([s]) => h("i", { class: `vlajka ${s}` }))) : null;
      bunky.push(h("div", { class: tridy, dataset: { d: di }, style: { gridRow: String(radek + 1), gridColumn: String(sloupec + 1) },
        title: svatky.map(([s, n]) => `${n}${s === "sk" ? " (SK)" : ""}`).join("\n") || null },
      h("span", { class: "kal-cislo", style: { top: `${maly ? 2 : 6}px`, fontSize: `${par.cislo}px` } }, String(i), vlajky,
        sNazvem && cw >= 70 ? h("span", { class: "kal-svatek", text: svatky[0][1], style: { fontSize: `${par.pismoSvatku}px` } }) : null),
      navic ? h("button", { type: "button", class: `kal-vic${maly ? " tecka-vic" : ""}`, dataset: { d: di }, text: maly ? "" : `+${navic}`,
        title: `Další ${navic === 1 ? "termín" : navic < 5 ? "termíny" : "termínů"} v tento den` }) : null));
    }
    const vzPruhu = vz.pruhy;
    const prvkyPruhu = pruhy.map(({ p, zac, kon, left, width, top }) => {
      const ztlumit = jeHotovo(p.pol) || (vz.probehle && p.rz[1] < dnesek);
      const tridy = ["kal-pruh", zac ? "zacatek" : "", kon ? "konec" : "", ztlumit ? "ztlumeny" : "", p.id === this.vybranyTermin ? "vybrany" : "",
        p.pevny ? "pevny" : "", p.cizi ? "cizi" : "", p.druh === "poznamka" && vzPruhu === "plne" ? "poznamka" : ""].filter(Boolean).join(" ");
      return h("div", { class: tridy, dataset: { id: p.id }, title: this._tip(p),
        style: { left: `${left}px`, width: `${width}px`, top: `${top}px`, "--b": sytost(p.barva, vz.sytost) } },
      par.pruh >= 12 ? h("span", { text: `${jeHotovo(p.pol) ? "✓ " : ""}${p.text}` }) : null);
    });

    // čísla týdnů (ISO) – aktuální týden zvýrazněný
    const tydny = [];
    if (par.tyden) {
      const pondeli = pridejDny(m, -prvniSloupec);
      const pondeliDnes = iso(pridejDny(dnesek, -denTydne(dnesek)));
      tydny.push(h("span", { class: "titul", style: { top: `${par.nadpis}px`, height: `${par.dny - 6}px` }, text: par.tyden < 24 ? "T" : "týd." }));
      for (let r = 0; r < tydnu; r++) {
        const po = pridejDny(pondeli, r * 7);
        const c = tydenRoku(po);
        const aktualni = iso(po) === pondeliDnes;
        tydny.push(h("span", { class: `tc${aktualni ? " aktualni" : ""}`, text: String(c),
          style: { top: `${par.nadpis + par.dny + r * par.bunka + (maly ? 2 : 6)}px` } }));
      }
    }

    const nadpisPismo = par.velky ? 17 : 14;
    return h("section", { class: "kal-mesic", dataset: { m: iso(m).slice(0, 7) },
      style: { left: `${x}px`, top: `${y}px`, width: `${sirkaM}px`, height: `${vyska}px` } },
    h("div", { class: "kal-mesic-nadpis", style: { left: "4px", top: "4px", height: `${par.nadpis - 10}px`, fontSize: `${nadpisPismo}px` } },
      velke(MESICE[mesic]), h("span", { text: String(rok) })),
    par.tyden ? h("div", { class: "kal-tydny", style: { left: "0", top: "0", width: `${par.tyden}px`, height: "100%", fontSize: `${par.pismoTydne}px` } }, tydny) : null,
    h("div", { class: "kal-hlavicka", style: { left: `${par.tyden}px`, top: `${par.nadpis}px`, width: `${7 * cw}px`, height: `${par.dny - 6}px`, fontSize: `${par.velky ? 11 : 10}px` } },
      DNY.map((d, i) => h("span", { class: i >= 5 ? "vikend" : "", text: velke(d) }))),
    h("div", { class: "kal-mrizka", style: { left: `${par.tyden}px`, top: `${par.nadpis + par.dny}px`, width: `${7 * cw}px`,
      height: `${tydnu * par.bunka}px`, gridTemplateRows: `repeat(${tydnu}, ${par.bunka}px)` } },
    bunky, h("div", { class: "kal-pruhy" }, prvkyPruhu)));
  }

  _tip(p) {
    const casti = [p.druh === "dovolene" ? `Dovolená – ${this.tym.jmeno(p.pol.uzivatel, "nevím kdo")}` : p.nazev,
      popisRozsahu(...p.rz)];
    if (p.projekt && !this.projektId) casti.push(nazevProjektu(p.projekt));
    if (p.druh === "projekt" || p.druh === "bez" || p.druh === "soukrome") casti.push(this.tym.nazevDruhu(p.pol));
    if (jeHotovo(p.pol)) casti.push("hotovo");
    return casti.filter(Boolean).join("\n");
  }

  _priRolovani() {
    const o = this.obal;
    if (o.scrollTop + o.clientHeight > o.scrollHeight - 500) {
      this.konec = new Date(this.konec.getFullYear(), this.konec.getMonth() + 12, 1);
      this._prekresli(true);
    } else if (o.scrollTop < 200 && pocetDni(this.zacatek, zIso(dnes())) < 5 * 366) {
      this.zacatek = new Date(this.zacatek.getFullYear(), this.zacatek.getMonth() - 12, 1);
      this._prekresli(true);
    }
  }

  jdiNa(d, plynule = true) {
    if (d < this.zacatek) { this.zacatek = new Date(d.getFullYear(), d.getMonth() - 2, 1); this._prekresli(); }
    if (d >= this.konec) { this.konec = new Date(d.getFullYear(), d.getMonth() + 6, 1); this._prekresli(); }
    const el = [...this.mesice.children].find((m) => m.dataset.m === iso(d).slice(0, 7));
    if (el) this.obal.scrollTo({ top: el.offsetTop - 4, behavior: plynule ? "smooth" : "auto" });
  }

  jdiNaDnes() {
    this.den = zIso(dnes());
    this.boc = "den";
    this.vybranyTermin = null;
    this._oznacVyber();
    this._ukazDen();
    this.jdiNa(this.den);
  }

  // --- myš: výběr dnů tažením, přetahování pruhů ---

  _denPodBodem(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      const d = el.closest?.(".kal-den[data-d]");
      if (d) return zIso(d.dataset.d);
    }
    return null;
  }

  _dolu(ev) {
    const dotyk = this._dotyk = ev.pointerType === "touch";
    if (ev.button !== 0 || ev.target.closest(".kal-vic")) return;
    const pruh = ev.target.closest(".kal-pruh");
    const start = this._denPodBodem(ev.clientX, ev.clientY);
    if (!start) return;
    this._potlacKlik = false;
    let rezim = null, polozka = null;
    if (pruh) {
      polozka = this._mapa.get(pruh.dataset.id) || null;
      if (polozka && !polozka.pevny && !polozka.cizi) {
        const r = pruh.getBoundingClientRect();
        rezim = !dotyk && pruh.classList.contains("konec") && ev.clientX > r.right - 7 ? "konec"
          : !dotyk && pruh.classList.contains("zacatek") && ev.clientX < r.left + 7 ? "zacatek" : "presun";
      } else if (!dotyk) {
        return;   // jen pro čtení – klik ukáže detail
      }
    }
    if (dotyk) {
      this._dlouhyStisk(ev, pruh, polozka, rezim, start);
      return;
    }
    this._tazeni(polozka, rezim, start, ev.clientX, ev.clientY, false);
    ev.preventDefault();
  }

  // Dotyk: podržení prstu (~0,45 s) zvedne termín k přesunu / začne výběr dnů; pohyb předtím = rolování.
  _dlouhyStisk(ev, pruh, polozka, rezim, start) {
    const x0 = ev.clientX, y0 = ev.clientY, id = ev.pointerId;
    let casovac = 0;
    const konec = () => {
      clearTimeout(casovac);
      document.removeEventListener("pointermove", pohyb);
      document.removeEventListener("pointerup", konec);
      document.removeEventListener("pointercancel", konec);
    };
    const pohyb = (e) => { if (e.pointerId === id && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) konec(); };
    casovac = setTimeout(() => {
      konec();
      this._potlacKontext = Date.now();
      navigator.vibrate?.(12);
      if (pruh && !rezim) {   // jen pro čtení: podržení = nabídka
        this._menuTerminu(x0, y0, polozka || this._mapa.get(pruh.dataset.id));
        return;
      }
      this._tazeni(polozka, rezim, start, x0, y0, true, id);
    }, 450);
    document.addEventListener("pointermove", pohyb);
    document.addEventListener("pointerup", konec);
    document.addEventListener("pointercancel", konec);
  }

  // Tažení myší i prstem: pruh = posun / délka (náhled označenými dny), den = výběr dnů → nabídka.
  _tazeni(polozka, rezim, start, x0, y0, dotykem, idUkazatele = null) {
    let tazeno = false, cil = start;
    this._tahDotykem = dotykem;
    if (dotykem) {
      this.oznacene = polozka ? [...polozka.rz] : [start, start];
      this._zvyrazni();
    }
    const pohyb = (e) => {
      if (idUkazatele != null && e.pointerId !== idUkazatele) return;
      if (!tazeno && Math.hypot(e.clientX - x0, e.clientY - y0) < 5) return;
      tazeno = true;
      const d = this._denPodBodem(e.clientX, e.clientY);
      if (!d || iso(d) === iso(cil) && this.oznacene) return;
      cil = d;
      if (polozka) {
        const posun = pocetDni(start, d);
        let [z, k] = polozka.rz;
        if (rezim === "presun") { z = pridejDny(z, posun); k = pridejDny(k, posun); }
        else if (rezim === "konec") k = pridejDny(k, posun) < z ? z : pridejDny(k, posun);
        else z = pridejDny(z, posun) > k ? k : pridejDny(z, posun);
        this.oznacene = [z, k];
      } else {
        this.oznacene = d < start ? [d, start] : [start, d];
      }
      this._zvyrazni();
    };
    const nahoru = (e) => {
      if (idUkazatele != null && e.pointerId !== idUkazatele) return;
      document.removeEventListener("pointermove", pohyb);
      document.removeEventListener("pointerup", nahoru);
      document.removeEventListener("pointercancel", nahoru);
      document.body.classList.remove("taznuti");
      this._tahDotykem = false;
      const oznacene = this.oznacene;
      if (polozka) {
        this.oznacene = null;
        this._zvyrazni();
        if (tazeno || dotykem) {
          this._potlacKlik = true;
          setTimeout(() => { this._potlacKlik = false; }, 0);
        }
        if (tazeno && e.type === "pointerup" && oznacene && (iso(oznacene[0]) !== iso(polozka.rz[0]) || iso(oznacene[1]) !== iso(polozka.rz[1]))) {
          this._posun(polozka, oznacene[0], oznacene[1], rezim === "presun" ? "presun" : "delka");
        } else if (dotykem && !tazeno) {
          this._menuTerminu(e.clientX, e.clientY, polozka);   // podržení bez pohybu = nabídka
        }
        return;
      }
      if (dotykem && !tazeno) {
        this.oznacene = null;
        this._zvyrazni();
        this._kontextDne(e.clientX, e.clientY, start);
        return;
      }
      if (!tazeno || !oznacene || iso(oznacene[0]) === iso(oznacene[1])) {
        this.oznacene = null;
        this._zvyrazni();
        if (e.type === "pointerup" && !dotykem) this.vyberDen(start);
        return;
      }
      this._menuVyberu(e.clientX, e.clientY, oznacene[0], oznacene[1]);
    };
    document.addEventListener("pointermove", pohyb);
    document.addEventListener("pointerup", nahoru);
    document.addEventListener("pointercancel", nahoru);
    if (polozka) document.body.classList.add("taznuti");
  }

  _zvyrazni() {
    const o = this.oznacene;
    const z = o ? iso(o[0]) : "", k = o ? iso(o[1]) : "";
    for (const el of this.mesice.querySelectorAll(".kal-den[data-d]")) {
      const d = el.dataset.d;
      el.classList.toggle("oznaceny", !!o && d >= z && d <= k);
      el.classList.toggle("kraj", !!o && (d === z || d === k));
    }
  }

  _menuVyberu(x, y, z, k) {
    const zrus = () => { this.oznacene = null; this._zvyrazni(); };
    const polozky = [
      { nadpis: popisRozsahu(z, k) },
      { text: this.projektId ? "Naplánovat sem…" : "Nový termín…", ikona: "plus", akce: () => { zrus(); this.novyTermin(z, k); } },
      this.projektId ? null : { text: "Soukromý termín…", ikona: "zamek", akce: () => { zrus(); this.novyTermin(z, k, SOUKROME); } },
      this.projektId ? null : { text: "Dovolená…", ikona: "dovolena", akce: () => { zrus(); this.novyTermin(z, k, `${DOVOLENE}:${this.tym.ja.id}`); } },
      "-",
      { text: "Exportovat toto období…", ikona: "export", akce: () => { zrus(); this.export([z, k]); } },
    ];
    menu(x, y, polozky);
    const zavrit = () => { setTimeout(() => { if (!document.querySelector(".menu")) zrus(); }, 0); document.removeEventListener("pointerdown", zavrit, true); };
    setTimeout(() => document.addEventListener("pointerdown", zavrit, true), 0);
  }

  _kontext(ev) {
    const pruh = ev.target.closest(".kal-pruh");
    const den = ev.target.closest(".kal-den[data-d]") || (pruh && null);
    if (!pruh && !den) return;
    ev.preventDefault();
    if (this._dotyk) return;   // dotyk: nabídky řeší podržení prstu (_dlouhyStisk)
    if (pruh) { this._menuTerminu(ev.clientX, ev.clientY, this._mapa.get(pruh.dataset.id)); return; }
    this._kontextDne(ev.clientX, ev.clientY, zIso(den.dataset.d));
  }

  _kontextDne(x, y, d) {
    const ev = { clientX: x, clientY: y };
    const m = new Date(d.getFullYear(), d.getMonth(), 1);
    menu(ev.clientX, ev.clientY, [
      { nadpis: `${DNY[(d.getDay() + 6) % 7]} ${datumKratce(d, true)}` },
      { text: this.projektId ? "Nový termín…" : "Nový termín…", ikona: "plus", akce: () => this.novyTermin(d, d) },
      this.projektId ? null : { text: "Soukromý termín…", ikona: "zamek", akce: () => this.novyTermin(d, d, SOUKROME) },
      this.projektId ? null : { text: "Dovolená…", ikona: "dovolena", akce: () => this.novyTermin(d, d, `${DOVOLENE}:${this.tym.ja.id}`) },
      "-",
      { text: "Přejít na dnešek", akce: () => this.jdiNaDnes() },
      { text: `Exportovat ${MESICE[d.getMonth()]}…`, ikona: "export", akce: () => this.export([m, new Date(d.getFullYear(), d.getMonth() + 1, 0)]) },
      this.projektId || !this.naDovolene ? null : { text: "Plán dovolených…", ikona: "sun", akce: () => this.naDovolene(d.getFullYear()) },
    ]);
  }

  _menuTerminu(x, y, p) {
    if (!p) return;
    if (p.druh === "faktura") { this.naFakturu(p.pol._faktura, "menu", x, y); return; }
    const projekt = p.projekt;
    const polozky = [{ nadpis: p.nazev }];
    if (p.druh === "poznamka") {
      polozky.push({ text: "Otevřít projekt", ikona: "otevrit", akce: () => this.naProjekt(projekt.id) });
    } else if (p.cizi) {
      polozky.push({ text: "Podrobnosti", akce: () => this.vyberTermin(p.id) });
    } else {
      polozky.push({ text: "Upravit…", ikona: "upravit", akce: () => { this.vyberTermin(p.id); this._uprava(p); } },
        { text: jeHotovo(p.pol) ? "Znovu otevřít" : "Označit jako hotové", ikona: "hotovo", akce: () => this._prepniHotovo(p) });
      if (projekt && !this.projektId) polozky.push({ text: "Otevřít projekt", ikona: "otevrit", akce: () => this.naProjekt(projekt.id) });
      if (this.faktury && p.druh === "projekt") polozky.push({ text: "Fakturovat…", akce: () => this.naFakturu("", "nova", p.id) });
    }
    if (!this.projektId && p.druh !== "poznamka") {
      const kdo = p.druh === "projekt" ? projekt.id : p.zdroj;
      const nazev = p.druh === "projekt" ? nazevProjektu(projekt) : OSTATNI_V_KALENDARI[p.zdroj];
      polozky.push("-", { text: `Ukázat jen „${nazev}“`, akce: () => this._jenTento(kdo) },
        { text: `Skrýt „${nazev}“`, akce: () => this._skryj(kdo) });
    }
    if (!p.cizi && p.druh !== "poznamka") polozky.push("-", { text: "Smazat", ikona: "smazat", nebezpecne: true, akce: () => this._smaz(p) });
    menu(x, y, polozky);
  }

  // --- boční panel: přehled dne (PrehledDne) / detail termínu (DetailTerminu) / úpravy ---

  _panel(nadpis, ...obsah) {
    const vObsahu = h("div", { class: "kal-bok-obsah" }, obsah);
    if (window.matchMedia("(max-width: 760px)").matches) {
      if (this._oknoBoku) this._oknoBoku.zavri();
      this._oknoBoku = okno(nadpis, vObsahu, [], { bezNadpisu: true });
      this._oknoBoku.dialog.addEventListener("close", () => { this._oknoBoku = null; });
      return;
    }
    vymen(this.bok, vObsahu);
  }

  vyberDen(d) {
    this.den = d;
    this.boc = "den";
    this.vybranyTermin = null;
    this._oznacVyber();
    this._ukazDen(true);
  }

  // řádek termínu (harmonogram.RadekTerminu): proužek / datum s odpočtem, nad názvem projekt
  _radekTerminu(p, sOdpoctem = false) {
    const pol = p.pol, rz = p.rz;
    const dnesek = zIso(dnes());
    const dny = pocetDni(...rz) + 1;
    const projekt = !this.projektId ? (p.projekt ? [p.projekt.lokalita, p.projekt.nazev].filter(Boolean).join(" · ") || nazevProjektu(p.projekt)
      : p.druh === "dovolene" ? this.tym.jmeno(pol.uzivatel, "Dovolená") : popisKam(this.tym, kamPatri(p))) : "";
    const upr = p.barva === BARVA_REALIZACE ? String(pol.upresneni || "").trim() : "";
    const znacka = sOdpoctem
      ? h("span", { class: "termin-znacka", style: { background: `color-mix(in srgb, ${p.barva} 11%, transparent)` } },
        h("b", { text: String(rz[0].getDate()), style: { color: p.barva } }), h("small", { text: MESICE_ZKR[rz[0].getMonth()] }))
      : h("span", { class: "termin-prouzek", style: { background: p.barva } });
    const [odpocet, barvaOdpoctu] = relativni(rz[0], rz[1], dnesek);
    return h("button", { type: "button", class: `termin-radek${jeHotovo(pol) ? " hotovo" : ""}`, onclick: () => this.vyberTermin(p.id, true) },
      znacka,
      h("span", { class: "termin-texty" },
        projekt ? h("span", { class: "projekt-nad", text: projekt }) : null,
        h("strong", { text: `${jeHotovo(pol) ? "✓ " : ""}${p.druh === "dovolene" ? "Dovolená" : p.nazev || "Termín"}` }),
        h("span", { class: "faint", text: `${DNY[denTydne(rz[0])]} ${popisRozsahu(...rz)}${dny > 1 ? ` · ${pocetDniText(dny)}` : ""}`
          + (upr && upr.toLowerCase() !== String(pol.nazev || "").trim().toLowerCase() ? ` · ${upr}` : "") })),
      sOdpoctem && !jeHotovo(pol) ? h("span", { class: "odpocet", text: odpocet, style: { color: barvaOdpoctu } }) : null);
  }

  _ukazDen(uzivatel = false) {
    if (!uzivatel && window.matchMedia("(max-width: 760px)").matches) return;
    const d = this.den;
    const dnesek = zIso(dnes());
    const dne = this.polozky.filter((p) => p.rz[0] <= d && p.rz[1] >= d);
    const svatky = svatkyDne(d, this.staty?.length ? this.staty : ["cz", "sk"]);
    const nadchazejici = this.projektId ? [] : this.polozky.filter((p) => !p.pevny && !jeHotovo(p.pol) && p.rz[1] >= dnesek)
      .sort((a, b) => a.rz[0] - b.rz[0] || a.rz[1] - b.rz[1]).slice(0, 12);
    this._panel(datumDlouze(d),
      h("div", { class: "den-tydne", text: `${+d === +dnesek ? "Dnes · " : ""}${DNY_CELE[denTydne(d)]} · ${tydenRoku(d)}. týden` }),
      h("h2", { text: datumDlouze(d) }),
      svatky.map(([s, n]) => h("div", { class: "stitek-svatku" }, h("span", { class: "vlajky", style: { "--vv": "10px" } }, h("i", { class: `vlajka ${s}` })), n)),
      h("div", { style: { height: "8px" } }),
      h("div", { class: "seznam" }, dne.map((p) => this._radekTerminu(p))),
      !dne.length ? h("p", { class: "tiche", text: "V tento den nic není." }) : null,
      h("div", {}, h("button", { type: "button", class: "tlacitko duch", onclick: () => this.novyTermin(d, d) }, ikona("plus"), "Přidat termín na tento den")),
      nadchazejici.length ? [h("div", { class: "sekce-boku", text: "NADCHÁZEJÍCÍ" }),
        h("div", { class: "seznam" }, nadchazejici.map((p) => this._radekTerminu(p, true)))] : null);
  }

  vyberTermin(id, posunout = false) {
    const p = this._mapa.get(id);
    if (!p) return;
    this.vybranyTermin = id;
    this.boc = "termin";
    this._oznacVyber();
    this._ukazTermin(p);
    if (posunout) this.jdiNa(p.rz[0]);
  }

  _ukazTermin(p) {
    const pol = p.pol;
    const zpet = h("button", { type: "button", class: "tlacitko duch", title: "Zpět na přehled dne", onclick: () => this.vyberDen(this.den) }, ikona("chevron-left"), "Den");
    if (p.druh === "faktura") {
      this._panel(p.nazev, h("div", { class: "kal-bok-akce" }, zpet, h("span", { class: "mezera" }),
        h("button", { type: "button", class: "tlacitko", onclick: () => this.naFakturu(pol._faktura, "upravit") }, ikona("edit"), "Upravit")),
      h("h2", { text: p.nazev }), h("p", { class: "text-poznamky tiche", text: pol.poznamka || "" }),
      h("div", {}, h("button", { type: "button", class: "tlacitko duch", onclick: () => this.naFakturu(pol._faktura, "cashflow") }, "Cashflow zakázky", ikona("chevron-right"))));
      return;
    }
    const dny = pocetDni(...p.rz) + 1;
    const projekt = p.projekt ? [p.projekt.lokalita, p.projekt.nazev].filter(Boolean).join(" · ") || nazevProjektu(p.projekt) : popisKam(this.tym, kamPatri(p));
    let doplnek = "";
    if (p.druh === "dovolene") {
      const dov = new Dovolene(this.tym.hodnota("dovolene"), this.tym.nastaveni);
      const bil = dov.bilance(pol.uzivatel || "", p.rz[0].getFullYear());
      doplnek = `${hodinyText(dov.hodinPolozky(pol), dov.den)}${hodinDovoleneDenne(pol, dov.den) < dov.den ? ` · ${cislo(pol.hodin)} h denně` : ""}`
        + (!p.cizi ? ` · letos zbývá ${hodinyText(bil.zbyva, dov.den)}` : "");
    }
    let zmeny = (Array.isArray(pol.zmeny) ? pol.zmeny : []).slice().reverse();
    if (!zmeny.length && pol.vytvoreno) zmeny = [{ cas: pol.vytvoreno, kdo: pol.vytvoril, text: "Vytvořen" }];
    const lzeUpravit = !p.cizi && p.druh !== "poznamka";
    this._panel(p.nazev,
      h("div", { class: "kal-bok-akce" }, zpet, h("span", { class: "mezera" }),
        lzeUpravit ? h("button", { type: "button", class: "tlacitko", title: "Změnit název, datum, druh, poznámku…", onclick: () => this._uprava(p) }, ikona("edit"), "Upravit") : null),
      h("div", { class: "projekt-nad", style: { color: "var(--c-primary-dark)", fontWeight: "700", fontSize: "12px" }, text: projekt }),
      h("h2", { text: `${jeHotovo(pol) ? "✓ " : ""}${p.druh === "dovolene" ? `Dovolená – ${this.tym.jmeno(pol.uzivatel, "")}` : p.nazev}` }),
      h("div", { class: "tiche", text: `${DNY[denTydne(p.rz[0])]} ${popisRozsahu(...p.rz)}${dny > 1 ? ` · ${pocetDniText(dny)}` : ""}${jeHotovo(pol) ? " · hotovo" : ""}` }),
      p.druh !== "dovolene" && p.druh !== "poznamka" ? h("div", { class: "druh-terminu" }, h("i", { class: "tecka", style: { background: p.barva } }), this.tym.nazevDruhu(pol)) : null,
      doplnek ? h("div", { class: "tiche", text: doplnek }) : null,
      h("div", { style: { height: "6px" } }),
      pol.poznamka ? [h("div", { class: "faint", text: "Poznámka" }), h("p", { class: "text-poznamky inset", style: { padding: "10px", margin: "2px 0 0" }, text: pol.poznamka })] : null,
      p.projekt && !this.projektId ? h("div", {}, h("button", { type: "button", class: "tlacitko duch",
        onclick: () => (this.naTermin ? this.naTermin(p.projekt.id, p.id) : this.naProjekt(p.projekt.id)) }, "Otevřít v harmonogramu projektu", ikona("chevron-right"))) : null,
      this.faktury && p.druh === "projekt" && lzeUpravit ? [h("div", { class: "sekce-boku", text: "FAKTURACE" }),
        h("div", {}, h("button", { type: "button", class: "tlacitko duch", title: "Vydaná faktura po tomto termínu – posouvá se s ním",
          onclick: () => this.naFakturu("", "nova", p.id) }, ikona("plus"), "Fakturovat…"))] : null,
      zmeny.length ? [h("div", { class: "sekce-boku", text: "HISTORIE TERMÍNU" }),
        h("div", { class: "historie-terminu-seznam" }, zmeny.slice(0, 15).map((z) => h("div", { class: "radek-historie" },
          h("span", { text: z.text }), h("small", { class: "faint", text: [casText(z.cas), z.kdo].filter(Boolean).join("  ·  ") }))))] : null);
  }

  _uprava(p) {
    if (p.pevny || p.cizi) return;
    this.boc = "uprava";
    const pol = p.pol;
    const tym = this.tym;
    const nazev = h("input", { value: pol.nazev || "", maxlength: 200 });
    const od = h("input", { type: "date", value: iso(p.rz[0]) });
    const doo = h("input", { type: "date", value: iso(p.rz[1]) });
    const druh = vyberDruhu(tym, barvaTerminu(pol));
    const upresneni = h("input", { value: pol.upresneni || "", maxlength: 100, placeholder: "např. Jeřáby na stavbě" });
    const poleUpr = pole("Upřesnění (nepovinné)", upresneni);
    const poznamka = h("textarea", { rows: 3, maxlength: 5000 });
    poznamka.value = pol.poznamka || "";
    const hotovo = h("input", { type: "checkbox", checked: jeHotovo(pol) });
    const dov = new Dovolene(tym.hodnota("dovolene"), tym.nastaveni);
    const hodin = h("input", { type: "number", min: 0.5, max: dov.den, step: 0.5, value: hodinDovoleneDenne(pol, dov.den) });
    const kam = h("select", {}, (this.projektId ? [[p.zdroj, nazevProjektu(p.projekt)]] : moznostiKam(tym))
      .map(([v, t]) => h("option", { value: v, text: t, selected: v === kamPatri(p) })));
    if (![...kam.options].some((o) => o.selected)) kam.append(h("option", { value: kamPatri(p), text: popisKam(tym, kamPatri(p)), selected: true }));
    const jeDovolena = () => kam.value.startsWith(DOVOLENE);
    const poleDruhu = pole("Druh", druh.el), poleHodin = pole("Hodin denně", hodin, `Celý den = ${cislo(dov.den)} h`);
    const ukaz = () => {
      poleDruhu.hidden = jeDovolena();
      poleUpr.hidden = jeDovolena() || druh.hodnota() !== BARVA_REALIZACE;
      poleHodin.hidden = !jeDovolena();
    };
    druh.priZmene = ukaz;
    kam.addEventListener("change", ukaz);
    ukaz();
    const chyba = h("p", { class: "chyba-formulare", role: "alert" });
    const ulozit = h("button", { type: "submit", class: "tlacitko male hlavni", text: "Uložit" });
    const formular = h("form", { class: "kal-uprava", onsubmit: async (ev) => {
      ev.preventDefault();
      chyba.textContent = "";
      const z = zIso(od.value), k = zIso(doo.value) || z;
      if (!z) { chyba.textContent = "Vyber datum."; return; }
      const novy = { ...pol, nazev: nazev.value.trim(), poznamka: poznamka.value.trim(), stav: hotovo.checked ? "Dokončeno" : (jeHotovo(pol) ? "Plánováno" : pol.stav || "Plánováno") };
      nastavRozsah(novy, z, k);
      if (!jeDovolena()) {
        novy.barva = druh.hodnota();
        if (druh.hodnota() === BARVA_REALIZACE) novy.upresneni = upresneni.value.trim();
        else if (novy.upresneni) novy.upresneni = "";
      } else {
        const h2 = Number(hodin.value);
        novy.hodin = h2 > 0 && h2 < dov.den ? h2 : 0;
      }
      if (!novy.nazev && !(novy.upresneni || "").trim()) { chyba.textContent = "Doplň název termínu."; return; }
      if (!novy.nazev) novy.nazev = novy.upresneni.trim();
      ulozit.disabled = true;
      try {
        await this._ulozUpravy(p, novy, kam.value);
        this.boc = "termin";
        this.obnov();
        oznam("Termín uložen");
      } catch (e) {
        chyba.textContent = e?.message || String(e);
        ulozit.disabled = false;
      }
    } },
    pole("Název", nazev), h("div", { class: "dve-pole" }, pole("Od", od), pole("Do", doo)),
    poleDruhu, poleUpr, poleHodin, pole("Kam patří", kam), pole("Poznámka", poznamka),
    h("label", { class: "zaskrtavatko" }, hotovo, h("span", { text: "Hotovo" })), chyba,
    h("div", { class: "kal-bok-akce" }, ulozit,
      h("button", { type: "button", class: "tlacitko male", text: "Zrušit", onclick: () => { this.boc = "termin"; this._ukazTermin(p); } }),
      h("div", { class: "mezera" }),
      h("button", { type: "button", class: "ikonove", title: "Smazat", "aria-label": "Smazat", onclick: () => this._smaz(p) }, ikona("smazat"))));
    this._panel("Upravit termín", formular);
    nazev.focus();
  }

  // --- změny dat ---

  _historieUpravy(p, text, sTerminem = "") {
    // termíny bez projektu, soukromé a dovolené historii projektu nemají
    return p.druh === "projekt" ? (sTerminem ? [text, sTerminem] : text) : "";
  }

  async _ulozUpravy(p, novy, kam) {
    const tym = this.tym;
    const popis = popisZmen(tym, p.pol, novy);
    const puvodniKam = kamPatri(p);
    // dovolená (i ta, kam se termín přesouvá) se nesmí krýt s jinou dovolenou téhož člověka
    const kdo = kam.startsWith(DOVOLENE) ? kam.split(":")[1] || "" : p.druh === "dovolene" ? p.pol.uzivatel || "" : null;
    if (kdo !== null) hlidejPrekryvDovolene(tym.hodnota("dovolene"), kdo, ...rozsah(novy), p.id);
    if (popis) {
      await upravZdroj(tym, this.osobni, p.zdroj, (seznam) => {
        const pol = seznam.find((x) => x.id === p.id);
        if (!pol) throw new Error("Termín už mezitím někdo smazal.");
        if (p.druh === "dovolene" && !tym.jeSpravce && (pol.uzivatel || "") !== tym.ja.id) throw new Error("Cizí dovolenou měnit nemůžeš.");
        if (p.druh === "dovolene") hlidejPrekryvDovolene(seznam, pol.uzivatel, ...rozsah(novy), p.id);
        for (const k of ["nazev", "poznamka", "stav", "barva", "upresneni", "hodin"]) if (k in novy) pol[k] = novy[k];
        nastavRozsah(pol, ...rozsah(novy));
        if (p.druh === "dovolene" && !pol.hodin) delete pol.hodin;
        zaznamTerminu(pol, popis, tym.ja.jmeno);
      }, this._historieUpravy(p, `Upraven termín (v kalendáři) ${novy.nazev}: ${popis.replace(/^Upraven: /, "")}`));
    }
    if (kam !== puvodniKam) await this._presun(p, kam);
  }

  async _presun(p, kam) {
    const tym = this.tym;
    const kdo = kam.startsWith(DOVOLENE) ? kam.split(":")[1] || "" : null;
    if (kdo !== null && kdo !== tym.ja.id && !tym.jeSpravce) throw new Error("Dovolenou kolegům zadává správce.");
    const cil = kdo !== null ? DOVOLENE : kam;
    if (cil === p.zdroj) {
      // dovolená jinému kolegovi
      await upravZdroj(tym, this.osobni, DOVOLENE, (s) => {
        const pol = s.find((x) => x.id === p.id);
        if (!pol) return false;
        const r = rozsah(pol);
        if (r) hlidejPrekryvDovolene(s, kdo, ...r, p.id);
        pol.uzivatel = kdo;
        zaznamTerminu(pol, `Dovolená – ${tym.jmeno(kdo, "nevím kdo")}`, tym.ja.jmeno);
      });
      return;
    }
    // nejdřív do cíle, pak ze zdroje (při chybě raději dvakrát než vůbec)
    const pol = structuredClone(p.pol);
    if (cil === DOVOLENE) { pol.barva = C_DOVOLENA; if (kdo) pol.uzivatel = kdo; }
    else if (p.zdroj === DOVOLENE) { delete pol.uzivatel; pol.barva = BARVY_TERMINU[BARVY_TERMINU.length - 1]; }
    const odkud = p.projekt ? nazevProjektu(p.projekt) : popisKam(tym, kamPatri(p));
    zaznamTerminu(pol, cil === DOVOLENE ? `Dovolená – ${tym.jmeno(kdo, "nevím kdo")}` : cil === SOUKROME ? "Soukromý termín"
      : cil === BEZ_PROJEKTU ? "Bez projektu" : `Přesunut do projektu ${popisKam(tym, cil)}`, tym.ja.jmeno);
    await upravZdroj(tym, this.osobni, cil, (s) => {
      if (s.some((x) => x.id === pol.id)) return;
      const r = rozsah(pol);
      if (cil === DOVOLENE && r) hlidejPrekryvDovolene(s, kdo, ...r, pol.id);
      s.push(pol);
    },
      DRUHY_ZDROJU[cil] ? "" : `Přidán termín (z ${odkud}): ${pol.nazev || ""}`);
    await upravZdroj(tym, this.osobni, p.zdroj, (s, projekt) => {
      const i = s.findIndex((x) => x.id === p.id);
      if (i < 0) return false;
      const [puvodni] = s.splice(i, 1);
      if (projekt) zmrazNavazane(projekt, puvodni);
    }, p.druh === "projekt" ? `Termín přesunut do ${popisKam(tym, cil)}: ${pol.nazev || ""}` : "");
    oznam(`Termín přesunut: ${popisKam(tym, kam)}`);
  }

  async _posun(p, z, k, druh) {
    const popis = popisRozsahu(z, k);
    try {
      await upravZdroj(this.tym, this.osobni, p.zdroj, (s) => {
        const pol = s.find((x) => x.id === p.id);
        if (!pol) return false;
        if (p.zdroj === DOVOLENE) hlidejPrekryvDovolene(s, pol.uzivatel, z, k, p.id);
        nastavRozsah(pol, z, k);
        zaznamTerminu(pol, (druh === "presun" ? "Přesunut na " : "Změněna délka: ") + popis, this.tym.ja.jmeno);
      }, this._historieUpravy(p, `${druh === "presun" ? "Přesunut" : "Změněna délka"} termínu (v kalendáři): ${p.pol.nazev || ""} → ${popis}`));
      this.vybranyTermin = p.id;
      this.boc = "termin";
      this.obnov();
    } catch (e) {
      this.obnov();   // pruh zpátky na původní místo
      oznam(e?.message || "Změnu se nepodařilo uložit.", true);
    }
  }

  async _prepniHotovo(p) {
    const hotovo = !jeHotovo(p.pol);
    try {
      await upravZdroj(this.tym, this.osobni, p.zdroj, (s) => {
        const pol = s.find((x) => x.id === p.id);
        if (!pol) return false;
        pol.stav = hotovo ? "Dokončeno" : "Plánováno";
        zaznamTerminu(pol, hotovo ? "Označen jako hotový" : "Znovu otevřen", this.tym.ja.jmeno);
      }, this._historieUpravy(p, (hotovo ? "Hotovo: " : "Znovu otevřeno: ") + (p.pol.nazev || "")));
    } catch (e) {
      oznam(e?.message || "Změnu se nepodařilo uložit.", true);
    }
  }

  async _smaz(p) {
    if (p.pevny || p.cizi) return;
    let index = -1, smazany = null;
    try {
      await upravZdroj(this.tym, this.osobni, p.zdroj, (s, projekt) => {
        index = s.findIndex((x) => x.id === p.id);
        if (index < 0) return false;
        if (p.druh === "dovolene" && !this.tym.jeSpravce && (s[index].uzivatel || "") !== this.tym.ja.id) throw new Error("Cizí dovolenou mazat nemůžeš.");
        smazany = s.splice(index, 1)[0];
        if (projekt) zmrazNavazane(projekt, smazany);   // plánovaná fakturace po termínu si nechá jeho datum
      }, this._historieUpravy(p, `Smazán termín (v kalendáři): ${p.pol.nazev || ""}`, p.pol.nazev || "Termín"));
    } catch (e) {
      oznam(e?.message || "Smazání se nepovedlo.", true);
      return;
    }
    this.vybranyTermin = null;
    this.boc = "den";
    this._oknoBoku?.zavri();
    this.obnov();
    oznam(`Termín „${p.pol.nazev || ""}“ smazán`, false, smazany ? { text: "Vrátit", fn: () => {
      upravZdroj(this.tym, this.osobni, p.zdroj, (s) => {
        if (s.some((x) => x.id === smazany.id)) return false;
        zaznamTerminu(smazany, "Obnoven po smazání", this.tym.ja.jmeno);
        s.splice(Math.min(index, s.length), 0, smazany);
      }, this._historieUpravy(p, `Obnoven termín: ${smazany.nazev || ""}`)).catch((e) => oznam(e?.message || "Nepovedlo se.", true));
    } } : null);
  }

  // Okénko Nový termín (harmonogram.RychlyTermin + výběr, kam patří)
  novyTermin(z, k, kamPredvolene = "") {
    const tym = this.tym;
    const nazev = h("input", { maxlength: 200, placeholder: "např. Kontrolní den" });
    const od = h("input", { type: "date", value: iso(z) });
    const doo = h("input", { type: "date", value: iso(k) });
    const druh = vyberDruhu(tym, BARVY_TERMINU[BARVY_TERMINU.length - 1]);
    const upresneni = h("input", { maxlength: 100, placeholder: "např. Jeřáby na stavbě" });
    const poleUpr = pole("Upřesnění (nepovinné)", upresneni);
    const dov = new Dovolene(tym.hodnota("dovolene"), tym.nastaveni);
    const hodin = h("input", { type: "number", min: 0.5, max: dov.den, step: 0.5, value: dov.den });
    const poleHodin = pole("Hodin denně", hodin, `Celý den = ${cislo(dov.den)} h, půlden = ${cislo(dov.den / 2)} h`);
    const poznamka = h("textarea", { rows: 2, maxlength: 5000 });
    const vychozi = kamPredvolene || this.projektId || this._posledniKam || this.posledniProjekt() || BEZ_PROJEKTU;
    const kam = h("select", {}, (this.projektId ? [[this.projektId, nazevProjektu(tym.projekt(this.projektId))]] : moznostiKam(tym))
      .map(([v, t]) => h("option", { value: v, text: t, selected: v === vychozi })));
    const jeDovolena = () => kam.value.startsWith(DOVOLENE);
    const poleDruhu = pole("Druh", druh.el), poleNazvu = pole("Název", nazev);
    const ukaz = () => {
      poleDruhu.hidden = jeDovolena();
      poleUpr.hidden = jeDovolena() || druh.hodnota() !== BARVA_REALIZACE;
      poleHodin.hidden = !jeDovolena();
      poleNazvu.hidden = jeDovolena();
    };
    druh.priZmene = ukaz;
    kam.addEventListener("change", ukaz);
    ukaz();
    okno(jeDovolena() ? "Dovolená" : kam.value === SOUKROME ? "Soukromý termín" : "Nový termín", [
      this.projektId ? null : pole("Kam patří", kam), poleNazvu,
      h("div", { class: "dve-pole" }, pole("Od", od), pole("Do", doo)), poleDruhu, poleUpr, poleHodin, pole("Poznámka", poznamka),
    ], [
      { text: "Zrušit" },
      { text: "Přidat", hlavni: true, akce: async () => {
        const zd = zIso(od.value), kd = zIso(doo.value) || zd;
        if (!zd) throw new Error("Vyber datum.");
        const cil = kam.value;
        const kdo = cil.startsWith(DOVOLENE) ? cil.split(":")[1] || "" : null;
        if (kdo !== null && kdo !== tym.ja.id && !tym.jeSpravce) throw new Error("Dovolenou kolegům zadává správce.");
        const upr = kdo === null && druh.hodnota() === BARVA_REALIZACE ? upresneni.value.trim() : "";
        const jmeno = kdo !== null ? "Dovolená" : nazev.value.trim() || upr;
        if (!jmeno) throw new Error("Doplň název termínu.");
        const udaje = { nazev: jmeno, poznamka: poznamka.value.trim(), barva: kdo !== null ? C_DOVOLENA : druh.hodnota(), stav: "Plánováno" };
        if (upr) udaje.upresneni = upr;
        if (kdo !== null) {
          if (kdo) udaje.uzivatel = kdo;
          const h2 = Number(hodin.value);
          if (h2 > 0 && h2 < dov.den) udaje.hodin = h2;
        }
        nastavRozsah(udaje, zd, kd);
        const pol = novyTermin(udaje, tym.ja.jmeno);
        const zdroj = kdo !== null ? DOVOLENE : cil;
        if (kdo !== null) hlidejPrekryvDovolene(tym.hodnota("dovolene"), kdo, ...rozsah(pol));
        await upravZdroj(tym, this.osobni, zdroj, (s) => {
          if (kdo !== null) hlidejPrekryvDovolene(s, kdo, ...rozsah(pol));
          s.push(pol);
        },
          DRUHY_ZDROJU[zdroj] ? "" : `${this.projektId ? "Přidán termín" : "Přidán termín (v kalendáři)"}: ${jmeno} (${popisRozsahu(...rozsah(pol))})`);
        if (!this.projektId && !kdo && cil !== SOUKROME) this._posledniKam = cil;
        this._zajistiViditelnost(zdroj, udaje.barva);
        this.vybranyTermin = pol.id;
        this.boc = "termin";
        this.obnov();
        oznam(zdroj === DOVOLENE ? "Dovolená přidána" : zdroj === SOUKROME ? "Soukromý termín přidán"
          : zdroj === BEZ_PROJEKTU || this.projektId ? "Termín přidán" : `Termín přidán do projektu ${popisKam(tym, zdroj)}`);
      } },
    ]);
    (jeDovolena() ? od : nazev).focus();
  }

  // nový termín musí být vidět (kalendar._zajisti_viditelnost)
  _zajistiViditelnost(zdroj, barva) {
    if (this.projektId) return;
    const n = this.osobni.kalendar();
    const zmena = {};
    if (n.skryte_ostatni.includes(zdroj)) zmena.skryte_ostatni = n.skryte_ostatni.filter((x) => x !== zdroj);
    if (n.skryte_barvy.includes(barva)) zmena.skryte_barvy = n.skryte_barvy.filter((x) => x !== barva);
    if (!DRUHY_ZDROJU[zdroj]) {
      const p = this.tym.projekt(zdroj);
      if (n.projekty === "vybrane" && !n.vybrane_projekty.includes(zdroj)) zmena.vybrane_projekty = [...n.vybrane_projekty, zdroj];
      else if (n.projekty === "vse" && p && NEAKTIVNI.has(p.status) && !n.vcetne_neaktivnich) zmena.vcetne_neaktivnich = true;
    }
    if (Object.keys(zmena).length) this.osobni.upravKalendar(zmena);
  }

  _jenTento(kdo) {
    const n = this.osobni.kalendar();
    const predtim = { ...n };
    if (DRUHY_ZDROJU[kdo]) {
      this.osobni.upravKalendar({ projekty: "vybrane", vybrane_projekty: [], skryte_ostatni: Object.keys(OSTATNI_V_KALENDARI).filter((x) => x !== kdo) });
    } else {
      this.osobni.upravKalendar({ projekty: "vybrane", vybrane_projekty: [kdo], skryte_ostatni: Object.keys(OSTATNI_V_KALENDARI) });
    }
    this.obnov();
    oznam("Kalendář ukazuje jen vybrané", false, { text: "Vrátit", fn: () => { this.osobni.upravKalendar(predtim); this.obnov(); } });
  }

  _skryj(kdo) {
    const n = this.osobni.kalendar();
    const predtim = { ...n };
    if (DRUHY_ZDROJU[kdo]) {
      this.osobni.upravKalendar({ skryte_ostatni: [...new Set([...n.skryte_ostatni, kdo])] });
    } else {
      const vybrane = n.projekty === "vybrane" ? n.vybrane_projekty : viditelneProjekty(this.tym, n).map((p) => p.id);
      this.osobni.upravKalendar({ projekty: "vybrane", vybrane_projekty: vybrane.filter((x) => x !== kdo) });
    }
    this.obnov();
    oznam("Skryto z kalendáře", false, { text: "Vrátit", fn: () => { this.osobni.upravKalendar(predtim); this.obnov(); } });
  }

  // --- filtr (kalendar.PopupFiltru) ---

  _filtr() {
    const obsah = h("div", { class: "filtr" });
    const prekresli = () => {
      const n = this.osobni.kalendar();
      const zmen = (zmena) => { this.osobni.upravKalendar(zmena); this.obnov(); prekresli(); };
      const projekty = [...this.tym.projekty].sort((a, b) => kolator.compare(nazevProjektu(a), nazevProjektu(b)));
      const vybrane = new Set(n.vybrane_projekty);
      vymen(obsah,
        h("h3", { text: "Projekty" }),
        segmentKal([["vse", "Všechny"], ["vybrane", "Jen vybrané"]], n.projekty, (v) => {
          const zmena = { projekty: v };
          if (v === "vybrane" && !n.vybrane_projekty.length && this.posledniProjekt()) zmena.vybrane_projekty = [this.posledniProjekt()];
          zmen(zmena);
        }),
        n.projekty === "vse"
          ? prepinac("I realizované a mrtvé", n.vcetne_neaktivnich, (v) => zmen({ vcetne_neaktivnich: v }))
          : h("div", { class: "filtr-projekty" }, projekty.map((p) => prepinac(
            `${nazevProjektu(p)}${NEAKTIVNI.has(p.status) ? ` (${p.status})` : ""}`, vybrane.has(p.id),
            (v) => zmen({ vybrane_projekty: v ? [...vybrane, p.id] : [...vybrane].filter((x) => x !== p.id) }), true))),
        h("h3", { text: "Další v kalendáři" }),
        Object.entries(OSTATNI_V_KALENDARI).map(([k, t]) => prepinac(t, !n.skryte_ostatni.includes(k),
          (v) => zmen({ skryte_ostatni: v ? n.skryte_ostatni.filter((x) => x !== k) : [...n.skryte_ostatni, k] }))),
        h("h3", { text: "Druhy termínů" }),
        h("div", { class: "filtr-druhy" }, BARVY_TERMINU.map((b) => {
          const skryty = n.skryte_barvy.includes(b);
          return h("button", { type: "button", class: `stitek-druhu${skryty ? " skryty" : ""}`, "aria-pressed": String(!skryty),
            title: "Klik = skrýt / ukázat, pravé tlačítko = jen tento",
            onclick: () => zmen({ skryte_barvy: skryty ? n.skryte_barvy.filter((x) => x !== b) : [...n.skryte_barvy, b] }),
            oncontextmenu: (ev) => { ev.preventDefault(); zmen({ skryte_barvy: BARVY_TERMINU.filter((x) => x !== b) }); } },
          h("i", { class: "tecka", style: { background: b } }), this.tym.vyznamBarvy(b));
        })),
        prepinac("Skrýt odškrtnuté jako hotové", n.skryt_hotove, (v) => zmen({ skryt_hotove: v })),
        h("p", { class: "tiche male", text: "Proběhlé termíny se neskrývají – jen ty odškrtnuté jako hotové." }),
        filtrJeAktivni(n) ? h("button", { type: "button", class: "tlacitko male", text: "Ukázat vše",
          onclick: () => zmen({ projekty: "vse", skryte_ostatni: [], skryte_barvy: [], skryt_hotove: false }) }) : null);
      this._pop?.umisti();
    };
    prekresli();
    this._pop = popup(this.bFiltr, obsah);
  }

  // --- historie termínů (PopupHistorieTerminu) ---

  _historie() {
    const n = this.osobni.kalendar();
    const zaznamy = [];
    for (const p of viditelneProjekty(this.tym, n)) {
      for (const t of Array.isArray(p.harmonogram) ? p.harmonogram : []) {
        let zmeny = Array.isArray(t.zmeny) ? t.zmeny : [];
        if (!zmeny.length && t.vytvoreno) zmeny = [{ cas: t.vytvoreno, kdo: t.vytvoril, text: "Vytvořen" }];
        for (const z of zmeny) zaznamy.push({ ...z, termin: t.nazev || "Termín", projekt: nazevProjektu(p), id: t.id });
      }
      for (const z of Array.isArray(p.historie) ? p.historie : []) {
        if (z?.termin) zaznamy.push({ ...z, termin: z.termin, projekt: nazevProjektu(p) });
      }
    }
    zaznamy.sort((a, b) => String(b.cas || "").localeCompare(String(a.cas || "")));
    const hledat = h("input", { type: "search", placeholder: "Hledat…" });
    const seznam = h("div", { class: "seznam historie-seznam" });
    const okenko = okno("Historie termínů", [hledat, seznam], [{ text: "Zavřít" }]);
    const vypis = () => {
      const slova = hledat.value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").split(/\s+/).filter(Boolean);
      const vyber = zaznamy.filter((z) => {
        const t = [z.text, z.termin, z.projekt, z.kdo].join(" ").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
        return slova.every((s) => t.includes(s));
      }).slice(0, 300);
      vymen(seznam, vyber.map((z) => h("button", { type: "button", class: "radek", disabled: !z.id || !this._mapa.has(z.id),
        onclick: () => { okenko.zavri(); this.vyberTermin(z.id); this.jdiNa(this._mapa.get(z.id).rz[0]); } },
      h("div", { class: "radek-text" }, h("strong", { text: `${z.projekt} · ${z.termin}` }), h("span", { text: z.text }),
        h("small", { class: "tiche", text: [casText(z.cas), z.kdo].filter(Boolean).join(" · ") })))),
      !vyber.length ? h("p", { class: "tiche", text: "Nic nenalezeno." }) : null);
    };
    hledat.addEventListener("input", vypis);
    vypis();
  }

  export(obdobi = null) {
    this.naExport({ obdobi, kalendar: this });
  }
}

// --- drobné prvky ------------------------------------------------------------------------------

export function casText(cas) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?/.exec(String(cas || ""));
  if (!m) return String(cas || "");
  return `${+m[3]}. ${+m[2]}. ${m[1]}${m[4] ? " " + m[4] : ""}`;
}

// Výběr druhu termínu: tečka + název ve dvou sloupcích (vzhled.VyberBarvy)
export function vyberDruhu(tym, vybrana) {
  let hodnota = BARVY_TERMINU.includes(vybrana) ? vybrana : BARVY_TERMINU[BARVY_TERMINU.length - 1];
  const vysledek = { hodnota: () => hodnota, priZmene: () => {} };
  const el = h("div", { class: "vyber-druhu", role: "radiogroup" });
  const prekresli = () => vymen(el, BARVY_TERMINU.map((b) => h("button", { type: "button", role: "radio", "aria-checked": String(b === hodnota),
    class: b === hodnota ? "vybrany" : "", style: { "--b": b }, onclick: () => { hodnota = b; prekresli(); vysledek.priZmene(); } },
  h("i", { class: "tecka", style: { background: b } }), tym.vyznamBarvy(b))));
  prekresli();
  vysledek.el = el;
  return vysledek;
}

function prepinac(text, hodnota, zmena, maly = false) {
  const box = h("input", { type: "checkbox", checked: hodnota, onchange: () => zmena(box.checked) });
  return h("label", { class: `zaskrtavatko${maly ? " male" : ""}` }, box, h("span", { text }));
}

function segmentKal(volby, vybrana, zmena) {
  return h("div", { class: "segment" }, volby.map(([v, t]) => h("button", { type: "button", text: t, "aria-pressed": String(v === vybrana),
    onclick: () => { if (v !== vybrana) zmena(v); } })));
}

