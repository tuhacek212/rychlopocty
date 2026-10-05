// Okno Nastavení jako v programu (nastaveni.DialogNastaveni): sekce vlevo s hledáním, vpravo skupiny
// voleb (karta s řádky: název a popis vlevo, ovládání vpravo), dole Zrušit / Uložit. Ukládá se do
// stejného osobního nastavení jako v programu (osobni/<id>) – motiv, seznam, záhlaví, kalendář, chování.

import { h, ikona, okno, oznam, prepinac } from "./ui.js";
import {
  PREDVOLBY_SEZNAMU, PREDVOLBY_ZAHLAVI, VYCHOZI_ZAHLAVI, VYCHOZI_ZOBRAZENI, avatar, nastavMotiv, normalizujZahlavi,
  normalizujZobrazeni, radekProjektu, textyZahlavi,
} from "./vzhled.js";

const VERZE_WEBU = "web";

const SEKCE = [
  ["vzhled", "Vzhled", "palette", "Barevný režim, seznam projektů a záhlaví projektu", "motiv tmavy svetly barvy seznam zahlavi"],
  ["kalendar", "Kalendář", "calendar", "Barvy pruhů, víkendy a svátky, čísla týdnů", "pruhy vikendy svatky tydny kontrast sytost"],
  ["chovani", "Chování", "settings", "Na které záložce se otevře projekt, upozornění, cashflow", "zalozka upozorneni cashflow faktury"],
  "-",
  ["uzivatele", "Uživatelé", "users", "Přihlášení a odhlášení", "prihlaseni odhlaseni heslo uzivatel"],
  "-",
  ["o_programu", "O programu", "shield", "Webová verze Správce projektů", "verze web aplikace"],
];

const bezDiakritiky = (t) => String(t || "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");

function segment(volby, vybrana, zmena) {
  const el = h("div", { class: "segment", role: "group" });
  for (const [hodnota, text] of volby) {
    el.append(h("button", { type: "button", text, "aria-pressed": String(hodnota === vybrana), dataset: { h: hodnota },
      onclick: () => { for (const b of el.children) b.setAttribute("aria-pressed", String(b.dataset.h === hodnota)); zmena(hodnota); } }));
  }
  return el;
}

function skupina(nadpis, popis, ...radky) {
  return h("section", { class: "skupina" }, nadpis ? h("div", { class: "skupina-nadpis", text: nadpis }) : null,
    popis ? h("div", { class: "faint", text: popis }) : null, h("div", { class: "skupina-karta" }, radky));
}

function radek(nazev, popis, ovladani, pod = false) {
  return h("div", { class: `nast-radek${pod ? " pod" : ""}` },
    h("div", { class: "texty" }, h("strong", { text: nazev }), popis ? h("small", { text: popis }) : null), ovladani);
}

function vyber(moznosti, hodnota, zmena) {
  const s = h("select", { onchange: () => zmena(s.value) }, moznosti.map(([k, t]) => h("option", { value: k, text: t, selected: k === hodnota })));
  return s;
}

function rozsahProcent(hodnota, min, max, krok, zmena) {
  const r = h("input", { type: "range", min, max, step: krok, value: hodnota, style: { width: "160px" } });
  const text = h("span", { class: "faint", style: { width: "44px", textAlign: "right" }, text: `${hodnota} %` });
  const nastav = () => { r.style.setProperty("--hodnota", `${((r.value - min) / (max - min)) * 100}%`); text.textContent = `${r.value} %`; };
  r.addEventListener("input", () => { nastav(); zmena(Number(r.value)); });
  nastav();
  return h("span", { style: { display: "inline-flex", alignItems: "center", gap: "8px" } }, r, text);
}

// miniatura motivu (VyberMotivu): lišta aktivit, seznam, obsah, stavový řádek
function miniatura(tmavy) {
  const b = tmavy ? ["#181818", "#181818", "#1F1F1F"] : ["#F8F8F8", "#F8F8F8", "#FFFFFF"];
  return h("span", { class: "miniatura" }, h("i", { style: { background: b[0] } }), h("i", { style: { background: b[1], borderRight: `1px solid ${tmavy ? "#2B2B2B" : "#E5E5E5"}` } }),
    h("i", { style: { background: b[2] } }), h("i", { style: { gridColumn: "1 / 4", background: "#195C00" } }));
}

