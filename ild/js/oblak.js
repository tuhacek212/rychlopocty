// Spojení s Firebase (Realtime Database + Authentication) přes REST – stejně jako ild/oblak.py.
// Žádná knihovna třetí strany: méně kódu, který může něco prozradit, a přísná CSP.
// Přístup k datům hlídají pravidla databáze (oblak.PRAVIDLA) – co tady jde, jde i v programu.

export const KONFIGURACE = {
  apiKey: "AIzaSyD-XAaTsQNj5jDT9hreBYySMOF2ltoWqu4",
  databaseURL: "https://ild-5c958-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ild-5c958",
};

const UCTY = "https://identitytoolkit.googleapis.com/v1/accounts:";
const TOKENY = "https://securetoken.googleapis.com/v1/token";
const KLIC_RELACE = "ild-relace";

export class ChybaOblaku extends Error {
  constructor(text, druh = "jine") {
    super(text);
    this.druh = druh; // sit | prihlaseni | pristup | jine
  }
}

const CHYBY_UCTU = {
  INVALID_LOGIN_CREDENTIALS: "Nesprávné přihlašovací jméno nebo heslo.",
  INVALID_PASSWORD: "Nesprávné přihlašovací jméno nebo heslo.",
  EMAIL_NOT_FOUND: "Nesprávné přihlašovací jméno nebo heslo.",
  USER_DISABLED: "Účet je zablokovaný – ozvi se správci.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Příliš mnoho pokusů. Zkus to za chvíli znovu.",
  TOKEN_EXPIRED: "Přihlášení vypršelo – přihlas se znovu.",
  INVALID_REFRESH_TOKEN: "Přihlášení vypršelo – přihlas se znovu.",
  USER_NOT_FOUND: "Účet už neexistuje – přihlas se znovu.",
};

// --- stejné výpočty jako v programu (oblak.heslo_uctu, otisk_prihlaseni, klic_do_db) -----------

