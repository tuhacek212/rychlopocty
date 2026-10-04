// Vzhled jako v programu: motiv (konstanty.MOTIVY přes CSS proměnné v app.css), řádek projektu
// v seznamu vlevo (dialogy.ProjektDelegate), záhlaví projektu (dialogy.texty_zahlavi), relativní
// texty termínů (data.relativni_text) a drobnosti (avatar, odznak stavu, „před 2 dny“).

import { NEAKTIVNI, STATUS_BARVY, dnes, jeHotovo, najdiDatumy, popisRozsahu, rozsah, zIso } from "./data.js";
import { h } from "./ui.js";

// --- motiv (svetly | tmavy | system) – stejné osobní nastavení „motiv“ jako v programu --------------
const KLIC_MOTIVU = "ild-motiv";

export function nastavMotiv(motiv) {
  if (!["svetly", "tmavy", "system"].includes(motiv)) motiv = "svetly";
  document.documentElement.dataset.motiv = motiv;
  try { window.localStorage.setItem(KLIC_MOTIVU, motiv); } catch { /* nic */ }
  const tmavy = motiv === "tmavy" || (motiv === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", tmavy ? "#181818" : "#F8F8F8");
  return motiv;
}

// před přihlášením: motiv z minula (žádné bliknutí světlé plochy u tmavého motivu)
export function motivZMinula() {
  let motiv = "svetly";
  try { motiv = window.localStorage.getItem(KLIC_MOTIVU) || "svetly"; } catch { /* nic */ }
  return nastavMotiv(motiv);
}

// --- texty ------------------------------------------------------------------------------------------
export const sklonuj = (n, jeden, dva, pet) => `${n} ${n === 1 ? jeden : n >= 2 && n <= 4 ? dva : pet}`;
export const pocetDniText = (n) => sklonuj(n, "den", "dny", "dní");
const MESICE_ZKR = ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"];
export const mesicZkratka = (d) => MESICE_ZKR[d.getMonth()];
export const DNY_ZKR = ["po", "út", "st", "čt", "pá", "so", "ne"];
export const DNY_CELE = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"];
export const denTydne = (d) => (d.getDay() + 6) % 7;

// data.relativni_text → [text, CSS barva]
export function relativniText(z, k, dnesek = zIso(dnes())) {
  if (z <= dnesek && dnesek <= k) return [+z !== +k ? "probíhá" : "dnes", "var(--c-primary-dark)"];
  const den = 86400000;
  if (k < dnesek) {
    const n = Math.round((dnesek - k) / den);
    return [n > 1 ? `před ${pocetDniText(n)}` : "včera", "var(--c-danger)"];
  }
  const n = Math.round((z - dnesek) / den);
  if (n === 1) return ["zítra", "var(--c-warning)"];
  if (n <= 7) return [`za ${pocetDniText(n)}`, "var(--c-warning)"];
  return [`za ${pocetDniText(n)}`, "var(--c-muted)"];
}

// data.cas_hezky: „dnes 14:20“, „včera 9:05“, „3. 10. 2026  16:40“
export function casHezky(cas) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/.exec(String(cas || ""));
  if (!m) return String(cas || "");
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const dnesek = zIso(dnes());
  if (+d === +dnesek) return `dnes ${m[4]}`;
  if (Math.round((dnesek - d) / 86400000) === 1) return `včera ${m[4]}`;
  return `${+m[3]}. ${+m[2]}. ${m[1]}  ${m[4]}`;
}

// data.den_hezky (záznam bez času – proběhlé termíny v historii)
export function denHezky(cas) {
  const d = zIso(String(cas || "").slice(0, 10));
  if (!d) return String(cas || "");
  const dnesek = zIso(dnes());
  if (+d === +dnesek) return "dnes";
  if (Math.round((dnesek - d) / 86400000) === 1) return "včera";
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

export function cisloTydne(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - denTydne(d));
  const prvni = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - prvni) / 86400000 - 3 + denTydne(prvni)) / 7);
}

// --- projekty ---------------------------------------------------------------------------------------
export const otevreneUkoly = (p) => (Array.isArray(p?.ukoly) ? p.ukoly : []).filter((u) => u && typeof u === "object" && !u.hotovo);

// data.nejblizsi_termin → [pol, z, k] | null
export function nejblizsiTermin(p, dnesek = zIso(dnes())) {
  let nej = null;
  for (const pol of Array.isArray(p?.harmonogram) ? p.harmonogram : []) {
    const rz = rozsah(pol);
    if (!rz || rz[1] < dnesek || jeHotovo(pol)) continue;
    if (!nej || rz[0] < nej[1] || (+rz[0] === +nej[1] && rz[1] < nej[2])) nej = [pol, rz[0], rz[1]];
  }
  return nej;
}