export function otevriNastaveni({ tym, osobni, sekce = "vzhled", odhlas = () => {}, instaluj = null }) {
  const n = structuredClone(osobni.hodnota || {});
  const zmeny = {};
  const zmen = (klic, hodnota) => { zmeny[klic] = hodnota; n[klic] = hodnota; };
  const vzhledKal = () => ({ ...(n.vzhled_kalendare && typeof n.vzhled_kalendare === "object" ? n.vzhled_kalendare : {}) });
  const zmenKal = (klic, hodnota) => { const v = vzhledKal(); v[klic] = hodnota; zmen("vzhled_kalendare", v); };
  const kal = () => osobni.vzhled.call({ hodnota: n });

  const stranky = {
    vzhled() {
      const motiv = n.motiv || "svetly";
      const dlazdice = h("div", { class: "dlazdice-motivu" }, [["svetly", "Světlý", false], ["tmavy", "Tmavý", true], ["system", "Podle Windows", null]].map(([k, t, tm]) =>
        h("button", { type: "button", "aria-pressed": String(k === motiv), onclick: (ev) => {
          for (const b of dlazdice.children) b.setAttribute("aria-pressed", "false");
          ev.currentTarget.setAttribute("aria-pressed", "true");
          zmen("motiv", k);
          nastavMotiv(k);   // náhled hned (Zrušit vrátí)
        } }, tm === null ? h("span", { style: { display: "flex" } }, miniatura(false), h("span", { style: { marginLeft: "-60px" } }, miniatura(true))) : miniatura(tm), t)));
      const zobr = normalizujZobrazeni(n.seznam_zobrazeni);
      const predvolbaSeznamu = Object.entries(PREDVOLBY_SEZNAMU).find(([, z]) => JSON.stringify(z.pole) === JSON.stringify(zobr.pole)
        && z.prvni_radek === zobr.prvni_radek && z.zbytek === zobr.zbytek)?.[0] || "";
      const nahled = h("div", { class: "sidebar", style: { width: "300px", maxWidth: "100%", border: "1px solid var(--c-border)", borderRadius: "6px", padding: "8px", gap: "0" } });
      const ukazkove = [
        { id: "n1", nazev: "Silo – dopravníky", lokalita: "Kojetín", investor: "Agro Kojetín a.s.", cislo: "2026-014", status: "Realizace", provozni_soubor: "PS 02",
          ukoly: [{ id: "u1", text: "x", hotovo: false }, { id: "u2", text: "y", hotovo: false }], harmonogram: [] },
        { id: "n2", nazev: "Hala – jeřábová dráha", lokalita: "Brno", investor: "Strojírny Brno", cislo: "2026-021", status: "Poptávka", harmonogram: [] },
        { id: "n3", nazev: "Sušárna obilí", lokalita: "Napajedla", investor: "Obec Napajedla", cislo: "2025-088", status: "Realizováno", harmonogram: [] },
      ];
      const obnovNahled = () => {
        const z = normalizujZobrazeni(n.seznam_zobrazeni);
        nahled.replaceChildren(...ukazkove.map((p, i) => radekProjektu(p, z, { vybrany: i === 0, upozorneni: false })));
      };
      const zmenZobrazeni = (zmena) => { zmen("seznam_zobrazeni", { ...normalizujZobrazeni(n.seznam_zobrazeni), ...zmena }); obnovNahled(); };
      obnovNahled();
      const zah = normalizujZahlavi(n.zahlavi_zobrazeni);
      const predvolbaZahlavi = Object.entries(PREDVOLBY_ZAHLAVI).find(([, z]) => JSON.stringify(z.pole) === JSON.stringify(zah.pole)
        && z.prvni_radek === zah.prvni_radek && z.zbytek === zah.zbytek)?.[0] || "";
      const nahledZahlavi = h("div", { class: "karta", style: { padding: "16px 20px" } });
      const obnovZahlavi = () => {
        const [nadpis, pod] = textyZahlavi(ukazkove[0], n.zahlavi_zobrazeni);
        nahledZahlavi.replaceChildren(h("h1", { text: nadpis }), ...pod.map((r) => h("div", { class: "tiche", text: r })));
      };
      obnovZahlavi();
      return [
        skupina("Barevný režim", "", radek("Vzhled aplikace", "Světlý, tmavý, nebo podle nastavení systému.", dlazdice, true)),
        h("div", { class: "nast-sloupce" },
          skupina("Seznam projektů", "Co a v jakém pořadí ukazuje seznam vlevo.",
            radek("Rozvržení", "", vyber([["", "Vlastní"], ...Object.keys(PREDVOLBY_SEZNAMU).map((k) => [k, k])], predvolbaSeznamu || (n.seznam_zobrazeni ? "" : VYCHOZI_ZOBRAZENI),
              (v) => { if (v) zmenZobrazeni({ ...structuredClone(PREDVOLBY_SEZNAMU[v]), stav: normalizujZobrazeni(n.seznam_zobrazeni).stav,
                hustota: normalizujZobrazeni(n.seznam_zobrazeni).hustota }); }), true),
            radek("Stav písmenem vlevo", "Barevný čtvereček P / R / O / M", prepinac(zobr.stav, (v) => zmenZobrazeni({ stav: v }))),
            radek("Úsporné řádky", "Vše na jednom nízkém řádku", prepinac(zobr.hustota === "usporne", (v) => zmenZobrazeni({ hustota: v ? "usporne" : "standardni" }))),
            h("div", { class: "nast-radek pod" }, nahled)),
          skupina("Záhlaví projektu", "Nadpis a tichý řádek pod ním.",
            radek("Rozvržení", "", vyber([["", "Vlastní"], ...Object.keys(PREDVOLBY_ZAHLAVI).map((k) => [k, k])], predvolbaZahlavi || (n.zahlavi_zobrazeni ? "" : VYCHOZI_ZAHLAVI),
              (v) => { if (v) { zmen("zahlavi_zobrazeni", structuredClone(PREDVOLBY_ZAHLAVI[v])); obnovZahlavi(); } }), true),
            h("div", { class: "nast-radek pod" }, nahledZahlavi))),
      ];
    },
    kalendar() {
      const v = kal();
      return [
        skupina("Pruhy termínů", "",
          radek("Styl pruhů", "", segment([["plne", "Plné barvy"], ["svetle", "Světlé"], ["obrys", "Jen obrys"]], v.pruhy, (x) => zmenKal("pruhy", x))),
          radek("Sytost barev", "Méně = tlumenější, víc = výraznější", rozsahProcent(v.sytost, 30, 140, 5, (x) => zmenKal("sytost", x))),
          radek("Velikost písma", "", rozsahProcent(v.pismo, 80, 150, 5, (x) => zmenKal("pismo", x))),
          radek("Výška pruhů", "Vyšší pruhy zvětší i buňky", rozsahProcent(v.vyska, 80, 160, 5, (x) => zmenKal("vyska", x))),
          radek("Ztlumit proběhlé termíny", "Jako hotové", prepinac(v.probehle, (x) => zmenKal("probehle", x)))),
        skupina("Mřížka", "",
          radek("Kontrast", "Mřížka, víkendy, minulé dny", segment([["jemny", "Jemný"], ["bezny", "Běžný"], ["vyrazny", "Výrazný"]], v.kontrast, (x) => zmenKal("kontrast", x))),
          radek("Podbarvit víkendy", "", prepinac(v.vikendy, (x) => zmenKal("vikendy", x))),
          radek("Výraznost víkendů a svátků", "Na některých monitorech splývají", rozsahProcent(v.vikendy_sila, 0, 100, 5, (x) => zmenKal("vikendy_sila", x))),
          radek("Čísla týdnů", "Vlevo od měsíce", prepinac(v.tydny, (x) => zmenKal("tydny", x))),
          radek("Státní svátky", "Podbarvený den, červené číslo, název", prepinac(v.svatky, (x) => zmenKal("svatky", x))),
          radek("I slovenské svátky", "U svátku malá vlaječka státu", prepinac(v.svatky_sk, (x) => zmenKal("svatky_sk", x)))),
      ];
    },
    chovani() {
      return [
        skupina("Projekt", "",
          radek("Na které záložce se projekt otevře", "", vyber([["posledni", "Stejná jako u předchozího projektu"], ["projekt", "Naposledy otevřená v projektu"],
            ["prehled", "Přehled"], ["soubory", "Soubory"], ["harmonogram", "Harmonogram"]], n.vychozi_zalozka || "posledni", (x) => zmen("vychozi_zalozka", x)))),
        skupina("Upozornění", "",
          radek("Upozorňovat na blížící se termíny", "Tečka u projektu v seznamu", prepinac(n.upozorneni !== false, (x) => zmen("upozorneni", x))),
          radek("Kolik dní předem", "", vyber([["0", "Jen v den termínu"], ["1", "Den předem"], ["3", "3 dny předem"], ["7", "Týden předem"]],
            String(n.upozorneni_dni ?? 1), (x) => zmen("upozorneni_dni", Number(x))))),
        skupina("Cashflow zakázek", "Zakázky v realizaci a realizované – faktury, příjmy a výdaje.",
          radek("Cashflow zakázek", "Přepínač Termíny | Cashflow v harmonogramu R a O", prepinac(n.cashflow !== false, (x) => zmen("cashflow", x))),
          radek("Faktury v kalendáři harmonogramu", "", prepinac(n.faktury_v_kalendari !== false, (x) => zmen("faktury_v_kalendari", x)))),
      ];
    },
    uzivatele() {
      const ja = tym.uzivatele.find((u) => u.id === tym.ja.id) || { id: tym.ja.id, jmeno: tym.ja.jmeno };
      return [
        skupina("Přihlášení", "",
          h("div", { class: "nast-radek" }, avatar(ja, 36), h("div", { class: "texty" }, h("strong", { text: ja.jmeno || "" }),
            h("small", { text: [tym.jeSpravce ? "Správce" : "Uživatel", ja.email].filter(Boolean).join(" · ") })),
          h("button", { type: "button", class: "tlacitko", onclick: odhlas }, ikona("power"), "Odhlásit se"))),
        tym.jeSpravce ? skupina("Uživatelé", "Účty, hesla a práva se spravují v programu na počítači.",
          ...tym.uzivatele.map((u) => h("div", { class: "nast-radek" }, avatar(u, 28), h("div", { class: "texty" },
            h("strong", { text: u.jmeno }), h("small", { text: [u.role === "admin" ? "Správce" : "Uživatel", u.aktivni === false ? "neaktivní" : "", u.email].filter(Boolean).join(" · ") }))))) : null,
      ];
    },
    o_programu() {
      return [
        skupina("Správce projektů", "",
          radek("Webová verze", "Stejná data týmu jako program na počítači. Soubory projektů se otevírají v programu.", h("span", { class: "faint", text: VERZE_WEBU })),
          instaluj ? radek("Aplikace do telefonu, tabletu a počítače", "Ikona na ploše, celá obrazovka bez lišt prohlížeče, rychlejší start",
            h("button", { type: "button", class: "tlacitko", onclick: instaluj }, ikona("telefon"), "Nainstalovat…")) : null),
      ];
    },
  };

  const navigace = h("nav", { class: "nast-bok" });
  const hledani = h("input", { type: "search", placeholder: "Hledat v nastavení…" });
  const obsah = h("div", { class: "nast-obsah" });
  let aktualni = SEKCE.some((s) => s[0] === sekce) ? sekce : "vzhled";

  function postavNavigaci() {
    const slova = bezDiakritiky(hledani.value).trim();
    navigace.replaceChildren(hledani, ...SEKCE.map((s) => {
      if (s === "-") return slova ? null : h("div", { class: "nast-cara" });
      const [k, t, ik, , klicova] = s;
      if (slova && !bezDiakritiky(`${t} ${klicova}`).includes(slova)) return null;
      return h("button", { type: "button", class: `nast-polozka${k === aktualni ? " vybrana" : ""}`, onclick: () => { aktualni = k; postavNavigaci(); ukaz(); } },
        ikona(ik), t);
    }));
  }
  function ukaz() {
    const [, t, ik, popis] = SEKCE.find((s) => s[0] === aktualni);
    obsah.replaceChildren(h("div", { class: "nast-hlava" }, ikona(ik), h("div", {}, h("h1", { text: t }), h("div", { class: "tiche", text: popis }))),
      ...stranky[aktualni]().filter(Boolean));
    obsah.scrollTop = 0;
  }
  hledani.addEventListener("input", () => {
    postavNavigaci();
    const prvni = navigace.querySelector(".nast-polozka");
    if (prvni && !navigace.querySelector(".nast-polozka.vybrana")) prvni.click();
  });
  postavNavigaci();
  ukaz();

  const puvodniMotiv = osobni.hodnota.motiv || "svetly";
  let ulozeno = false;
  const o = okno("Nastavení", [h("div", { class: "nast" }, navigace, h("div", { class: "nast-stranka" }, obsah,
    h("div", { class: "nast-paticka" },
      h("button", { type: "button", class: "tlacitko", text: "Zrušit", onclick: () => o.zavri() }),
      h("button", { type: "button", class: "tlacitko hlavni", onclick: async () => {
        ulozeno = true;
        const klice = Object.keys(zmeny);
        if (klice.length) {
          try {
            await osobni.uprav((h2) => { for (const k of klice) h2[k] = structuredClone(zmeny[k]); }, true);
            oznam("Nastavení uloženo");
          } catch {
            oznam("Nastavení se nepodařilo uložit – zkus to znovu", true);
          }
        }
        o.zavri();
      } }, ikona("check"), "Uložit"))))], [], { trida: "nastaveni", bezNadpisu: true });
  o.dialog.addEventListener("close", () => { if (!ulozeno) nastavMotiv(puvodniMotiv); });
}
