// Správce projektů ILD – webová verze. Data týmu ve Firebase (stejná jako v programu),
// soubory projektů zůstávají v počítačích (web ukazuje cesty a otevírá je přes program).
// Rozvržení, vzhled a chování jsou převzaté z programu (okno.HlavniOkno): lišta aktivit vlevo,
// seznam projektů s hranou, obsah se záložkami a zelený stavový řádek dole.

import { ChybaOblaku, Oblak } from "./oblak.js";
import {
  BARVA_REALIZACE, BARVY_TERMINU, NEAKTIVNI, Osobni, STATUSY, Tym, barvaTerminu, datumKratce, dnes, iso, jeHotovo,
  najdiDatumy, nazevProjektu, novyTermin, noveId, popisRozsahu, rozsah, ted, zIso,
} from "./data.js";
import { Cashflow, dialogFaktury, menuFaktury } from "./cashflow.js";
import { otevriDovolene } from "./dovolene.js";
import { otevriExport } from "./export.js";
import * as FIN from "./finance.js";
import { Kalendar } from "./kalendar.js";
import { otevriNastaveni } from "./nastaveni.js";
import { jeNainstalovano, odkazInstalace, otevriInstalaci } from "./instalace.js";
import { dialogProjektu, tabulkaProjektu } from "./projekty.js";
import { h, ikona, kompaktni, menu, menuPod, okno, oznam, pole, popup, vymen, zavriMenu, zavriPopup, zkopiruj } from "./ui.js";
import {
  DNY_CELE, DNY_ZKR, avatar, barvaUzivatele, casHezky, cisloTydne, denHezky, denTydne, historieSUdalostmi, mesicZkratka,
  motivZMinula, nastavMotiv, normalizujZobrazeni, odznakStavu, pocetDniText, radekProjektu, relativniText, sklonuj,
  textyZahlavi, tipProjektu,
} from "./vzhled.js";
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

motivZMinula();

const APP_NAME = "Správce projektů";
const oblak = new Oblak();
const tym = new Tym(oblak);
let posta = null;
let osobni = null;            // osobní nastavení – stejný obsah jako v programu (motiv, seznam, kalendář…)
let pohled = null;            // {klic, el, obnov, zrus}
const koren = document.getElementById("aplikace");
const kolator = new Intl.Collator("cs");
const stav = { hledani: "", sbaleno: false, cekajiciTermin: null, vybranyOdkaz: "", konverzace: "" };

const sDiakritikou = (t) => String(t || "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");

function chybaText(e) {
  return e instanceof ChybaOblaku ? e.message : (e?.message || "Něco se nepovedlo. Zkus to znovu.");
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

const nast = () => osobni?.hodnota || {};
const dniUpozorneni = () => Math.max(0, parseInt(nast().upozorneni_dni ?? 1, 10) || 0);

// --- přihlášení (nastaveni.DialogPrihlaseni: karta, pozdrav, dvě pole, jedno tmavé tlačítko) -------------

function logo(trida = "") {
  return h("span", { class: `logo-ild ${trida}`, role: "img", "aria-label": "ILD" });
}

function pozdrav() {
  const hodina = new Date().getHours();
  return hodina >= 4 && hodina < 10 ? "Dobré ráno" : hodina < 18 ? "Dobrý den" : "Dobrý večer";
}

function ukazPrihlaseni(hlaska = "") {
  tym.zastav();
  posta?.zastav();
  document.title = APP_NAME;
  const jmeno = h("input", { id: "jmeno", name: "username", autocomplete: "username", required: true, autocapitalize: "none",
    spellcheck: false, placeholder: "jan.novak nebo e-mail" });
  const heslo = h("input", { id: "heslo", name: "password", type: "password", autocomplete: "current-password" });
  const oko = h("button", { type: "button", class: "heslo-oko", title: "Ukázat / skrýt heslo", "aria-label": "Ukázat heslo",
    onclick: () => { heslo.type = heslo.type === "password" ? "text" : "password"; } }, ikona("eye"));
  const zustat = h("input", { type: "checkbox" });
  const chyba = h("p", { class: "chyba-prihlaseni", role: "alert", text: hlaska });
  const tlacitko = h("button", { class: "tlacitko-prihlasit", type: "submit", text: "Přihlásit se" });
  for (const p of [jmeno, heslo]) p.addEventListener("input", () => { chyba.textContent = ""; });
  const formular = h("form", {
    class: "karta-prihlaseni",
    onsubmit: async (ev) => {
      ev.preventDefault();
      chyba.textContent = "";
      if (!heslo.value) {
        chyba.textContent = "Na webu se přihlašuje s heslem. Když ho nemáš, požádej správce, ať ti ho nastaví.";
        heslo.focus();
        return;
      }
      tlacitko.disabled = true;
      try {
        const clen = await oblak.prihlas(jmeno.value.trim(), heslo.value, zustat.checked);
        heslo.value = "";
        await spust(clen);
      } catch (e) {
        chyba.textContent = chybaText(e);
        tlacitko.disabled = false;
        heslo.select();
        heslo.focus();
      }
    },
  },
  h("div", { class: "horni" }),
  h("div", { class: "vnitrek" },
    logo(),
    h("div", { class: "nadpis-prihlaseni", text: pozdrav() }),
    h("div", { class: "podnadpis-prihlaseni", text: `Přihlas se do ${APP_NAME}` }),
    h("label", { class: "popisek-prihlaseni", for: "jmeno", text: "Přihlašovací jméno" }), jmeno,
    h("label", { class: "popisek-prihlaseni", for: "heslo", text: "Heslo" }), h("div", { class: "heslo-obal" }, heslo, oko),
    chyba,
    h("label", { class: "zustat" }, zustat, h("span", { text: "Zůstat přihlášen na tomto zařízení" })),
    tlacitko));
  vymen(koren, h("div", { class: "obrazovka-prihlaseni" }, h("div", { class: "prihlaseni-sloupec" }, formular, odkazInstalace())));
  jmeno.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); heslo.focus(); } });
  jmeno.focus();
}

// --- úvod při načítání (uvod.UvodniLogo: jen logo a pod ním hláška s procenty) --------------------------

const HLASKY = ["Probouzím projekty…", "Oklepávám staré záznamy…", "Hledám továrníka…", "Počítám víkendy a svátky…",
  "Rovnám šanony…", "Utahuji poslední šrouby…", "Leštím logo…", "Ladím barvičky…", "Dělám, že načítám…"];

function uvod() {
  const text = h("p");
  const hlasky = ["Připravuji prostředí…", ...[...HLASKY].sort(() => Math.random() - 0.5).slice(0, 2)];
  let procent = 0, cil = 34, i = 0;
  const obnov = () => { text.textContent = `${hlasky[Math.min(i, hlasky.length - 1)]}   ${Math.round(procent)} %`; };
  vymen(koren, h("div", { class: "uvod" }, logo(), text));
  obnov();
  const krok = setInterval(() => { procent += (cil - procent) * 0.12; obnov(); }, 60);
  const hlaska = setInterval(() => { i = Math.min(i + 1, hlasky.length - 1); obnov(); }, 1100);
  return {
    postup(p) { cil = p; },
    konec() { clearInterval(krok); clearInterval(hlaska); procent = 100; obnov(); },
  };
}

// --- po přihlášení ---------------------------------------------------------------------------------

async function spust(clen) {
  const u = uvod();
  tym.ja = { id: clen.id, role: clen.role, jmeno: "" };
  osobni = new Osobni(oblak, clen.id);
  await Promise.all([tym.nacti(), osobni.nacti()]);
  nastavMotiv(nast().motiv);
  u.postup(62);
  tym.ja.jmeno = tym.jmeno(clen.id, "");
  posta = new Posta(oblak, clen.id);
  stav.hledani = "";
  stav.sbaleno = (() => { try { return window.localStorage.getItem("ild-seznam-sbaleny") === "1"; } catch { return false; } })();
  u.konec();
  postavKostru();
  tym.sleduj((pripojeno) => obnovStavovyRadek(pripojeno));
  tym.pri(() => { tym.ja.jmeno = tym.jmeno(clen.id, tym.ja.jmeno); obnovVse(); obnovOdznak(); });
  posta.pri(() => { obnovOdznak(); if (pohled?.klic === "zpravy") pohled.obnov?.(); });
  let odklad = 0;
  osobni.pri(() => {
    clearTimeout(odklad);
    odklad = setTimeout(() => { nastavMotiv(nast().motiv); obnovVse(); }, 40);
  });
  posta.spust();
  window.addEventListener("hashchange", trasa);
  trasa();
}

function obnovVse() {
  obnovSeznam();
  obnovStavovyRadek();
  pohled?.obnov?.();
}

// --- kostra okna -------------------------------------------------------------------------------------

const el = {};   // prvky kostry (lišta aktivit, seznam, stavový řádek)

function tlacitkoAktivity(nazevIkony, popisek, akce, zkratka = "") {
  return h("button", { type: "button", class: "aktivita", "aria-label": popisek, dataset: { popisek, ...(zkratka ? { zkratka } : {}) },
    onclick: akce }, ikona(nazevIkony, "ikona", 24));
}

