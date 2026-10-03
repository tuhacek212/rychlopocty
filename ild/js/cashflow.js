// Cashflow zakázky (jen R a O) – jako cashflow.py v programu: dlaždice, graf po měsících, faktury
// (přidat, upravit, stav, duplikovat, smazat s vrácením), cena zakázky a měna, report pro vedení
// (PDF / Excel / Tisk). Každá změna jde do historie projektu stejným textem jako v programu.

import { datumKratce, dnes, iso, nazevProjektu, pridejDny, rozsah, zIso, popisRozsahu } from "./data.js";
import * as F from "./finance.js";
import { rozmery, segment, strana, tiskni } from "./export.js";
import { h, ikona, menu, okno, oznam, pole, vymen } from "./ui.js";
import { stahni, vytvorXlsx } from "./xlsx.js";

const NS = "http://www.w3.org/2000/svg";
const kolator = new Intl.Collator("cs");
const datumT = (d) => (d ? datumKratce(d, true) : "—");
const dnesD = () => zIso(dnes());

function s(tag, atributy = {}, ...deti) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(atributy)) if (v != null) el.setAttribute(k, String(v));
  for (const d of deti.flat(Infinity)) if (d != null && d !== false) el.append(d instanceof Node ? d : document.createTextNode(String(d)));
  return el;
}

const BARVY_STAVU = { po_splatnosti: "var(--nebezpeci)", nevyfakturovano: "#B54708", uhrazena: "var(--ild)", plan: "var(--tiche)" };

export function popisAkceStavu(f, stav) {
  const prijem = F.jePrijem(f);
  return { [F.VYSTAVENA]: prijem ? "Označit jako vystavenou" : "Označit jako přijatou",
    [F.UHRAZENA]: prijem ? "Označit jako uhrazenou" : "Označit jako zaplacenou", [F.PLAN]: "Vrátit do plánu" }[stav] || "";
}

// --- graf (report.nakresli_graf): příjmy nahoru, výdaje dolů, výhled světleji, čára salda ---------------

export function graf(mesice, mena, { sirka = 860, vyska = 230, tisk = false } = {}) {
  if (!mesice.length) return null;
  const hodnoty = [0];
  for (const m of mesice) hodnoty.push(m.prijmy + m.prijmy_vyhled, -(m.vydaje + m.vydaje_vyhled), m.zustatek);
  const osa = F.osaHodnot(Math.min(...hodnoty), Math.max(...hodnoty));
  const dolni = osa[0], horni = osa[osa.length - 1];
  const levy = 62, nahore = 26, dole = 24;
  const g = { x: levy, y: nahore, w: sirka - levy - 6, h: vyska - nahore - dole };
  const y = (v) => g.y + g.h - ((v - dolni) / (horni - dolni)) * g.h;
  const sl = g.w / mesice.length;
  const barvy = tisk ? { text: "#1d2939", seda: "#667085", mrizka: "#e4e7ec", nula: "#98a2b3", aktualni: "#eef2ea" }
    : { text: "var(--text)", seda: "var(--tiche)", mrizka: "var(--cara)", nula: "var(--tiche)", aktualni: "var(--ild-svetla)" };
  const tento = iso(new Date(dnesD().getFullYear(), dnesD().getMonth(), 1));
  const prvky = [];
  // legenda
  const legenda = [[F.C_PRIJEM, "Příjmy", 1], [F.C_PRIJEM, "očekávané", 0.4], [F.C_VYDAJ, "Výdaje", 1], [F.C_VYDAJ, "očekávané", 0.4]];
  let lx = levy;
  for (const [b, t, o] of legenda) {
    prvky.push(s("rect", { x: lx, y: 4, width: 10, height: 10, fill: b, "fill-opacity": o, rx: 2 }),
      s("text", { x: lx + 14, y: 13, "font-size": 11, fill: barvy.seda }, t));
    lx += 22 + t.length * 6.2;
  }
  prvky.push(s("line", { x1: lx, y1: 9, x2: lx + 14, y2: 9, stroke: barvy.text, "stroke-width": 2 }),
    s("text", { x: lx + 18, y: 13, "font-size": 11, fill: barvy.seda }, "Saldo zakázky"));
  mesice.forEach((m, i) => {
    if (iso(m.mesic) === tento) prvky.push(s("rect", { x: g.x + i * sl, y: g.y, width: sl, height: g.h, fill: barvy.aktualni }));
  });
  for (const v of osa) {
    const yy = y(v);
    prvky.push(s("line", { x1: g.x, y1: yy, x2: g.x + g.w, y2: yy, stroke: Math.abs(v) < 1e-9 ? barvy.nula : barvy.mrizka, "stroke-width": 1 }),
      s("text", { x: levy - 6, y: yy + 4, "text-anchor": "end", "font-size": 10.5, fill: barvy.seda }, F.kratkaCastka(v)));
  }
  const sirkaSloupce = Math.min(sl * 0.58, 60);
  const body = [];
  mesice.forEach((m, i) => {
    const x = g.x + i * sl + sl / 2 - sirkaSloupce / 2;
    for (const [zaklad, hodnota, b, o] of [[0, m.prijmy, F.C_PRIJEM, 1], [m.prijmy, m.prijmy_vyhled, F.C_PRIJEM, 0.4],
      [0, -m.vydaje, F.C_VYDAJ, 1], [-m.vydaje, -m.vydaje_vyhled, F.C_VYDAJ, 0.4]]) {
      if (Math.abs(hodnota) < 0.005) continue;
      const y1 = y(zaklad), y2 = y(zaklad + hodnota);
      prvky.push(s("rect", { x, y: Math.min(y1, y2), width: sirkaSloupce, height: Math.max(1, Math.abs(y2 - y1)), fill: b, "fill-opacity": o },
        s("title", {}, `${F.popisMesice(m.mesic, false)}\nPřijato: ${F.formatujCastku(m.prijmy, mena)}\nZaplaceno: ${F.formatujCastku(m.vydaje, mena)}\nOčekávané příjmy: ${F.formatujCastku(m.prijmy_vyhled, mena)}\nOčekávané výdaje: ${F.formatujCastku(m.vydaje_vyhled, mena)}\nSaldo na konci měsíce: ${F.formatujCastku(m.zustatek, mena, false, true)}`)));
    }
    body.push([g.x + i * sl + sl / 2, y(m.zustatek)]);
  });
  if (body.length > 1) prvky.push(s("polyline", { points: body.map((b) => b.join(",")).join(" "), fill: "none", stroke: barvy.text, "stroke-width": 2, "stroke-linejoin": "round" }));
  for (const [bx, by] of body) prvky.push(s("circle", { cx: bx, cy: by, r: 2.6, fill: barvy.text }));
  let krok = 1;
  while (krok < mesice.length && sl * krok < 34) krok++;
  mesice.forEach((m, i) => {
    if (i % krok) return;
    const t = m.mesic.getMonth() === 0 || i === 0 ? F.popisMesice(m.mesic) : F.popisMesice(m.mesic).split(" ")[0];
    prvky.push(s("text", { x: g.x + i * sl + sl / 2, y: vyska - 6, "text-anchor": "middle", "font-size": 10.5, fill: barvy.seda }, t));
  });
  return s("svg", { viewBox: `0 0 ${sirka} ${vyska}`, class: "graf-cashflow", role: "img", "aria-label": "Příjmy a výdaje po měsících" }, prvky);
}

