// Cashflow zakázky – port ild/finance.py (stejná data i výpočty jako program na počítači).
// Faktury projektu: projekt.faktury = [{id, typ, nazev, castka, datum, splatnost_dni, stav, uhrazeno, cislo,
// firma, poznamka, termin}], projekt.cena_zakazky, projekt.mena (CZK | EUR). Částky bez DPH.

import { datumKratce, iso, noveId, pridejDny, rozsah, zIso } from "./data.js";

export const VYDANA = "vydana", PRIJATA = "prijata";
export const PLAN = "plan", VYSTAVENA = "vystavena", UHRAZENA = "uhrazena";
export const TYPY = { [VYDANA]: "Vydaná faktura", [PRIJATA]: "Přijatá faktura" };
export const STAVY = {
  [VYDANA]: { [PLAN]: "Plán", [VYSTAVENA]: "Vystavená", [UHRAZENA]: "Uhrazená" },
  [PRIJATA]: { [PLAN]: "Očekávaná", [VYSTAVENA]: "Přijatá", [UHRAZENA]: "Zaplacená" },
};
export const STAVY_K_DATU = {
  [VYDANA]: { plan: "Plán", nevyfakturovano: "Nevyfakturováno", ceka: "Čeká na úhradu", po_splatnosti: "Po splatnosti", uhrazena: "Uhrazeno" },
  [PRIJATA]: { plan: "Očekávaná", nevyfakturovano: "Očekávaná", ceka: "K úhradě", po_splatnosti: "Po splatnosti", uhrazena: "Zaplaceno" },
};
export const MENY = { CZK: "Kč", EUR: "€" };
export const VYCHOZI_MENA = "CZK";
export const VYCHOZI_SPLATNOST = 30;
export const STATUSY_CASHFLOW = new Set(["Realizace", "Realizováno"]);
export const C_PRIJEM = "#15803D", C_VYDAJ = "#C2410C";
export const FAKTURA_ID = "faktura:";
const POLE = ["typ", "nazev", "castka", "datum", "splatnost_dni", "stav", "uhrazeno", "cislo", "firma", "poznamka", "termin"];
const NBSP = " ";

export const maCashflow = (p) => !!p && typeof p === "object" && STATUSY_CASHFLOW.has(p.status);
export const platne = (p) => (Array.isArray(p?.faktury) ? p.faktury : []).filter((f) => f && typeof f === "object");
export const najdi = (p, id) => (p && id ? platne(p).find((f) => f.id === id) || null : null);
export const menaProjektu = (p) => (p?.mena in MENY ? p.mena : VYCHOZI_MENA);

function cislo(h, vychozi = 0) {
  if (typeof h === "boolean") return vychozi;
  const x = Number(h);
  return Number.isFinite(x) && h !== "" && h != null ? x : vychozi;
}

const zaokrouhli = (x) => Math.round(x * 100) / 100;

export function cenaZakazky(p) {
  const x = cislo(p?.cena_zakazky, 0);
  return x ? zaokrouhli(x) : null;
}

export const typ = (f) => (f?.typ in TYPY ? f.typ : VYDANA);
export const jePrijem = (f) => typ(f) === VYDANA;
export const stav = (f) => ([PLAN, VYSTAVENA, UHRAZENA].includes(f?.stav) ? f.stav : PLAN);
export const castka = (f) => zaokrouhli(cislo(f?.castka));
export const nazev = (f) => String(f?.nazev || "").trim() || TYPY[typ(f)];

export function splatnostDni(f) {
  const n = parseInt(f?.splatnost_dni ?? VYCHOZI_SPLATNOST, 10);
  return Number.isNaN(n) ? VYCHOZI_SPLATNOST : Math.max(0, Math.min(3650, n));
}

const den = (t) => zIso(String(t || "").slice(0, 10));

export function termin(f, p) {
  if (!f?.termin || !p) return null;
  return (Array.isArray(p.harmonogram) ? p.harmonogram : []).find((t) => t && t.id === f.termin) || null;
}

// kdy fakturovat / datum vystavení (plánovaná navázaná na termín = den, kdy termín končí)
export function datum(f, p = null) {
  if (stav(f) === PLAN) {
    const t = termin(f, p);
    const rz = t ? rozsah(t) : null;
    if (rz) return rz[1];
  }
  return den(f?.datum);
}

export function splatnost(f, p = null) {
  const d = datum(f, p);
  return d ? pridejDny(d, splatnostDni(f)) : null;
}