function postavKostru() {
  el.aProjekt = tlacitkoAktivity("folder", "Projekt", aktivitaProjekt);
  el.aKalendar = tlacitkoAktivity("calendar", "Kalendář", () => { window.location.hash = "#/kalendar"; }, "Ctrl+K");
  el.odznak = h("span", { class: "odznak", hidden: true });
  el.aZpravy = tlacitkoAktivity("chat", "Zprávy", () => { window.location.hash = stav.konverzace ? `#/zpravy/${encodeURIComponent(stav.konverzace)}` : "#/zpravy"; }, "Ctrl+M");
  el.aZpravy.append(el.odznak);
  el.aUzivatel = h("button", { type: "button", class: "aktivita", "aria-label": "Uživatel", dataset: { popisek: tym.ja.jmeno || "Uživatel" },
    onclick: () => menuUzivatele() }, avatar(tym.uzivatele.find((x) => x.id === tym.ja.id) || { id: tym.ja.id, jmeno: tym.ja.jmeno }, 28));
  el.aNastaveni = tlacitkoAktivity("settings", "Nastavení", () => menuPod(el.aNastaveni, [
    { text: "Nastavení…", ikona: "settings", akce: () => nastaveni() },
    "-",
    { text: "Ukončit aplikaci", ikona: "power", nebezpecne: true, akce: ukonci },
  ]));
  const lista = h("nav", { class: "activitybar", "aria-label": "Lišta aktivit" }, el.aProjekt, el.aKalendar, el.aZpravy,
    h("div", { class: "mezera" }), el.aUzivatel, el.aNastaveni);

  // seznam projektů (QFrame#sidebar)
  el.znacka = h("div", { class: "znacka", title: "Přehled všech projektů (Ctrl+0)", onclick: () => { window.location.hash = "#/projekty"; } },
    logo(), h("span", { class: "znacka-nadpis", text: "PROJEKTY" }), el.pocet = h("span", { class: "znacka-pocet" }));
  el.hledani = h("input", { type: "search", placeholder: "Hledat…", "aria-label": "Hledat projekt",
    title: "Hledá v názvu, čísle, lokalitě, investorovi i provozním souboru (Ctrl+F)",
    oninput: () => { stav.hledani = el.hledani.value; obnovSeznam(); } });
  el.fAktivni = h("button", { type: "button", text: "Aktivní", title: "Projekty v poptávce a realizaci", onclick: () => nastavFiltr("aktivni") });
  el.fVse = h("button", { type: "button", text: "Vše", title: "Všechny projekty – i realizované a mrtvé", onclick: () => nastavFiltr("vse") });
  el.seznam = h("div", { class: "seznam-projektu", tabindex: "0", role: "listbox", "aria-label": "Projekty" });
  el.seznam.addEventListener("click", (ev) => {
    const r = ev.target.closest(".projekt-radek");
    if (r) otevriProjekt(r.dataset.id);
  });
  el.seznam.addEventListener("contextmenu", (ev) => {
    const r = ev.target.closest(".projekt-radek");
    if (!r) return;
    ev.preventDefault();
    menuProjektuVSeznamu(ev.clientX, ev.clientY, r.dataset.id);
  });
  el.seznam.addEventListener("keydown", (ev) => {
    if (!["ArrowDown", "ArrowUp"].includes(ev.key)) return;
    ev.preventDefault();
    const radky = [...el.seznam.querySelectorAll(".projekt-radek")];
    const i = radky.findIndex((r) => r.classList.contains("vybrany"));
    const dalsi = radky[Math.max(0, Math.min(radky.length - 1, i + (ev.key === "ArrowDown" ? 1 : -1)))];
    if (dalsi) otevriProjekt(dalsi.dataset.id);
  });
  el.sidebar = h("aside", { class: "sidebar", "aria-label": "Seznam projektů" }, el.znacka,
    h("label", { class: "s-ikonou" }, ikona("search"), el.hledani),
    h("div", { class: "filtr-seznamu", role: "group" }, el.fAktivni, el.fVse),
    el.seznam,
    h("button", { type: "button", class: "tlacitko hlavni siroke", title: "Ctrl+N", onclick: () => dialogProjektu(tym, null, otevriProjekt) },
      ikona("plus"), "Nový projekt"));

  // hrana: tažením šířka seznamu, šipkou schovat / ukázat
  el.sipka = h("button", { type: "button", class: "panel-sipka", onclick: (ev) => { ev.stopPropagation(); prepniSeznam(); } });
  el.hrana = h("div", { class: "hrana" }, el.sipka);
  el.hrana.addEventListener("pointerdown", tahniHranu);

  el.obsah = h("main", { class: "obsah", id: "obsah" });

  // stavový řádek
  el.sPohled = h("button", { type: "button", title: "Seznam projektů (Ctrl+B)", onclick: () => prepniSeznam() }, ikona("folder"), h("span"));
  el.sTerminy = h("button", { type: "button", onclick: () => { window.location.hash = "#/kalendar"; } }, ikona("calendar"), h("span"));
  el.sTyden = h("span", { class: "tyden" });
  el.sData = h("button", { type: "button", class: "data", onclick: () => obnovStavovyRadek() }, ikonaDat(false));
  const radek = h("footer", { class: "statusbar" }, el.sPohled, h("div", { class: "mezera" }), el.sTerminy, el.sTyden, el.sData);

  el.ram = h("div", { class: "ram" }, h("div", { class: "ram-telo" }, lista, el.sidebar, el.hrana, el.obsah), radek);
  vymen(koren, el.ram);
  nastavSirkuSeznamu(nast().sirka_seznamu);
  nastavSbaleni(stav.sbaleno, false);
  obnovSeznam();
  obnovStavovyRadek();
}

function ikonaDat(pripojeno) {
  // vzhled.ikona_dat: plný válec (zelený = připojeno), rýhy v barvě stavového řádku
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 15 15");
  svg.setAttribute("class", `ikona-dat${pripojeno ? " pripojeno" : ""}`);
  const x = 2.55, w = 9.9, ry = 1.8, nahore = 3.3, dole = 11.7;
  const telo = document.createElementNS(ns, "path");
  telo.setAttribute("class", "valec");
  telo.setAttribute("d", `M ${x} ${nahore} A ${w / 2} ${ry} 0 0 1 ${x + w} ${nahore} V ${dole} A ${w / 2} ${ry} 0 0 1 ${x} ${dole} Z`);
  svg.append(telo);
  for (const y of [nahore, (nahore + dole) / 2]) {
    const r = document.createElementNS(ns, "path");
    r.setAttribute("class", "ryha");
    r.setAttribute("d", `M ${x} ${y} A ${w / 2} ${ry} 0 0 0 ${x + w} ${y}`);
    svg.append(r);
  }
  return svg;
}

// --- lišta aktivit a stavový řádek ------------------------------------------------------------------

function aktivitaProjekt() {
  if (kompaktni()) {
    el.ram.classList.toggle("seznam-otevreny");
    return;
  }
  if (pohled?.klic === "projekt") { prepniSeznam(); return; }
  const id = posledniProjekt();
  if (id) otevriProjekt(id); else window.location.hash = "#/projekty";
}

function posledniProjekt() {
  const id = nast().posledni_projekt;
  if (id && tym.projekt(id)) return id;
  return seradProjekty(tym.projekty)[0]?.id || "";
}

function nastavPohled(klic) {
  const mapa = { projekt: el.aProjekt, kalendar: el.aKalendar, zpravy: el.aZpravy };
  for (const b of [el.aProjekt, el.aKalendar, el.aZpravy]) b.classList.toggle("vybrana", mapa[klic] === b);
  el.znacka.classList.toggle("aktivni", klic !== "projekt");
  el.ram.classList.remove("seznam-otevreny");
  obnovStavovyRadek();
}

function textPohledu() {
  const k = pohled?.klic;
  if (k === "projekty") return "Všechny projekty";
  if (k === "kalendar") return "Kalendář všech projektů";
  if (k === "zpravy") return "Zprávy";
  const p = k === "projekt" ? tym.projekt(pohled.id) : null;
  return p ? `${p.cislo ? `${p.cislo} · ` : ""}${p.nazev || ""}` : APP_NAME;
}

function obnovStavovyRadek(pripojeno = tym.pripojeno) {
  if (!el.sPohled) return;
  el.sPohled.querySelector("span").textContent = textPohledu();
  const d = zIso(dnes());
  el.sTyden.textContent = `${cisloTydne(d)}. týden · ${DNY_ZKR[denTydne(d)]} ${datumKratce(d, true)}`;
  const pondeli = new Date(d.getFullYear(), d.getMonth(), d.getDate() - denTydne(d));
  const nedele = new Date(pondeli.getFullYear(), pondeli.getMonth(), pondeli.getDate() + 6);
  const tyden = [];
  const zdroje = [...tym.projekty.filter((p) => !NEAKTIVNI.has(p.status)).map((p) => [p, p.harmonogram]),
    [null, tym.hodnota("terminy_bez_projektu")], [null, nast().soukrome_terminy]];
  for (const [p, seznam] of zdroje) {
    for (const pol of Array.isArray(seznam) ? seznam : []) {
      const rz = rozsah(pol);
      if (rz && !jeHotovo(pol) && rz[0] <= nedele && rz[1] >= pondeli) tyden.push([rz[0], p, pol]);
    }
  }
  tyden.sort((a, b) => a[0] - b[0]);
  el.sTerminy.querySelector("span").textContent = `Tento týden: ${tyden.length ? sklonuj(tyden.length, "termín", "termíny", "termínů") : "nic"}`;
  el.sTerminy.dataset.tip = tyden.length
    ? tyden.slice(0, 15).map(([z, p, pol]) => `${DNY_ZKR[denTydne(z)]} ${datumKratce(z)}  ${pol.nazev || ""}${p ? `  (${[p.lokalita, p.nazev].filter(Boolean).join(" · ")})` : ""}`).join("\n")
      + "\n\nKlik = kalendář (Ctrl+K)"
    : "Klik = kalendář všech projektů (Ctrl+K)";
  el.sData.replaceChildren(ikonaDat(!!pripojeno));
  el.sData.dataset.tip = pripojeno ? "Data týmu v cloudu – připojeno, změny kolegů se ukazují hned"
    : "Bez spojení se serverem – změny se ukážou po připojení";
}

function obnovOdznak() {
  if (!el.odznak || !posta) return;
  const n = posta.pocetNeprectenych();
  el.odznak.hidden = !n;
  el.odznak.textContent = n < 100 ? String(n) : "99+";
  document.title = `${n ? `(${n}) ` : ""}${APP_NAME}`;
}

function menuUzivatele() {
  const ja = tym.uzivatele.find((u) => u.id === tym.ja.id) || { id: tym.ja.id, jmeno: tym.ja.jmeno };
  menuPod(el.aUzivatel, [
    { text: ja.jmeno || "Uživatel", zakazano: true },
    { nadpis: tym.jeSpravce ? "Správce" : "Uživatel" },
    tym.jeSpravce ? { text: "Správa uživatelů…", ikona: "users", akce: () => nastaveni("uzivatele") } : null,
    "-",
    jeNainstalovano() ? null : { text: "Nainstalovat aplikaci…", ikona: "telefon", akce: otevriInstalaci },
    { text: "Přihlásit se jako jiný…", ikona: "users", akce: odhlas },
    { text: "Odhlásit se", ikona: "power", akce: () => okno(APP_NAME, [h("p", { text: "Odhlásit se na tomto zařízení?" }),
      h("p", { class: "tiche", text: "Pro další práci se bude potřeba znovu přihlásit." })],
    [{ text: "Ne" }, { text: "Ano", hlavni: true, akce: odhlas }]) },
  ]);
  const prvni = document.querySelector(".menu button");
  if (prvni) prvni.prepend(avatar(ja, 20)), prvni.querySelector(".ikona")?.remove();
}

function nastaveni(sekce = "vzhled") {
  otevriNastaveni({ tym, osobni, sekce, odhlas, instaluj: jeNainstalovano() ? null : otevriInstalaci });
}

function ukonci() {
  window.close();
  setTimeout(() => oznam("Prohlížeč okno zavřít nedovolí – zavři kartu (Ctrl+W)"), 150);
}

function odhlas() {
  tym.zastav();
  posta?.zastav();
  oblak.odhlas();
  window.location.replace(window.location.pathname);
}

// --- seznam projektů vlevo -----------------------------------------------------------------------------

const seradProjekty = (projekty) => [...projekty].sort((a, b) => kolator.compare(String(a.cislo || ""), String(b.cislo || ""))
  || kolator.compare(String(a.nazev || ""), String(b.nazev || "")));

function nastavFiltr(hodnota) {
  if ((nast().filtr_projektu || "aktivni") === hodnota) return;
  osobni.uprav((n) => { n.filtr_projektu = hodnota; });
}

