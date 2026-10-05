// Rychlé zprávy – stejná data jako ild/zpravy.py:
//   zpravy/<k>/<id> = {od, text, cas (čas serveru), odkazy?, odpoved?: {id, od, text}}
//   reakce/<k>/<id zprávy> = {<id uživatele>: emoji, cas}   (cas = poslední změna, stahuje se od něj)
//   schranka/<já>/<k> = poslední zpráva konverzace (živě sledovaná) + reakce = signál nové reakce,
//   prectene/<já>/<k> = čas přečtení
// Historie se drží celá: napoprvé posledních NACIST zpráv, starší po STRANKA při rolování nahoru;
// hledání si stáhne zbytek (web nemá mezipaměť jako program).

import { bezDiakritiky } from "./oblak.js";

const TYM = "tym";
const MAX_DELKA = 4000;
const NACIST = 300;
const STRANKA = 500;
const DELKA_CITACE = 200;
const CAS_SERVERU = { ".sv": "timestamp" };
export const REAKCE = ["👍", "✅", "❤️", "😂", "😮", "🙏"];

export { TYM };

export const konverzaceS = (a, b) => [a, b].sort().join("~");

export function protejsek(k, ja) {
  if (k === TYM) return null;
  const lide = k.split("~");
  return lide.find((x) => x !== ja) ?? ja;
}

export const normalizujHledani = (t) => bezDiakritiky(t).split(/\s+/).filter(Boolean).join(" ");

export function citace(z) {
  return { id: z.id, od: z.od || "", text: String(z.text || "").split(/\s+/).filter(Boolean).join(" ").slice(0, DELKA_CITACE) };
}