// --- pohled Cashflow (Harmonogram → Cashflow) ------------------------------------------------------

export class Cashflow {
  constructor({ tym, projektId, naKalendar = () => {} }) {
    this.tym = tym;
    this.pid = projektId;
    this.naKalendar = naKalendar;
    this.filtr = "vse";
    this.razeni = ["datum", 1];
    this.dlazdice = h("div", { class: "cf-dlazdice" });
    this.grafObal = h("div", { class: "karta cf-graf" });
    this.pocet = h("span", { class: "tiche male" });
    this.seznam = h("div", { class: "tabulka-obal" });
    const seg = segment([["vse", "Vše"], [F.VYDANA, "Vydané"], [F.PRIJATA, "Přijaté"]], "vse", (v) => { this.filtr = v; this.obnov(); });
    this.el = h("div", { class: "cashflow" },
      h("div", { class: "cf-lista" },
        h("div", { class: "mezera" }),
        h("button", { type: "button", class: "tlacitko male", onclick: () => otevriReport({ tym, projektId }) }, ikona("export"), "Report pro vedení")),
      this.dlazdice, this.grafObal,
      h("section", { class: "karta" },
        h("div", { class: "karta-hlavicka cf-hlavicka" }, h("h2", { text: "Faktury" }), seg, this.pocet, h("div", { class: "mezera" }),
          h("button", { type: "button", class: "tlacitko male", onclick: () => dialogFaktury(tym, projektId, null, { typ: F.VYDANA }) }, ikona("plus"), "Vydaná faktura"),
          h("button", { type: "button", class: "tlacitko male", onclick: () => dialogFaktury(tym, projektId, null, { typ: F.PRIJATA }) }, ikona("plus"), "Přijatá faktura")),
        this.seznam));
    this.obnov();
  }

  obnov() {
    const p = this.tym.projekt(this.pid);
    if (!p) return;
    const d = dnesD();
    const so = F.souhrn(p, d);
    const m = so.mena;
    const c = (x, z = false) => F.formatujCastku(x, m, false, z);
    const tile = (nazev, hodnota, radky, { klik = null, barva = "", podil = null, tip = "" } = {}) => h(klik ? "button" : "div",
      { type: klik ? "button" : null, class: `cf-tile${klik ? " klikaci" : ""}`, onclick: klik, title: tip || null },
      h("small", { text: nazev }), h("strong", { text: hodnota, style: barva ? { color: barva } : null }),
      podil != null ? h("span", { class: "cf-podil" }, h("i", { style: { width: `${Math.max(0, Math.min(100, podil * 100))}%` } })) : null,
      radky.filter(Boolean).map(([t, trida]) => h("span", { class: `cf-pod ${trida || ""}`, text: t })));
    const radkyCeny = so.cena ? [[F.zbyvaVyfakturovat(so) > 0.5 ? `zbývá vyfakturovat ${c(F.zbyvaVyfakturovat(so))}` : "vyfakturováno celé"],
      so.nenaplanovano > 0.5 ? [`bez plánu fakturace ${c(so.nenaplanovano)}`, "varovani"] : null] : [["Zadat cenu", "odkaz-text"]];
    const casti = [];
    if (F.podilVyfakturovano(so) != null) casti.push(`${Math.round(F.podilVyfakturovano(so) * 100)} % ceny`);
    if (so.planovano) casti.push(`v plánu ${c(so.planovano)}`);
    const nakl = [`zaplaceno ${c(so.zaplaceno)}`];
    if (so.zavazky) nakl.push(`k úhradě ${c(so.zavazky)}`);
    vymen(this.dlazdice,
      tile("Cena zakázky", so.cena ? c(so.cena) : "nezadaná", radkyCeny, { klik: () => dialogCeny(this.tym, this.pid), barva: so.cena ? "" : "var(--tiche)", tip: "Cena zakázky a měna" }),
      tile("Vyfakturováno", c(so.vyfakturovano), [[casti.join(" · ")], so.nevyfakturovano ? [`nevyfakturováno ${c(so.nevyfakturovano)}`, "varovani"] : null],
        { podil: F.podilVyfakturovano(so), tip: "Vydané faktury – vystavené i uhrazené" }),
      tile("Uhrazeno", c(so.prijato), [[`čeká na úhradu ${c(so.pohledavky)}`], so.po_splatnosti ? [`po splatnosti ${c(so.po_splatnosti)}`, "chyba-text"] : null], { tip: "Co od odběratele přišlo" }),
      tile("Náklady", c(so.naklady), [[nakl.join(" · ")], so.naklady_plan ? [`očekávané ${c(so.naklady_plan)}`] : null,
        so.zavazky_po_splatnosti ? [`po splatnosti ${c(so.zavazky_po_splatnosti)}`, "chyba-text"] : null], { tip: "Přijaté faktury – došlé i zaplacené" }),
      tile("Saldo", c(F.saldo(so), true), [[`očekávaný výsledek ${c(F.vysledek(so), true)}`]],
        { barva: F.saldo(so) > 0.5 ? F.C_PRIJEM : F.saldo(so) < -0.5 ? "var(--nebezpeci)" : "", tip: "Co přišlo minus co odešlo (uhrazené faktury). Záporné = zakázku zatím financuje firma." }));
    const mesice = F.mesiceGrafu([p], d, m);
    vymen(this.grafObal, mesice.length ? graf(mesice, m) : null);
    this.grafObal.hidden = !mesice.length;

    const vsechny = F.platne(p);
    const vydanych = vsechny.filter(F.jePrijem).length;
    this.pocet.textContent = vsechny.length ? `${vydanych} ${vydanych === 1 ? "vydaná" : vydanych >= 2 && vydanych <= 4 ? "vydané" : "vydaných"} · ${vsechny.length - vydanych} ${vsechny.length - vydanych === 1 ? "přijatá" : vsechny.length - vydanych >= 2 && vsechny.length - vydanych <= 4 ? "přijaté" : "přijatých"}` : "";
    const radky = vsechny.filter((f) => this.filtr === "vse" || F.typ(f) === this.filtr).map((f) => {
      const [kod, text] = F.stavKDatu(f, p, d);
      return { f, kod, text: kod === "po_splatnosti" ? `${text} (${F.dniPoSplatnosti(f, p, d)} d)` : text, datum: F.datum(f, p), splatnost: F.splatnost(f, p) };
    });
    const [klic, smer] = this.razeni;
    const PORADI_STAVU = ["po_splatnosti", "nevyfakturovano", "ceka", "plan", "uhrazena"];
    const hodnota = (r) => ({ datum: r.datum ? +r.datum : Infinity, faktura: F.nazev(r.f).toLowerCase(), firma: (r.f.firma || "").toLowerCase(),
      cislo: r.f.cislo || "", castka: F.jePrijem(r.f) ? F.castka(r.f) : -F.castka(r.f), splatnost: r.splatnost ? +r.splatnost : Infinity,
      stav: PORADI_STAVU.indexOf(r.kod) })[klic];
    radky.sort((a, b) => { const x = hodnota(a), y = hodnota(b); return (x < y ? -1 : x > y ? 1 : 0) * smer; });
    const hlavicka = [["", ""], ["datum", "Datum"], ["faktura", "Faktura"], ["firma", "Odběratel / dodavatel"], ["cislo", "Číslo"],
      ["castka", "Částka"], ["splatnost", "Splatnost"], ["stav", "Stav"], ["", ""]];
    vymen(this.seznam, vsechny.length ? h("table", { class: "tabulka faktury" },
      h("thead", {}, h("tr", {}, hlavicka.map(([k, t]) => h("th", { class: k === "castka" ? "vpravo" : "",
        onclick: k ? () => { this.razeni = [k, this.razeni[0] === k ? -this.razeni[1] : 1]; this.obnov(); } : null },
      t, k && klic === k ? (smer > 0 ? " ▲" : " ▼") : "")))),
      h("tbody", {}, radky.map((r) => {
        const f = r.f, prijem = F.jePrijem(f), t = F.termin(f, p);
        const otevrit = () => dialogFaktury(this.tym, this.pid, f.id);
        return h("tr", { class: `${F.stav(f) === F.PLAN ? "plan" : ""}`, onclick: otevrit,
          oncontextmenu: (ev) => { ev.preventDefault(); menuFaktury(ev.clientX, ev.clientY, this.tym, this.pid, f.id, this.naKalendar); } },
        h("td", {}, h("i", { class: "tecka", style: { background: prijem ? F.C_PRIJEM : F.C_VYDAJ }, title: prijem ? "Vydaná faktura – příjem" : "Přijatá faktura – výdaj" })),
        h("td", { text: datumT(r.datum), title: t && F.stav(f) === F.PLAN ? `Po termínu „${t.nazev || ""}“ – posouvá se s ním` : null }),
        h("td", { class: "cf-nazev", text: F.nazev(f), title: [F.nazev(f), t ? `Termín: ${t.nazev || ""}` : "", f.poznamka || ""].filter(Boolean).join("\n") }),
        h("td", { text: f.firma || "" }), h("td", { text: f.cislo || "" }),
        h("td", { class: "vpravo", style: { color: prijem ? F.C_PRIJEM : F.C_VYDAJ }, text: F.formatujCastku(prijem ? F.castka(f) : -F.castka(f), F.menaProjektu(p), true) }),
        h("td", { text: datumT(r.splatnost) }),
        h("td", { class: ["po_splatnosti", "nevyfakturovano"].includes(r.kod) ? "tucne" : "", style: { color: BARVY_STAVU[r.kod] || "" },
          text: (r.kod === "uhrazena" ? "✓ " : "") + r.text }),
        h("td", {}, h("button", { type: "button", class: "ikonove male", "aria-label": "Akce s fakturou",
          onclick: (ev) => { ev.stopPropagation(); const b = ev.currentTarget.getBoundingClientRect(); menuFaktury(b.left, b.bottom, this.tym, this.pid, f.id, this.naKalendar); } }, "⋯")));
      }))) : h("p", { class: "tiche", text: "Zatím tu nejsou žádné faktury." }));
  }
}