function aktivniProjekt() {
  return pohled?.klic === "projekt" ? pohled.id : nast().posledni_projekt || "";
}

function obnovSeznam() {
  if (!el.seznam) return;
  const filtr = nast().filtr_projektu === "vse" ? "vse" : "aktivni";
  el.fAktivni.setAttribute("aria-pressed", String(filtr === "aktivni"));
  el.fVse.setAttribute("aria-pressed", String(filtr === "vse"));
  const zobrazeni = normalizujZobrazeni(nast().seznam_zobrazeni);
  const vybrany = aktivniProjekt();
  const slova = sDiakritikou(stav.hledani).trim();
  const vsechny = seradProjekty(tym.projekty);
  const viditelne = vsechny.filter((p) => {
    if (slova) {
      return sDiakritikou([p.cislo, p.nazev, p.lokalita, p.investor, p.provozni_soubor || p.provozni_cel].join(" ")).includes(slova);
    }
    return filtr === "vse" || !NEAKTIVNI.has(p.status) || p.id === vybrany;
  });
  el.pocet.textContent = viditelne.length !== vsechny.length ? `${viditelne.length} z ${vsechny.length}` : String(vsechny.length);
  const upozorneni = nast().upozorneni !== false;
  const rolovani = el.seznam.scrollTop;
  vymen(el.seznam, viditelne.map((p) => {
    const r = radekProjektu(p, zobrazeni, { vybrany: p.id === vybrany, dniUpozorneni: dniUpozorneni(), upozorneni });
    r.dataset.tip = tipProjektu(p, dniUpozorneni());
    r.setAttribute("role", "option");
    return r;
  }), !viditelne.length ? h("div", { class: "seznam-prazdny", text: slova ? "Nic neodpovídá hledání." : "Zatím tu není žádný projekt." }) : null);
  el.seznam.scrollTop = rolovani;
}

function menuProjektuVSeznamu(x, y, id) {
  const p = tym.projekt(id);
  if (!p) return;
  menu(x, y, [
    { text: "Poslat odkaz ve Zprávách…", ikona: "chat", zelena: true, akce: () => poslatProjekt(p) },
    { text: "Otevřít složku projektu", ikona: "folder", akce: () => otevriSlozkuProjektu(p) },
    "-",
    { text: "Přidat úkol…", ikona: "task", akce: () => rychlyZapis(p, false) },
    { text: "Přidat poznámku…", ikona: "note", akce: () => rychlyZapis(p, true) },
  ]);
}

function hlavniSlozka(p) {
  const ods = (Array.isArray(p?.odkazy) ? p.odkazy : []).filter((o) => o && o.cesta);
  return (ods.find((o) => /složka projektu/i.test(o.popis || "")) || ods.find((o) => !/\.[a-z0-9]{1,5}$/i.test(o.cesta)) || ods[0])?.cesta || "";
}

function otevriSlozkuProjektu(p) {
  const cesta = hlavniSlozka(p);
  if (!cesta) { oznam("Projekt nemá žádnou složku"); return; }
  otevriVPocitaci(cesta, p.id);
}

// dialogy.DialogRychlehoZapisu – úkol nebo poznámka rovnou ze seznamu projektů
function rychlyZapis(p, poznamka) {
  const vstup = poznamka ? h("textarea", { rows: 6, maxlength: 10000, placeholder: "Text poznámky… (Ctrl+Enter uloží)" })
    : h("input", { maxlength: 500, placeholder: "Co je potřeba udělat…" });
  const o = okno(poznamka ? "Přidat poznámku" : "Přidat úkol", [h("p", { class: "tiche", text: [p.lokalita, p.nazev].filter(Boolean).join(" · ") }), vstup], [
    { text: "Zrušit" },
    { text: "Přidat", hlavni: true, ikona: "plus", akce: async () => {
      const text = vstup.value.trim();
      if (!text) return false;
      if (poznamka) await pridejPoznamku(p.id, text); else await pridejUkol(p.id, text);
    } },
  ]);
  if (poznamka) vstup.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && ev.ctrlKey) o.dialog.querySelector(".tlacitko.hlavni")?.click(); });
  vstup.focus();
}

// --- šířka a schování seznamu (SkladaciPanely) ----------------------------------------------------------

function mezeSeznamu() {
  const n = nast();
  const min = parseInt(n.sirka_seznamu_min, 10) || 240;
  return [min, Math.max(min, parseInt(n.sirka_seznamu_max, 10) || 900)];
}

function nastavSirkuSeznamu(sirka) {
  const [min, max] = mezeSeznamu();
  const s = Math.max(min, Math.min(max, parseInt(sirka, 10) || 300));
  el.sidebar.style.setProperty("--sirka-seznamu", `${s}px`);
  return s;
}

function nastavSbaleni(sbaleno, ulozit = true) {
  stav.sbaleno = sbaleno;
  el.sidebar.classList.toggle("sbaleno", sbaleno);
  el.hrana.classList.toggle("sbaleno", sbaleno);
  el.sipka.replaceChildren(ikona(sbaleno ? "chevron-right" : "chevron-left"));
  el.sipka.dataset.tip = `${sbaleno ? "Zobrazit" : "Skrýt"} seznam projektů (Ctrl+B)`;
  if (ulozit) { try { window.localStorage.setItem("ild-seznam-sbaleny", sbaleno ? "1" : "0"); } catch { /* nic */ } }
}

function prepniSeznam() {
  if (kompaktni()) { el.ram.classList.toggle("seznam-otevreny"); return; }
  nastavSbaleni(!stav.sbaleno);
}

// Kompaktní rozvržení: vysunutý seznam projektů zavře klepnutí vedle něj (telefon na šířku – nezakrývá vše).
document.addEventListener("pointerdown", (ev) => {
  if (!el.ram?.classList.contains("seznam-otevreny") || el.sidebar.contains(ev.target) || el.aProjekt.contains(ev.target)
    || ev.target.closest?.(".menu, dialog, .popup")) return;
  el.ram.classList.remove("seznam-otevreny");
}, true);

function tahniHranu(ev) {
  if (ev.button !== 0 || stav.sbaleno || ev.target.closest(".panel-sipka")) return;
  ev.preventDefault();
  const start = ev.clientX, puvodni = el.sidebar.getBoundingClientRect().width;
  let sirka = puvodni;
  el.hrana.classList.add("tazena");
  document.body.style.cursor = "col-resize";
  const pohyb = (e) => { sirka = nastavSirkuSeznamu(puvodni + e.clientX - start); };
  const konec = () => {
    document.removeEventListener("pointermove", pohyb);
    document.removeEventListener("pointerup", konec);
    el.hrana.classList.remove("tazena");
    document.body.style.cursor = "";
    if (Math.round(sirka) !== Math.round(puvodni)) osobni.uprav((n) => { n.sirka_seznamu = Math.round(sirka); });
  };
  document.addEventListener("pointermove", pohyb);
  document.addEventListener("pointerup", konec);
}

// --- trasy ------------------------------------------------------------------------------------------

const ZALOZKY = [["prehled", "Přehled", "grid"], ["soubory", "Soubory", "folder"], ["harmonogram", "Harmonogram", "calendar"]];

// HlavniOkno._vychozi_zalozka – na které záložce se otevře nově vybraný projekt
function vychoziZalozka(id) {
  const n = nast();
  let volba = n.vychozi_zalozka || "posledni";
  const platna = (i) => Number.isInteger(i) && i >= 0 && i < ZALOZKY.length;
  if (volba === "projekt") {
    const i = (n.zalozky_projektu || {})[id];
    if (platna(i)) return ZALOZKY[i][0];
    volba = "posledni";
  }
  if (volba === "posledni") return ZALOZKY[platna(n.posledni_zalozka) ? n.posledni_zalozka : 1][0];
  return { prehled: "prehled", harmonogram: "harmonogram" }[volba] || "soubory";
}

function zapamatujZalozku(id, zalozka) {
  const i = ZALOZKY.findIndex(([k]) => k === zalozka);
  if (i < 0) return;
  const n = nast();
  const pamet = n.zalozky_projektu && typeof n.zalozky_projektu === "object" ? n.zalozky_projektu : {};
  if (n.posledni_zalozka === i && pamet[id] === i && n.posledni_projekt === id) return;
  osobni.uprav((h2) => {
    h2.posledni_zalozka = i;
    h2.posledni_projekt = id;
    const p = h2.zalozky_projektu && typeof h2.zalozky_projektu === "object" ? h2.zalozky_projektu : (h2.zalozky_projektu = {});
    delete p[id];
    p[id] = i;
    const klice = Object.keys(p);
    for (const k of klice.slice(0, Math.max(0, klice.length - 300))) delete p[k];
  });
}

const otevriProjekt = (id, zalozka = "") => {
  window.location.hash = `#/projekt/${encodeURIComponent(id)}${zalozka ? `/${zalozka}` : ""}`;
};

function trasa() {
  const casti = window.location.hash.replace(/^#\/?/, "").split("/").map((c) => {
    try { return decodeURIComponent(c); } catch { return ""; }
  });
  let [klic, parametr = "", dalsi = ""] = casti;
  if (!klic) {
    const id = posledniProjekt();
    if (id) { window.location.replace(`#/projekt/${encodeURIComponent(id)}`); return; }
    klic = "projekty";
  }
  if (klic === "projekt" && !tym.projekt(parametr) && !tym.projekty.length) klic = "projekty";
  if (klic === "projekt" && !dalsi) {
    window.location.replace(`#/projekt/${encodeURIComponent(parametr)}/${vychoziZalozka(parametr)}`);
    return;
  }
  const pohledy = { projekty: pohledVsechny, projekt: pohledProjekt, kalendar: pohledKalendar, dovolena: pohledKalendar, zpravy: pohledZpravy };
  const tvorba = pohledy[klic] || pohledVsechny;
  // stejný projekt, jen jiná záložka – záhlaví a seznam zůstávají
  if (klic === "projekt" && pohled?.klic === "projekt" && pohled.id === parametr && pohled.prepniZalozku) {
    zavriMenu();
    zavriPopup();
    el.ram.classList.remove("seznam-otevreny");   // telefon: klepnutí na už otevřený projekt seznam zavře
    pohled.prepniZalozku(dalsi);
    return;
  }
  pohled?.zrus?.();
  for (const d of document.querySelectorAll("dialog.okno")) { d.close(); d.remove(); }
  zavriMenu();
  zavriPopup();
  pohled = tvorba(parametr, dalsi) || null;
  if (pohled) pohled.klic = pohledy[klic] && klic !== "dovolena" ? klic : klic === "dovolena" ? "kalendar" : "projekty";
  vymen(el.obsah, pohled?.el || "");
  nastavPohled(pohled?.klic);
  obnovSeznam();
  if (klic === "dovolena") otevriOknoDovolenych(/^\d{4}$/.test(parametr) ? +parametr : new Date().getFullYear());
}

// --- záhlaví a záložky projektu ----------------------------------------------------------------------