// terminy.upozorneni_projektu – termíny harmonogramu a data z poznámek v nejbližších dnech
export function upozorneniProjektu(p, dni = 1, dnesek = zIso(dnes())) {
  const konec = new Date(dnesek.getFullYear(), dnesek.getMonth(), dnesek.getDate() + Math.max(0, dni));
  const vysledek = [];
  for (const krok of Array.isArray(p?.harmonogram) ? p.harmonogram : []) {
    const d = zIso(String(krok?.datum || "").trim());
    if (d && d >= dnesek && d <= konec) vysledek.push({ datum: d, text: krok.nazev || "Termín harmonogramu" });
  }
  for (const pozn of Array.isArray(p?.poznamky) ? p.poznamky : []) {
    for (const datum of najdiDatumy(String(pozn?.text || ""))) {
      const d = zIso(datum);
      if (d && d >= dnesek && d <= konec) vysledek.push({ datum: d, text: pozn.text });
    }
  }
  return vysledek;
}

export function statusKratka(status) {
  const mapa = { poptávka: "P", poptavka: "P", nabídka: "P", nabidka: "P", realizace: "R", realizováno: "O", realizovano: "O",
    hotovo: "O", mrtvé: "M", mrtve: "M", pozastaveno: "M" };
  const s = String(status || "").trim();
  return mapa[s.toLowerCase()] || (s ? s[0].toUpperCase() : "");
}

// barevný čtvereček s písmenem stavu (vzhled.nakresli_odznak_statusu)
export function odznakStavu(status, velikost = 20) {
  return h("span", { class: "odznak-stavu", "aria-hidden": "true", text: statusKratka(status) || "?",
    style: { background: STATUS_BARVY[status] || "var(--c-faint)", "--v": `${velikost}px` } });
}

// --- zobrazení seznamu a záhlaví (konstanty.normalizuj_zobrazeni / radky_zobrazeni) -----------------
export const POLE_SEZNAMU = { lokalita: "Lokalita", investor: "Investor", nazev: "Název projektu", cislo: "Číslo zakázky",
  provozni: "Provozní soubor", termin: "Nejbližší termín" };

const zobrazeni = (poradi, prvni = 1, zbytek = "spolu", stav = true) => ({
  pole: [...poradi.map((k) => [k, true]), ...Object.keys(POLE_SEZNAMU).filter((k) => !poradi.includes(k)).map((k) => [k, false])],
  prvni_radek: prvni, zbytek, stav, hustota: "standardni" });

export const PREDVOLBY_SEZNAMU = {
  "Lokalita → název · investor": zobrazeni(["lokalita", "nazev", "investor"]),
  "Investor → název · lokalita": zobrazeni(["investor", "nazev", "lokalita"]),
  "Lokalita · investor → název": zobrazeni(["lokalita", "investor", "nazev"], 2),
  "Lokalita → název → investor": zobrazeni(["lokalita", "nazev", "investor"], 1, "zvlast"),
  "Investor → lokalita → název": zobrazeni(["investor", "lokalita", "nazev"], 1, "zvlast"),
  "Název → lokalita · investor": zobrazeni(["nazev", "lokalita", "investor"]),
  "Jeden řádek: lokalita · investor · název": zobrazeni(["lokalita", "investor", "nazev"], 3),
  "Jeden řádek: lokalita · název": zobrazeni(["lokalita", "nazev"], 2),
};
export const VYCHOZI_ZOBRAZENI = "Lokalita → název · investor";

const zahlavi = (poradi, prvni = 1, zbytek = "spolu") => ({ ...zobrazeni(poradi, prvni, zbytek), stav: false });
export const PREDVOLBY_ZAHLAVI = {
  "Název → číslo · lokalita · investor · provozní soubor": zahlavi(["nazev", "cislo", "lokalita", "investor", "provozni"]),
  "Lokalita · název → číslo · investor": zahlavi(["lokalita", "nazev", "cislo", "investor"], 2),
  "Číslo · název → lokalita · investor": zahlavi(["cislo", "nazev", "lokalita", "investor"], 2),
  "Lokalita → název · číslo · investor": zahlavi(["lokalita", "nazev", "cislo", "investor"]),
  "Název → lokalita → investor → číslo": zahlavi(["nazev", "lokalita", "investor", "cislo"], 1, "zvlast"),
  "Jen nadpis: lokalita · název · číslo": zahlavi(["lokalita", "nazev", "cislo"], 3),
};
export const VYCHOZI_ZAHLAVI = "Název → číslo · lokalita · investor · provozní soubor";