// --- změny faktur -------------------------------------------------------------------------------

function zmenFaktury(tym, pid, zmena, text) {
  return tym.upravProjekt(pid, (p) => {
    if (!Array.isArray(p.faktury)) p.faktury = [];
    return zmena(p);
  }, text);
}

export async function nastavStav(tym, pid, fid, novy) {
  const p = tym.projekt(pid);
  const f0 = F.najdi(p, fid);
  if (!f0 || F.stav(f0) === novy) return;
  let text = "";
  try {
    await zmenFaktury(tym, pid, (pp) => {
      const f = F.najdi(pp, fid);
      if (!f) return false;
      const prijem = F.jePrijem(f);
      F.nastavStav(f, pp, novy, dnesD());
      text = `${{ [F.PLAN]: "Faktura vrácena do plánu", [F.VYSTAVENA]: prijem ? "Faktura vystavena" : "Faktura přijata",
        [F.UHRAZENA]: prijem ? "Faktura uhrazena" : "Faktura zaplacena" }[novy]}: ${F.popis(f, pp)}`;
    }, () => text);
    oznam(text.split(":")[0]);
  } catch (e) { oznam(e?.message || "Nepovedlo se.", true); }
}

async function smazFakturu(tym, pid, fid) {
  let index = -1, smazana = null, popis = "";
  try {
    await zmenFaktury(tym, pid, (p) => {
      index = p.faktury.findIndex((f) => f && f.id === fid);
      if (index < 0) return false;
      smazana = p.faktury.splice(index, 1)[0];
      popis = F.popis(smazana, p);
    }, () => `Smazána faktura: ${popis}`);
  } catch (e) { oznam(e?.message || "Nepovedlo se.", true); return; }
  if (!smazana) return;
  oznam(`Faktura „${F.nazev(smazana)}“ smazána`, false, { text: "Vrátit", fn: () => zmenFaktury(tym, pid, (p) => {
    if (F.najdi(p, smazana.id)) return false;
    p.faktury.splice(Math.min(index, p.faktury.length), 0, smazana);
  }, () => `Obnovena faktura: ${popis}`).catch((e) => oznam(e?.message || "Nepovedlo se.", true)) });
}

function duplikuj(tym, pid, fid) {
  const p = tym.projekt(pid);
  const f = F.najdi(p, fid);
  if (!f) return;
  const udaje = {};
  for (const k of ["typ", "nazev", "castka", "datum", "splatnost_dni", "stav", "uhrazeno", "cislo", "firma", "poznamka", "termin"]) if (k in f) udaje[k] = f[k];
  Object.assign(udaje, { nazev: `${F.nazev(f)} (kopie)`, stav: F.PLAN, uhrazeno: "", cislo: "", datum: iso(F.datum(f, p) || dnesD()) });
  const nova = F.novaFaktura(udaje);
  zmenFaktury(tym, pid, (pp) => { pp.faktury.push(nova); },
    () => `Přidána ${F.jePrijem(nova) ? "vydaná" : "přijatá"} faktura: ${F.popis(nova, tym.projekt(pid))}`)
    .then(() => oznam("Faktura zkopírována")).catch((e) => oznam(e?.message || "Nepovedlo se.", true));
}