function pohledProjekt(id, zalozka = "prehled") {
  if (!ZALOZKY.some(([k]) => k === zalozka) && zalozka !== "cashflow") zalozka = "prehled";
  const p0 = tym.projekt(id);
  if (!p0) {
    return { id, el: h("section", { class: "pohled" }, h("p", { class: "tiche", text: "Projekt nebyl nalezen (možná ho někdo smazal)." })) };
  }
  if (nast().posledni_projekt !== id) osobni.uprav((n) => { n.posledni_projekt = id; });
  const nadpis = h("h1");
  const udaje = h("div", { class: "tiche" });
  const tlacitkaZalozek = ZALOZKY.map(([k, t, ik]) => h("a", { class: "zalozka", href: `#/projekt/${encodeURIComponent(id)}/${k}`,
    dataset: { k }, onclick: (ev) => {
      // klik na už otevřený Harmonogram = přejít na dnešek
      if (k === "harmonogram" && aktualni === "harmonogram" && telo?.jdiNaDnes) { ev.preventDefault(); telo.jdiNaDnes(); }
    } }, ikona(ik), h("span", { text: t }), h("span", { class: "pocet" })));
  tlacitkaZalozek[2].dataset.tip = "Harmonogram projektu (další klik = přejít na dnešek)";
  const roh = h("div", { class: "roh-zalozek" });
  const bHistorie = h("button", { type: "button", class: "ikonove", title: "Historie změn projektu", "aria-label": "Historie změn projektu",
    onclick: () => historieProjektu(id, bHistorie) }, ikona("history"));
  const obsahZalozky = h("div", { class: "telo-zalozky" });
  let aktualni = "", telo = null;

  function obnovZahlavi() {
    const p = tym.projekt(id);
    if (!p) return false;
    const [n, radky] = textyZahlavi(p, nast().zahlavi_zobrazeni);
    nadpis.textContent = n;
    vymen(udaje, radky.map((r, i) => [i ? h("br") : null, r]));
    udaje.hidden = !radky.length;
    const pocty = [0, (p.odkazy || []).length, (p.harmonogram || []).length];
    tlacitkaZalozek.forEach((b, i) => { b.querySelector(".pocet").textContent = pocty[i] ? String(pocty[i]) : ""; });
    document.title = `${posta?.pocetNeprectenych() ? `(${posta.pocetNeprectenych()}) ` : ""}${n} – ${APP_NAME}`;
    return true;
  }

  function prepniZalozku(z) {
    if (!ZALOZKY.some(([k]) => k === z) && z !== "cashflow") z = "prehled";
    const vybrana = z === "cashflow" ? "harmonogram" : z;
    telo?.zrus?.();
    aktualni = vybrana;
    for (const b of tlacitkaZalozek) {
      const ano = b.dataset.k === vybrana;
      b.classList.toggle("vybrana", ano);
      if (ano) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    }
    zapamatujZalozku(id, vybrana);
    telo = vybrana === "harmonogram" ? zalozkaHarmonogram(id, z === "cashflow") : vybrana === "soubory" ? zalozkaSoubory(id) : zalozkaPrehled(id);
    obsahZalozky.classList.toggle("roluje", vybrana === "prehled");
    vymen(obsahZalozky, telo.el);
    vymen(roh, telo.roh || null, bHistorie);
    obsahZalozky.scrollTop = 0;
  }

  obnovZahlavi();
  prepniZalozku(zalozka);
  return {
    id, prepniZalozku,
    el: h("section", { class: "pohled projekt" },
      h("header", { class: "zahlavi-projektu" }, nadpis, udaje),
      h("div", { class: "zalozky-radek" }, h("nav", { class: "zalozky", "aria-label": "Záložky projektu" }, tlacitkaZalozek), roh),
      obsahZalozky),
    obnov: () => { if (obnovZahlavi()) telo?.obnov?.(); },
    zrus: () => telo?.zrus?.(),
  };
}

// historie projektu pod ikonou hodin (okno_poznamky.PopupHistorie + prehled.HistorieDelegate)
function historieProjektu(id, kotva) {
  const p = tym.projekt(id);
  if (!p) return;
  const hledat = h("input", { type: "search", placeholder: "Hledat v historii…", class: "historie-hledani" });
  const seznam = h("div", { class: "historie-seznam" });
  const obnov = () => {
    const slova = sDiakritikou(hledat.value).trim();
    const zaznamy = historieSUdalostmi(tym.projekt(id) || p).filter((z) => z && z.text && (!slova || sDiakritikou(`${z.text} ${z.kdo || ""}`).includes(slova)));
    vymen(seznam, zaznamy.slice(0, 400).map((z) => {
      const barva = z.udalost ? barvaTerminu(z.pol) : /^(Smazán|Odebrán|Smazána)/.test(z.text) ? "var(--c-danger)"
        : /^(Přesunut|Posunut|Změněna)/.test(z.text) ? "#2E90FA" : "var(--c-primary)";
      const u = z.kdo ? tym.uzivatele.find((x) => x.jmeno === z.kdo) : null;
      return h("div", { class: `zaznam-historie${z.udalost ? " udalost" : ""}`, style: { "--b": barva }, title: z.text },
        h("i", { class: "bod" }), h("span", { class: "kdy", text: z.udalost ? denHezky(z.cas) : casHezky(z.cas) }),
        z.kdo ? avatar(u || { id: z.kdo, jmeno: z.kdo }, 20) : null, h("span", { class: "co", text: z.text }));
    }), !zaznamy.length ? h("p", { class: "tiche", text: "Zatím žádné změny." }) : null);
  };
  hledat.addEventListener("input", obnov);
  obnov();
  popup(kotva, [h("h2", { text: `Historie – ${p.nazev || nazevProjektu(p)}` }), hledat, seznam], () => {}, { trida: "historie" });
}

// --- záložka Přehled (prehled.PrehledStranka) ------------------------------------------------------------