function noveId() {
  const nahoda = [...crypto.getRandomValues(new Uint8Array(3))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return String(Date.now()).padStart(13, "0") + nahoda;
}

function zprava(id, h) {
  if (!h || typeof h.text !== "string" || typeof h.cas !== "number") return null;
  const z = { id, od: String(h.od || ""), text: h.text, cas: h.cas };
  if (Array.isArray(h.odkazy)) {
    // typ "projekt" = odkaz na celý projekt (cesta = jeho hlavní složka, může chybět)
    z.odkazy = h.odkazy.filter((o) => o && ((o.typ === "projekt" && o.projekt) || (typeof o.cesta === "string" && o.cesta)))
      .slice(0, 20).map((o) => ({ cesta: typeof o.cesta === "string" ? o.cesta : "", nazev: String(o.nazev || o.cesta || "Projekt"),
        slozka: !!o.slozka, projekt: String(o.projekt || ""), typ: o.typ === "projekt" ? "projekt" : "" }));
  }
  if (h.odpoved && typeof h.odpoved === "object" && typeof h.odpoved.id === "string" && h.odpoved.id) {
    z.odpoved = { id: h.odpoved.id, od: String(h.odpoved.od || ""), text: String(h.odpoved.text || "").slice(0, DELKA_CITACE) };
  }
  return z;
}

function reakceUzlu(h) {
  const r = {};
  for (const [u, e] of Object.entries(h && typeof h === "object" ? h : {})) {
    if (u !== "cas" && typeof e === "string" && e && e.length <= 16) r[u] = e;
  }
  return r;
}

export class Posta {
  constructor(oblak, ja) {
    this.oblak = oblak;
    this.ja = ja;
    this.schranka = {};   // k → {cas, od, id, text, reakce?}
    this.prectene = {};   // k → čas
    this.zpravy = new Map(); // k → Map(id → zpráva)
    this.reakce = new Map(); // k → Map(id zprávy → {uživatel: emoji})
    this.reakceCas = {};     // k → čas nejnovější stažené změny reakcí
    this.reakceSignal = {};  // k → poslední zpracovaný signál ze schránky
    this.uplne = new Set();  // konverzace se staženou celou historií
    this.nacita = new Set(); // právě se stahují starší
    this.koncepty = new Map(); // rozepsaný text po konverzacích (přežije přepnutí konverzace)
    this.posluchaci = new Set();
    this._konec = null;
    this._clenove = null;
  }

  pri(f) { this.posluchaci.add(f); return () => this.posluchaci.delete(f); }
  _oznam() { this.posluchaci.forEach((f) => f()); }

  async spust() {
    // co je přečtené, musí být známo dřív, než se otevře konverzace (čára „Nepřečtené“)
    this._prectene = (async () => {
      try {
        const p = await this.oblak.cti(`prectene/${this.ja}`);
        if (p && typeof p === "object") this.prectene = p;
      } catch { /* bez přečtených */ }
    })();
    await this._prectene;
    this._konec = this.oblak.sleduj(`schranka/${this.ja}`, (udalost, obsah) => {
      const cesta = String(obsah.path || "/").split("/").filter(Boolean);
      if (udalost === "put" && !cesta.length) {
        this.schranka = {};
        for (const [k, m] of Object.entries(obsah.data && typeof obsah.data === "object" ? obsah.data : {})) {
          if (m && typeof m === "object") this.schranka[k] = { ...m };
        }
      } else if (udalost === "patch" && obsah.data && typeof obsah.data === "object") {
        // patch = každý klíč (i víc úrovní „k/reakce“) nahradí svůj uzel
        for (const [klic, hodnota] of Object.entries(obsah.data)) this._nastav([...cesta, ...klic.split("/").filter(Boolean)], hodnota);
      } else {
        this._nastav(cesta, obsah.data);
      }
      for (const k of this.zpravy.keys()) {
        this._dotahni(k);
        const signal = this.schranka[k]?.reakce;
        if (typeof signal === "number" && signal > (this.reakceSignal[k] || 0)) this._dotahniReakce(k, signal);
      }
      this._oznam();
    });
  }

  _nastav(cesta, data) {
    if (!cesta.length) return;
    if (cesta.length === 1) {
      if (data && typeof data === "object") this.schranka[cesta[0]] = { ...data };
      else delete this.schranka[cesta[0]];
    } else if (cesta.length === 2) {
      const meta = (this.schranka[cesta[0]] ||= {});
      if (data == null) delete meta[cesta[1]]; else meta[cesta[1]] = data;
    }
  }

  zastav() { this._konec?.(); }

  neprecteno(k) {
    const m = this.schranka[k];
    return !!m && m.od && m.od !== this.ja && typeof m.cas === "number" && m.cas > (this.prectene[k] || 0);
  }

  // počet nepřečtených: ze stažených zpráv, u nestažené konverzace aspoň 1 podle schránky
  pocet(k) {
    const zz = this.zpravy.get(k);
    if (!zz || !zz.size) return this.neprecteno(k) ? 1 : 0;
    const hranice = this.prectene[k] || 0;
    let n = 0;
    for (const z of zz.values()) if (z.od !== this.ja && z.cas > hranice && !("ceka" in z)) n += 1;
    return n || (this.neprecteno(k) ? 1 : 0);
  }

  pocetNeprectenych() {
    const klice = new Set([...Object.keys(this.schranka), ...this.zpravy.keys()]);
    let n = 0;
    for (const k of klice) n += this.pocet(k);
    return n;
  }

  seznam(k) {
    return [...(this.zpravy.get(k)?.values() || [])].sort((a, b) => a.cas - b.cas || (a.id < b.id ? -1 : 1));
  }

  reakceZpravy(k, id) { return { ...(this.reakce.get(k)?.get(id) || {}) }; }

  maStarsi(k) {
    return !this.uplne.has(k) && [...(this.zpravy.get(k)?.values() || [])].some((z) => !("ceka" in z));
  }

  async otevri(k) {
    await this._prectene;
    if (!this.zpravy.has(k)) this.zpravy.set(k, new Map());
    await this._dotahni(k, true);
    if (!(k in this.reakceCas)) await this._dotahniReakce(k, this.schranka[k]?.reakce || 0);
  }

  async _dotahni(k, vzdy = false) {
    const zz = this.zpravy.get(k);
    if (!zz) return;
    const meta = this.schranka[k];
    // zpráva bez klíče „ceka“ = potvrzená serverem (čas serveru); jen od té se stahuje dál
    const potvrzene = [...zz.values()].filter((z) => !("ceka" in z));
    if (!vzdy && (!meta?.id || zz.has(meta.id) && !("ceka" in zz.get(meta.id)))) return;
    const posledni = potvrzene.length ? Math.max(...potvrzene.map((z) => z.cas)) : null;
    const dotaz = posledni != null ? { orderBy: '"cas"', startAt: String(posledni) } : { orderBy: '"cas"', limitToLast: String(NACIST) };
    try {
      const data = await this.oblak.cti(`zpravy/${k}`, dotaz);
      const nove = Object.entries(data || {}).map(([id, h]) => zprava(id, h)).filter(Boolean);
      for (const z of nove) zz.set(z.id, z);
      if (posledni == null && nove.length < NACIST) this.uplne.add(k);
      this._oznam();
    } catch { /* příště */ }
  }

  // starší zprávy (rolování nahoru): endAt je včetně → o jednu víc
  async nactiStarsi(k) {
    const zz = this.zpravy.get(k);
    if (!zz || this.uplne.has(k) || this.nacita.has(k)) return;
    const potvrzene = [...zz.values()].filter((z) => !("ceka" in z));
    if (!potvrzene.length) return;
    this.nacita.add(k);
    this._oznam();
    try {
      const nejstarsi = Math.min(...potvrzene.map((z) => z.cas));
      const data = await this.oblak.cti(`zpravy/${k}`, { orderBy: '"cas"', endAt: String(nejstarsi), limitToLast: String(STRANKA + 1) });
      const nove = Object.entries(data || {}).map(([id, h]) => zprava(id, h)).filter(Boolean);
      let pridano = 0;
      for (const z of nove) if (!zz.has(z.id)) { zz.set(z.id, z); pridano += 1; }
      if (nove.length <= STRANKA || !pridano) this.uplne.add(k);
    } catch { /* příště */ } finally {
      this.nacita.delete(k);
      this._oznam();
    }
  }

  // pro hledání: všechny konverzace celé
  async nactiVse() {
    const klice = new Set([...Object.keys(this.schranka).filter((k) => this.schranka[k]?.id), ...this.zpravy.keys()]);
    for (const k of klice) {
      if (!this.zpravy.has(k)) await this.otevri(k);
      let pokusu = 200;
      while (this.maStarsi(k) && pokusu-- > 0) await this.nactiStarsi(k);
    }
  }

  historieUplna() {
    return Object.keys(this.schranka).filter((k) => this.schranka[k]?.id).every((k) => this.uplne.has(k));
  }

  // zprávy obsahující všechna slova (bez diakritiky, i v názvech odkazů), nejnovější první
  hledej(dotaz, limit = 200) {
    const slova = normalizujHledani(dotaz).split(" ").filter(Boolean);
    if (!slova.length) return [];
    const vysledky = [];
    for (const [k, zz] of this.zpravy) {
      for (const z of zz.values()) {
        const text = normalizujHledani([z.text, ...(z.odkazy || []).map((o) => o.nazev)].join(" "));
        if (slova.every((s) => text.includes(s))) vysledky.push([k, z]);
      }
    }
    vysledky.sort((a, b) => b[1].cas - a[1].cas || (a[1].id < b[1].id ? 1 : -1));
    return vysledky.slice(0, limit);
  }

  async oznacPrectene(k) {
    const cas = Math.max(0, ...this.seznam(k).filter((z) => !("ceka" in z)).map((z) => z.cas),
      this.schranka[k]?.cas || 0);
    if (cas <= (this.prectene[k] || 0)) return;
    this.prectene[k] = cas;
    this._oznam();
    try { await this.oblak.zapis(`prectene/${this.ja}`, { [k]: cas }); } catch { /* příště */ }
  }

  async _prijemci(k) {
    let prijemci;
    if (k === TYM) {
      if (!this._clenove || Date.now() - this._clenove.cas > 60000) {
        const clenove = await this.oblak.cti("clenove");
        this._clenove = { cas: Date.now(), id: Object.values(clenove || {}).map((c) => c?.id).filter(Boolean) };
      }
      prijemci = new Set(this._clenove.id);
    } else {
      prijemci = new Set(k.split("~"));
    }
    prijemci.add(this.ja);
    return prijemci;
  }

  // odkazy = soubory / složky / celý projekt ({cesta, nazev, slozka, projekt, typ}) – zpráva je i bez vzkazu;
  // odpoved = zpráva, na kterou se odpovídá
  async posli(k, text, odkazy = null, odpoved = null) {
    odkazy = (zprava("x", { text: "x", cas: 0, odkazy: odkazy || [] })?.odkazy || []).map((o) => {
      const c = { cesta: o.cesta, nazev: o.nazev, slozka: o.slozka, projekt: o.projekt };
      if (o.typ) c.typ = o.typ;
      return c;
    });
    text = String(text || "").trim().slice(0, MAX_DELKA) || (odkazy.length ? `📎 ${odkazy.map((o) => o.nazev).join(", ")}` : "");
    if (!text) return;
    const id = noveId();
    const zz = this.zpravy.get(k) || new Map();
    this.zpravy.set(k, zz);
    const z = { id, od: this.ja, text, cas: Date.now(), ceka: true, ...(odkazy.length ? { odkazy } : {}),
      ...(odpoved?.id ? { odpoved: citace(odpoved) } : {}) };
    zz.set(id, z);
    this.koncepty.delete(k);
    this._oznam();
    await this._odesli(k, z);
  }

  async _odesli(k, z) {
    const zz = this.zpravy.get(k);
    try {
      const prijemci = await this._prijemci(k);
      const telo = { [`zpravy/${k}/${z.id}`]: { od: this.ja, text: z.text, cas: CAS_SERVERU,
        ...(z.odkazy ? { odkazy: z.odkazy } : {}), ...(z.odpoved ? { odpoved: z.odpoved } : {}) } };
      const meta = { cas: CAS_SERVERU, od: this.ja, id: z.id, text: z.text.slice(0, 140) };
      for (const p of prijemci) telo[`schranka/${p}/${k}`] = meta;
      await this.oblak.zapis("", telo);
      zz.get(z.id).ceka = false;
      delete zz.get(z.id).chyba;
      await this._dotahni(k, true);
    } catch (e) {
      if (zz.get(z.id)) zz.get(z.id).chyba = true;
      this._oznam();
      throw e;
    }
  }

  async zkusZnovu(k, id) {
    const z = this.zpravy.get(k)?.get(id);
    if (!z?.chyba) return;
    delete z.chyba;
    z.ceka = true;
    this._oznam();
    await this._odesli(k, z);
  }

  zahod(k, id) {
    const z = this.zpravy.get(k)?.get(id);
    if (!z || !("ceka" in z) || z.ceka === false) return;
    this.zpravy.get(k).delete(id);
    this._oznam();
  }

  // reakce: stejná podruhé = odebrat, jiná = vyměnit; signál do schránek účastníků
  async reaguj(k, id, emoji) {
    const z = this.zpravy.get(k)?.get(id);
    if (!z || "ceka" in z) return;
    const mapa = this.reakce.get(k) || new Map();
    this.reakce.set(k, mapa);
    const r = { ...(mapa.get(id) || {}) };
    const puvodni = r[this.ja] ?? null;
    const nova = puvodni === emoji ? null : emoji;
    if (nova) r[this.ja] = nova; else delete r[this.ja];
    mapa.set(id, r);
    this._oznam();
    try {
      const telo = { [`reakce/${k}/${id}/${this.ja}`]: nova, [`reakce/${k}/${id}/cas`]: CAS_SERVERU };
      for (const p of await this._prijemci(k)) telo[`schranka/${p}/${k}/reakce`] = CAS_SERVERU;
      await this.oblak.zapis("", telo);
    } catch (e) {
      const zpet = { ...(mapa.get(id) || {}) };
      if (puvodni) zpet[this.ja] = puvodni; else delete zpet[this.ja];
      mapa.set(id, zpet);
      this._oznam();
      throw e;
    }
  }

  async _dotahniReakce(k, signal = 0) {
    const od = this.reakceCas[k];
    try {
      const data = await this.oblak.cti(`reakce/${k}`, od ? { orderBy: '"cas"', startAt: String(od) } : {});
      const mapa = this.reakce.get(k) || new Map();
      this.reakce.set(k, mapa);
      let nejnovejsi = od || 0;
      for (const [id, h] of Object.entries(data || {})) {
        const r = reakceUzlu(h);
        if (Object.keys(r).length) mapa.set(id, r); else mapa.delete(id);
        if (typeof h?.cas === "number") nejnovejsi = Math.max(nejnovejsi, h.cas);
      }
      this.reakceCas[k] = nejnovejsi;
      this.reakceSignal[k] = Math.max(signal || 0, this.reakceSignal[k] || 0);
      this._oznam();
    } catch {
      this.reakceCas[k] ??= 0;   // pravidla reakce zatím neznají – zprávy fungují dál
    }
  }
}