export function menuFaktury(x, y, tym, pid, fid, naKalendar = null) {
  const p = tym.projekt(pid);
  const f = F.najdi(p, fid);
  if (!f) return;
  const st = F.stav(f);
  menu(x, y, [
    { nadpis: F.nazev(f) },
    { text: "Upravit…", ikona: "upravit", akce: () => dialogFaktury(tym, pid, fid) },
    st === F.PLAN ? { text: popisAkceStavu(f, F.VYSTAVENA), ikona: "hotovo", akce: () => nastavStav(tym, pid, fid, F.VYSTAVENA) } : null,
    st !== F.UHRAZENA ? { text: popisAkceStavu(f, F.UHRAZENA), ikona: "hotovo", akce: () => nastavStav(tym, pid, fid, F.UHRAZENA) }
      : { text: "Zrušit úhradu", akce: () => nastavStav(tym, pid, fid, F.VYSTAVENA) },
    naKalendar && F.pruhFaktury(f, p) ? { text: "Ukázat v kalendáři", ikona: "kalendar", akce: () => naKalendar(fid) } : null,
    { text: "Duplikovat", ikona: "kopirovat", akce: () => duplikuj(tym, pid, fid) },
    "-",
    { text: "Smazat", ikona: "smazat", nebezpecne: true, akce: () => smazFakturu(tym, pid, fid) },
  ]);
}

// --- dialog faktury (cashflow.DialogFaktury) -----------------------------------------------------