function zalozkaPrehled(id) {
  let ukazHotove = false, vsePoznamky = false;
  let upravovana = null;   // {id, text} – rozepsaná úprava poznámky přežije obnovu (změny kolegů)
  const pridanaData = new Set();

  // úkoly
  const ukoly = h("div", { class: "ukoly" });
  const hotove = h("div", { class: "ukoly hotove-seznam" });
  const prazdneUkoly = h("p", { class: "prazdne-text" });
  const bHotove = h("button", { type: "button", class: "tlacitko duch", onclick: () => { ukazHotove = !ukazHotove; obnov(); } });
  const odznak = h("span", { class: "odznak-ukolu", title: "Úkoly, které čekají na udělání" });
  const pocetUkolu = h("span", { class: "faint" });
  const novyUkol = h("input", { placeholder: "Nový úkol… (Enter přidá)", "aria-label": "Nový úkol", maxlength: 500 });
  novyUkol.addEventListener("keydown", async (ev) => {
    if (ev.key !== "Enter" || ev.isComposing) return;
    const text = novyUkol.value.trim();
    if (!text) return;
    novyUkol.value = "";
    if (!(await pridejUkol(id, text))) novyUkol.value = text;
  });

  // poznámky
  const poznamky = h("div", { class: "poznamky" });
  const pocetPoznamek = h("span", { class: "faint" });
  const bVsePoznamky = h("button", { type: "button", class: "tlacitko duch", onclick: () => { vsePoznamky = !vsePoznamky; obnov(); } });
  const novaPoznamka = h("textarea", { class: "pole-poznamky", rows: 2, maxlength: 10000, "aria-label": "Nová poznámka",
    placeholder: "Napiš poznámku… (Enter uloží, Shift+Enter nový řádek)" });
  const navrhDat = h("div", { class: "banner-info", hidden: true });
  const prizpusob = (pole2, min = 2) => {
    pole2.style.height = "auto";
    const radek = 18;
    pole2.style.height = `${Math.min(Math.max(pole2.scrollHeight + 2, min * radek + 14), 8 * radek + 14)}px`;
  };
  let casovacNavrhu = 0;
  novaPoznamka.addEventListener("input", () => { prizpusob(novaPoznamka); clearTimeout(casovacNavrhu); casovacNavrhu = setTimeout(obnovNavrhy, 250); });
  novaPoznamka.addEventListener("keydown", async (ev) => {
    if (ev.key === "Escape") { novaPoznamka.value = ""; prizpusob(novaPoznamka); obnovNavrhy(); return; }
    if (ev.key !== "Enter" || ev.shiftKey || ev.isComposing) return;
    ev.preventDefault();
    const text = novaPoznamka.value.trim();
    if (!text) return;
    const nepridane = najdiDatumy(text).filter((d) => !pridanaData.has(d));
    novaPoznamka.value = "";
    prizpusob(novaPoznamka);
    pridanaData.clear();
    obnovNavrhy();
    const ok = await pridejPoznamku(id, text);
    if (!ok) { novaPoznamka.value = text; return; }
    if (nepridane.length) {
      const d = zIso(nepridane[0]);
      oznam(`Poznámka uložena – v textu je ${datumKratce(d, true)}`, false,
        { text: "Přidat do kalendáře", fn: () => dialogTerminu(id, { datum: d, nazev: navrhNazvu(text) }) });
    }
  });
  function obnovNavrhy() {
    const navrhy = najdiDatumy(novaPoznamka.value).slice(0, 3);
    vymen(navrhDat, ikona("calendar"), h("span", { class: "tiche", text: "Datum v poznámce:" }), navrhy.map((datum) => {
      const d = zIso(datum);
      if (pridanaData.has(datum)) return h("button", { type: "button", class: "tlacitko duch", disabled: true }, ikona("check"), `${datumKratce(d, true)} je v kalendáři`);
      return h("button", { type: "button", class: "tlacitko duch", title: `Nový termín „${navrhNazvu(novaPoznamka.value)}“ v harmonogramu projektu`,
        onclick: () => dialogTerminu(id, { datum: d, nazev: navrhNazvu(novaPoznamka.value), poPridani: () => { pridanaData.add(datum); obnovNavrhy(); } }) },
      ikona("plus"), `Přidat ${datumKratce(d, true)} do kalendáře`);
    }));
    navrhDat.hidden = !navrhy.length;
  }

  // termíny
  const terminy = h("div", { class: "seznam" });

  function radekUkolu(u) {
    const zvyraznit = !u.hotovo;
    const box = h("input", { type: "checkbox", checked: !!u.hotovo, "aria-label": u.text, onclick: (ev) => ev.stopPropagation(),
      onchange: () => prepniUkol(id, u, box.checked) });
    const radek = h("div", { class: `ukol${zvyraznit ? " cekajici" : ""}${u.hotovo ? " hotovo" : ""}`, title: "Klik = hotovo / znovu otevřít · pravé tlačítko = upravit, smazat",
      onclick: () => { box.checked = !box.checked; prepniUkol(id, u, box.checked); },
      oncontextmenu: (ev) => { ev.preventDefault(); menu(ev.clientX, ev.clientY, [
        { text: u.hotovo ? "Znovu otevřít" : "Hotovo", ikona: "check", zelena: true, akce: () => prepniUkol(id, u, !u.hotovo) },
        { text: "Upravit…", ikona: "edit", akce: () => upravUkol(id, u) },
        "-",
        { text: "Smazat", ikona: "trash", nebezpecne: true, akce: () => smazUkol(id, u) }]); } },
    box, h("div", { class: "ukol-text" }, h("span", { text: u.text }),
      u.hotovo && u.splneno ? h("small", { class: "faint", text: `splněno ${casHezky(u.splneno)}` }) : null),
    h("button", { type: "button", class: "ikonove male", title: "Smazat úkol", "aria-label": "Smazat úkol",
      onclick: (ev) => { ev.stopPropagation(); smazUkol(id, u); } }, ikona("x")));
    return radek;
  }

  function kartaPoznamky(x) {
    const navrhy = najdiDatumy(x.text);
    const uprav = () => { upravovana = { id: x.id, text: x.text }; obnov(true); };
    const menuPoznamky = (mx, my) => menu(mx, my, [
      { text: "Upravit", ikona: "edit", akce: uprav },
      { text: "Kopírovat text", ikona: "copy", akce: () => zkopiruj(x.text) },
      ...navrhy.map((datum) => ({ text: `Přidat ${datumKratce(zIso(datum), true)} do kalendáře`, ikona: "calendar", zelena: true,
        akce: () => dialogTerminu(id, { datum: zIso(datum), nazev: navrhNazvu(x.text) }) })),
      "-",
      { text: "Smazat", ikona: "trash", nebezpecne: true, akce: () => smazPoznamku(id, x) }]);
    const hlava = h("div", { class: "poznamka-hlava" },
      h("span", { class: "poznamka-cas", text: [casHezky(x.cas), x.autor].filter(Boolean).join("  ·  ") }), h("span", { class: "mezera" }),
      navrhy.length ? h("button", { type: "button", class: "ikonove male zelene", title: "Přidat datum z poznámky do kalendáře",
        onclick: (ev) => {
          if (navrhy.length === 1) { dialogTerminu(id, { datum: zIso(navrhy[0]), nazev: navrhNazvu(x.text) }); return; }
          const r = ev.currentTarget.getBoundingClientRect();
          menu(r.left, r.bottom, navrhy.map((datum) => ({ text: `${datumKratce(zIso(datum), true)} – ${navrhNazvu(x.text)}`, ikona: "calendar", zelena: true,
            akce: () => dialogTerminu(id, { datum: zIso(datum), nazev: navrhNazvu(x.text) }) })));
        } }, ikona("calendar")) : null,
      h("button", { type: "button", class: "ikonove male", title: "Upravit (dvojklik)", onclick: uprav }, ikona("edit")),
      h("button", { type: "button", class: "ikonove male cervene", title: "Smazat poznámku", onclick: () => smazPoznamku(id, x) }, ikona("trash")));
    if (upravovana?.id === x.id) {
      const editor = h("textarea", { class: "pole-poznamky", maxlength: 10000 });
      editor.value = upravovana.text;
      const zrus = () => { upravovana = null; obnov(true); };
      const uloz = async () => {
        const text = editor.value.trim();
        upravovana = null;
        obnov(true);
        if (text && text !== x.text) await upravPoznamku(id, x, text);
      };
      editor.addEventListener("input", () => { upravovana.text = editor.value; prizpusob(editor); });
      editor.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") { ev.preventDefault(); zrus(); }
        else if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); uloz(); }
      });
      setTimeout(() => { prizpusob(editor); if (!editor.dataset.fokus) { editor.dataset.fokus = "1"; editor.focus(); editor.setSelectionRange(editor.value.length, editor.value.length); } }, 0);
      return h("article", { class: "poznamka" }, h("div", { class: "poznamka-hlava" }, h("span", { class: "poznamka-cas", text: [casHezky(x.cas), x.autor].filter(Boolean).join("  ·  ") })),
        h("div", { class: "poznamka-uprava" }, editor, h("div", { class: "radek-tlacitek" },
          h("span", { class: "faint", text: "Enter uloží · Shift+Enter nový řádek · Esc zruší" }), h("span", { class: "mezera" }),
          h("button", { type: "button", class: "tlacitko duch", text: "Zrušit", onclick: zrus }),
          h("button", { type: "button", class: "tlacitko hlavni", text: "Uložit", onclick: uloz }))));
    }
    return h("article", { class: "poznamka", ondblclick: uprav, oncontextmenu: (ev) => { ev.preventDefault(); menuPoznamky(ev.clientX, ev.clientY); } },
      hlava, h("p", { class: "text-poznamky", text: x.text }));
  }

  function radekTerminuPrehledu(pol, dnesek) {
    const rz = rozsah(pol);
    const barva = barvaTerminu(pol);
    const dny = Math.round((rz[1] - rz[0]) / 86400000) + 1;
    const [text, barvaTextu] = relativniText(rz[0], rz[1], dnesek);
    return h("button", { type: "button", class: "termin-radek", onclick: () => { stav.cekajiciTermin = pol.id; otevriProjekt(id, "harmonogram"); } },
      h("span", { class: "termin-znacka", style: { background: `color-mix(in srgb, ${barva} 11%, transparent)` } },
        h("b", { text: String(rz[0].getDate()), style: { color: barva } }), h("small", { text: mesicZkratka(rz[0]) })),
      h("span", { class: "termin-texty" }, h("strong", { text: pol.nazev || "Termín" }),
        h("span", { class: "faint", text: `${DNY_ZKR[denTydne(rz[0])]} ${popisRozsahu(...rz)}${dny > 1 ? ` · ${pocetDniText(dny)}` : ""}${upresneniText(pol)}` })),
      h("span", { class: "odpocet", text, style: { color: barvaTextu } }));
  }

  function obnov(jenPoznamky = false) {
    const p = tym.projekt(id);
    if (!p) return;
    const dnesek = zIso(dnes());
    if (!jenPoznamky) {
      const vse = (Array.isArray(p.ukoly) ? p.ukoly : []).filter((u) => u && u.id);
      const otevrene = vse.filter((u) => !u.hotovo);
      const hot = vse.filter((u) => u.hotovo).sort((a, b) => String(b.splneno || "").localeCompare(String(a.splneno || "")));
      vymen(ukoly, otevrene.map(radekUkolu));
      prazdneUkoly.textContent = hot.length ? "Všechno je hotovo." : "Zatím žádné úkoly. Napiš první nahoře a stiskni Enter.";
      prazdneUkoly.hidden = !!otevrene.length;
      bHotove.hidden = !hot.length;
      vymen(bHotove, ikona(ukazHotove ? "chevron-right" : "chevron-down"), `${ukazHotove ? "Skrýt hotové" : "Hotové"}  (${hot.length})`);
      vymen(hotove, ukazHotove ? hot.slice(0, 15).map(radekUkolu) : null);
      odznak.textContent = `${otevrene.length} k udělání`;
      odznak.hidden = !otevrene.length;
      pocetUkolu.textContent = vse.length ? `${hot.length} z ${vse.length} hotovo` : "";

      const planovane = (Array.isArray(p.harmonogram) ? p.harmonogram : []).filter((t) => t && rozsah(t) && !jeHotovo(t));
      const po = planovane.filter((t) => rozsah(t)[1] < dnesek).sort((a, b) => rozsah(b)[1] - rozsah(a)[1]).slice(0, 2);
      const budouci = planovane.filter((t) => rozsah(t)[1] >= dnesek).sort((a, b) => rozsah(a)[0] - rozsah(b)[0] || rozsah(a)[1] - rozsah(b)[1]).slice(0, 6);
      const bez = (p.harmonogram || []).filter((t) => t && !rozsah(t)).length;
      vymen(terminy, [...po, ...budouci].map((t) => radekTerminuPrehledu(t, dnesek)),
        !po.length && !budouci.length ? h("p", { class: "prazdne-text", text: "Žádné naplánované termíny."
          + (bez ? ` ${bez} ${bez === 1 ? "krok čeká" : bez < 5 ? "kroky čekají" : "kroků čeká"} na datum v harmonogramu.` : "") }) : null);
    }
    const vsechny = (Array.isArray(p.poznamky) ? p.poznamky : []).filter((x) => x && x.text).slice().reverse();
    if (upravovana && vsechny.slice(5).some((x) => x.id === upravovana.id)) vsePoznamky = true;
    vymen(poznamky, (vsePoznamky ? vsechny : vsechny.slice(0, 5)).map(kartaPoznamky),
      !vsechny.length ? h("p", { class: "prazdne-text", text: "Zatím žádné poznámky." }) : null);
    pocetPoznamek.textContent = vsechny.length ? String(vsechny.length) : "";
    const dalsi = vsechny.length - 5;
    bVsePoznamky.hidden = dalsi <= 0;
    bVsePoznamky.textContent = vsePoznamky ? "Zobrazit méně" : `Zobrazit další (${dalsi})`;
  }

  obnov();
  setTimeout(() => prizpusob(novaPoznamka), 0);
  const el2 = h("div", { class: "prehled-mrizka" },
    h("div", { class: "sloupec" },
      h("section", { class: "karta karta-ukolu" },
        h("div", { class: "karta-hlavicka" }, h("h2", { text: "Úkoly" }), odznak, h("span", { class: "mezera" }), pocetUkolu),
        h("label", { class: "nove-pole" }, ikona("plus"), novyUkol), ukoly, prazdneUkoly, h("div", {}, bHotove), hotove),
      h("section", { class: "karta" },
        h("div", { class: "karta-hlavicka" }, h("h2", { text: "Poznámky" }), h("span", { class: "mezera" }), pocetPoznamek),
        novaPoznamka, navrhDat, poznamky, h("div", {}, bVsePoznamky))),
    h("div", { class: "sloupec" },
      h("section", { class: "karta" },
        h("div", { class: "karta-hlavicka" }, h("h2", { text: "Termíny" }), h("span", { class: "mezera" }),
          h("button", { type: "button", class: "tlacitko duch", onclick: () => otevriProjekt(id, "harmonogram") }, "Harmonogram", ikona("chevron-right"))),
        terminy)));
  return { el: el2, obnov: () => obnov() };
}

function navrhNazvu(text) {
  const prvni = String(text || "").split("\n").map((r) => r.trim()).find(Boolean) || "Termín";
  return prvni.length <= 60 ? prvni : prvni.slice(0, 59) + "…";
}

function upresneniText(pol) {
  const u = barvaTerminu(pol) === BARVA_REALIZACE ? String(pol.upresneni || "").trim() : "";
  return u && u.toLowerCase() !== String(pol.nazev || "").trim().toLowerCase() ? ` · ${u}` : "";
}

// --- úkoly a poznámky (data + historie projektu jako v programu) -------------------------------------------

async function pridejUkol(pid, text) {
  return proved(() => tym.upravProjekt(pid, (p) => {
    if (!Array.isArray(p.ukoly)) p.ukoly = [];
    p.ukoly.push({ id: noveId(), text, hotovo: false, vytvoreno: ted(), splneno: "" });
  }, `Přidán úkol: ${text}`));
}

