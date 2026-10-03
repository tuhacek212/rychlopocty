// Kalendář jako v programu (kalendar.py + mrizka.py): plynulé měsíce s pruhy přes dny, zoom,
// filtr (stejné osobní nastavení jako v programu), historie termínů, export, přehled dne a detail
// termínu, úpravy, přetahování (posun i délka), výběr dnů tažením, nabídky na pravé tlačítko.
// Stejná komponenta je i harmonogramem projektu (projektId).

import {
  BARVA_REALIZACE, BARVY_TERMINU, BEZ_PROJEKTU, C_DOVOLENA, C_POZNAMKA, DNY, DOVOLENE, MESICE, NEAKTIVNI,
  OSTATNI_V_KALENDARI, POZNAMKY, SOUKROME, Dovolene, barvaTerminu, cislo, datumKratce, dnes, hodinDovoleneDenne,
  hodinyText, iso, jeHotovo, najdiDatumy, nastavRozsah, nazevProjektu, novyTermin, popisRozsahu,
  pridejDny, rozsah, svatkyDne, upravZdroj, zIso, zaznamTerminu,
} from "./data.js";
import { h, ikona, menu, okno, oznam, pole, popup, vymen, zavriPopup } from "./ui.js";

const DRUHY_ZDROJU = { [SOUKROME]: "soukrome", [DOVOLENE]: "dovolene", [BEZ_PROJEKTU]: "bez" };
const kolator = new Intl.Collator("cs");
const velke = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// rozměry podle přiblížení (0 … 4, plynule – jako KalendarHarmonogramu._parametry_zoomu)
const UROVNE = [
  { mesic: 210, pruh: 13, pismo: 10, cislo: 16, drah: 2, minDrah: 1 },
  { mesic: 280, pruh: 15, pismo: 11, cislo: 18, drah: 3, minDrah: 1 },
  { mesic: 360, pruh: 17, pismo: 11.5, cislo: 20, drah: 4, minDrah: 2 },
  { mesic: 500, pruh: 19, pismo: 12, cislo: 22, drah: 6, minDrah: 2 },
  { mesic: 820, pruh: 22, pismo: 13, cislo: 24, drah: 9, minDrah: 3 },
];