export function dialogFaktury(tym, pid, fid = null, { typ = F.VYDANA, datum = null, termin = "" } = {}) {
  const p = tym.projekt(pid);
  if (!p) return;
  const f0 = fid ? F.najdi(p, fid) : null;
  if (fid && !f0) { oznam("Faktura už neexistuje.", true); return; }
  const nova = !f0;
  const f = { ...(f0 || {}) };
  let typF = f0 ? F.typ(f) : (typ in F.TYPY ? typ : F.VYDANA);
  let dni = f0 ? F.splatnostDni(f) : F.VYCHOZI_SPLATNOST;
  const cena = F.cenaZakazky(p);
  const mena = F.menaProjektu(p);
  const navazany = nova ? F.termin({ termin }, p) : null;

  const nazev = h("input", { value: f.nazev || (navazany && typF === F.VYDANA ? `Fakturace – ${navazany.nazev || "termín"}` : ""), maxlength: 200 });
  const castka = h("input", { value: f0 ? String(F.castka(f)).replace(".", ",") : "", inputmode: "decimal", placeholder: "350 000, 1,2 mil, 30 %" });
  const napoveda = h("small", { class: "tiche" });
  const firma = h("input", { value: f0 ? f.firma || "" : typF === F.VYDANA ? p.investor || "" : "", list: "cf-firmy", maxlength: 200 });
  const firmyList = h("datalist", { id: "cf-firmy" }, F.firmy(tym.projekty).map((j) => h("option", { value: j })));
  const terminSel = h("select", {}, h("option", { value: "", text: "— nenavazuje —" }),
    (Array.isArray(p.harmonogram) ? p.harmonogram : []).filter((t) => t && t.id).sort((a, b) => ((rozsah(a)?.[0] || Infinity) - (rozsah(b)?.[0] || Infinity)))
      .map((t) => { const rz = rozsah(t); return h("option", { value: t.id, text: `${t.nazev || "Termín"} – ${rz ? popisRozsahu(...rz) : "bez data"}` }); }));
  if (f.termin && ![...terminSel.options].some((o) => o.value === f.termin)) terminSel.append(h("option", { value: f.termin, text: "— termín byl smazán —" }));
  terminSel.value = f.termin || termin || "";
  const datumIn = h("input", { type: "date" });
  const splatnostIn = h("input", { type: "date" });
  const dniText = h("small", { class: "tiche" });
  const podleTerminu = h("small", { class: "tiche" });
  const uhrazenoIn = h("input", { type: "date", value: iso(F.uhrazeno(f) || dnesD()) });
  const cislo = h("input", { value: f.cislo || "", placeholder: "nepovinné", maxlength: 60 });
  const poznamka = h("input", { value: f.poznamka || "", placeholder: "nepovinné", maxlength: 500 });
  let stavF = f0 ? F.stav(f) : typF === F.VYDANA ? F.PLAN : F.VYSTAVENA;
  let stavRucne = false;
  const stavObal = h("div");
  const nadpis = h("p", { class: "tiche", text: nazevProjektu(p) });
  const typObal = h("div");

  const vychoziDatum = f0 ? F.datum(f, p) || dnesD() : (() => { const t = F.termin({ termin }, p); const rz = t ? rozsah(t) : null; return rz ? rz[1] : datum || dnesD(); })();
  datumIn.value = iso(vychoziDatum);
  splatnostIn.value = iso(pridejDny(vychoziDatum, dni));

  const pole2 = {};
  const datumPodleTerminu = () => {
    if (stavF !== F.PLAN) return null;
    const t = F.termin({ termin: terminSel.value }, p);
    const rz = t ? rozsah(t) : null;
    return rz ? rz[1] : null;
  };
  const prekresliStav = () => vymen(stavObal, segment(Object.entries(F.STAVY[typF]), stavF, (v) => { stavF = v; stavRucne = true; obnov(); }));
  const prekresliTyp = () => vymen(typObal, segment([[F.VYDANA, "Vydaná – příjem"], [F.PRIJATA, "Přijatá – výdaj"]], typF, (v) => {
    const stary = typF; typF = v;
    if (nova && v !== stary) {
      const investor = String(p.investor || "").trim();
      if (v === F.PRIJATA && firma.value.trim() === investor) firma.value = "";
      else if (v === F.VYDANA && !firma.value.trim()) firma.value = investor;
      if (!stavRucne) stavF = v === F.VYDANA ? F.PLAN : F.VYSTAVENA;
    }
    obnov();
  }));
  function obnovNapovedu() {
    const x = F.prectiCastku(castka.value, cena);
    if (castka.value.trim().endsWith("%") && !cena) { napoveda.textContent = "Procenta jdou jen se zadanou cenou zakázky."; napoveda.className = "chyba-text"; }
    else if (x != null && cena && typF === F.VYDANA) { napoveda.textContent = `${String(Math.round((x / cena) * 1000) / 10).replace(".", ",")} % ceny zakázky (${F.formatujCastku(cena, mena)})`; napoveda.className = "tiche"; }
    else napoveda.textContent = "";
  }
  function obnov() {
    const prijem = typF === F.VYDANA;
    prekresliTyp();
    prekresliStav();
    pole2.firma.firstChild.textContent = prijem ? "Odběratel" : "Dodavatel";
    pole2.termin.firstChild.textContent = prijem ? "Fakturovat po termínu" : "Navazuje na termín";
    pole2.datum.firstChild.textContent = stavF === F.PLAN ? (prijem ? "Kdy fakturovat" : "Kdy přijde") : (prijem ? "Datum vystavení" : "Datum faktury");
    pole2.uhrazeno.firstChild.textContent = prijem ? "Uhrazeno dne" : "Zaplaceno dne";
    pole2.uhrazeno.hidden = stavF !== F.UHRAZENA;
    nazev.placeholder = prijem ? "Např. Záloha 30 %, Konečná faktura" : "Např. Dodávka materiálu";
    const pt = datumPodleTerminu();
    if (pt && datumIn.value !== iso(pt)) { datumIn.value = iso(pt); splatnostIn.value = iso(pridejDny(pt, dni)); }
    datumIn.disabled = !!pt;
    podleTerminu.textContent = pt ? "den, kdy termín končí – posouvá se s ním" : "";
    dniText.textContent = `${dni} ${dni === 1 ? "den" : dni >= 2 && dni <= 4 ? "dny" : "dní"} od data faktury`;
    okenko.dialog.querySelector(".okno-hlavicka h2").textContent = nova ? (prijem ? "Nová vydaná faktura" : "Nová přijatá faktura") : "Upravit fakturu";
    obnovNapovedu();
  }
  castka.addEventListener("input", obnovNapovedu);
  terminSel.addEventListener("change", () => {
    const t = F.termin({ termin: terminSel.value }, p);
    if (nova && typF === F.VYDANA && !nazev.value.trim() && t) nazev.value = `Fakturace – ${t.nazev || ""}`;
    obnov();
  });
  datumIn.addEventListener("change", () => { const d = zIso(datumIn.value); if (d) splatnostIn.value = iso(pridejDny(d, dni)); obnov(); });
  splatnostIn.addEventListener("change", () => {
    const d = zIso(datumIn.value), sp = zIso(splatnostIn.value);
    if (d && sp) dni = Math.max(0, Math.round((sp - d) / 86400000));
    obnov();
  });
  const rychle = h("div", { class: "cf-rychle" }, [14, 30, 60].map((n) => h("button", { type: "button", class: "tlacitko male", text: `${n} d`,
    title: `Splatnost ${n} dní od data faktury`, onclick: () => { dni = n; const d = zIso(datumIn.value); if (d) splatnostIn.value = iso(pridejDny(d, n)); obnov(); } })));

  pole2.firma = pole("Odběratel", firma);
  pole2.termin = pole("Fakturovat po termínu", terminSel);
  pole2.datum = pole("Kdy fakturovat", datumIn);
  pole2.uhrazeno = pole("Uhrazeno dne", uhrazenoIn);
  const obsah = [nadpis, typObal, pole("Faktura", nazev),
    h("div", { class: "dve-pole" }, h("div", { class: "pole" }, h("span", { text: `Částka (${F.MENY[mena]} bez DPH)` }), castka, napoveda), pole2.firma),
    firmyList, pole2.termin,
    h("div", { class: "dve-pole" }, h("div", {}, pole2.datum, podleTerminu), h("div", { class: "pole" }, h("span", { text: "Splatnost" }), splatnostIn, rychle, dniText)),
    h("div", { class: "dve-pole" }, h("div", { class: "pole" }, h("span", { text: "Stav" }), stavObal), pole2.uhrazeno),
    h("div", { class: "dve-pole" }, pole("Číslo faktury", cislo), pole("Poznámka", poznamka))];
  const tlacitka = [
    nova ? null : { text: "Smazat", nebezpecne: true, akce: () => smazFakturu(tym, pid, fid) },
    { text: "Zrušit" },
    { text: "Uložit", hlavni: true, akce: async () => {
      const x = F.prectiCastku(castka.value, cena);
      if (x == null) { castka.focus(); throw new Error("Napiš částku – třeba 350 000, 1,2 mil nebo 30 %."); }
      const udaje = { typ: typF, nazev: nazev.value.trim(), castka: x, datum: datumIn.value, splatnost_dni: dni, stav: stavF,
        uhrazeno: stavF === F.UHRAZENA ? uhrazenoIn.value : "", cislo: cislo.value.trim(), firma: firma.value.trim(),
        poznamka: poznamka.value.trim(), termin: terminSel.value || "" };
      if (nova) {
        const nf = F.novaFaktura(udaje);
        await zmenFaktury(tym, pid, (pp) => { pp.faktury.push(nf); }, () => `Přidána ${F.jePrijem(nf) ? "vydaná" : "přijatá"} faktura: ${F.popis(nf, tym.projekt(pid))}`);
        oznam("Faktura přidána");
      } else {
        let text = "";
        await zmenFaktury(tym, pid, (pp) => {
          let ff = F.najdi(pp, fid);
          if (!ff) { ff = F.novaFaktura(udaje); pp.faktury.push(ff); text = `Přidána ${F.jePrijem(ff) ? "vydaná" : "přijatá"} faktura: ${F.popis(ff, pp)}`; return; }
          const pred = { ...ff };
          F.zapisUdaje(ff, udaje);
          const popis = F.popisZmen(pred, ff, pp);
          text = popis ? `Upravena faktura ${F.nazev(ff)}: ${popis}` : "";
          if (!popis) return false;
        }, () => text);
        oznam("Faktura uložena");
      }
    } },
  ].filter(Boolean);
  const okenko = okno(nova ? "Nová faktura" : "Upravit fakturu", obsah, tlacitka);
  okenko.dialog.classList.add("siroke-okno");
  obnov();
  (nazev.value.trim() ? castka : nazev).focus();
}