async function sha256hex(text) {
  const otisk = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(otisk)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function bezDiakritiky(text) {
  return String(text ?? "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
}

export async function hesloUctu(ucet, heslo) {
  return "ild1:" + (await sha256hex(`${ucet.trim().toLowerCase()}\n${heslo}`));
}

export async function otiskPrihlaseni(text) {
  const jmeno = bezDiakritiky(text).split(/\s+/).filter(Boolean).join(" ");
  return (await sha256hex("ild:" + jmeno)).slice(0, 40);
}

export function klicDoDb(klic) {
  return [...klic].map((z) => (/[.$#[\]/%\x00-\x1f\x7f]/.test(z)
    ? "%" + z.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0") : z)).join("");
}

export function klicZDb(klic) {
  try { return decodeURIComponent(klic); } catch { return klic; }
}

// --- uložené přihlášení: obnovovací token (sessionStorage, nebo localStorage při „zůstat přihlášen“) ---

function uloziste(trvale) {
  try { return trvale ? window.localStorage : window.sessionStorage; } catch { return null; }
}

function nactiRelaci() {
  for (const trvale of [false, true]) {
    try {
      const text = uloziste(trvale)?.getItem(KLIC_RELACE);
      if (text) return { ...JSON.parse(text), trvale };
    } catch { /* poškozené / zakázané úložiště = nepřihlášen */ }
  }
  return null;
}

function ulozRelaci(relace) {
  for (const trvale of [false, true]) {
    try { uloziste(trvale)?.removeItem(KLIC_RELACE); } catch { /* nic */ }
  }
  if (!relace) return;
  const { uid, obnovovaci, id, trvale } = relace;
  try { uloziste(trvale)?.setItem(KLIC_RELACE, JSON.stringify({ uid, obnovovaci, id })); } catch { /* nic */ }
}

// --- klient ---------------------------------------------------------------------------------

export class Oblak {
  constructor(konfig = KONFIGURACE) {
    this.konfig = konfig;
    this.relace = null;       // {uid, obnovovaci, id, trvale}
    this.token = "";
    this.platiDo = 0;
    this._obnova = null;
    this.priOdhlaseni = null;  // zavolá se, když přihlášení přestane platit
  }

  async _pozadavek(url, volby, druhChyby = "jine") {
    let odpoved;
    try {
      odpoved = await fetch(url, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", ...volby });
    } catch {
      throw new ChybaOblaku("Bez spojení se serverem.", "sit");
    }
    let telo = null;
    try { telo = await odpoved.json(); } catch { telo = null; }
    if (odpoved.ok) return telo;
    if (druhChyby === "ucet") {
      const kod = String(telo?.error?.message || "").split(" ")[0];
      throw new ChybaOblaku(CHYBY_UCTU[kod] || "Přihlášení se nepovedlo.", "prihlaseni");
    }
    if (odpoved.status === 401 || odpoved.status === 403) {
      throw new ChybaOblaku("Server požadavek odmítl.", "pristup");
    }
    throw new ChybaOblaku(`Chyba serveru (${odpoved.status}).`, odpoved.status >= 500 ? "sit" : "jine");
  }

  _ucty(akce, telo) {
    return this._pozadavek(`${UCTY}${akce}?key=${encodeURIComponent(this.konfig.apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(telo),
    }, "ucet");
  }

  url(cesta, dotaz = {}, token = this.token) {
    const parametry = new URLSearchParams();
    if (token) parametry.set("auth", token);
    for (const [k, v] of Object.entries(dotaz)) parametry.set(k, typeof v === "string" ? v : JSON.stringify(v));
    const c = String(cesta).split("/").filter(Boolean).map(encodeURIComponent).join("/");
    return `${this.konfig.databaseURL}/${c}.json?${parametry}`;
  }

  // přihlášení

  async prihlas(jmeno, heslo, zapamatovat) {
    const mapa = await this._pozadavek(this.url(`prihlaseni/${await otiskPrihlaseni(jmeno)}`, {}, ""), {});
    const ucet = mapa && typeof mapa.ucet === "string" ? mapa.ucet : "";
    if (!ucet) throw new ChybaOblaku("Nesprávné přihlašovací jméno nebo heslo.", "prihlaseni");
    const d = await this._ucty("signInWithPassword", {
      email: ucet, password: await hesloUctu(ucet, heslo), returnSecureToken: true,
    });
    this.token = d.idToken;
    this.platiDo = Date.now() + (Number(d.expiresIn) || 3600) * 1000;
    const clen = await this.cti(`clenove/${d.localId}`);
    if (!clen || !clen.id) {
      this.token = "";
      throw new ChybaOblaku("Účet není aktivní – ozvi se správci.", "prihlaseni");
    }
    this.relace = { uid: d.localId, obnovovaci: d.refreshToken, id: clen.id, trvale: !!zapamatovat };
    ulozRelaci(this.relace);
    return clen;
  }

  // přihlášení z minula (obnovovací token) → člen {id, role}, nebo null
  async obnovRelaci() {
    const relace = nactiRelaci();
    if (!relace?.obnovovaci || !relace.uid) return null;
    this.relace = relace;
    try {
      await this._obnovToken();
      const clen = await this.cti(`clenove/${relace.uid}`);
      if (!clen || !clen.id) throw new ChybaOblaku("Účet není aktivní.", "prihlaseni");
      this.relace.id = clen.id;
      return clen;
    } catch (e) {
      if (e.druh !== "sit") this.odhlas();
      throw e;
    }
  }

  odhlas() {
    this.relace = null;
    this.token = "";
    this.platiDo = 0;
    ulozRelaci(null);
  }

  async _obnovToken() {
    if (!this.relace) throw new ChybaOblaku("Nejsi přihlášený.", "prihlaseni");
    if (!this._obnova) {
      this._obnova = (async () => {
        const telo = new URLSearchParams({ grant_type: "refresh_token", refresh_token: this.relace.obnovovaci });
        const d = await this._pozadavek(`${TOKENY}?key=${encodeURIComponent(this.konfig.apiKey)}`, {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: telo,
        }, "ucet");
        this.token = d.id_token;
        this.platiDo = Date.now() + (Number(d.expires_in) || 3600) * 1000;
        if (d.refresh_token && d.refresh_token !== this.relace.obnovovaci) {
          this.relace.obnovovaci = d.refresh_token;
          ulozRelaci(this.relace);
        }
      })().finally(() => { this._obnova = null; });
    }
    try {
      await this._obnova;
    } catch (e) {
      if (e.druh === "prihlaseni") {
        this.odhlas();
        this.priOdhlaseni?.(e.message);
      }
      throw e;
    }
  }

  async platnyToken() {
    if (!this.token || Date.now() > this.platiDo - 120000) await this._obnovToken();
    return this.token;
  }

  // databáze

  async cti(cesta, dotaz = {}) {
    if (this.relace) await this.platnyToken();
    return this._pozadavek(this.url(cesta, dotaz), {});
  }

  async zapis(cesta, data, metoda = "PATCH") {
    await this.platnyToken();
    return this._pozadavek(this.url(cesta), {
      method: metoda, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
  }

  // Živé sledování cesty (SSE). naUdalost(udalost, {path, data}); vrátí funkci, která sledování ukončí.
  // Token platí hodinu – při „auth_revoked“ / výpadku se spojení naváže znovu s čerstvým.
  sleduj(cesta, naUdalost, naStav = () => {}) {
    let zdroj = null;
    let konec = false;
    let cekani = 1000;
    let casovac = 0;
    const pripoj = async () => {
      if (konec) return;
      try {
        await this.platnyToken();
      } catch (e) {
        naStav(false);
        if (e.druh === "sit") casovac = setTimeout(pripoj, cekani = Math.min(cekani * 2, 60000));
        return;
      }
      zdroj = new EventSource(this.url(cesta));
      const zpracuj = (udalost) => (ev) => {
        cekani = 1000;
        naStav(true);
        try { naUdalost(udalost, JSON.parse(ev.data)); } catch { /* vadná událost */ }
      };
      zdroj.addEventListener("put", zpracuj("put"));
      zdroj.addEventListener("patch", zpracuj("patch"));
      zdroj.addEventListener("keep-alive", () => naStav(true));
      const znovu = () => {
        zdroj?.close();
        zdroj = null;
        naStav(false);
        if (!konec) casovac = setTimeout(pripoj, cekani = Math.min(cekani * 2, 60000));
      };
      zdroj.addEventListener("auth_revoked", () => { this.platiDo = 0; cekani = 500; znovu(); });
      zdroj.addEventListener("cancel", () => { konec = true; zdroj?.close(); naStav(false); });
      zdroj.onerror = () => { this.platiDo = 0; znovu(); };   // mohl vypršet token – vezme se čerstvý
    };
    pripoj();
    return () => { konec = true; clearTimeout(casovac); zdroj?.close(); };
  }
}