function prepniUkol(pid, u, hotovo) {
  setTimeout(() => proved(() => tym.upravProjekt(pid, (p) => {
    const x = (p.ukoly || []).find((y) => y.id === u.id);
    if (!x || !!x.hotovo === hotovo) return false;
    x.hotovo = hotovo;
    x.splneno = hotovo ? ted() : "";
  }, `${hotovo ? "Splněn úkol: " : "Znovu otevřen úkol: "}${u.text}`)), hotovo ? 350 : 0);
}

function upravUkol(pid, u) {
  const vstup = h("input", { value: u.text, maxlength: 500 });
  okno("Upravit úkol", [vstup], [{ text: "Zrušit" }, { text: "Uložit", hlavni: true, akce: async () => {
    const text = vstup.value.trim();
    if (!text) throw new Error("Úkol nesmí být prázdný.");
    await tym.upravProjekt(pid, (p) => {
      const x = (p.ukoly || []).find((y) => y.id === u.id);
      if (!x || x.text === text) return false;
      x.text = text;
    }, `Upraven úkol: ${text}`);
  } }]);
  vstup.focus();
  vstup.select();
}

async function smazUkol(pid, u) {
  let index = -1, smazany = null;
  const ok = await proved(() => tym.upravProjekt(pid, (p) => {
    index = (p.ukoly || []).findIndex((y) => y.id === u.id);
    if (index < 0) return false;
    smazany = p.ukoly.splice(index, 1)[0];
  }, `Smazán úkol: ${u.text}`));
  if (!ok || !smazany) return;
  oznam(`Úkol „${u.text.slice(0, 40)}“ smazán`, false, { text: "Vrátit", fn: () => proved(() => tym.upravProjekt(pid, (p) => {
    if (!Array.isArray(p.ukoly)) p.ukoly = [];
    if (p.ukoly.some((y) => y.id === smazany.id)) return false;
    p.ukoly.splice(Math.min(index, p.ukoly.length), 0, smazany);
  }, `Obnoven úkol: ${smazany.text}`)) });
}

async function pridejPoznamku(pid, text) {
  return proved(() => tym.upravProjekt(pid, (p) => {
    if (!Array.isArray(p.poznamky)) p.poznamky = [];
    const pol = { id: noveId(), cas: ted(), text };
    if (tym.ja.jmeno) pol.autor = tym.ja.jmeno;
    p.poznamky.push(pol);
  }, "Přidána poznámka"));
}

function upravPoznamku(pid, x, text) {
  return proved(() => tym.upravProjekt(pid, (p) => {
    const y = (p.poznamky || []).find((z) => z.id === x.id);
    if (!y || y.text === text) return false;
    y.text = text;
    y.cas = y.cas || ted();
  }, "Upravena poznámka"));
}

async function smazPoznamku(pid, x) {
  let index = -1, smazana = null;
  const ok = await proved(() => tym.upravProjekt(pid, (p) => {
    index = (p.poznamky || []).findIndex((z) => z.id === x.id);
    if (index < 0) return false;
    smazana = p.poznamky.splice(index, 1)[0];
  }, "Smazána poznámka"));
  if (!ok || !smazana) return;
  oznam("Poznámka smazána", false, { text: "Vrátit", fn: () => proved(() => tym.upravProjekt(pid, (p) => {
    if (!Array.isArray(p.poznamky)) p.poznamky = [];
    if (p.poznamky.some((z) => z.id === smazana.id)) return false;
    p.poznamky.splice(Math.min(index, p.poznamky.length), 0, smazana);
  }, "Obnovena poznámka")) });
}

// --- nový termín z poznámky (okénko Nový termín jako v programu) -------------------------------------------

function vyberDruhu(vybrana) {
  const el2 = h("div", { class: "vyber-druhu", role: "radiogroup" });
  let hodnota = vybrana;
  const obnov = () => { for (const b of el2.children) b.classList.toggle("vybrany", b.dataset.b === hodnota); };
  for (const b of BARVY_TERMINU) {
    el2.append(h("button", { type: "button", dataset: { b }, style: { "--b": b }, onclick: () => { hodnota = b; obnov(); el2.dispatchEvent(new Event("change")); } },
      h("i", { class: "tecka", style: { background: b } }), h("span", { text: tym.vyznamBarvy(b) })));
  }
  obnov();
  el2.hodnota = () => hodnota;
  return el2;
}

function dialogTerminu(pid, { datum = null, nazev: navrh = "", poPridani = null } = {}) {
  const d0 = datum || zIso(dnes());
  const nazev = h("input", { maxlength: 200, value: navrh, placeholder: "např. Kontrolní den" });
  const od = h("input", { type: "date", value: iso(d0), required: true });
  const doo = h("input", { type: "date", value: iso(d0) });
  const druh = vyberDruhu(BARVY_TERMINU[BARVY_TERMINU.length - 1]);
  const upresneni = h("input", { maxlength: 100, placeholder: "Např. Jeřáby na stavbě, Návoz techniky…" });
  const poleUpresneni = pole("Upřesnění (nepovinné)", upresneni);
  const poznamka = h("textarea", { rows: 3, maxlength: 5000 });
  const ukazUpresneni = () => { poleUpresneni.hidden = druh.hodnota() !== BARVA_REALIZACE; };
  druh.addEventListener("change", ukazUpresneni);
  ukazUpresneni();
  const p = tym.projekt(pid);
  okno("Nový termín", [h("p", { class: "tiche", text: p ? nazevProjektu(p) : "" }), pole("Název", nazev),
    h("div", { class: "dve-pole" }, pole("Od", od), pole("Do", doo)),
    pole("Druh", druh), poleUpresneni, pole("Poznámka", poznamka)], [
    { text: "Zrušit" },
    { text: "Vytvořit", hlavni: true, akce: async () => {
      const z = zIso(od.value);
      let k = zIso(doo.value) || z;
      if (!z) throw new Error("Vyber datum.");
      const z2 = k < z ? k : z;
      k = k < z ? z : k;
      const upr = druh.hodnota() === BARVA_REALIZACE ? upresneni.value.trim() : "";
      const jmeno = nazev.value.trim() || upr;
      if (!jmeno) throw new Error("Doplň název termínu.");
      const udaje = { nazev: jmeno, poznamka: poznamka.value.trim(), barva: druh.hodnota(), stav: "Plánováno", datum: iso(z2) };
      if (iso(k) !== iso(z2)) udaje.datum_do = iso(k);
      if (upr) udaje.upresneni = upr;
      await tym.upravProjekt(pid, (pp) => {
        if (!Array.isArray(pp.harmonogram)) pp.harmonogram = [];
        pp.harmonogram.push(novyTermin(udaje, tym.ja.jmeno));
      }, `Přidán termín: ${jmeno} (${popisRozsahu(z2, k)})`);
      oznam(`Termín „${jmeno}“ přidán do harmonogramu`);
      poPridani?.();
    } },
  ]);
  nazev.focus();
  nazev.select();
}

// --- záložka Soubory: strom odkazů projektu + náhled (soubory jsou v počítačích, otevírá je program) -------

const PROTOKOL = "ild-soubor";