export function dialogCeny(tym, pid) {
  const p = tym.projekt(pid);
  if (!p) return;
  const cena = h("input", { value: F.cenaZakazky(p) != null ? String(F.cenaZakazky(p)).replace(".", ",") : "", placeholder: "nezadaná", inputmode: "decimal" });
  const mena = h("select", {}, Object.entries(F.MENY).map(([k, z]) => h("option", { value: k, text: `${z} (${k})`, selected: k === F.menaProjektu(p) })));
  okno("Cena zakázky", [h("p", { class: "tiche", text: nazevProjektu(p) }),
    h("div", { class: "dve-pole" }, pole("Cena podle smlouvy, bez DPH", cena), pole("Měna zakázky", mena))], [
    { text: "Zrušit" },
    { text: "Uložit", hlavni: true, akce: async () => {
      const x = cena.value.trim() ? F.prectiCastku(cena.value) : null;
      if (cena.value.trim() && x == null) throw new Error("Cenu nejde přečíst – napiš třeba 2 500 000 nebo 2,5 mil.");
      const zmeny = [];
      await tym.upravProjekt(pid, (pp) => {
        zmeny.length = 0;
        const nova = x ? Math.round(x * 100) / 100 : null;
        if (F.cenaZakazky(pp) !== nova) {
          if (nova) { pp.cena_zakazky = nova; zmeny.push(`cena zakázky ${F.formatujCastku(nova, mena.value)}`); }
          else { delete pp.cena_zakazky; zmeny.push("cena zakázky odebrána"); }
        }
        if (F.menaProjektu(pp) !== mena.value) {
          if (mena.value === F.VYCHOZI_MENA) delete pp.mena; else pp.mena = mena.value;
          zmeny.push(`měna ${F.MENY[mena.value]}`);
        }
        if (!zmeny.length) return false;
      }, () => `Cashflow: ${zmeny.join(", ")}`);
    } },
  ]);
}

// --- report pro vedení (cashflow.DialogReportu + report.SestavaCashflow) -----------------------------