export function normalizujZobrazeni(z) {
  const vychozi = PREDVOLBY_SEZNAMU[VYCHOZI_ZOBRAZENI];
  if (!z || typeof z !== "object") z = vychozi;
  let pole = [];
  for (const p of Array.isArray(z.pole) ? z.pole : []) {
    if (Array.isArray(p) && p.length === 2 && p[0] in POLE_SEZNAMU && !pole.some((x) => x[0] === p[0])) pole.push([p[0], !!p[1]]);
  }
  pole.push(...Object.keys(POLE_SEZNAMU).filter((k) => !pole.some((x) => x[0] === k)).map((k) => [k, false]));
  if (!pole.some(([, zap]) => zap)) pole = vychozi.pole.map((p) => [...p]);
  const prvni = Math.max(1, parseInt(z.prvni_radek, 10) || 1);
  return { pole, prvni_radek: prvni, zbytek: z.zbytek === "zvlast" ? "zvlast" : "spolu", stav: z.stav !== false,
    hustota: z.hustota === "usporne" ? "usporne" : "standardni" };
}

export function normalizujZahlavi(z) {
  return { ...normalizujZobrazeni(z && typeof z === "object" ? z : PREDVOLBY_ZAHLAVI[VYCHOZI_ZAHLAVI]), stav: false, hustota: "standardni" };
}

export function radkyZobrazeni(z) {
  const zapnuta = z.pole.filter(([, zap]) => zap).map(([k]) => k);
  if (z.hustota === "usporne") return [zapnuta];
  const radky = [zapnuta.slice(0, z.prvni_radek)];
  const zbytek = zapnuta.slice(z.prvni_radek);
  if (zbytek.length) radky.push(...(z.zbytek === "spolu" ? [zbytek] : zbytek.map((k) => [k])));
  return radky;
}

function hodnotaPole(p, pole) {
  if (pole === "termin") {
    const n = nejblizsiTermin(p);
    if (!n) return ["", null];
    const [text, barva] = relativniText(n[1], n[2]);
    return [`${text} · ${n[0].nazev || ""}`, barva === "var(--c-muted)" ? null : barva];
  }
  if (pole === "provozni") return [String(p.provozni_soubor || p.provozni_cel || "").trim(), null];
  return [String(p[pole] || "").trim(), null];
}

// dialogy.texty_zahlavi → [nadpis, [řádky]]
export function textyZahlavi(p, zobr) {
  const radky = radkyZobrazeni(normalizujZahlavi(zobr));
  const hodnota = (pole, vNadpisu) => {
    const [text] = hodnotaPole(p, pole);
    return pole === "cislo" && text && !vNadpisu ? `Zakázka ${text}` : text;
  };
  const nadpis = radky[0].map((k) => hodnota(k, true)).filter(Boolean).join(" · ");
  const pod = radky.slice(1).map((r) => r.map((k) => hodnota(k, false)).filter(Boolean).join("  ·  ")).filter(Boolean);
  return [nadpis || String(p.nazev || "").trim() || "Projekt", pod];
}

// --- řádek projektu v seznamu vlevo (ProjektDelegate) ---------------------------------------------
const ZASTUPNE = { lokalita: "bez lokality", investor: "bez investora", nazev: "bez názvu", cislo: "bez čísla",
  provozni: "bez provozního souboru", termin: "bez termínu" };

export function radekProjektu(p, zobr, { vybrany = false, dniUpozorneni = 1, upozorneni = true } = {}) {
  const usporne = zobr.hustota === "usporne";
  const radky = radkyZobrazeni(zobr);
  const zvlast = zobr.zbytek === "zvlast";
  const neaktivni = NEAKTIVNI.has(p.status);
  const prvniRadek = h("div", { class: "pr-radek prvni" });
  const obsah = [];
  radky.forEach((pole, i) => {
    const prvni = i === 0;
    const el = prvni ? prvniRadek : h("div", { class: "pr-radek" });
    let segmentu = 0;
    pole.forEach((klic, j) => {
      let [text, barva] = hodnotaPole(p, klic);
      let zastupny = false;
      if (!text) {
        if ((prvni && j === 0) || (zvlast && !prvni)) { text = ZASTUPNE[klic]; zastupny = true; } else return;
      }
      // barva jako na prvním řádku jen u prvního pole úsporného řádku (ProjektDelegate._segmenty_radku)
      const r = prvni && (!usporne || !segmentu) ? "r1" : "r2";
      const pismo = usporne ? (segmentu ? "f-uspor2" : "f-uspor") : prvni ? (segmentu ? "f-hlavni2" : "f-hlavni")
        : klic === "lokalita" ? "f-radek-b" : "f-radek";
      if (segmentu) el.append(h("span", { class: "pr-tecka", text: "·" }));
      el.append(h("span", { class: `pr-pole pr-${klic} ${r} ${pismo}${segmentu ? " dalsi" : ""}${zastupny ? " zastupne" : ""}${neaktivni && ["nazev", "investor", "provozni"].includes(klic) ? " neaktivni" : ""}`,
        text, style: barva && !zastupny ? { color: barva } : null }));
      segmentu++;
    });
    obsah.push(el);
  });
  const ukoly = otevreneUkoly(p).length;
  const znacky = h("span", { class: "pr-znacky" },
    ukoly ? h("span", { class: "pr-ukoly", title: null }, h("i", { class: "pr-policko" }), ukoly < 100 ? String(ukoly) : "99+") : null,
    upozorneni && upozorneniProjektu(p, dniUpozorneni).length ? h("i", { class: "pr-upozorneni" }) : null);
  prvniRadek.append(znacky);
  return h("div", { class: `projekt-radek${usporne ? " usporne" : ""}${vybrany ? " vybrany" : ""}`, dataset: { id: p.id } },
    zobr.stav ? odznakStavu(p.status, usporne ? 15 : 20) : null, h("div", { class: "pr-texty" }, obsah));
}