export const uhrazeno = (f) => (stav(f) === UHRAZENA ? den(f.uhrazeno) : null);

export function datumPohybu(f, p = null) {
  if (stav(f) === UHRAZENA) return uhrazeno(f) || splatnost(f, p) || datum(f, p);
  return splatnost(f, p);
}

const dnesD = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

export function stavKDatu(f, p = null, dnes = dnesD()) {
  const s = stav(f);
  let kod;
  if (s === UHRAZENA) kod = "uhrazena";
  else if (s === PLAN) {
    const d = datum(f, p);
    kod = jePrijem(f) && d && d < dnes ? "nevyfakturovano" : "plan";
  } else {
    const sp = splatnost(f, p);
    kod = sp && sp < dnes ? "po_splatnosti" : "ceka";
  }
  return [kod, STAVY_K_DATU[typ(f)][kod]];
}

export function dniPoSplatnosti(f, p = null, dnes = dnesD()) {
  if (stav(f) !== VYSTAVENA) return 0;
  const sp = splatnost(f, p);
  return sp && sp < dnes ? Math.round((dnes - sp) / 86400000) : 0;
}

export const popis = (f, p = null) => `${nazev(f)} (${formatujCastku(castka(f), menaProjektu(p), true)})`;
const datumText = (d) => (d ? datumKratce(d, true) : "—");
const stejneDatum = (a, b) => (a ? iso(a) : "") === (b ? iso(b) : "");

export function popisZmen(pred, po, p = null) {
  const m = menaProjektu(p);
  const casti = [];
  if (typ(pred) !== typ(po)) casti.push(`${TYPY[typ(pred)].toLowerCase()} → ${TYPY[typ(po)].toLowerCase()}`);
  if (nazev(pred) !== nazev(po)) casti.push(`název: ${nazev(pred)} → ${nazev(po)}`);
  if (castka(pred) !== castka(po)) casti.push(`částka: ${formatujCastku(castka(pred), m, true)} → ${formatujCastku(castka(po), m, true)}`);
  if (!stejneDatum(datum(pred, p), datum(po, p))) casti.push(`datum: ${datumText(datum(pred, p))} → ${datumText(datum(po, p))}`);
  if (!stejneDatum(splatnost(pred, p), splatnost(po, p))) casti.push(`splatnost: ${datumText(splatnost(pred, p))} → ${datumText(splatnost(po, p))}`);
  if (stav(pred) !== stav(po)) casti.push(`stav: ${STAVY[typ(pred)][stav(pred)]} → ${STAVY[typ(po)][stav(po)]}`);
  else if (!stejneDatum(uhrazeno(pred), uhrazeno(po))) casti.push(`uhrazeno: ${datumText(uhrazeno(po))}`);
  for (const [k, t] of [["cislo", "číslo faktury"], ["firma", "odběratel / dodavatel"], ["poznamka", "poznámka"], ["termin", "navazující termín"]]) {
    if ((pred[k] || "") !== (po[k] || "")) casti.push(t);
  }
  return casti.join(" · ");
}

export function zapisUdaje(f, udaje) {
  for (const k of POLE) {
    if (!(k in udaje)) continue;
    const h = udaje[k];
    if ((h == null || h === "") && !["typ", "stav", "castka", "nazev", "splatnost_dni"].includes(k)) delete f[k];
    else f[k] = h;
  }
  if (stav(f) !== UHRAZENA) delete f.uhrazeno;
}

export function novaFaktura(udaje) {
  const f = { id: noveId(), typ: VYDANA, nazev: "", castka: 0, splatnost_dni: VYCHOZI_SPLATNOST, stav: PLAN };
  zapisUdaje(f, udaje);
  return f;
}

export function nastavStav(f, p, novy, uhrazenoDne = dnesD()) {
  if (stav(f) === PLAN && novy !== PLAN) {
    const d = datum(f, p);
    if (d) f.datum = iso(d);
  }
  f.stav = novy;
  if (novy === UHRAZENA) f.uhrazeno = iso(uhrazenoDne);
  else delete f.uhrazeno;
}

export function zmrazNavazane(p, terminPol) {
  const rz = rozsah(terminPol);
  if (!rz) return 0;
  let n = 0;
  for (const f of platne(p)) {
    if (f.termin === terminPol.id && stav(f) === PLAN && f.datum !== iso(rz[1])) { f.datum = iso(rz[1]); n++; }
  }
  return n;
}

