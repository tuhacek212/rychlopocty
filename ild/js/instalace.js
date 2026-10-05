// Aplikace do telefonu, tabletu i počítače = instalace webu (PWA), žádný soubor ke stažení.
// Android a Chrome / Edge na počítači nabídnou instalaci samy (beforeinstallprompt), iPhone a iPad jen
// přes Sdílet → Přidat na plochu – proto okno s návodem podle zařízení. Nainstalovaná aplikace běží
// bez lišt prohlížeče (na telefonu nic nezakrývají) a startuje rychleji.

import { h, ikona, okno, oznam, zkopiruj } from "./ui.js";

const NAZEV = "Správce projektů ILD";
let pozvanka = null;   // beforeinstallprompt – instalace jedním klepnutím

window.addEventListener("beforeinstallprompt", (ev) => { ev.preventDefault(); pozvanka = ev; });
window.addEventListener("appinstalled", () => {
  pozvanka = null;
  oznam("Aplikace je nainstalovaná – spouštěj ji z ikony ILD");
});

export function jeNainstalovano() {
  return navigator.standalone === true
    || window.matchMedia("(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui), (display-mode: window-controls-overlay)").matches;
}

export const adresaAplikace = () => new URL("./", window.location.href).href;

function zarizeni() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const prohlizec = /SamsungBrowser/i.test(ua) ? "samsung" : /Firefox|FxiOS/i.test(ua) ? "firefox"
    : /EdgA|EdgiOS|Edg\//i.test(ua) ? "edge" : /CriOS|Chrome|Chromium/i.test(ua) ? "chrome" : /Safari/i.test(ua) ? "safari" : "";
  return { ios, ipad: ios && !/iPhone|iPod/i.test(ua), android: /Android/i.test(ua), mac: !ios && /Macintosh/i.test(ua), prohlizec };
}

// [ikona, text] – postup v menu prohlížeče, když instalace jedním klepnutím není k dispozici
function kroky(z) {
  if (z.ios) {
    const kde = z.prohlizec === "safari" ? (z.ipad ? "nahoře vpravo" : "dole – v novém iOS je pod ⋯ vedle adresy")
      : "v adresním řádku nebo v nabídce ⋯";
    return [
      ["sdilet", `Klepni na Sdílet (${kde}).`],
      ["plus", "Vyber „Přidat na plochu“ – případně nabídku posuň níž."],
      ["check", "Potvrď „Přidat“. Na ploše přibude ikona ILD, spouštěj aplikaci odtud."],
    ];
  }
  if (z.android) {
    if (z.prohlizec === "samsung") {
      return [["nabidka", "Klepni na ☰ (Nabídka) dole vpravo."], ["plus", "Vyber „Přidat stránku do“ → „Domovská obrazovka“."], ["check", "Potvrď „Přidat“."]];
    }
    return [
      ["dots", `Klepni na ⋮ (Nabídka) ${z.prohlizec === "firefox" ? "" : "vpravo nahoře"}`.trim() + "."],
      ["plus", "Vyber „Nainstalovat aplikaci“ nebo „Přidat na plochu“."],
      ["check", "Potvrď „Nainstalovat“. Ikona ILD bude mezi aplikacemi."],
    ];
  }
  if (z.prohlizec === "chrome" || z.prohlizec === "edge") {
    return [["download", "V adresním řádku vpravo klikni na ikonu Nainstalovat."], ["dots", "Nebo otevři nabídku prohlížeče a vyber „Nainstalovat…“."]];
  }
  if (z.mac && z.prohlizec === "safari") return [["sdilet", "V Safari vyber Soubor → „Přidat do Docku“."]];
  return [];
}

// Okno „Nainstalovat aplikaci“ – z přihlášení, z menu uživatele i z Nastavení → O programu.
export function otevriInstalaci() {
  const z = zarizeni();
  const adresa = adresaAplikace();
  const nainstalovano = jeNainstalovano();
  const postup = kroky(z);
  const obsah = [
    h("div", { class: "instalace-hlava" }, h("img", { src: "ikona-192.png", alt: "", width: 52, height: 52 }),
      h("div", {}, h("strong", { text: NAZEV }),
        h("div", { class: "tiche", text: nainstalovano ? "Aplikace je na tomto zařízení nainstalovaná."
          : "Ikona na ploše, celá obrazovka bez lišt prohlížeče a rychlejší start. Data jsou stejná jako na webu." }))),
  ];
  if (!nainstalovano) {
    if (pozvanka) {
      obsah.push(h("button", { type: "button", class: "tlacitko hlavni siroke instalovat", onclick: async () => {
        const p = pozvanka;
        pozvanka = null;
        p.prompt();
        const volba = await p.userChoice.catch(() => null);
        if (volba?.outcome === "accepted") o.zavri();
      } }, ikona("download"), "Nainstalovat"));
    } else if (postup.length) {
      obsah.push(h("ol", { class: "kroky-instalace" }, postup.map(([ik, text], i) =>
        h("li", {}, h("span", { class: "cislo", text: String(i + 1) }), h("span", { text }), ikona(ik)))));
      if (z.ios && z.prohlizec !== "safari") obsah.push(h("p", { class: "faint", text: "Kdyby „Přidat na plochu“ chybělo, otevři odkaz v Safari." }));
    } else {
      obsah.push(h("p", { class: "tiche", text: "Tenhle prohlížeč instalaci neumí – otevři odkaz v Chrome, Edge nebo Safari." }));
    }
  }
  obsah.push(
    h("div", { class: "sekce-nadpis odkaz-nadpis", text: "Odkaz pro kolegy a další zařízení" }),
    h("div", { class: "odkaz-webu" }, h("span", { class: "adresa", text: adresa }),
      navigator.share ? h("button", { type: "button", class: "ikonove", title: "Poslat odkaz", "aria-label": "Poslat odkaz",
        onclick: () => navigator.share({ title: NAZEV, url: adresa }).catch(() => {}) }, ikona("sdilet")) : null,
      h("button", { type: "button", class: "ikonove", title: "Kopírovat odkaz", "aria-label": "Kopírovat odkaz", onclick: () => zkopiruj(adresa) }, ikona("copy"))),
    h("p", { class: "faint", text: "Na počítači s Windows je lepší program Správce projektů – otevírá i soubory projektů. Instalaci dostaneš od správce." }));
  const o = okno("Nainstalovat aplikaci", obsah, [{ text: "Zavřít" }], { trida: "instalace" });
  return o;
}

// Odkaz na přihlašovací obrazovce (v nainstalované aplikaci se neukazuje)
export function odkazInstalace() {
  if (jeNainstalovano()) return null;
  return h("button", { type: "button", class: "odkaz-instalace", onclick: otevriInstalaci }, ikona("telefon"), "Nainstalovat aplikaci do telefonu nebo počítače");
}