function otevriVPocitaci(cesta, projekt = "") {
  const url = `${PROTOKOL}:otevrit?cesta=${encodeURIComponent(cesta)}${projekt ? `&projekt=${encodeURIComponent(projekt)}` : ""}`;
  const a = h("a", { href: url, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  oznam("Otevírám v počítači – přes program Správce projektů", false, { text: "Kopírovat cestu", fn: () => zkopiruj(cesta) });
}

const jeSoubor = (cesta) => /\.[a-z0-9]{1,5}$/i.test(cesta);
const nazevOdkazu = (o) => o.popis || o.cesta.split(/[\\/]/).filter(Boolean).pop() || o.cesta;

function dialogOdkazu(pid, odkaz = null, cestu = false) {
  const popis = h("input", { value: odkaz?.popis || "", maxlength: 200, placeholder: "např. Výkresy" });
  const cesta = h("input", { value: odkaz?.cesta || "", maxlength: 1000, placeholder: "\\\\server\\zakazky\\2026\\…  nebo  P:\\Projekty\\…" });
  okno(odkaz ? (cestu ? "Změnit cestu" : "Přejmenovat odkaz") : "Přidat složku do projektu", [
    odkaz && cestu ? null : pole("Popis", popis), odkaz && !cestu ? null : pole("Cesta", cesta),
    odkaz && !cestu ? null : h("p", { class: "faint", text: "Cesta, jak ji vidí počítače v síti firmy – web na disky nevidí, otevře ji program na počítači." }),
  ], [{ text: "Zrušit" }, { text: odkaz ? "Uložit" : "Uložit odkaz", hlavni: true, ikona: "check", akce: async () => {
    const c = cesta.value.trim(), t = popis.value.trim() || c.split(/[\\/]/).filter(Boolean).pop() || c;
    if (!c) throw new Error("Doplň cestu.");
    if (!odkaz) {
      await tym.upravProjekt(pid, (p) => {
        if (!Array.isArray(p.odkazy)) p.odkazy = [];
        if (p.odkazy.some((o) => o.cesta === c)) throw new Error("Tahle cesta už v projektu je.");
        p.odkazy.push({ popis: t, cesta: c });
      }, `Přidán odkaz: ${t}`);
      stav.vybranyOdkaz = c;
      return;
    }
    await tym.upravProjekt(pid, (p) => {
      const o = (p.odkazy || []).find((x) => x.cesta === odkaz.cesta);
      if (!o) throw new Error("Odkaz už v projektu není.");
      if (cestu) { if (o.cesta === c) return false; o.cesta = c; } else { if (o.popis === t) return false; o.popis = t; }
    }, `Změněn odkaz: ${cestu ? odkaz.popis || t : t}`);
    if (cestu) stav.vybranyOdkaz = c;
  } }]);
  (odkaz && cestu ? cesta : popis).focus();
}

function odeberOdkaz(pid, odkaz) {
  okno("Odebrat z projektu?", [h("p", { text: nazevOdkazu(odkaz) }), h("p", { class: "tiche", text: "Odebere se jen odkaz v projektu – složka ani soubory na disku se nemažou." })], [
    { text: "Zrušit" },
    { text: "Odebrat", nebezpecne: true, akce: () => tym.upravProjekt(pid, (p) => {
      const i = (p.odkazy || []).findIndex((x) => x.cesta === odkaz.cesta);
      if (i < 0) return false;
      p.odkazy.splice(i, 1);
    }, `Odebrán odkaz: ${odkaz.popis || ""}`) },
  ]);
}

function menuOdkazu(x, y, pid, o) {
  menu(x, y, [
    { nadpis: nazevOdkazu(o) },
    { text: "Otevřít", ikona: "external", akce: () => otevriVPocitaci(o.cesta, pid) },
    { text: "Kopírovat cestu", ikona: "copy", akce: () => zkopiruj(o.cesta) },
    { text: "Kolegovi ve Zprávách (odkaz)…", ikona: "chat", zelena: true, akce: () => poslatOdkazy(pid, [o]) },
    "-",
    { text: "Přejmenovat…", ikona: "edit", akce: () => dialogOdkazu(pid, o) },
    { text: "Změnit cestu…", ikona: "folder", akce: () => dialogOdkazu(pid, o, true) },
    "-",
    { text: "Odebrat z projektu", ikona: "trash", nebezpecne: true, akce: () => odeberOdkaz(pid, o) },
  ]);
}

function zalozkaSoubory(id) {
  const telo = h("tbody");
  const nahled = h("div", { class: "nahled" });
  const tabulka = h("div", { class: "strom", tabindex: "0" }, h("table", {},
    h("colgroup", {}, h("col", { style: { width: "45%" } }), h("col")),
    h("thead", {}, h("tr", {}, h("th", { text: "Název" }), h("th", { text: "Cesta" }))), telo));

  function obnovNahled(o) {
    nahled.classList.toggle("prazdny", !o);   // úzká obrazovka: náhled pod seznamem, jen když je něco vybrané
    if (!o) {
      vymen(nahled, h("div", { class: "nahled-hlava" }, h("h3", { text: "Náhled" })),
        h("div", { class: "nahled-prazdny", text: "Vyber složku nebo soubor – ukáže se tu, kde přesně leží." }));
      return;
    }
    vymen(nahled, h("div", { class: "nahled-hlava" }, ikona(jeSoubor(o.cesta) ? "file" : "folder"), h("h3", { text: nazevOdkazu(o) }), h("span", { class: "mezera" }),
      h("button", { type: "button", class: "ikonove", title: "Zavřít náhled", onclick: () => { stav.vybranyOdkaz = ""; obnov(); } }, ikona("x"))),
    h("div", { class: "nahled-akce" },
      h("button", { type: "button", class: "tlacitko hlavni", onclick: () => otevriVPocitaci(o.cesta, id) }, ikona("external"), "Otevřít"),
      h("button", { type: "button", class: "tlacitko", title: "Ukázat ve složce (Průzkumník)", onclick: () => otevriVPocitaci(o.cesta, id) }, ikona("search"), "Ve složce"),
      h("button", { type: "button", class: "ikonove", title: "Kopírovat cestu", onclick: () => zkopiruj(o.cesta) }, ikona("link"))),
    h("dl", { class: "udaje" }, h("dt", { text: "Cesta" }), h("dd", { class: "cesta", text: o.cesta }),
      h("dt", { text: "Typ" }), h("dd", { text: jeSoubor(o.cesta) ? "Soubor" : "Složka" })),
    h("p", { class: "faint", text: "Soubory projektu jsou na discích firmy – otevřou se v programu Správce projektů na tomto počítači (v síti firmy nebo přes VPN)." }));
  }

  function obnov() {
    const p = tym.projekt(id);
    if (!p) return;
    const ods = (Array.isArray(p.odkazy) ? p.odkazy : []).filter((o) => o && o.cesta);
    if (stav.vybranyOdkaz && !ods.some((o) => o.cesta === stav.vybranyOdkaz)) stav.vybranyOdkaz = "";
    vymen(telo, ods.map((o) => h("tr", { class: o.cesta === stav.vybranyOdkaz ? "vybrany" : "", title: o.cesta,
      onclick: () => { stav.vybranyOdkaz = o.cesta; obnov(); },
      ondblclick: () => otevriVPocitaci(o.cesta, id),
      oncontextmenu: (ev) => { ev.preventDefault(); stav.vybranyOdkaz = o.cesta; obnov(); menuOdkazu(ev.clientX, ev.clientY, id, o); } },
    h("td", {}, h("span", { class: "nazev-odkazu" }, ikona(jeSoubor(o.cesta) ? "file" : "folder"), nazevOdkazu(o))),
    h("td", { class: "cesta-bunka", text: o.cesta }))),
    !ods.length ? h("tr", {}, h("td", { colspan: 2, class: "tiche", text: "Projekt zatím nemá žádné složky – přidej je tlačítkem + vpravo nahoře." })) : null);
    obnovNahled(ods.find((o) => o.cesta === stav.vybranyOdkaz));
  }
  obnov();
  const bPlus = h("button", { type: "button", class: "ikonove zelene", title: "Složky a soubory projektu, přidat složku…", "aria-label": "Přidat",
    onclick: () => {
      const p = tym.projekt(id);
      const ods = (p?.odkazy || []).filter((o) => o && o.cesta);
      menuPod(bPlus, [
        ...ods.map((o) => ({ text: nazevOdkazu(o), ikona: jeSoubor(o.cesta) ? "file" : "folder", akce: () => { stav.vybranyOdkaz = o.cesta; obnov(); } })),
        ods.length ? "-" : null,
        { text: "Přidat složku do projektu…", ikona: "plus", zelena: true, akce: () => dialogOdkazu(id, null) },
      ]);
    } }, ikona("plus"));
  const bVice = h("button", { type: "button", class: "ikonove", title: "Další volby", "aria-label": "Další volby",
    onclick: () => menuPod(bVice, [
      { text: "Přidat odkaz…", ikona: "link", akce: () => dialogOdkazu(id, null) },
      { text: "Otevřít složku projektu", ikona: "folder", akce: () => otevriSlozkuProjektu(tym.projekt(id)) },
      { text: "Kopírovat všechny cesty", ikona: "copy", akce: () => zkopiruj((tym.projekt(id)?.odkazy || []).map((o) => o.cesta).join("\n")) },
    ]) }, ikona("dots"));
  return { el: h("div", { class: "soubory-rozlozeni" }, tabulka, nahled), obnov, roh: [bPlus, bVice] };
}

// --- záložka Harmonogram (+ u R a O přepínač Termíny | Cashflow) -------------------------------------------

function segment(volby, vybrana, zmena) {
  const el2 = h("div", { class: "segment", role: "group" });
  for (const [hodnota, text] of volby) {
    el2.append(h("button", { type: "button", text, "aria-pressed": String(hodnota === vybrana), dataset: { h: hodnota },
      onclick: () => {
        for (const b of el2.children) b.setAttribute("aria-pressed", String(b.dataset.h === hodnota));
        zmena(hodnota);
      } }));
  }
  return el2;
}

function zalozkaHarmonogram(id, cashflow) {
  const sCashflow = () => FIN.maCashflow(tym.projekt(id)) && nast().cashflow !== false;
  const rezim = cashflow && sCashflow() ? "cashflow" : "harmonogram";
  const prepinac = sCashflow() ? segment([["harmonogram", "Termíny"], ["cashflow", "Cashflow"]], rezim,
    (v) => { window.location.hash = `#/projekt/${encodeURIComponent(id)}/${v}`; }) : null;
  if (rezim === "cashflow") {
    const cf = new Cashflow({ tym, projektId: id, vlevo: prepinac, naKalendar: () => { window.location.hash = `#/projekt/${encodeURIComponent(id)}/harmonogram`; } });
    return { el: cf.el, obnov: () => cf.obnov() };
  }
  const kal = new Kalendar({ tym, osobni, projektId: id, vlevo: prepinac, naProjekt: () => {},
    naExport: ({ obdobi }) => otevriExport({ tym, osobni, projektId: id, obdobi }),
    faktury: () => (sCashflow() && nast().faktury_v_kalendari !== false ? FIN.pruhyFaktur(tym.projekt(id)) : []),
    naFakturu: (fid, akce, x, y) => {
      if (akce === "upravit") dialogFaktury(tym, id, fid);
      else if (akce === "menu") menuFaktury(x, y, tym, id, fid);
      else if (akce === "cashflow") window.location.hash = `#/projekt/${encodeURIComponent(id)}/cashflow`;
      else if (akce === "nova") dialogFaktury(tym, id, null, { typ: FIN.VYDANA, termin: x });
    } });
  if (stav.cekajiciTermin) {
    const tid = stav.cekajiciTermin;
    stav.cekajiciTermin = null;
    setTimeout(() => kal.vyberTermin(tid, true), 60);
  }
  return { el: kal.el, obnov: () => kal.obnov(), zrus: () => kal.zrus(), jdiNaDnes: () => kal.jdiNaDnes() };
}

// --- Všechny projekty (prehled.PrehledProjektu) ---------------------------------------------------------

const filtrVsech = { stav: "", text: "", razeni: ["stav", 1], vybrany: "" };

function pohledVsechny() {
  const filtry = h("div", { class: "lista-filtru", style: { display: "contents" } });
  const hledani = h("input", { type: "search", placeholder: "Hledat v názvu, lokalitě, investorovi…", value: filtrVsech.text,
    "aria-label": "Hledat projekt", oninput: () => { filtrVsech.text = hledani.value; obnov(); } });
  const vice = h("button", { type: "button", class: "ikonove", title: "Vybraný projekt, cashflow, sloupce tabulky", "aria-label": "Další volby",
    onclick: () => tabulka?.menuVice(vice) }, ikona("dots"));
  const obal = h("div", { class: "tabulka-qt", tabindex: "0" });
  let tabulka = null;

  function obnov() {
    const projekty = tym.projekty;
    vymen(filtry, ["", ...STATUSY].map((s) => {
      const n = s ? projekty.filter((p) => p.status === s).length : projekty.length;
      return h("button", { type: "button", class: "filtr-stavu", "aria-pressed": String(filtrVsech.stav === s),
        onclick: () => { filtrVsech.stav = s; obnov(); } }, s ? odznakStavu(s, 16) : null, h("span", { text: s || "Vše" }), h("span", { class: "pocet", text: String(n) }));
    }));
    const slova = filtrVsech.text.trim().toLowerCase();
    const vybrane = projekty.filter((p) => (!filtrVsech.stav || p.status === filtrVsech.stav)
      && (!slova || [p.cislo, p.nazev, p.lokalita, p.investor, p.provozni_soubor || p.provozni_cel].join(" ").toLowerCase().includes(slova)));
    const rolovani = [obal.scrollTop, obal.scrollLeft];
    tabulka = tabulkaProjektu(tym, vybrane, filtrVsech, otevriProjekt, obnov, nast().cashflow !== false);
    vymen(obal, tabulka.el);
    [obal.scrollTop, obal.scrollLeft] = rolovani;
  }
  obnov();
  return {
    el: h("section", { class: "pohled" },
      h("div", { class: "nadpisy" }, h("span", { class: "faint", text: "PŘEHLED" }), h("h1", { text: "Všechny projekty" })),
      h("div", { class: "lista" }, filtry, h("label", { class: "s-ikonou hledani" }, ikona("search"), hledani), vice),
      obal),
    obnov,
  };
}

// --- kalendář všech projektů (KalendarPanel) --------------------------------------------------------

function pohledKalendar() {
  const kal = new Kalendar({ tym, osobni,
    naProjekt: (pid) => otevriProjekt(pid, "prehled"),
    naTermin: (pid, tid) => { stav.cekajiciTermin = tid; otevriProjekt(pid, "harmonogram"); },
    naExport: ({ obdobi, kalendar }) => otevriExport({ tym, osobni, kalendar, obdobi }),
    naDovolene: (rok) => otevriOknoDovolenych(rok),
    posledniProjekt: () => nast().posledni_projekt || "" });
  return { el: h("section", { class: "pohled" }, kal.el), obnov: () => kal.obnov(), zrus: () => kal.zrus(), jdiNa: (d) => kal.jdiNa(d) };
}

function otevriOknoDovolenych(rok) {
  otevriDovolene({ tym, osobni, rok, naKalendar: (d) => { window.location.hash = "#/kalendar"; setTimeout(() => pohled?.jdiNa?.(d), 50); } });
}

// --- zprávy (okno_zpravy.PanelZprav) ---------------------------------------------------------------

function poslatOdkazy(pid, odkazy) {
  dialogZpravy(odkazy.map((o) => ({ cesta: o.cesta, nazev: nazevOdkazu(o), slozka: !jeSoubor(o.cesta), projekt: pid })));
}

function poslatProjekt(p) {
  dialogZpravy([{ typ: "projekt", projekt: p.id, nazev: [p.lokalita, p.nazev].filter(Boolean).join(" · ") || nazevProjektu(p), cesta: hlavniSlozka(p), slozka: true }]);
}

// okno_zpravy.DialogOdkazu: komu + nepovinný vzkaz
function dialogZpravy(odkazy) {
  const komu = h("select", {}, h("option", { value: TYM, text: "Celý tým" }),
    tym.aktivni.filter((u) => u.id !== tym.ja.id).map((u) => h("option", { value: konverzaceS(tym.ja.id, u.id), text: u.jmeno })));
  const vzkaz = h("textarea", { rows: 3, maxlength: 4000, placeholder: "Vzkaz (nepovinný)" });
  okno("Poslat odkaz ve Zprávách", [
    odkazy.slice(0, 6).map((o) => h("p", { class: "zvyraznene", text: `${o.typ === "projekt" ? "Projekt " : "📎 "}${o.nazev}` })),
    pole("Komu", komu), vzkaz,
  ], [{ text: "Zrušit" }, { text: "Odeslat", hlavni: true, ikona: "send", akce: async () => {
    await posta.posli(komu.value, vzkaz.value, odkazy);
    oznam("Odkaz odeslán", false, { text: "Otevřít Zprávy", fn: () => { window.location.hash = `#/zpravy/${encodeURIComponent(komu.value)}`; } });
  } }]);
  komu.focus();
}

function casKonverzace(cas) {
  if (typeof cas !== "number") return "";
  const d = new Date(cas);
  const dnesek = zIso(dnes());
  const den = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (+den === +dnesek) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (Math.round((dnesek - den) / 86400000) === 1) return "včera";
  return datumKratce(d, d.getFullYear() !== dnesek.getFullYear());
}

function pohledZpravy(parametr) {
  const vybrana = parametr || stav.konverzace || "";
  stav.konverzace = vybrana;
  const seznam = h("div", { class: "konverzace" });
  const vlakno = h("div", { class: "vlakno", "aria-live": "polite" });
  const pole2 = h("textarea", { rows: 1, maxlength: 4000, placeholder: "Napiš zprávu…", "aria-label": "Zpráva", title: "Enter odešle, Shift+Enter = nový řádek" });
  const odeslat = h("button", { type: "submit", class: "odeslat", title: "Odeslat (Enter)", "aria-label": "Odeslat" }, ikona("send", "ikona", 20));
  const prizpusob = () => { pole2.style.height = "40px"; pole2.style.height = `${Math.min(Math.max(pole2.scrollHeight + 2, 40), 140)}px`; };
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
  const kolecko = (k, v = 36) => (k === TYM ? h("span", { class: "kolecko-tymu" }, ikona("users", "ikona", 20))
    : avatar(tym.uzivatele.find((u) => u.id === protejsek(k, tym.ja.id)) || { id: protejsek(k, tym.ja.id), jmeno: nazevKonverzace(k) }, v));
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
      const neprecteno = posta.neprecteno(k);
      return h("a", { href: `#/zpravy/${encodeURIComponent(k)}`, class: `radek-konverzace${k === vybrana ? " vybrany" : ""}${neprecteno ? " neprectene" : ""}` },
        kolecko(k),
        h("div", { class: "texty" },
          h("div", { class: "r1" }, h("span", { class: "jmeno", text: nazevKonverzace(k) }), h("span", { class: "cas", text: casKonverzace(meta?.cas) })),
          h("div", { class: "r2" }, h("span", { class: "nahled-zpravy", text: meta?.text ? od + meta.text : "Zatím bez zpráv" }),
            neprecteno ? h("span", { class: "odznak-zprav", text: "1" }) : null)));
    }));
    if (!vybrana) return;
    const druhy = protejsek(vybrana, tym.ja.id);
    vymen(hlavickaVlakna, h("a", { href: "#/zpravy/", class: "ikonove jen-mobil", "aria-label": "Zpět", onclick: () => { stav.konverzace = ""; } }, ikona("chevron-left")),
      kolecko(vybrana, 32), h("div", {}, h("h3", { text: nazevKonverzace(vybrana) }),
        h("div", { class: "faint", text: vybrana === TYM ? `${tym.aktivni.length} ${tym.aktivni.length === 1 ? "člen" : tym.aktivni.length < 5 ? "členové" : "členů"} týmu` : tym.uzivatele.find((u) => u.id === druhy)?.email || "" })));
    const zpravy = posta.seznam(vybrana);
    const dole = vlakno.scrollHeight - vlakno.scrollTop - vlakno.clientHeight < 80;
    const prvky = [];
    let posledniDen = "", posledniOd = "", posledniCas = 0;
    for (const z of zpravy) {
      const d = new Date(z.cas);
      const den = iso(d);
      if (den !== posledniDen) {
        posledniDen = den;
        posledniOd = "";
        prvky.push(h("div", { class: "oddelovac-dne", text: den === dnes() ? "Dnes" : `${DNY_CELE[denTydne(d)]} ${datumKratce(d, d.getFullYear() !== new Date().getFullYear())}` }));
      }
      const moje = z.od === tym.ja.id;
      const navazuje = z.od === posledniOd && z.cas - posledniCas < 5 * 60000;
      posledniOd = z.od;
      posledniCas = z.cas;
      const autor = tym.uzivatele.find((u) => u.id === z.od);
      prvky.push(h("div", { class: `bublina${moje ? " moje" : ""}${navazuje ? " navazuje" : ""}${z.chyba ? " chyba" : ""}` },
        !moje && vybrana === TYM && !navazuje ? h("small", { class: "odesilatel", text: tym.jmeno(z.od, "Kolega"), style: { color: barvaUzivatele(autor || { id: z.od }) } }) : null,
        h("p", { text: z.text }),
        (z.odkazy || []).map((o) => o.typ === "projekt" ? h("div", { class: "odkaz-zpravy" },
          h("a", { class: "odkaz-otevrit", href: `#/projekt/${encodeURIComponent(o.projekt)}`, title: "Otevřít projekt" },
            ikona("folder"), h("span", { text: `Projekt ${o.nazev}` })))
          : h("div", { class: "odkaz-zpravy" },
            h("button", { type: "button", class: "odkaz-otevrit", title: `${o.cesta}\nOtevřít v počítači`, onclick: () => otevriVPocitaci(o.cesta, o.projekt) },
              ikona(o.slozka ? "folder" : "file"), h("span", { text: o.nazev })),
            h("button", { type: "button", class: "ikonove male", title: "Kopírovat cestu", "aria-label": "Kopírovat cestu", onclick: () => zkopiruj(o.cesta) }, ikona("copy")))),
        h("small", { class: "cas-zpravy", text: z.chyba ? "neodesláno" : z.ceka ? "odesílá se…"
          : `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}` })));
    }
    if (!zpravy.length) prvky.push(h("p", { class: "prazdne", text: "Zatím tu nic není – napiš první zprávu." }));
    vymen(vlakno, prvky);
    if (dole || posledniPocet !== zpravy.length) vlakno.scrollTop = vlakno.scrollHeight;
    posledniPocet = zpravy.length;
    if (document.visibilityState === "visible") posta.oznacPrectene(vybrana);
  }

  if (vybrana) posta.otevri(vybrana);
  obnov();
  const el2 = h("section", { class: "pohled" },
    h("div", { class: "nadpisy" }, h("span", { class: "faint", text: "TÝM" }), h("h1", { text: "Zprávy" })),
    h("div", { class: `zpravy-telo${vybrana ? " s-vlaknem" : ""}` }, seznam,
      vybrana ? h("div", { class: "panel-vlakna" }, hlavickaVlakna, vlakno, formular)
        : h("div", { class: "panel-vlakna prazdny" }, h("p", { text: "Vyber konverzaci." }))));
  if (vybrana) setTimeout(() => { vlakno.scrollTop = vlakno.scrollHeight; if (window.matchMedia("(pointer: fine)").matches) pole2.focus(); }, 0);
  return { el: el2, obnov };
}