export function firmy(projekty) {
  const jmena = new Set();
  for (const p of projekty) {
    for (const f of platne(p)) if (String(f.firma || "").trim()) jmena.add(String(f.firma).trim());
    if (String(p.investor || "").trim()) jmena.add(String(p.investor).trim());
  }
  return [...jmena].sort((a, b) => a.localeCompare(b, "cs"));
}

// --- souhrn ------------------------------------------------------------------------------------

export function prazdnySouhrn(mena = VYCHOZI_MENA) {
  return { mena, zakazek: 0, s_cenou: 0, faktur: 0, cena: 0, vyfakturovano: 0, planovano: 0, nevyfakturovano: 0,
    prijato: 0, pohledavky: 0, po_splatnosti: 0, naklady: 0, naklady_plan: 0, zaplaceno: 0, zavazky: 0,
    zavazky_po_splatnosti: 0, fakturace_s_cenou: 0, nenaplanovano: 0 };
}

export const saldo = (s) => s.prijato - s.zaplaceno;
export const prijmy = (s) => s.vyfakturovano + s.planovano;
export const vydaje = (s) => s.naklady + s.naklady_plan;
export const vysledek = (s) => prijmy(s) - vydaje(s);
export const podilVyfakturovano = (s) => (s.cena ? s.fakturace_s_cenou / s.cena : null);
export const zbyvaVyfakturovat = (s) => (s.cena ? s.cena - s.fakturace_s_cenou : null);

export function souhrn(p, dnes = dnesD()) {
  const s = prazdnySouhrn(menaProjektu(p));
  s.zakazek = 1;
  const cena = cenaZakazky(p);
  if (cena) { s.cena = cena; s.s_cenou = 1; }
  for (const f of platne(p)) {
    const x = castka(f), st = stav(f), kod = stavKDatu(f, p, dnes)[0];
    s.faktur++;
    if (jePrijem(f)) {
      if (st === PLAN) { s.planovano += x; if (kod === "nevyfakturovano") s.nevyfakturovano += x; continue; }
      s.vyfakturovano += x;
      if (st === UHRAZENA) s.prijato += x;
      else { s.pohledavky += x; if (kod === "po_splatnosti") s.po_splatnosti += x; }
    } else {
      if (st === PLAN) { s.naklady_plan += x; continue; }
      s.naklady += x;
      if (st === UHRAZENA) s.zaplaceno += x;
      else { s.zavazky += x; if (kod === "po_splatnosti") s.zavazky_po_splatnosti += x; }
    }
  }
  if (cena) { s.fakturace_s_cenou = s.vyfakturovano; s.nenaplanovano = Math.max(0, cena - prijmy(s)); }
  return s;
}

export function souhrny(projekty, dnes = dnesD()) {
  const v = {};
  for (const p of projekty) {
    const s = souhrn(p, dnes);
    const c = (v[s.mena] ||= prazdnySouhrn(s.mena));
    for (const k of Object.keys(c)) if (k !== "mena") c[k] += s[k];
  }
  return Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a !== VYCHOZI_MENA) - (b !== VYCHOZI_MENA) || a.localeCompare(b)));
}

// --- toky po měsících --------------------------------------------------------------------------

export function toky(projekty, dnes = dnesD(), mena = null) {
  const v = [];
  for (const p of projekty) {
    if (mena && menaProjektu(p) !== mena) continue;
    for (const f of platne(p)) {
      let d = datumPohybu(f, p);
      if (!d) continue;
      const skutecnost = stav(f) === UHRAZENA;
      if (!skutecnost && d < dnes) d = dnes;
      v.push({ den: d, castka: castka(f), prijem: jePrijem(f), skutecnost, faktura: f, projekt: p });
    }
  }
  return v.sort((a, b) => a.den - b.den);
}

const prvniDen = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const pridejMesice = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const konecMesice = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