function parametry(zoom) {
  const z = Math.max(0, Math.min(4, zoom));
  const a = UROVNE[Math.floor(z)], b = UROVNE[Math.min(4, Math.floor(z) + 1)], t = z - Math.floor(z);
  const mix = (k) => a[k] + (b[k] - a[k]) * t;
  return { mesic: mix("mesic"), pruh: Math.round(mix("pruh")), pismo: mix("pismo"), cislo: Math.round(mix("cislo")),
    drah: Math.round(mix("drah")), minDrah: Math.round(mix("minDrah")) };
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
  constructor({ tym, osobni, projektId = null, naProjekt = () => {}, naExport = () => {}, posledniProjekt = () => "" }) {
    this.tym = tym;
    this.osobni = osobni;
    this.projektId = projektId;
    this.naProjekt = naProjekt;
    this.naExport = naExport;
    this.posledniProjekt = posledniProjekt;
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
    this._prekresli(true);
  }

  _vytvor() {
    this.souhrn = h("span", { class: "tiche kal-souhrn" });
    this.posuvnik = h("input", { type: "range", min: 0, max: 4, step: 0.05, value: String(this.zoom), class: "kal-zoom",
      "aria-label": "Přiblížení", title: "Přiblížení (Ctrl + kolečko)", oninput: () => this.nastavZoom(Number(this.posuvnik.value)) });
    this.bFiltr = h("button", { type: "button", class: "ikonove kal-filtr", title: "Filtr", "aria-label": "Filtr",
      onclick: () => this._filtr() }, ikona("filtr"), h("span", { class: "pocet" }));
    const nadpis = this.projektId ? null : h("button", { type: "button", class: "kal-nadpis", title: "Přejít na dnešek",
      onclick: () => this.jdiNaDnes() }, h("h1", { text: "Kalendář" }));
    this.lista = h("div", { class: "kal-lista" }, nadpis, this.souhrn, h("div", { class: "mezera" }),
      h("button", { type: "button", class: "tlacitko male", text: "Dnes", onclick: () => this.jdiNaDnes() }),
      h("label", { class: "kal-zoom-obal", title: "Přiblížení" }, ikona("lupa_plus"), this.posuvnik),
      this.projektId ? null : this.bFiltr,
      this.projektId ? null : h("button", { type: "button", class: "ikonove", title: "Historie termínů", "aria-label": "Historie termínů",
        onclick: () => this._historie() }, ikona("historie")),
      h("button", { type: "button", class: "ikonove", title: "Export", "aria-label": "Export", onclick: () => this.export() }, ikona("export")));
    this.mesice = h("div", { class: "kal-mesice" });
    this.obal = h("div", { class: "kal-obal" }, this.mesice);
    this.bok = h("aside", { class: "kal-bok" });
    this.el = h("div", { class: `kal${this.projektId ? " harmonogram" : ""}` }, this.lista, h("div", { class: "kal-telo" }, this.obal, this.bok));

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
    this._mapa = new Map(this.polozky.map((p) => [p.id, p]));
    const terminu = this.polozky.filter((p) => !p.pevny).length;
    const zPoznamek = this.polozky.length - terminu;
    const nast = this.osobni.kalendar();
    const aktivni = this.projektId ? 0 : filtrJeAktivni(nast);
    let text = `${terminu} ${terminu === 1 ? "termín" : terminu >= 2 && terminu <= 4 ? "termíny" : "termínů"}`;
    if (zPoznamek) text += ` · ${zPoznamek} ${zPoznamek === 1 ? "datum" : zPoznamek <= 4 ? "data" : "dat"} z poznámek`;
    if (aktivni) text += " · filtrováno";
    this.souhrn.textContent = text;
    this.bFiltr.classList.toggle("aktivni", !!aktivni);
    this.bFiltr.querySelector(".pocet").textContent = aktivni ? String(aktivni) : "";
    if (document.activeElement !== this.posuvnik) this.posuvnik.value = String(this.zoom);
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
    const den = this.boc === "den" ? iso(this.den) : "";
    for (const el of this.mesice.querySelectorAll(".kal-den[data-d]")) el.classList.toggle("vybrany", el.dataset.d === den);
    for (const el of this.mesice.querySelectorAll(".kal-pruh")) el.classList.toggle("vybrany", el.dataset.id === this.vybranyTermin);
  }

  // --- vykreslení měsíců ---

  _kotva() {
    const vrch = this.obal.scrollTop;
    for (const m of this.mesice.children) {
      if (m.offsetTop + m.offsetHeight > vrch) return [m.dataset.m, m.offsetTop - vrch];
    }
    return null;
  }

  _prekresli(drzKotvu = false) {
    const kotva = drzKotvu ? this._kotva() : null;
    const par = parametry(this.zoom);
    const vz = this.osobni.vzhled();
    this.staty = vz.svatky_sk ? ["cz", "sk"] : ["cz"];
    const sirka = this.obal.clientWidth || 900;
    const sloupcu = Math.max(1, Math.floor(sirka / par.mesic));
    this.mesice.style.gridTemplateColumns = `repeat(${sloupcu}, minmax(0, 1fr))`;
    this.mesice.style.setProperty("--pruh", `${par.pruh}px`);
    this.mesice.style.setProperty("--pismo", `${par.pismo}px`);
    this.mesice.style.setProperty("--cislo", `${par.cislo}px`);
    this.mesice.className = `kal-mesice pruhy-${vz.pruhy}${vz.vikendy ? "" : " bez-vikendu"}${vz.tydny ? " s-tydny" : ""}`;
    const dnesek = dnes();
    const prvniDen = this.zacatek, posledni = pridejDny(this.konec, -1);
    const vRozsahu = this.polozky.filter((p) => p.rz[1] >= prvniDen && p.rz[0] <= posledni);
    const mesice = [];
    for (let m = new Date(this.zacatek); m < this.konec; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      mesice.push(this._mesic(m, vRozsahu, par, vz, dnesek));
    }
    vymen(this.mesice, mesice);
    if (kotva) {
      const el = [...this.mesice.children].find((m) => m.dataset.m === kotva[0]);
      if (el) this.obal.scrollTop = el.offsetTop - kotva[1];
    }
  }

  _mesic(m, polozky, par, vz, dnesek) {
    const rok = m.getFullYear(), mesic = m.getMonth();
    const posledni = new Date(rok, mesic + 1, 0);
    const vMesici = polozky.filter((p) => p.rz[1] >= m && p.rz[0] <= posledni);
    const tydny = [];
    for (let pondeli = pridejDny(m, -((m.getDay() + 6) % 7)); pondeli <= posledni; pondeli = pridejDny(pondeli, 7)) {
      tydny.push(this._tyden(pondeli, m, posledni, vMesici, par, vz, dnesek));
    }
    return h("section", { class: "kal-mesic", dataset: { m: iso(m).slice(0, 7) } },
      h("div", { class: "kal-mesic-nadpis" }, h("strong", { text: `${velke(MESICE[mesic])} ${rok}` })),
      h("div", { class: "kal-hlavicka" }, vz.tydny ? h("span", { class: "kal-tc" }) : null,
        DNY.map((d, i) => h("span", { class: i >= 5 ? "vikend" : "", text: d }))),
      tydny);
  }

  _tyden(pondeli, prvni, posledni, polozky, par, vz, dnesek) {
    const dny = [];
    for (let i = 0; i < 7; i++) dny.push(pridejDny(pondeli, i));
    const nedele = dny[6];
    const od = pondeli < prvni ? prvni : pondeli, doo = nedele > posledni ? posledni : nedele;
    // úseky pruhů v týdnu (jen dny tohoto měsíce), dráhy od nejdřívějších a nejdelších
    const useky = polozky.filter((p) => p.rz[1] >= od && p.rz[0] <= doo).map((p) => {
      const z = p.rz[0] < od ? od : p.rz[0], k = p.rz[1] > doo ? doo : p.rz[1];
      return { p, sloupec: pocetDni(pondeli, z), delka: pocetDni(z, k) + 1, zacatek: iso(z) === iso(p.rz[0]), konec: iso(k) === iso(p.rz[1]) };
    }).sort((a, b) => a.sloupec - b.sloupec || b.delka - a.delka || kolator.compare(a.p.text, b.p.text));
    const drahy = [];
    for (const u of useky) {
      let d = drahy.findIndex((konec) => konec < u.sloupec);
      if (d < 0) { d = drahy.length; drahy.push(-1); }
      drahy[d] = u.sloupec + u.delka - 1;
      u.draha = d;
    }
    const videt = Math.min(par.drah, drahy.length);
    const skryte = new Array(7).fill(0);
    for (const u of useky) if (u.draha >= videt) for (let i = u.sloupec; i < u.sloupec + u.delka; i++) skryte[i]++;
    const drah = Math.max(par.minDrah, videt);
    const vyska = par.cislo + drah * (par.pruh + 2) + (skryte.some(Boolean) ? 14 : 4);
    const oznacene = this.oznacene;
    const bunky = dny.map((d, i) => {
      const v = d >= prvni && d <= posledni;
      if (!v) return h("div", { class: "kal-den mimo" });
      const di = iso(d);
      const svatky = vz.svatky ? svatkyDne(d, this.staty) : [];
      const tridy = ["kal-den", i >= 5 ? "vikend" : "", svatky.length ? "svatek" : "", di === dnesek ? "dnes" : "",
        di < dnesek ? "minuly" : "", di === iso(this.den) && this.boc === "den" ? "vybrany" : "",
        oznacene && d >= oznacene[0] && d <= oznacene[1] ? "oznaceny" : ""].filter(Boolean).join(" ");
      return h("div", { class: tridy, dataset: { d: di },
        title: svatky.map(([s, n]) => `${n}${s === "sk" ? " (SK)" : ""}`).join(" · ") || null },
      h("span", { class: "kal-cislo", text: d.getDate() }),
      svatky.length && par.mesic >= 360 ? h("span", { class: "kal-svatek", text: svatky[0][1] }) : null,
      skryte[i] ? h("button", { type: "button", class: "kal-vic", dataset: { d: di }, text: `+${skryte[i]}` }) : null);
    });
    const pruhy = useky.filter((u) => u.draha < videt).map((u) => {
      const p = u.p;
      const tridy = ["kal-pruh", u.zacatek ? "zacatek" : "", u.konec ? "konec" : "", jeHotovo(p.pol) ? "hotovo" : "",
        vz.probehle && iso(p.rz[1]) < dnesek ? "probehly" : "", p.id === this.vybranyTermin ? "vybrany" : "",
        p.pevny ? "pevny" : "", p.cizi ? "cizi" : "", p.druh === "poznamka" ? "poznamka" : ""].filter(Boolean).join(" ");
      return h("div", { class: tridy, dataset: { id: p.id }, title: this._tip(p),
        style: { left: `${(u.sloupec / 7) * 100}%`, width: `${(u.delka / 7) * 100}%`, top: `${par.cislo + u.draha * (par.pruh + 2)}px`, "--b": p.barva } },
      h("span", { text: p.text }));
    });
    return h("div", { class: "kal-tyden", style: { height: `${vyska}px` } },
      vz.tydny ? h("span", { class: "kal-tc", text: tydenRoku(pondeli) }) : null,
      h("div", { class: "kal-dny" }, bunky, h("div", { class: "kal-pruhy" }, pruhy)));
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
    this._dotyk = ev.pointerType === "touch";
    if (ev.button !== 0 || ev.target.closest(".kal-vic")) return;
    const pruh = ev.target.closest(".kal-pruh");
    const dotyk = this._dotyk = ev.pointerType === "touch";
    const start = this._denPodBodem(ev.clientX, ev.clientY);
    if (!start) return;
    this._potlacKlik = false;
    let rezim = null, polozka = null;
    if (pruh) {
      polozka = this._mapa.get(pruh.dataset.id);
      if (!polozka || polozka.pevny || polozka.cizi || dotyk) return;
      const r = pruh.getBoundingClientRect();
      rezim = pruh.classList.contains("konec") && ev.clientX > r.right - 7 ? "konec"
        : pruh.classList.contains("zacatek") && ev.clientX < r.left + 7 ? "zacatek" : "presun";
    } else if (dotyk) {
      return; // na dotyk se roluje; klepnutí vybere den (click)
    }
    const x0 = ev.clientX, y0 = ev.clientY;
    let tazeno = false, cil = start;
    const pohyb = (e) => {
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
      document.removeEventListener("pointermove", pohyb);
      document.removeEventListener("pointerup", nahoru);
      document.removeEventListener("pointercancel", nahoru);
      document.body.classList.remove("taznuti");
      const oznacene = this.oznacene;
      if (polozka) {
        this.oznacene = null;
        this._zvyrazni();
        if (tazeno) {
          this._potlacKlik = true;
          setTimeout(() => { this._potlacKlik = false; }, 0);
          if (oznacene && (iso(oznacene[0]) !== iso(polozka.rz[0]) || iso(oznacene[1]) !== iso(polozka.rz[1]))) {
            this._posun(polozka, oznacene[0], oznacene[1], rezim === "presun" ? "presun" : "delka");
          }
        }
        return;
      }
      if (!tazeno || !oznacene || iso(oznacene[0]) === iso(oznacene[1])) {
        this.oznacene = null;
        if (e.type === "pointerup") this.vyberDen(start);
        return;
      }
      this._menuVyberu(e.clientX, e.clientY, oznacene[0], oznacene[1]);
    };
    document.addEventListener("pointermove", pohyb);
    document.addEventListener("pointerup", nahoru);
    document.addEventListener("pointercancel", nahoru);
    if (polozka) document.body.classList.add("taznuti");
    ev.preventDefault();
  }

  _zvyrazni() {
    const o = this.oznacene;
    for (const el of this.mesice.querySelectorAll(".kal-den[data-d]")) {
      const d = el.dataset.d;
      el.classList.toggle("oznaceny", !!o && d >= iso(o[0]) && d <= iso(o[1]));
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
    if (pruh) { this._menuTerminu(ev.clientX, ev.clientY, this._mapa.get(pruh.dataset.id)); return; }
    const d = zIso(den.dataset.d);
    const m = new Date(d.getFullYear(), d.getMonth(), 1);
    menu(ev.clientX, ev.clientY, [
      { nadpis: `${DNY[(d.getDay() + 6) % 7]} ${datumKratce(d, true)}` },
      { text: this.projektId ? "Nový termín…" : "Nový termín…", ikona: "plus", akce: () => this.novyTermin(d, d) },
      this.projektId ? null : { text: "Soukromý termín…", ikona: "zamek", akce: () => this.novyTermin(d, d, SOUKROME) },
      this.projektId ? null : { text: "Dovolená…", ikona: "dovolena", akce: () => this.novyTermin(d, d, `${DOVOLENE}:${this.tym.ja.id}`) },
      "-",
      { text: "Přejít na dnešek", akce: () => this.jdiNaDnes() },
      { text: `Exportovat ${MESICE[d.getMonth()]}…`, ikona: "export", akce: () => this.export([m, new Date(d.getFullYear(), d.getMonth() + 1, 0)]) },
      this.projektId ? null : { text: `Dovolené ${d.getFullYear()} – kolik kdo má…`, akce: () => { window.location.hash = `#/dovolena/${d.getFullYear()}`; } },
    ]);
  }

  _menuTerminu(x, y, p) {
    if (!p) return;
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

  // --- boční panel: přehled dne / detail / úpravy ---

  _panel(nadpis, ...obsah) {
    const vObsahu = h("div", { class: "kal-bok-obsah" }, obsah);
    if (window.matchMedia("(max-width: 900px)").matches) {
      if (this._oknoBoku) this._oknoBoku.zavri();
      this._oknoBoku = okno(nadpis, vObsahu, []);
      this._oknoBoku.dialog.addEventListener("close", () => { this._oknoBoku = null; });
      return;
    }
    vymen(this.bok, h("h2", { class: "kal-bok-nadpis", text: nadpis }), vObsahu);
  }

  vyberDen(d) {
    this.den = d;
    this.boc = "den";
    this.vybranyTermin = null;
    this._oznacVyber();
    this._ukazDen(true);
  }

  _ukazDen(uzivatel = false) {
    if (!uzivatel && window.matchMedia("(max-width: 900px)").matches) return;
    const d = this.den;
    const dne = this.polozky.filter((p) => p.rz[0] <= d && p.rz[1] >= d).sort((a, b) => kolator.compare(a.text, b.text));
    const svatky = svatkyDne(d, this.staty || ["cz"]);
    this._panel(`${velke(DNY[(d.getDay() + 6) % 7])} ${datumKratce(d, true)}`,
      svatky.map(([s, n]) => h("p", { class: "svatek-text", text: `${n}${s === "sk" ? " (SK)" : ""}` })),
      dne.map((p) => h("button", { type: "button", class: `radek termin${jeHotovo(p.pol) ? " hotovo" : ""}`, onclick: () => this.vyberTermin(p.id) },
        h("i", { class: "tecka", style: { background: p.barva } }),
        h("div", { class: "radek-text" }, h("strong", { text: p.druh === "dovolene" ? p.text : p.nazev }),
          h("small", { class: "tiche", text: [popisRozsahu(...p.rz), p.projekt && !this.projektId ? nazevProjektu(p.projekt) : popisKam(this.tym, kamPatri(p))].filter(Boolean).join(" · ") })))),
      !dne.length && !svatky.length ? h("p", { class: "tiche", text: "Nic naplánováno." }) : null,
      h("div", { class: "kal-bok-akce" },
        h("button", { type: "button", class: "tlacitko male", onclick: () => this.novyTermin(d, d) }, ikona("plus"), "Termín")));
  }

  vyberTermin(id) {
    const p = this._mapa.get(id);
    if (!p) return;
    this.vybranyTermin = id;
    this.boc = "termin";
    this._oznacVyber();
    this._ukazTermin(p);
  }

  _ukazTermin(p) {
    const pol = p.pol;
    const radky = [];
    const pridej = (nazev, hodnota) => { if (hodnota) radky.push(h("dt", { text: nazev }), h("dd", {}, hodnota)); };
    if (p.projekt) pridej("Projekt", this.projektId ? nazevProjektu(p.projekt)
      : h("a", { href: `#/projekt/${encodeURIComponent(p.projekt.id)}`, text: nazevProjektu(p.projekt) }));
    else pridej("Kam patří", popisKam(this.tym, kamPatri(p)));
    pridej("Kdy", `${popisRozsahu(...p.rz)}${p.rz[1] > p.rz[0] ? ` (${pocetDni(...p.rz) + 1} dní)` : ""}`);
    if (p.druh === "dovolene") {
      const dov = new Dovolene(this.tym.hodnota("dovolene"), this.tym.nastaveni);
      pridej("Kdo", this.tym.jmeno(pol.uzivatel, "nevím kdo"));
      pridej("Bere", hodinyText(dov.hodinPolozky(pol), dov.den) + (hodinDovoleneDenne(pol, dov.den) < dov.den ? ` · ${cislo(pol.hodin)} h denně` : ""));
    } else if (p.druh !== "poznamka") {
      pridej("Druh", h("span", {}, h("i", { class: "tecka", style: { background: p.barva } }), this.tym.nazevDruhu(pol)));
      pridej("Stav", jeHotovo(pol) ? "Hotovo" : "Plánováno");
    }
    if (pol.poznamka) radky.push(h("dt", { text: p.druh === "poznamka" ? "Poznámka" : "Poznámka" }), h("dd", { class: "text-poznamky", text: pol.poznamka }));
    if (pol.vytvoril) pridej("Vytvořil", `${pol.vytvoril}${pol.vytvoreno ? `, ${casText(pol.vytvoreno)}` : ""}`);
    const zmeny = (Array.isArray(pol.zmeny) ? pol.zmeny : []).slice(-10).reverse();
    const tlacitka = [];
    if (p.druh === "poznamka") {
      tlacitka.push(h("button", { type: "button", class: "tlacitko male", onclick: () => this.naProjekt(p.projekt.id) }, ikona("otevrit"), "Otevřít projekt"));
    } else if (!p.cizi) {
      tlacitka.push(h("button", { type: "button", class: "tlacitko male hlavni", onclick: () => this._uprava(p) }, ikona("upravit"), "Upravit"),
        h("button", { type: "button", class: "tlacitko male", onclick: () => this._prepniHotovo(p) }, ikona("hotovo"), jeHotovo(pol) ? "Znovu otevřít" : "Hotovo"),
        h("button", { type: "button", class: "ikonove", title: "Smazat", "aria-label": "Smazat", onclick: () => this._smaz(p) }, ikona("smazat")));
    }
    this._panel(p.druh === "dovolene" ? `Dovolená – ${this.tym.jmeno(pol.uzivatel, "")}` : p.nazev,
      h("dl", { class: "udaje" }, radky),
      tlacitka.length ? h("div", { class: "kal-bok-akce" }, tlacitka) : null,
      zmeny.length ? h("details", { class: "historie-terminu" }, h("summary", { text: "Historie termínu" }),
        zmeny.map((z) => h("div", { class: "radek-historie" }, h("small", { class: "tiche", text: [casText(z.cas), z.kdo].filter(Boolean).join(" · ") }), h("span", { text: z.text })))) : null,
      h("button", { type: "button", class: "odkaz", text: "← Přehled dne", onclick: () => this.vyberDen(this.den) }));
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
    if (popis) {
      await upravZdroj(tym, this.osobni, p.zdroj, (seznam) => {
        const pol = seznam.find((x) => x.id === p.id);
        if (!pol) throw new Error("Termín už mezitím někdo smazal.");
        if (p.druh === "dovolene" && !tym.jeSpravce && (pol.uzivatel || "") !== tym.ja.id) throw new Error("Cizí dovolenou měnit nemůžeš.");
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
    await upravZdroj(tym, this.osobni, cil, (s) => { if (!s.some((x) => x.id === pol.id)) s.push(pol); },
      DRUHY_ZDROJU[cil] ? "" : `Přidán termín (z ${odkud}): ${pol.nazev || ""}`);
    await upravZdroj(tym, this.osobni, p.zdroj, (s) => {
      const i = s.findIndex((x) => x.id === p.id);
      if (i < 0) return false;
      s.splice(i, 1);
    }, p.druh === "projekt" ? `Termín přesunut do ${popisKam(tym, cil)}: ${pol.nazev || ""}` : "");
    oznam(`Termín přesunut: ${popisKam(tym, kam)}`);
  }

  async _posun(p, z, k, druh) {
    const popis = popisRozsahu(z, k);
    try {
      await upravZdroj(this.tym, this.osobni, p.zdroj, (s) => {
        const pol = s.find((x) => x.id === p.id);
        if (!pol) return false;
        nastavRozsah(pol, z, k);
        zaznamTerminu(pol, (druh === "presun" ? "Přesunut na " : "Změněna délka: ") + popis, this.tym.ja.jmeno);
      }, this._historieUpravy(p, `${druh === "presun" ? "Přesunut" : "Změněna délka"} termínu (v kalendáři): ${p.pol.nazev || ""} → ${popis}`));
      this.vybranyTermin = p.id;
      this.boc = "termin";
      this.obnov();
    } catch (e) {
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
      await upravZdroj(this.tym, this.osobni, p.zdroj, (s) => {
        index = s.findIndex((x) => x.id === p.id);
        if (index < 0) return false;
        if (p.druh === "dovolene" && !this.tym.jeSpravce && (s[index].uzivatel || "") !== this.tym.ja.id) throw new Error("Cizí dovolenou mazat nemůžeš.");
        smazany = s.splice(index, 1)[0];
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
        await upravZdroj(tym, this.osobni, zdroj, (s) => { s.push(pol); },
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
    class: b === hodnota ? "vybrany" : "", onclick: () => { hodnota = b; prekresli(); vysledek.priZmene(); } },
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

