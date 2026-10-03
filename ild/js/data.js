// Data týmu z Firebase (jednotky jako v ild/oblak.py) a výpočty převzaté z ild/data.py:
// svátky, pracovní dny, dovolená v hodinách, názvy projektů a druhů termínů.

import { ChybaOblaku, klicDoDb, klicZDb } from "./oblak.js";

// --- datumy (vždy místní čas, "RRRR-MM-DD") ---------------------------------------------------

export const dnes = () => iso(new Date());

export function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function zIso(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ""));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function pridejDny(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function ted() {
  const d = new Date();
  return `${iso(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const MESICE = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září",
  "říjen", "listopad", "prosinec"];
export const DNY = ["po", "út", "st", "čt", "pá", "so", "ne"];

export function datumKratce(d, sRokem = false) {
  return `${d.getDate()}. ${d.getMonth() + 1}.${sRokem ? " " + d.getFullYear() : ""}`;
}

export function popisRozsahu(z, k) {
  if (iso(z) === iso(k)) return datumKratce(z, true);
  if (z.getFullYear() === k.getFullYear()) return `${datumKratce(z)} – ${datumKratce(k, true)}`;
  return `${datumKratce(z, true)} – ${datumKratce(k, true)}`;
}

// rozsah_polozky: [od, do] (Date), nebo null
export function rozsah(pol) {
  let z = zIso(pol?.datum);
  if (!z) return null;
  let k = zIso(pol.datum_do) || z;
  if (k < z) [z, k] = [k, z];
  return [z, k];
}

export const noveId = () => [...crypto.getRandomValues(new Uint8Array(16))]
  .map((b) => b.toString(16).padStart(2, "0")).join("");

// --- svátky (data.statni_svatky / slovenske_svatky) --------------------------------------------

function velikonocniNedele(rok) {
  const a = rok % 19, b = Math.floor(rok / 100), c = rok % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mesic = Math.floor((h + l - 7 * m + 114) / 31), den = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(rok, mesic - 1, den);
}

const _svatky = new Map();

function svatkyRoku(stat, rok) {
  const klic = `${stat}${rok}`;
  if (_svatky.has(klic)) return _svatky.get(klic);
  const vysledek = new Map();
  const nedele = velikonocniNedele(rok);
  if (stat === "cz") {
    const pevne = [[1, 1, "Nový rok"], [5, 1, "Svátek práce"], [5, 8, "Den vítězství"], [7, 5, "Cyril a Metoděj"],
      [7, 6, "Mistr Jan Hus"], [9, 28, "Den české státnosti"], [10, 28, "Vznik Československa"],
      [11, 17, "Den boje za svobodu"], [12, 24, "Štědrý den"], [12, 25, "1. svátek vánoční"],
      [12, 26, "2. svátek vánoční"]];
    for (const [m, d, n] of pevne) vysledek.set(iso(new Date(rok, m - 1, d)), n);
    if (rok >= 2016) vysledek.set(iso(pridejDny(nedele, -2)), "Velký pátek");
    vysledek.set(iso(pridejDny(nedele, 1)), "Velikonoční pondělí");
  } else {
    const pevne = [[1, 1, "Deň vzniku Slovenskej republiky"], [1, 6, "Zjavenie Pána"], [5, 1, "Sviatok práce"],
      [7, 5, "Sviatok sv. Cyrila a Metoda"], [8, 29, "Výročie SNP"], [11, 1, "Sviatok všetkých svätých"],
      [12, 24, "Štedrý deň"], [12, 25, "Prvý sviatok vianočný"], [12, 26, "Druhý sviatok vianočný"]];
    if (rok <= 2024) pevne.push([9, 1, "Deň Ústavy SR"]);
    if (rok <= 2025) pevne.push([5, 8, "Deň víťazstva nad fašizmom"], [9, 15, "Sedembolestná Panna Mária"],
      [11, 17, "Deň boja za slobodu a demokraciu"]);
    for (const [m, d, n] of pevne) vysledek.set(iso(new Date(rok, m - 1, d)), n);
    vysledek.set(iso(pridejDny(nedele, -2)), "Veľký piatok");
    vysledek.set(iso(pridejDny(nedele, 1)), "Veľkonočný pondelok");
  }
  _svatky.set(klic, vysledek);
  return vysledek;
}

// [[stat, název]] svátků dne
export function svatkyDne(d, staty = ["cz"]) {
  const den = iso(d);
  return staty.map((s) => [s, svatkyRoku(s, d.getFullYear()).get(den)]).filter(([, n]) => n);
}

export function pracovniDny(z, k, staty = ["cz"]) {
  const dny = [];
  for (let d = z; d <= k; d = pridejDny(d, 1)) {
    const tyden = (d.getDay() + 6) % 7;
    if (tyden < 5 && !svatkyDne(d, staty).length) dny.push(d);
  }
  return dny;
}

// --- texty ----------------------------------------------------------------------------------

export function cislo(x) {
  const r = Math.round(x * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ",");
}

function sklonujDny(n) {
  if (!Number.isInteger(n)) return "dne";
  const a = Math.abs(n);
  return a === 1 ? "den" : a >= 2 && a <= 4 ? "dny" : "dní";
}

// „164 h (20,5 dne)“ – data.hodiny_text
export function hodinyText(hodin, den = 8, sDny = true) {
  const text = `${cislo(hodin)} h`;
  if (!sDny || !den) return text;
  const dni = Math.round((hodin / den) * 10) / 10;
  return `${text} (${cislo(dni)} ${sklonujDny(dni)})`;
}

// --- konstanty z programu (konstanty.py) ----------------------------------------------------------

export const STATUSY = ["Poptávka", "Realizace", "Realizováno", "Mrtvé"];
export const NEAKTIVNI = new Set(["Realizováno", "Mrtvé"]);
export const STATUS_BARVY = { Poptávka: "#7A5AF8", Realizace: "#2E90FA", Realizováno: "#12B76A", Mrtvé: "#F04438" };
export const BARVY_TERMINU = ["#F79009", "#12B76A", "#2E90FA", "#7A5AF8", "#0BA5EC", "#EE46BC", "#F04438", "#00A991"];
export const VYCHOZI_VYZNAM = {
  "#F79009": "Cenová nabídka", "#12B76A": "Podpis smlouvy", "#2E90FA": "Realizace", "#7A5AF8": "Odevzdání",
  "#0BA5EC": "Prohlídka / dotazy", "#EE46BC": "Jednání", "#F04438": "Důležitá lhůta", "#00A991": "Ostatní",
};
export const BARVA_REALIZACE = "#2E90FA";
export const C_DOVOLENA = "#A0785A";
export const C_BEZ_PROJEKTU = "#667085";
const PLATNA_BARVA = /^#[0-9a-fA-F]{6}$/;

export function barvaTerminu(pol) {
  if (typeof pol?.barva === "string" && PLATNA_BARVA.test(pol.barva)) return pol.barva;
  const ident = pol?.id || pol?.nazev || "";
  let soucet = 0;
  for (const z of ident) soucet += z.codePointAt(0);
  return BARVY_TERMINU[soucet % BARVY_TERMINU.length];
}

export const jeHotovo = (pol) => pol?.stav === "Dokončeno";

export function nazevProjektu(p) {
  return String(p?.lokalita || p?.nazev || p?.cislo || "Projekt").trim();
}

export function podtitulProjektu(p) {
  const casti = [];
  if (p?.lokalita && p?.nazev) casti.push(p.nazev);
  if (p?.cislo) casti.push(`Zakázka ${p.cislo}`);
  if (p?.investor) casti.push(p.investor);
  if (p?.provozni) casti.push(p.provozni);
  return casti.map((c) => String(c).trim()).filter(Boolean).join(" · ");
}

// --- tým: jednotky z databáze ---------------------------------------------------------------

export const PRAZDNE = { terminy_bez_projektu: [], dovolene: [], nastaveni: {}, uzivatele: { uzivatele: [] } };

export class Tym {
  constructor(oblak) {
    this.oblak = oblak;
    this.jednotky = new Map(); // klíč → {n, j, smazano, hodnota}
    this.posluchaci = new Set();
    this.pripojeno = false;
    this.ja = null;            // {id, jmeno, role}
    this._konecSledovani = null;
    this._stahuji = new Set();
  }

  pri(funkce) { this.posluchaci.add(funkce); return () => this.posluchaci.delete(funkce); }

  _oznam() {
    clearTimeout(this._odlozene);
    this._odlozene = setTimeout(() => this.posluchaci.forEach((f) => f()), 30);
  }

  _prijmi(klic, h) {
    if (!h || typeof h !== "object" || !Number.isInteger(h.n)) return false;
    const stara = this.jednotky.get(klic);
    if (stara && stara.n >= h.n) return false;
    let hodnota = null;
    if (!h.smazano && typeof h.j === "string") {
      try { hodnota = JSON.parse(h.j); } catch { hodnota = null; }
    }
    this.jednotky.set(klic, { n: h.n, smazano: !!h.smazano, hodnota });
    return true;
  }

  async nacti() {
    const vse = await this.oblak.cti("tym/jednotky");
    this.jednotky.clear();
    for (const [k, h] of Object.entries(vse || {})) this._prijmi(klicZDb(k), h);
    this._oznam();
  }

  sleduj(naStav) {
    this._konecSledovani?.();
    this._konecSledovani = this.oblak.sleduj("tym/index", (udalost, obsah) => {
      const cesta = String(obsah.path || "/").split("/").filter(Boolean);
      const verze = {};
      if (!cesta.length && obsah.data && typeof obsah.data === "object") Object.assign(verze, obsah.data);
      else if (cesta.length === 1) verze[cesta[0]] = obsah.data;
      for (const [k, n] of Object.entries(verze)) {
        const klic = klicZDb(k);
        if (Number.isInteger(n) && n > (this.jednotky.get(klic)?.n || 0)) this._stahni(klic);
      }
    }, (stav) => { this.pripojeno = stav; naStav?.(stav); });
  }

  zastav() { this._konecSledovani?.(); this._konecSledovani = null; }

  async _stahni(klic) {
    if (this._stahuji.has(klic)) return;
    this._stahuji.add(klic);
    try {
      if (this._prijmi(klic, await this.oblak.cti(`tym/jednotky/${klicDoDb(klic)}`))) this._oznam();
    } catch { /* příště */ } finally {
      this._stahuji.delete(klic);
    }
  }

  hodnota(klic) {
    const j = this.jednotky.get(klic);
    return j && !j.smazano && j.hodnota != null ? j.hodnota : PRAZDNE[klic] ?? null;
  }

  get projekty() {
    const vysledek = [];
    for (const [k, j] of this.jednotky) {
      if (k.startsWith("p:") && !j.smazano && j.hodnota && typeof j.hodnota === "object") vysledek.push(j.hodnota);
    }
    return vysledek;
  }

  projekt(id) { return this.hodnota(`p:${id}`); }
  get nastaveni() { return this.hodnota("nastaveni") || {}; }
  get uzivatele() {
    const u = this.hodnota("uzivatele");
    return (Array.isArray(u?.uzivatele) ? u.uzivatele : []).filter((x) => x && typeof x === "object" && x.id);
  }
  get aktivni() { return this.uzivatele.filter((u) => u.aktivni !== false); }
  get jeSpravce() { return this.ja?.role === "admin"; }

  jmeno(id, vychozi = "") {
    return this.uzivatele.find((u) => u.id === id)?.jmeno || vychozi || id || "";
  }

  vyznamBarvy(barva) {
    const vlastni = this.nastaveni.vyznam_barev;
    return (vlastni && typeof vlastni === "object" && vlastni[barva]) || VYCHOZI_VYZNAM[barva] || "";
  }

  nazevDruhu(pol) {
    const barva = barvaTerminu(pol);
    const nazev = this.vyznamBarvy(barva);
    const upresneni = barva === BARVA_REALIZACE ? String(pol?.upresneni || "").trim() : "";
    return upresneni ? `${nazev} – ${upresneni}` : nazev;
  }

  // Změna jedné jednotky: vezme poslední verzi ze serveru, upraví ji (zmen(hodnota) – false = nic
  // neměnit) a zapíše s n + 1. Když mezitím zapsal někdo jiný, pravidla zápis odmítnou → znovu.
  async uprav(klic, zmen) {
    const k = klicDoDb(klic);
    for (let pokus = 0; pokus < 6; pokus++) {
      const h = await this.oblak.cti(`tym/jednotky/${k}`);
      let hodnota;
      if (h && typeof h.j === "string" && !h.smazano) {
        hodnota = JSON.parse(h.j);
      } else if (klic in PRAZDNE && klic !== "uzivatele") {
        hodnota = structuredClone(PRAZDNE[klic]);
      } else {
        throw new ChybaOblaku("Tohle už mezitím někdo smazal.", "jine");
      }
      if (zmen(hodnota) === false) return hodnota;
      const n = (Number.isInteger(h?.n) ? h.n : 0) + 1;
      const zaznam = { j: JSON.stringify(hodnota), n, kdo: this.ja?.jmeno || "", id: this.ja?.id || "",
        cas: ted(), smazano: false };
      try {
        await this.oblak.zapis("tym", { [`jednotky/${k}`]: zaznam, [`index/${k}`]: n });
      } catch (e) {
        if (e.druh === "pristup" && pokus < 5) {
          await new Promise((r) => setTimeout(r, 150 + Math.random() * 400));
          continue; // souběh – zkusit nad novější verzí
        }
        throw e.druh === "pristup" ? new ChybaOblaku("Změnu server odmítl (nemáš na ni oprávnění?).", "pristup") : e;
      }
      this._prijmi(klic, zaznam);
      this._oznam();
      return hodnota;
    }
    throw new ChybaOblaku("Změnu se nepodařilo uložit, zkus to znovu.", "jine");
  }

  // projekt: změna + záznam do historie (data.zaznam_zmeny)
  upravProjekt(id, zmen, textHistorie) {
    return this.uprav(`p:${id}`, (p) => {
      if (zmen(p) === false) return false;
      if (textHistorie) zaznamZmeny(p, textHistorie, this.ja?.jmeno);
    });
  }
}

export function zaznamZmeny(projekt, text, kdo) {
  if (!Array.isArray(projekt.historie)) projekt.historie = [];
  const zaznam = { cas: ted(), text };
  if (kdo) zaznam.kdo = kdo;
  projekt.historie.push(zaznam);
  if (projekt.historie.length > 200) projekt.historie = projekt.historie.slice(-200);
}

export function zaznamTerminu(pol, text, kdo) {
  if (!Array.isArray(pol.zmeny)) pol.zmeny = [];
  const zaznam = { cas: ted(), text };
  if (kdo) zaznam.kdo = kdo;
  pol.zmeny.push(zaznam);
  if (pol.zmeny.length > 40) pol.zmeny = pol.zmeny.slice(-40);
}

export function novyTermin(udaje, kdo) {
  const pol = { id: noveId(), ...udaje };
  if (kdo) { pol.vytvoril = kdo; pol.vytvoreno = ted(); }
  zaznamTerminu(pol, "Vytvořen", kdo);
  return pol;
}

// --- dovolená v hodinách (data.nastaveni_dovolene … bilance_dovolene) ---------------------------

export const VYCHOZI_HODIN_DENNE = 8;
export const VYCHOZI_NAROK = 160;

export function nastaveniDovolene(nastaveni) {
  const d = nastaveni?.dovolena && typeof nastaveni.dovolena === "object" ? nastaveni.dovolena : {};
  const den = typeof d.hodin_denne === "number" && d.hodin_denne > 0 ? d.hodin_denne : VYCHOZI_HODIN_DENNE;
  const nasob = d.jednotka === "h" ? 1 : den; // starší nastavení ve dnech
  const lide = {};
  for (const [kdo, roky] of Object.entries(d.lide && typeof d.lide === "object" ? d.lide : {})) {
    lide[kdo] = {};
    for (const [rok, z] of Object.entries(roky && typeof roky === "object" ? roky : {})) {
      if (!z || typeof z !== "object") continue;
      lide[kdo][rok] = {};
      for (const k of ["narok", "prevod"]) if (typeof z[k] === "number") lide[kdo][rok][k] = z[k] * nasob;
    }
  }
  return { den, narok: typeof d.narok === "number" ? d.narok * nasob : VYCHOZI_NAROK, lide };
}

export function hodinDovoleneDenne(pol, celyDen) {
  const h = pol?.hodin;
  return typeof h === "number" && h > 0 && h < celyDen ? h : celyDen;
}

export class Dovolene {
  constructor(seznam, nastaveni, staty = ["cz"]) {
    this.seznam = (Array.isArray(seznam) ? seznam : []).filter((p) => p && typeof p === "object");
    this.nast = nastaveniDovolene(nastaveni);
    this.staty = staty;
    this._hodiny = new Map();
  }

  get den() { return this.nast.den; }

  cloveka(kdo) { return this.seznam.filter((p) => (p.uzivatel || "") === (kdo || "")); }

  // Map(iso den → hodin) pro člověka a rok
  hodiny(kdo, rok) {
    const klic = `${kdo}|${rok}`;
    if (this._hodiny.has(klic)) return this._hodiny.get(klic);
    const dny = new Map();
    const zacatek = new Date(rok, 0, 1), konec = new Date(rok, 11, 31);
    for (const pol of this.cloveka(kdo)) {
      const rz = rozsah(pol);
      if (!rz || rz[1] < zacatek || rz[0] > konec) continue;
      const h = hodinDovoleneDenne(pol, this.den);
      const z = rz[0] < zacatek ? zacatek : rz[0], k = rz[1] > konec ? konec : rz[1];
      for (const d of pracovniDny(z, k, this.staty)) {
        const i = iso(d);
        dny.set(i, Math.min(this.den, Math.max(dny.get(i) || 0, h)));
      }
    }
    this._hodiny.set(klic, dny);
    return dny;
  }

  _zaznam(kdo, rok) { return this.nast.lide[kdo || ""]?.[String(rok)] || {}; }

  narok(kdo, rok) {
    const z = this._zaznam(kdo, rok);
    return typeof z.narok === "number" ? z.narok : this.nast.narok;
  }

  _prvniRok(kdo) {
    const roky = this.cloveka(kdo).map((p) => rozsah(p)?.[0].getFullYear()).filter((r) => r);
    roky.push(...Object.keys(this.nast.lide[kdo || ""] || {}).filter((r) => /^\d+$/.test(r)).map(Number));
    return roky.length ? Math.min(...roky) : null;
  }

  prevod(kdo, rok) {
    const z = this._zaznam(kdo, rok);
    if (typeof z.prevod === "number") return z.prevod;
    const prvni = this._prvniRok(kdo);
    if (prvni == null || rok - 1 < prvni) return 0;
    const soucet = [...this.hodiny(kdo, rok - 1).values()].reduce((a, b) => a + b, 0);
    return Math.max(0, this.narok(kdo, rok - 1) + this.prevod(kdo, rok - 1) - soucet);
  }

  bilance(kdo, rok, dnesIso = dnes()) {
    const hodiny = this.hodiny(kdo, rok);
    let celkem = 0, vycerpano = 0;
    for (const [d, h] of hodiny) { celkem += h; if (d <= dnesIso) vycerpano += h; }
    const narok = this.narok(kdo, rok), prevod = this.prevod(kdo, rok);
    return { narok, prevod, k_dispozici: narok + prevod, vycerpano, naplanovano: celkem - vycerpano, celkem,
      zbyva: narok + prevod - celkem, den: this.den };
  }

  hodinPolozky(pol) {
    const rz = rozsah(pol);
    return rz ? pracovniDny(rz[0], rz[1], this.staty).length * hodinDovoleneDenne(pol, this.den) : 0;
  }
}