export function poMesicich(projekty, dnes = dnesD(), od = null, doo = null, mena = VYCHOZI_MENA) {
  const vsechny = toky(projekty, dnes, mena);
  if (!od || !doo) {
    if (!vsechny.length) return [];
    od ||= vsechny[0].den;
    doo ||= vsechny[vsechny.length - 1].den;
  }
  let [prvni, posledni] = [prvniDen(od), prvniDen(doo)].sort((a, b) => a - b);
  const mesice = [];
  for (let m = prvni; m <= posledni; m = pridejMesice(m, 1)) {
    mesice.push({ mesic: m, prijmy: 0, prijmy_vyhled: 0, vydaje: 0, vydaje_vyhled: 0, zustatek: 0 });
  }
  const podle = new Map(mesice.map((x) => [iso(x.mesic), x]));
  let zustatek = 0;
  for (const t of vsechny) {
    const z = t.prijem ? 1 : -1;
    if (t.den < prvni) { zustatek += z * t.castka; continue; }
    const x = podle.get(iso(prvniDen(t.den)));
    if (!x) continue;
    if (t.prijem) { if (t.skutecnost) x.prijmy += t.castka; else x.prijmy_vyhled += t.castka; }
    else if (t.skutecnost) x.vydaje += t.castka;
    else x.vydaje_vyhled += t.castka;
  }
  for (const x of mesice) {
    zustatek += x.prijmy + x.prijmy_vyhled - x.vydaje - x.vydaje_vyhled;
    x.zustatek = zustatek;
  }
  return mesice;
}

// měsíce do grafu v aplikaci: celá doba faktur, vždy i aktuální měsíc, aspoň 6 měsíců
export function mesiceGrafu(projekty, dnes = dnesD(), mena = VYCHOZI_MENA) {
  const t = toky(projekty, dnes, mena);
  if (!t.length) return [];
  const tento = prvniDen(dnes);
  let od = prvniDen(t[0].den) < tento ? prvniDen(t[0].den) : tento;
  let doo = prvniDen(t[t.length - 1].den) > tento ? prvniDen(t[t.length - 1].den) : tento;
  while ((doo.getFullYear() - od.getFullYear()) * 12 + doo.getMonth() - od.getMonth() < 5) doo = pridejMesice(doo, 1);
  return poMesicich(projekty, dnes, od, doo, mena);
}

export const OBDOBI = { vse: "Celá doba zakázky", vyhled: "3 měsíce zpět a 9 měsíců dopředu", "12m": "Příštích 12 měsíců", rok: "Letošní rok" };

export function obdobi(predvolba, dnes = dnesD()) {
  const m = prvniDen(dnes);
  if (predvolba === "vyhled") return [pridejMesice(m, -3), konecMesice(pridejMesice(m, 8))];
  if (predvolba === "12m") return [m, konecMesice(pridejMesice(m, 11))];
  if (predvolba === "rok") return [new Date(dnes.getFullYear(), 0, 1), new Date(dnes.getFullYear(), 11, 31)];
  return [null, null];
}

export function poSplatnosti(projekty, dnes = dnesD()) {
  const v = [];
  for (const p of projekty) for (const f of platne(p)) { const d = dniPoSplatnosti(f, p, dnes); if (d > 0) v.push([p, f, d]); }
  return v.sort((a, b) => b[2] - a[2] || nazev(a[1]).localeCompare(nazev(b[1]), "cs"));
}

export function kFakturaci(projekty, dnes = dnesD(), dni = 60) {
  const v = [];
  const hranice = pridejDny(dnes, dni);
  for (const p of projekty) for (const f of platne(p)) {
    const d = datum(f, p);
    if (jePrijem(f) && stav(f) === PLAN && d && d <= hranice) v.push([p, f, d]);
  }
  return v.sort((a, b) => a[2] - b[2] || nazev(a[1]).localeCompare(nazev(b[1]), "cs"));
}

// --- pruhy faktur v kalendáři harmonogramu (jen pro čtení) ---------------------------------------

export function pruhFaktury(f, p) {
  const s = stav(f), prijem = jePrijem(f);
  let d, kdy;
  if (s === UHRAZENA) { d = uhrazeno(f) || splatnost(f, p); kdy = prijem ? "Uhrazeno" : "Zaplaceno"; }
  else if (s === PLAN && prijem) { d = datum(f, p); kdy = "Fakturovat"; }
  else { d = splatnost(f, p); kdy = prijem ? "Splatnost" : "K úhradě"; }
  if (!d) return null;
  const m = menaProjektu(p);
  const radky = [`${TYPY[typ(f)]} · ${formatujCastku(castka(f), m, true)} bez DPH`, `Stav: ${stavKDatu(f, p)[1]}`,
    `${s === PLAN && prijem ? "Kdy fakturovat" : "Datum"}: ${datumText(datum(f, p))}`, `Splatnost: ${datumText(splatnost(f, p))}`];
  if (f.firma) radky.push(`${prijem ? "Odběratel" : "Dodavatel"}: ${f.firma}`);
  if (f.cislo) radky.push(`Číslo: ${f.cislo}`);
  const pol = { id: FAKTURA_ID + (f.id || ""), nazev: `${kdy}: ${nazev(f)} · ${kratkaCastka(castka(f), m)}`, datum: iso(d),
    barva: prijem ? C_PRIJEM : C_VYDAJ, poznamka: radky.join("\n"), _faktura: f.id || "" };
  if (s === UHRAZENA) pol.stav = "Dokončeno";
  return pol;
}

