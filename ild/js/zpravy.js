// Rychlé zprávy – stejná data jako ild/zpravy.py:
//   zpravy/<k>/<id> = {od, text, cas (čas serveru), odkazy?}
//   schranka/<já>/<k> = poslední zpráva konverzace (živě sledovaná), prectene/<já>/<k> = čas přečtení

const TYM = "tym";
const MAX_DELKA = 4000;
const NACIST = 300;
const CAS_SERVERU = { ".sv": "timestamp" };

export { TYM };

export const konverzaceS = (a, b) => [a, b].sort().join("~");

export function protejsek(k, ja) {
  if (k === TYM) return null;
  const lide = k.split("~");
  return lide.find((x) => x !== ja) ?? ja;
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
  return z;
}

export class Posta {
  constructor(oblak, ja) {
    this.oblak = oblak;
    this.ja = ja;
    this.schranka = {};   // k → {cas, od, id, text}
    this.prectene = {};   // k → čas
    this.zpravy = new Map(); // k → Map(id → zpráva)
    this.posluchaci = new Set();
    this._konec = null;
  }

  pri(f) { this.posluchaci.add(f); return () => this.posluchaci.delete(f); }
  _oznam() { this.posluchaci.forEach((f) => f()); }

  async spust() {
    try {
      const p = await this.oblak.cti(`prectene/${this.ja}`);
      if (p && typeof p === "object") this.prectene = p;
    } catch { /* bez přečtených */ }
    this._konec = this.oblak.sleduj(`schranka/${this.ja}`, (udalost, obsah) => {
      const cesta = String(obsah.path || "/").split("/").filter(Boolean);
      if (!cesta.length) {
        if (udalost === "put") this.schranka = {};
        Object.assign(this.schranka, obsah.data && typeof obsah.data === "object" ? obsah.data : {});
      } else if (cesta.length === 1) {
        if (obsah.data && typeof obsah.data === "object") this.schranka[cesta[0]] = obsah.data;
      } else if (cesta.length === 2) {
        (this.schranka[cesta[0]] ||= {})[cesta[1]] = obsah.data;
      }
      for (const k of this.zpravy.keys()) this._dotahni(k);
      this._oznam();
    });
  }

  zastav() { this._konec?.(); }

  neprecteno(k) {
    const m = this.schranka[k];
    return !!m && m.od !== this.ja && typeof m.cas === "number" && m.cas > (this.prectene[k] || 0);
  }

  pocetNeprectenych() { return Object.keys(this.schranka).filter((k) => this.neprecteno(k)).length; }

  seznam(k) {
    return [...(this.zpravy.get(k)?.values() || [])].sort((a, b) => a.cas - b.cas || (a.id < b.id ? -1 : 1));
  }

  async otevri(k) {
    if (!this.zpravy.has(k)) this.zpravy.set(k, new Map());
    await this._dotahni(k, true);
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
      for (const [id, h] of Object.entries(data || {})) {
        const z = zprava(id, h);
        if (z) zz.set(id, z);
      }
      this._oznam();
    } catch { /* příště */ }
  }

  async oznacPrectene(k) {
    const cas = Math.max(0, ...this.seznam(k).filter((z) => !("ceka" in z)).map((z) => z.cas),
      this.schranka[k]?.cas || 0);
    if (cas <= (this.prectene[k] || 0)) return;
    this.prectene[k] = cas;
    this._oznam();
    try { await this.oblak.zapis(`prectene/${this.ja}`, { [k]: cas }); } catch { /* příště */ }
  }

  // odkazy = soubory / složky / celý projekt ({cesta, nazev, slozka, projekt, typ}) – zpráva je i bez vzkazu
  async posli(k, text, odkazy = null) {
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
    zz.set(id, { id, od: this.ja, text, cas: Date.now(), ceka: true, ...(odkazy.length ? { odkazy } : {}) });
    this._oznam();
    let prijemci;
    if (k === TYM) {
      const clenove = await this.oblak.cti("clenove");
      prijemci = new Set(Object.values(clenove || {}).map((c) => c?.id).filter(Boolean));
    } else {
      prijemci = new Set(k.split("~"));
    }
    prijemci.add(this.ja);
    const telo = { [`zpravy/${k}/${id}`]: { od: this.ja, text, cas: CAS_SERVERU, ...(odkazy.length ? { odkazy } : {}) } };
    const meta = { cas: CAS_SERVERU, od: this.ja, id, text: text.slice(0, 140) };
    for (const p of prijemci) telo[`schranka/${p}/${k}`] = meta;
    try {
      await this.oblak.zapis("", telo);
      zz.get(id).ceka = false;
      await this._dotahni(k, true);
    } catch (e) {
      zz.get(id).chyba = true;
      this._oznam();
      throw e;
    }
  }
}