// --- klávesové zkratky (jako v programu) ----------------------------------------------------------------

document.addEventListener("keydown", (ev) => {
  if (!el.ram || !(ev.ctrlKey || ev.metaKey) || ev.altKey || document.querySelector("dialog[open]")) return;
  const k = ev.key.toLowerCase();
  const akce = {
    k: () => { window.location.hash = "#/kalendar"; },
    m: () => { el.aZpravy.click(); },
    b: () => prepniSeznam(),
    0: () => { window.location.hash = "#/projekty"; },
    f: () => { if (stav.sbaleno) nastavSbaleni(false); el.hledani.focus(); el.hledani.select(); },
    n: () => dialogProjektu(tym, null, otevriProjekt),
  }[k];
  if (!akce) return;
  ev.preventDefault();
  akce();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (pohled?.klic === "zpravy") pohled.obnov?.();
  // osobní nastavení mohl změnit jiný počítač (program) – motiv, seznam, kalendář
  osobni?.nacti().then(() => { nastavMotiv(nast().motiv); obnovVse(); }).catch(() => {});
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => nastavMotiv(document.documentElement.dataset.motiv));

// --- start ------------------------------------------------------------------------------------------

oblak.priOdhlaseni = (text) => ukazPrihlaseni(text);

// Instalovatelná aplikace (tablet, telefon, počítač – instalace.js): service worker drží stránku pro rychlý
// start; data týmu jdou vždy živě z Firebase (sw.js je necachuje).
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

(async () => {
  try {
    const clen = await oblak.obnovRelaci();
    if (clen) return await spust(clen);
  } catch (e) {
    if (e.druh === "sit") {
      vymen(koren, h("div", { class: "uvod" }, logo(), h("p", { text: "Bez spojení se serverem. Zkontroluj internet." }),
        h("button", { class: "tlacitko hlavni", type: "button", text: "Zkusit znovu", onclick: () => window.location.reload() })));
      return;
    }
    return ukazPrihlaseni(chybaText(e));
  }
  ukazPrihlaseni();
})();