// tooltip řádku projektu (HlavniOkno._tip_projektu)
export function tipProjektu(p, dniUpozorneni = 1) {
  const tip = [p.nazev || ""];
  for (const [popisek, k] of [["Číslo", "cislo"], ["Lokalita", "lokalita"], ["Investor", "investor"]]) if (p[k]) tip.push(`${popisek}: ${p[k]}`);
  tip.push(`Stav: ${p.status || ""}`);
  const n = otevreneUkoly(p).length;
  if (n) tip.push(`Úkoly: ${n} otevřen${n === 1 ? "ý" : n < 5 ? "é" : "ých"}`);
  const upoz = upozorneniProjektu(p, dniUpozorneni);
  if (upoz.length) tip.push("Blíží se: " + upoz.map((u) => `${u.datum.getDate()}. ${u.datum.getMonth() + 1}. ${u.datum.getFullYear()} – ${u.text}`).join("; "));
  return tip.join("\n");
}

// --- uživatelé: kolečko s iniciálami (uzivatele.barva / zkratka) ----------------------------------
const BARVY_UZIVATELU = ["#2E90FA", "#7A5AF8", "#EE46BC", "#F79009", "#12B76A", "#0BA5EC", "#F04438", "#00A991", "#667085", "#B54708"];

export function barvaUzivatele(u) {
  if (!u) return BARVY_UZIVATELU[BARVY_UZIVATELU.length - 2];
  if (BARVY_UZIVATELU.includes(u.barva)) return u.barva;
  let soucet = 0;
  for (const z of String(u.id || u.jmeno || "")) soucet += z.codePointAt(0);
  return BARVY_UZIVATELU[soucet % BARVY_UZIVATELU.length];
}

export function zkratkaJmena(jmeno) {
  const casti = String(jmeno || "").replace(/\./g, " ").split(/\s+/).filter(Boolean);
  if (casti.length >= 2) return (casti[0][0] + casti[casti.length - 1][0]).toUpperCase();
  return casti.length ? casti[0].slice(0, 2).toUpperCase() : "?";
}

export function avatar(u, velikost = 24, jmeno = "") {
  const text = u?.jmeno || jmeno;
  return h("span", { class: "avatar", text: zkratkaJmena(text), "aria-hidden": "true",
    style: { background: barvaUzivatele(u || { id: jmeno, jmeno }), "--v": `${velikost}px` } });
}

// --- historie projektu s proběhlými termíny (data.historie_s_udalostmi) ----------------------------
export function historieSUdalostmi(p, dnesek = zIso(dnes())) {
  const zmeny = (Array.isArray(p?.historie) ? p.historie : []).filter((z) => z && typeof z === "object").slice().reverse();
  const udalosti = [];
  for (const pol of Array.isArray(p?.harmonogram) ? p.harmonogram : []) {
    const rz = rozsah(pol);
    if (!rz || rz[0] > dnesek) continue;
    const [z, k] = rz;
    const nazev = pol.nazev || "Termín";
    const text = k < dnesek ? `Proběhlo: ${nazev}${+z !== +k ? ` (${popisRozsahu(z, k)})` : ""}`
      : +z === +k ? `Dnes: ${nazev}` : `Probíhá: ${nazev} (${popisRozsahu(z, k)})`;
    const iso = `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`;
    udalosti.push({ cas: `${iso} 00:00`, text, udalost: true, pol, id: pol.id });
  }
  return [...zmeny, ...udalosti].sort((a, b) => String(b.cas || "").localeCompare(String(a.cas || "")));
}