export function otevriReport({ tym, projektId = "" }) {
  const p = { co: projektId || "", obdobi: "vyhled", format: "pdf", papir: "A4", naSirku: true, barvy: "barevne" };
  const co = h("select", { onchange: () => { p.co = co.value; obnov(); } },
    h("option", { value: "", text: "Všechny zakázky R a O" }),
    tym.projekty.filter(F.maCashflow).sort((a, b) => kolator.compare(nazevProjektu(a), nazevProjektu(b)))
      .map((x) => h("option", { value: x.id, text: nazevProjektu(x), selected: x.id === projektId })));
  const obd = h("select", { onchange: () => { p.obdobi = obd.value; obnov(); } }, Object.entries(F.OBDOBI).map(([k, t]) => h("option", { value: k, text: t, selected: k === p.obdobi })));
  const formatSeg = segment([["pdf", "PDF"], ["xlsx", "Excel"], ["tisk", "Tisk"]], p.format, (v) => { p.format = v; obnov(); });
  const barvySeg = segment([["barevne", "Barevně"], ["sede", "Černobíle"]], p.barvy, (v) => { p.barvy = v; obnov(); });
  const orientace = h("select", { onchange: () => { p.naSirku = orientace.value === "sirka"; obnov(); } },
    h("option", { value: "sirka", text: "Na šířku", selected: true }), h("option", { value: "vyska", text: "Na výšku" }));
  const hlavni = h("button", { type: "button", class: "tlacitko hlavni", onclick: () => proved() });
  const popisV = h("p", { class: "tiche male" });
  const nahled = h("div", { class: "nahled-stran" });
  const pocet = h("span", { class: "tiche male" });
  const dialog = h("dialog", { class: "okno export" }, h("div", { class: "export-rozlozeni" },
    h("div", { class: "export-formular" }, h("h2", { text: "Cashflow – report pro vedení" }),
      pole("Co", co), pole("Období grafu a měsíců", obd), h("p", { class: "tiche male", text: "Souhrn a faktury jsou vždy k dnešku. Částky bez DPH." }),
      pole("Orientace", orientace), h("div", { class: "pole" }, h("span", { text: "Barvy" }), barvySeg),
      h("div", { class: "mezera" }), popisV, h("div", { class: "pole" }, h("span", { text: "Výstup" }), formatSeg),
      h("div", { class: "export-tlacitka" }, h("button", { type: "button", class: "tlacitko", text: "Zavřít", onclick: () => zavri() }), hlavni)),
    h("div", { class: "export-nahled" }, h("div", { class: "export-nahled-hlavicka" }, h("strong", { text: "Náhled" }), pocet), nahled)));
  const zavri = () => { dialog.close(); dialog.remove(); };
  dialog.addEventListener("cancel", (ev) => { ev.preventDefault(); zavri(); });
  document.body.append(dialog);
  dialog.showModal();
  let strany = [];

  function data() {
    const projekty = p.co ? [tym.projekt(p.co)].filter(Boolean) : tym.projekty.filter(F.maCashflow);
    const [od, doo] = F.obdobi(p.obdobi, dnesD());
    const jeden = !!p.co;
    const proj = jeden ? projekty[0] : null;
    return { projekty, od, doo, jeden, nadpis: jeden ? `Cashflow – ${nazevProjektu(proj)}` : "Cashflow zakázek",
      podnadpis: jeden ? [proj?.cislo ? `Zakázka ${proj.cislo}` : "", proj?.investor || ""].filter(Boolean).join(" · ") : `${projekty.length} zakázek v realizaci a realizovaných` };
  }

  function obnov() {
    const d = data();
    strany = stranyReportu(tym, d, p);
    vymen(nahled, strany.map((st) => h("div", { class: "nahled-strana" }, st.cloneNode(true))));
    requestAnimationFrame(() => {
      const sirka = nahled.clientWidth - 24;
      const [w, v] = rozmery(p);
      for (const obal of nahled.children) {
        const k = Math.min(1, sirka / (w * 3.7795));
        obal.firstChild.style.transform = `scale(${k})`;
        obal.style.width = `${w * 3.7795 * k}px`;
        obal.style.height = `${v * 3.7795 * k}px`;
      }
    });
    pocet.textContent = `${strany.length} ${strany.length === 1 ? "stránka" : strany.length <= 4 ? "stránky" : "stran"}`;
    hlavni.replaceChildren({ pdf: "Uložit PDF…", xlsx: "Uložit Excel…", tisk: "Tisknout…" }[p.format]);
    popisV.textContent = p.format === "pdf" ? "PDF uloží tisk prohlížeče – v okně tisku zvol „Uložit jako PDF“."
      : p.format === "xlsx" ? "Excel: Souhrn, Po měsících, Faktury." : "";
  }

  function proved() {
    const d = data();
    const jmeno = `${d.nadpis} ${dnes()}`.replace(/[\\/:*?"<>|]/g, "-");
    if (p.format === "xlsx") {
      stahni(vytvorXlsx(listyReportu(d)), `${jmeno}.xlsx`);
      oznam("Excel uložen do Stažených souborů");
      return;
    }
    tiskni(strany, p, jmeno);
    if (p.format === "pdf") oznam("V okně tisku zvol „Uložit jako PDF“");
  }
  obnov();
}

function stranyReportu(tym, d, p) {
  const n = { ...p, nadpis: d.nadpis, podnadpis: d.podnadpis, od: d.od, do: d.doo, obdobiText: d.od ? "" : F.OBDOBI.vse };
  const bloky = [];
  const sDaty = d.projekty.filter((x) => F.platne(x).length || F.cenaZakazky(x) != null);
  for (const [mena, so] of Object.entries(F.souhrny(sDaty))) {
    const c = (x, z = false) => F.formatujCastku(x, mena, false, z);
    const podil = F.podilVyfakturovano(so);
    bloky.push(h("div", { class: "r-dlazdice" }, [
      [d.jeden ? "Cena zakázky" : "Cena zakázek", so.cena ? c(so.cena) : "—", so.cena ? `zbývá vyfakturovat ${c(F.zbyvaVyfakturovat(so))}` : ""],
      ["Vyfakturováno", c(so.vyfakturovano), `${podil != null ? `${Math.round(podil * 100)} % ceny · ` : ""}v plánu ${c(so.planovano)}`],
      ["Uhrazeno", c(so.prijato), `čeká na úhradu ${c(so.pohledavky)}`],
      ["Po splatnosti", c(so.po_splatnosti), so.nevyfakturovano ? `nevyfakturováno ${c(so.nevyfakturovano)}` : ""],
      ["Náklady", c(so.naklady), `zaplaceno ${c(so.zaplaceno)} · k úhradě ${c(so.zavazky)}`],
      ["Saldo", c(F.saldo(so), true), `očekávaný výsledek ${c(F.vysledek(so), true)}`],
    ].map(([t, v, pod]) => h("div", { class: "r-tile" }, h("small", { text: t }), h("strong", { text: v }), pod ? h("span", { text: pod }) : null))));
    const mesice = d.od ? F.poMesicich(sDaty, dnesD(), d.od, d.doo, mena) : F.poMesicich(sDaty, dnesD(), null, null, mena);
    if (mesice.length) {
      bloky.push(h("h3", { text: `Příjmy a výdaje po měsících (${F.MENY[mena]})` }));
      const gr = graf(mesice, mena, { sirka: 1000, vyska: 240, tisk: true });
      if (gr) bloky.push(h("div", { class: "r-graf" }, gr));
      bloky.push(tabulkaTisk(`Po měsících (${F.MENY[mena]})`, ["Měsíc", "Přijato", "Očekávané příjmy", "Zaplaceno", "Očekávané výdaje", "Rozdíl", d.jeden ? "Saldo zakázky" : "Saldo zakázek"],
        [...mesice.map((m) => [F.popisMesice(m.mesic, false), c(m.prijmy), c(m.prijmy_vyhled), c(m.vydaje), c(m.vydaje_vyhled),
          c(m.prijmy + m.prijmy_vyhled - m.vydaje - m.vydaje_vyhled, true), c(m.zustatek, true)]),
        ["Celkem za období", c(mesice.reduce((a, m) => a + m.prijmy, 0)), c(mesice.reduce((a, m) => a + m.prijmy_vyhled, 0)),
          c(mesice.reduce((a, m) => a + m.vydaje, 0)), c(mesice.reduce((a, m) => a + m.vydaje_vyhled, 0)), "", ""]], true));
    }
  }
  if (!d.jeden) {
    bloky.push(tabulkaTisk("Zakázky", ["Zakázka", "Stav", "Cena", "Vyfakturováno", "%", "Uhrazeno", "Pohledávky", "Po splatnosti", "Náklady", "Saldo", "Výsledek"],
      [...sDaty].sort((a, b) => (a.status !== "Realizace") - (b.status !== "Realizace") || kolator.compare(nazevProjektu(a), nazevProjektu(b))).map((x) => {
        const so = F.souhrn(x), m = so.mena, c = (v, z = false) => F.formatujCastku(v, m, false, z);
        return [nazevProjektu(x), x.status === "Realizace" ? "R" : "O", so.cena ? c(so.cena) : "—", c(so.vyfakturovano),
          F.podilVyfakturovano(so) != null ? `${Math.round(F.podilVyfakturovano(so) * 100)} %` : "", c(so.prijato), c(so.pohledavky),
          c(so.po_splatnosti), c(so.naklady), c(F.saldo(so), true), c(F.vysledek(so), true)];
      }), true));
    const bez = d.projekty.filter((x) => !sDaty.includes(x));
    if (bez.length) bloky.push(h("p", { class: "r-text", text: `Bez finančních údajů (${bez.length}): ${bez.map(nazevProjektu).join(", ")}` }));
    const ps = F.poSplatnosti(d.projekty);
    bloky.push(tabulkaTisk("Po splatnosti", ["Zakázka", "Faktura", "Odběratel / dodavatel", "Částka", "Splatnost", "Dní po splatnosti"],
      ps.length ? ps.map(([pp, f, dn]) => [nazevProjektu(pp), F.nazev(f), f.firma || "", F.formatujCastku(F.jePrijem(f) ? F.castka(f) : -F.castka(f), F.menaProjektu(pp), true), datumT(F.splatnost(f, pp)), String(dn)])
        : [["—", "Nic není po splatnosti.", "", "", "", ""]], true));
    const kf = F.kFakturaci(d.projekty);
    bloky.push(tabulkaTisk("K fakturaci v příštích 60 dnech", ["Zakázka", "Faktura", "Odběratel", "Částka", "Kdy fakturovat"],
      kf.length ? kf.map(([pp, f, dd]) => [nazevProjektu(pp), F.nazev(f), f.firma || "", F.formatujCastku(F.castka(f), F.menaProjektu(pp), true), datumT(dd)])
        : [["—", "Nic k fakturaci.", "", "", ""]], true));
  } else if (d.projekty[0]) {
    const pp = d.projekty[0], m = F.menaProjektu(pp);
    for (const prijem of [true, false]) {
      const seznam = F.platne(pp).filter((f) => F.jePrijem(f) === prijem).sort((a, b) => (F.datum(a, pp) || Infinity) - (F.datum(b, pp) || Infinity));
      bloky.push(tabulkaTisk(`${prijem ? "Vydané faktury – příjmy" : "Přijaté faktury – výdaje"} (${F.MENY[m]} bez DPH)`,
        ["Datum", "Faktura", prijem ? "Odběratel" : "Dodavatel", "Číslo", "Částka", "Splatnost", "Stav", prijem ? "Uhrazeno" : "Zaplaceno"],
        seznam.length ? [...seznam.map((f) => [datumT(F.datum(f, pp)), F.nazev(f), f.firma || "", f.cislo || "", F.formatujCastku(F.castka(f), "", true),
          datumT(F.splatnost(f, pp)), F.stavKDatu(f, pp)[1], datumT(F.uhrazeno(f))]),
        ["Celkem", "", "", "", F.formatujCastku(seznam.reduce((a, f) => a + F.castka(f), 0), "", true), "", "", ""]]
          : [["—", `Žádné ${prijem ? "vydané" : "přijaté"} faktury.`, "", "", "", "", "", ""]], true));
    }
  }
  // rozložení do stránek: odhad výšky bloků (mm)
  const [, vyska] = rozmery(p);
  const misto = vyska - 34;
  const vysky = (b) => b.classList.contains("r-dlazdice") ? 24 : b.classList.contains("r-graf") ? (p.naSirku ? 68 : 52)
    : b.tagName === "H3" ? 8 : b.classList.contains("r-text") ? 8 : 10 + (b.querySelectorAll("tr").length) * 5.2;
  const stranky = [[]];
  let zbyva = misto;
  for (const b of bloky) {
    let v = vysky(b);
    if (b.classList.contains("seznam-tisk") && v > misto) {
      // dlouhá tabulka se rozdělí po řádcích
      const radky = [...b.querySelectorAll("tbody tr")];
      const hlava = b.querySelector("thead");
      const nadpis = b.querySelector("h3")?.textContent || "";
      const naStranu = Math.floor((misto - 14) / 5.2);
      for (let i = 0; i < radky.length; i += naStranu) {
        const kus = h("div", { class: "seznam-tisk" }, h("h3", { text: i ? `${nadpis} (pokračování)` : nadpis }),
          h("table", { class: "cisla" }, hlava.cloneNode(true), h("tbody", {}, radky.slice(i, i + naStranu))));
        if (zbyva < 40) { stranky.push([]); zbyva = misto; }
        stranky[stranky.length - 1].push(kus);
        stranky.push([]);
        zbyva = misto;
      }
      continue;
    }
    if (v > zbyva && stranky[stranky.length - 1].length) { stranky.push([]); zbyva = misto; }
    stranky[stranky.length - 1].push(b);
    zbyva -= v;
  }
  const plne = stranky.filter((x) => x.length);
  return plne.map((obsah, i) => strana(n, h("div", { class: "report-obsah" }, obsah), i + 1, plne.length));
}

function tabulkaTisk(nadpis, sloupce, radky) {
  return h("div", { class: "seznam-tisk" }, h("h3", { text: nadpis }),
    h("table", { class: "cisla" }, h("thead", {}, h("tr", {}, sloupce.map((t) => h("th", { text: t })))),
      h("tbody", {}, radky.map((r) => h("tr", {}, r.map((x) => h("td", { text: x })))))));
}

function listyReportu(d) {
  const sDaty = d.projekty.filter((x) => F.platne(x).length || F.cenaZakazky(x) != null);
  const hl = (t) => ({ v: t, tucne: true, barva: "#EEF2EA", ramecek: true });
  const cislo = (x) => ({ v: Math.round(x * 100) / 100, ramecek: true });
  const souhrn = [[{ v: d.nadpis, tucne: true, velikost: 14 }], [d.podnadpis], [`Stav k ${datumKratce(dnesD(), true)} · částky bez DPH`], []];
  for (const [mena, so] of Object.entries(F.souhrny(sDaty))) {
    souhrn.push([{ v: `Měna ${F.MENY[mena]}`, tucne: true }]);
    for (const [t, x] of [["Cena", so.cena], ["Vyfakturováno", so.vyfakturovano], ["V plánu", so.planovano], ["Uhrazeno", so.prijato],
      ["Pohledávky", so.pohledavky], ["Po splatnosti", so.po_splatnosti], ["Náklady", so.naklady], ["Zaplaceno", so.zaplaceno],
      ["K úhradě", so.zavazky], ["Saldo", F.saldo(so)], ["Očekávaný výsledek", F.vysledek(so)]]) souhrn.push([{ v: t, ramecek: true }, cislo(x)]);
    souhrn.push([]);
  }
  if (!d.jeden) {
    souhrn.push(["Zakázka", "Stav", "Měna", "Cena", "Vyfakturováno", "Uhrazeno", "Pohledávky", "Po splatnosti", "Náklady", "Saldo", "Výsledek"].map(hl));
    for (const x of sDaty) {
      const so = F.souhrn(x);
      souhrn.push([{ v: nazevProjektu(x), ramecek: true }, { v: x.status, ramecek: true }, { v: so.mena, ramecek: true }, cislo(so.cena), cislo(so.vyfakturovano),
        cislo(so.prijato), cislo(so.pohledavky), cislo(so.po_splatnosti), cislo(so.naklady), cislo(F.saldo(so)), cislo(F.vysledek(so))]);
    }
  }
  const mesice = [["Měna", "Měsíc", "Přijato", "Očekávané příjmy", "Zaplaceno", "Očekávané výdaje", "Rozdíl", "Saldo"].map(hl)];
  for (const mena of Object.keys(F.souhrny(sDaty))) {
    const ms = d.od ? F.poMesicich(sDaty, dnesD(), d.od, d.doo, mena) : F.poMesicich(sDaty, dnesD(), null, null, mena);
    for (const m of ms) mesice.push([{ v: mena, ramecek: true }, { v: F.popisMesice(m.mesic, false), ramecek: true }, cislo(m.prijmy), cislo(m.prijmy_vyhled),
      cislo(m.vydaje), cislo(m.vydaje_vyhled), cislo(m.prijmy + m.prijmy_vyhled - m.vydaje - m.vydaje_vyhled), cislo(m.zustatek)]);
  }
  const faktury = [["Zakázka", "Typ", "Faktura", "Odběratel / dodavatel", "Číslo", "Částka", "Měna", "Datum", "Splatnost", "Stav", "Uhrazeno"].map(hl)];
  for (const x of d.projekty) for (const f of F.platne(x)) {
    faktury.push([nazevProjektu(x), F.jePrijem(f) ? "Vydaná" : "Přijatá", F.nazev(f), f.firma || "", f.cislo || ""].map((v) => ({ v, ramecek: true }))
      .concat([{ v: F.jePrijem(f) ? F.castka(f) : -F.castka(f), ramecek: true, pismo: F.jePrijem(f) ? F.C_PRIJEM : F.C_VYDAJ },
        { v: F.menaProjektu(x), ramecek: true }, { v: datumT(F.datum(f, x)), ramecek: true }, { v: datumT(F.splatnost(f, x)), ramecek: true },
        { v: F.stavKDatu(f, x)[1], ramecek: true }, { v: datumT(F.uhrazeno(f)), ramecek: true }]));
  }
  return [{ nazev: "Souhrn", radky: souhrn, sirky: [32, 16, 8, 16, 16, 16, 16, 16, 16, 16, 16], naSirku: true, naStranku: true },
    { nazev: "Po měsících", radky: mesice, sirky: [8, 18, 16, 18, 16, 18, 16, 16], ukotvit: 1, naSirku: true, naStranku: true },
    { nazev: "Faktury", radky: faktury, sirky: [26, 10, 32, 26, 14, 16, 8, 13, 13, 18, 13], ukotvit: 1, naSirku: true, naStranku: true }];
}