export const pruhyFaktur = (p) => (p ? platne(p).map((f) => pruhFaktury(f, p)).filter(Boolean) : []);

// --- částky ------------------------------------------------------------------------------------

const skupiny = (cele) => String(cele).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

export function formatujCastku(x, mena = VYCHOZI_MENA, desetiny = false, znamenko = false) {
  x = zaokrouhli(cislo(x));
  const a = Math.abs(x);
  let text;
  if (desetiny && Math.abs(a - Math.round(a)) >= 0.005) {
    const sto = Math.round(a * 100);
    text = `${skupiny(Math.floor(sto / 100))},${String(sto % 100).padStart(2, "0")}`;
  } else text = skupiny(Math.round(a));
  const nula = text === "0" || text === "0,00";
  const znak = x < 0 && !nula ? "−" : znamenko && x > 0 && !nula ? "+" : "";
  return znak + text + (mena ? NBSP + (MENY[mena] || mena) : "");
}

export function kratkaCastka(x, mena = "") {
  x = cislo(x);
  const a = Math.abs(x);
  let c;
  if (a >= 999950) c = `${(a / 1e6).toFixed(1).replace(".", ",").replace(/,0$/, "")}${NBSP}mil.`;
  else if (a >= 999.5) c = `${Math.round(a / 1000)}${NBSP}tis.`;
  else c = String(Math.round(a));
  return (x < 0 && c !== "0" ? "−" : "") + c + (mena ? NBSP + (MENY[mena] || mena) : "");
}

const NASOBKY = /(mil\.?|milion\p{L}*|mio\.?|tis\.?|tisíc\p{L}*|tisic\p{L}*)$/u;

// „1 234 567,50“, „1.234.567,5“, „350 000,-“, „1,2 mil“, „350 tis“, „−5 000“, „30 %“ z ceny; null = nejde
export function prectiCastku(text, cena = null) {
  let t = String(text || "").trim().toLowerCase();
  for (const [co, cim] of [[" ", " "], [" ", " "], ["−", "-"], ["–", "-"]]) t = t.split(co).join(cim);
  for (const z of ["kč", "czk", "eur", "€", ",-", ".-", ",–"]) t = t.split(z).join("");
  t = t.trim();
  const procenta = t.endsWith("%");
  if (procenta) t = t.slice(0, -1).trim();
  let nasobek = 1;
  const s = NASOBKY.exec(t);
  if (s) { nasobek = /^(mil|mio)/.test(s[1]) ? 1e6 : 1e3; t = t.slice(0, s.index).trim(); }
  t = t.replace(/ /g, "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (t.includes(",")) t = (t.match(/,/g).length > 1) ? t.replace(/,/g, "") : t.replace(",", ".");
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, "");
  else if (t.includes(".") && t.split(".")[1].length === 3 && nasobek === 1 && !procenta) t = t.replace(".", "");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  let x = Number(t) * nasobek;
  if (procenta) { if (!cena) return null; x = (cena * x) / 100; }
  return zaokrouhli(x);
}

export function osaHodnot(dolni, horni, kroku = 4) {
  dolni = Math.min(dolni, 0); horni = Math.max(horni, 0);
  if (horni - dolni < 1e-9) horni = dolni + 1;
  const hruby = (horni - dolni) / Math.max(1, kroku);
  const rad = 10 ** Math.floor(Math.log10(hruby));
  const krok = [1, 2, 2.5, 5, 10].map((n) => n * rad).find((x) => x >= hruby - 1e-12);
  const v = [];
  let x = Math.floor(dolni / krok + 1e-9) * krok;
  while (x < horni - 1e-9 * krok) { v.push(Math.round(x * 1e6) / 1e6); x += krok; }
  v.push(Math.round(x * 1e6) / 1e6);
  return v;
}

const MESICE_ZKR = ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"];
const MESICE_CELE = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];
export const popisMesice = (m, kratce = true) => `${(kratce ? MESICE_ZKR : MESICE_CELE)[m.getMonth()]} ${m.getFullYear()}`;
