// Export kalendáře a harmonogramu (dialog_tisku.DialogExportu): co, období, vzhled (Kalendář |
// Harmonogram + seznam termínů), stránky, papír, barvy, co zahrnout; výstup PDF | Excel | Tisk s náhledem.
// PDF = tisk prohlížeče („Uložit jako PDF“), Excel = skutečný .xlsx (xlsx.js).

import {
  DNY, Dovolene, MESICE, NEAKTIVNI, cislo, datumKratce, dnes, hodinyText, iso, jeHotovo, nazevProjektu,
  pridejDny, rozsah, svatkyDne, zIso,
} from "./data.js";
import { sestavPolozky } from "./kalendar.js";
import { h, oznam, pole, vymen } from "./ui.js";
import { sloupec, stahni, vytvorXlsx } from "./xlsx.js";

const PAPIRY = { A4: [210, 297], A3: [297, 420] };
const OBDOBI = [["mesic", "Měsíc", 1], ["2m", "2 měs.", 2], ["4m", "4 měs.", 4], ["6m", "6 měs.", 6], ["12m", "Rok", 12]];
const KLIC_PROFILU = "ild-export";
const kolator = new Intl.Collator("cs");
const velke = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const pocetDni = (z, k) => Math.round((k - z) / 86400000);
const DOVOLENE_VYBER = "__dovolene_report__";

function nactiProfil() {
  try { return JSON.parse(window.localStorage.getItem(KLIC_PROFILU) || "{}") || {}; } catch { return {}; }
}

function ulozProfil(p) {
  try { window.localStorage.setItem(KLIC_PROFILU, JSON.stringify(p)); } catch { /* nic */ }
}

function segment(volby, hodnota, zmena) {
  const el = h("div", { class: "segment", role: "group" });
  const prekresli = (v) => vymen(el, volby.map(([k, t]) => h("button", { type: "button", text: t, "aria-pressed": String(k === v),
    onclick: () => { prekresli(k); zmena(k); } })));
  prekresli(hodnota);
  el.nastav = prekresli;
  return el;
}

// --- dialog ------------------------------------------------------------------------------------

export function otevriExport({ tym, osobni, projektId = null, kalendar = null, obdobi = null }) {
  const ulozeny = nactiProfil();
  const p = {
    vzhled: projektId ? "harmonogram" : "kalendar", seznam: false, stranky: "jedna", stran: 2, papir: "A4", naSirku: true,
    barvy: "barevne", hotove: true, svatky: true, poznamky: false, format: "pdf", obdobi: projektId ? "vse" : "mesic",
    ...(ulozeny[projektId ? "harmonogram" : "kalendar"] || {}),
  };
  const dnesek = zIso(dnes());
  let vlastni = obdobi ? [...obdobi] : null;
  if (vlastni) p.obdobi = "vlastni";

  // co exportovat
  const co = h("select", {});
  if (projektId) {
    co.append(h("option", { value: projektId, text: nazevProjektu(tym.projekt(projektId)) }));
  } else {
    co.append(h("option", { value: "", text: "Kalendář – vše zobrazené (podle filtru)" }));
    for (const pr of [...tym.projekty].filter((x) => !NEAKTIVNI.has(x.status)).sort((a, b) => kolator.compare(nazevProjektu(a), nazevProjektu(b)))) {
      co.append(h("option", { value: pr.id, text: `Projekt – ${nazevProjektu(pr)}` }));
    }
    co.append(h("option", { value: DOVOLENE_VYBER, text: tym.jeSpravce ? "Dovolené – přehled lidí (převod, čerpáno, zbývá)" : "Moje dovolená" }));
  }

  const od = h("input", { type: "date" }), doo = h("input", { type: "date" });
  const poleOdDo = h("div", { class: "dve-pole" }, pole("Od", od), pole("Do (včetně)", doo));
  const volbyObdobi = [...OBDOBI.map(([k, t]) => [k, t]), ...(projektId ? [["vse", "Vše"]] : []), ["vlastni", "Vlastní"]];
  const segObdobi = segment(volbyObdobi, p.obdobi, (v) => { p.obdobi = v; if (v === "vlastni" && !vlastni) vlastni = urciObdobi(); obnov(); });
  const segVzhled = segment([["kalendar", "Kalendář"], ["harmonogram", "Harmonogram"]], p.vzhled, (v) => { p.vzhled = v; obnov(); });
  const seznam = zaskrt("+ seznam termínů", p.seznam, (v) => { p.seznam = v; obnov(); });
  const segStranky = segment([["jedna", "Na jednu stránku"], ["vice", "Na více stránek"]], p.stranky, (v) => { p.stranky = v; obnov(); });
  const stran = h("input", { type: "number", min: 2, max: 24, value: p.stran, class: "pocet-stran", "aria-label": "Počet stránek",
    oninput: () => { p.stran = Math.max(2, Math.min(24, Number(stran.value) || 2)); obnov(); } });
  const papir = h("select", { onchange: () => { p.papir = papir.value; obnov(); } }, ["A4", "A3"].map((x) => h("option", { value: x, text: x, selected: x === p.papir })));
  const orientace = h("select", { onchange: () => { p.naSirku = orientace.value === "sirka"; obnov(); } },
    h("option", { value: "sirka", text: "Na šířku", selected: p.naSirku }), h("option", { value: "vyska", text: "Na výšku", selected: !p.naSirku }));
  const segBarvy = segment([["barevne", "Barevně"], ["sede", "Černobíle"]], p.barvy, (v) => { p.barvy = v; obnov(); });
  const zahrnout = h("div", { class: "zahrnout" },
    zaskrt("Hotové termíny", p.hotove, (v) => { p.hotove = v; obnov(); }),
    zaskrt("Státní svátky", p.svatky, (v) => { p.svatky = v; obnov(); }),
    zaskrt("Poznámky termínů (v seznamu)", p.poznamky, (v) => { p.poznamky = v; obnov(); }));
  const segFormat = segment([["pdf", "PDF"], ["xlsx", "Excel"], ["tisk", "Tisk"]], p.format, (v) => { p.format = v; obnov(); });
  const popis = h("p", { class: "tiche male" });
  const hlavni = h("button", { type: "button", class: "tlacitko hlavni", onclick: () => proved() });
  const nahled = h("div", { class: "nahled-stran" });
  const strankovani = h("span", { class: "tiche male" });

  const casti = {
    vzhled: h("div", {}, pole("Vzhled", segVzhled), seznam),
    stranky: pole("Výstup", h("div", { class: "radek-stran" }, segStranky, stran)),
    papir: h("div", { class: "dve-pole" }, pole("Papír", papir), pole("Orientace", orientace)),
  };
  const formular = h("div", { class: "export-formular" },
    h("h2", { text: projektId ? "Export harmonogramu" : "Export kalendáře" }),
    pole("Co exportovat", co), pole("Období", segObdobi), poleOdDo,
    casti.vzhled, casti.stranky, casti.papir, pole("Barvy", segBarvy), pole("Zahrnout", zahrnout),
    h("div", { class: "mezera" }), popis, pole("Výstup", segFormat),
    h("div", { class: "export-tlacitka" }, h("button", { type: "button", class: "tlacitko", text: "Zavřít", onclick: () => zavri() }), hlavni));
  const dialog = h("dialog", { class: "okno export" }, h("div", { class: "export-rozlozeni" }, formular,
    h("div", { class: "export-nahled" }, h("div", { class: "export-nahled-hlavicka" }, h("strong", { text: "Náhled" }), strankovani), nahled)));
  const zavri = () => { dialog.close(); dialog.remove(); };
  dialog.addEventListener("cancel", (ev) => { ev.preventDefault(); zavri(); });
  document.body.append(dialog);
  dialog.showModal();
  co.addEventListener("change", () => obnov());
  for (const el of [od, doo]) el.addEventListener("change", () => {
    const z = zIso(od.value), k = zIso(doo.value);
    if (z && k) { vlastni = z <= k ? [z, k] : [k, z]; p.obdobi = "vlastni"; segObdobi.nastav("vlastni"); obnov(); }
  });

  function urciObdobi() {
    if (p.obdobi === "vlastni" && vlastni) return vlastni;
    const z = new Date(dnesek.getFullYear(), dnesek.getMonth(), 1);
    if (co.value === DOVOLENE_VYBER && p.obdobi !== "vlastni") return [new Date(dnesek.getFullYear(), 0, 1), new Date(dnesek.getFullYear(), 11, 31)];
    if (p.obdobi === "vse") {
      const pol = polozky(true);
      if (pol.length) return [new Date(Math.min(...pol.map((x) => x.rz[0]))), new Date(Math.max(...pol.map((x) => x.rz[1])))];
      return [z, new Date(z.getFullYear(), z.getMonth() + 1, 0)];
    }
    const mesicu = (OBDOBI.find((x) => x[0] === p.obdobi) || OBDOBI[0])[2];
    return [z, new Date(z.getFullYear(), z.getMonth() + mesicu, 0)];
  }

  function polozky(bezObdobi = false) {
    const vse = co.value && co.value !== DOVOLENE_VYBER ? sestavPolozky(tym, osobni, co.value)
      : kalendar ? kalendar.polozky : sestavPolozky(tym, osobni, null);
    const [z, k] = bezObdobi ? [new Date(1900, 0, 1), new Date(2200, 0, 1)] : urciObdobi();
    return vse.filter((x) => x.rz[1] >= z && x.rz[0] <= k && (p.hotove || !jeHotovo(x.pol)))
      .sort((a, b) => a.rz[0] - b.rz[0] || kolator.compare(a.text, b.text));
  }

  function nastaveni() {
    const [z, k] = urciObdobi();
    const projekt = co.value && co.value !== DOVOLENE_VYBER ? tym.projekt(co.value) : null;
    return {
      ...p, od: z, do: k, dovolene: co.value === DOVOLENE_VYBER,
      nadpis: co.value === DOVOLENE_VYBER ? (tym.jeSpravce ? "Dovolené" : "Moje dovolená") : projekt ? nazevProjektu(projekt) : "Kalendář",
      podnadpis: projekt ? [projekt.nazev !== nazevProjektu(projekt) ? projekt.nazev : "", projekt.cislo ? `Zakázka ${projekt.cislo}` : ""].filter(Boolean).join(" · ") : "",
      staty: osobni.vzhled().svatky_sk ? ["cz", "sk"] : ["cz"],
      jedenProjekt: !!projekt,
    };
  }

  let strany = [];
  function obnov() {
    const n = nastaveni();
    const dov = n.dovolene;
    poleOdDo.hidden = p.obdobi !== "vlastni";
    if (p.obdobi === "vlastni") { const [z, k] = urciObdobi(); od.value = iso(z); doo.value = iso(k); }
    casti.vzhled.hidden = dov;
    casti.stranky.hidden = dov;
    zahrnout.hidden = dov;
    stran.hidden = p.stranky !== "vice";
    const pol = dov ? [] : polozky();
    strany = dov ? stranyDovolenych(tym, n) : vyrobStrany(tym, pol, n);
    vymen(nahled, strany.map((s) => h("div", { class: "nahled-strana" }, s.cloneNode(true))));
    zmensiNahled();
    strankovani.textContent = `${strany.length} ${strany.length === 1 ? "stránka" : strany.length <= 4 ? "stránky" : "stran"}`;
    const text = { pdf: "Uložit PDF…", xlsx: "Uložit Excel…", tisk: "Tisknout…" }[p.format];
    hlavni.replaceChildren(text);
    popis.textContent = p.format === "pdf" ? "PDF uloží tisk prohlížeče – v okně tisku zvol „Uložit jako PDF“."
      : p.format === "xlsx" ? `Excel: ${dov ? "přehled a rozpis dovolených" : ["Kalendář", "Časový diagram", "Seznam termínů"].join(", ")}.`
        : `${strany.length} ${strany.length === 1 ? "stránka" : "stran"} na tiskárnu.`;
    ulozProfil({ ...nactiProfil(), [projektId ? "harmonogram" : "kalendar"]: { ...p, obdobi: p.obdobi === "vlastni" ? (projektId ? "vse" : "mesic") : p.obdobi } });
  }

  function zmensiNahled() {
    requestAnimationFrame(() => {
      const sirka = nahled.clientWidth - 24;
      for (const obal of nahled.children) {
        const s = obal.firstChild;
        const [w] = rozmery(p);
        const px = w * 3.7795;
        const k = Math.min(1, sirka / px);
        s.style.transform = `scale(${k})`;
        obal.style.width = `${px * k}px`;
        obal.style.height = `${(rozmery(p)[1] * 3.7795) * k}px`;
      }
    });
  }

  function proved() {
    const n = nastaveni();
    const jmeno = `${n.nadpis} ${iso(n.od)}${iso(n.od) !== iso(n.do) ? `–${iso(n.do)}` : ""}`.replace(/[\\/:*?"<>|]/g, "-");
    if (p.format === "xlsx") {
      const listy = n.dovolene ? listyDovolenych(tym, n) : listyExcelu(tym, polozky(), n);
      stahni(vytvorXlsx(listy), `${jmeno}.xlsx`);
      oznam("Excel uložen do Stažených souborů");
      return;
    }
    tiskni(strany, p, `${jmeno}`);
    if (p.format === "pdf") oznam("V okně tisku zvol „Uložit jako PDF“");
  }

  window.addEventListener("resize", zmensiNahled);
  dialog.addEventListener("close", () => window.removeEventListener("resize", zmensiNahled));
  obnov();
}

function zaskrt(text, hodnota, zmena) {
  const box = h("input", { type: "checkbox", checked: hodnota, onchange: () => zmena(box.checked) });
  return h("label", { class: "zaskrtavatko" }, box, h("span", { text }));
}

const rozmery = (p) => {
  const [a, b] = PAPIRY[p.papir] || PAPIRY.A4;
  return p.naSirku ? [b, a] : [a, b];
};

// --- stránky (HTML v milimetrech – stejné pro náhled i tisk) ------------------------------------

function strana(n, obsah, cislo2, celkem) {
  const [w, v] = rozmery(n);
  return h("div", { class: `strana${n.barvy === "sede" ? " sede" : ""}`, style: { width: `${w}mm`, height: `${v}mm` } },
    h("header", { class: "strana-hlavicka" },
      h("img", { src: "logo.png", alt: "", class: "strana-logo" }),
      h("div", { class: "strana-nadpis" }, h("strong", { text: n.nadpis }), n.podnadpis ? h("small", { text: n.podnadpis }) : null),
      h("div", { class: "strana-obdobi" }, h("strong", { text: `Období: ${datumKratce(n.od, true)} – ${datumKratce(n.do, true)}` }),
        h("small", { text: `Stav k ${datumKratce(zIso(dnes()), true)}` }))),
    h("div", { class: "strana-obsah" }, obsah),
    h("footer", { class: "strana-pata" }, h("span", { text: `Vytištěno ${new Date().toLocaleString("cs-CZ")} · Správce projektů ILD` }),
      h("strong", { text: `Strana ${cislo2} z ${celkem}` })));
}

export function vyrobStrany(tym, polozky, n) {
  const obsahy = [];
  if (n.vzhled === "kalendar") obsahy.push(...obsahKalendare(polozky, n));
  else obsahy.push(...obsahHarmonogramu(polozky, n));
  if (n.seznam) obsahy.push(...obsahSeznamu(tym, polozky, n));
  return obsahy.map((o, i) => strana(n, o, i + 1, obsahy.length));
}

function mesiceObdobi(z, k) {
  const m = [];
  for (let d = new Date(z.getFullYear(), z.getMonth(), 1); d <= k; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) m.push(d);
  return m;
}

function obsahKalendare(polozky, n) {
  const mesice = mesiceObdobi(n.od, n.do);
  const skupiny = n.stranky === "vice"
    ? rozdel(mesice, Math.min(n.stran, mesice.length))
    : [mesice];
  return skupiny.map((sk) => {
    const sloupcu = sk.length <= 1 ? 1 : sk.length <= 2 ? 2 : sk.length <= 4 ? 2 : sk.length <= 6 ? 3 : sk.length <= 9 ? 3 : 4;
    const radku = Math.ceil(sk.length / sloupcu);
    const meritko = Math.max(0.45, 1 / Math.sqrt(Math.max(sloupcu, radku)));
    return h("div", { class: "tisk-mesice", style: { gridTemplateColumns: `repeat(${sloupcu}, 1fr)`, gridTemplateRows: `repeat(${radku}, 1fr)`, fontSize: `${(9 * meritko).toFixed(2)}pt` } },
      sk.map((m) => mesicTisk(m, polozky, n)));
  });
}

function rozdel(pole2, kusu) {
  const vysledek = [];
  for (let i = 0; i < kusu; i++) {
    const z = Math.round((i * pole2.length) / kusu), k = Math.round(((i + 1) * pole2.length) / kusu);
    if (k > z) vysledek.push(pole2.slice(z, k));
  }
  return vysledek;
}

function mesicTisk(m, polozky, n) {
  const posledni = new Date(m.getFullYear(), m.getMonth() + 1, 0);
  const vMesici = polozky.filter((p) => p.rz[1] >= m && p.rz[0] <= posledni);
  const tydny = [];
  for (let pondeli = pridejDny(m, -((m.getDay() + 6) % 7)); pondeli <= posledni; pondeli = pridejDny(pondeli, 7)) {
    const nedele = pridejDny(pondeli, 6);
    const od = pondeli < m ? m : pondeli, doo = nedele > posledni ? posledni : nedele;
    const useky = vMesici.filter((p) => p.rz[1] >= od && p.rz[0] <= doo).map((p) => {
      const z = p.rz[0] < od ? od : p.rz[0], k = p.rz[1] > doo ? doo : p.rz[1];
      return { p, s: pocetDni(pondeli, z), d: pocetDni(z, k) + 1, zac: iso(z) === iso(p.rz[0]), kon: iso(k) === iso(p.rz[1]) };
    }).sort((a, b) => a.s - b.s || b.d - a.d);
    const drahy = [];
    for (const u of useky) {
      let i = drahy.findIndex((k) => k < u.s);
      if (i < 0) { i = drahy.length; drahy.push(-1); }
      drahy[i] = u.s + u.d - 1;
      u.draha = i;
    }
    const dny = [];
    for (let i = 0; i < 7; i++) {
      const d = pridejDny(pondeli, i);
      const v = d >= m && d <= posledni;
      const sv = v && n.svatky ? svatkyDne(d, n.staty) : [];
      dny.push(h("div", { class: `td${i >= 5 ? " vikend" : ""}${sv.length ? " svatek" : ""}${v ? "" : " mimo"}`, style: { gridColumn: `${i + 1}`, gridRow: "1 / -1" } },
        v ? h("span", { class: "td-cislo", text: d.getDate() }) : null, sv.length ? h("span", { class: "td-svatek", text: sv[0][1] }) : null));
    }
    tydny.push(h("div", { class: "tt", style: { gridTemplateRows: `1.5em repeat(${Math.max(1, drahy.length)}, 1.35em) 1fr` } }, dny,
      useky.map((u) => h("div", { class: `tp${u.zac ? " zac" : ""}${u.kon ? " kon" : ""}${jeHotovo(u.p.pol) ? " hotovo" : ""}`,
        style: { gridColumn: `${u.s + 1} / span ${u.d}`, gridRow: `${u.draha + 2}`, "--b": u.p.barva }, text: u.p.text }))));
  }
  return h("section", { class: "tm" }, h("div", { class: "tm-nadpis", text: `${velke(MESICE[m.getMonth()])} ${m.getFullYear()}` }),
    h("div", { class: "tm-dny" }, DNY.map((d, i) => h("span", { class: i >= 5 ? "vikend" : "", text: d }))), tydny);
}

function obsahHarmonogramu(polozky, n) {
  const useky = n.stranky === "vice" ? rozdel(dnyObdobi(n.od, n.do), n.stran).map((d) => [d[0], d[d.length - 1]]) : [[n.od, n.do]];
  const vysledek = [];
  const [, vyska] = rozmery(n);
  for (const [z, k] of useky) {
    const radky = polozky.filter((p) => p.rz[1] >= z && p.rz[0] <= k);
    const dni = pocetDni(z, k) + 1;
    const naRadek = Math.max(28, Math.floor((vyska - 52) / 5.2));   // kolik řádků se vejde (mm / řádek)
    const kusy = n.stranky === "jedna" && radky.length > naRadek && radky.length <= naRadek * 2.2 ? [radky] : rozdelPo(radky, naRadek);
    for (const kus of kusy.length ? kusy : [[]]) {
      const mensi = naRadek / Math.max(1, kus.length);   // málo řádků = větší, hodně = menší (na stránku)
      vysledek.push(h("div", { class: "gantt", style: { fontSize: `${(8 * Math.max(0.55, Math.min(1.35, mensi))).toFixed(2)}pt` } },
        osaGantt(z, k, dni, n),
        kus.map((p) => {
          const s = Math.max(0, pocetDni(z, p.rz[0])), e = Math.min(dni - 1, pocetDni(z, p.rz[1]));
          return h("div", { class: `g-radek${jeHotovo(p.pol) ? " hotovo" : ""}` },
            h("div", { class: "g-nazev", text: n.jedenProjekt ? p.nazev : p.text }),
            h("div", { class: "g-stopa" }, svatkyAVikendy(z, dni, n),
              h("div", { class: "g-pruh", style: { left: `${(s / dni) * 100}%`, width: `${((e - s + 1) / dni) * 100}%`, "--b": p.barva },
                title: popisRozsahuTisk(p) })));
        }),
        !kus.length ? h("p", { class: "tiche", text: "V tomto období nic není." }) : null));
    }
  }
  return vysledek;
}

const popisRozsahuTisk = (p) => `${datumKratce(p.rz[0], true)}${iso(p.rz[0]) !== iso(p.rz[1]) ? ` – ${datumKratce(p.rz[1], true)}` : ""}`;

function dnyObdobi(z, k) {
  const d = [];
  for (let x = z; x <= k; x = pridejDny(x, 1)) d.push(x);
  return d;
}

function rozdelPo(pole2, po) {
  const v = [];
  for (let i = 0; i < pole2.length; i += po) v.push(pole2.slice(i, i + po));
  return v;
}

function osaGantt(z, k, dni, n) {
  const mesice = mesiceObdobi(z, k).map((m) => {
    const s = Math.max(0, pocetDni(z, m)), e = Math.min(dni - 1, pocetDni(z, new Date(m.getFullYear(), m.getMonth() + 1, 0)));
    return h("span", { style: { left: `${(s / dni) * 100}%`, width: `${((e - s + 1) / dni) * 100}%` }, text: `${velke(MESICE[m.getMonth()])} ${m.getFullYear()}` });
  });
  const dny = dni <= 62 ? dnyObdobi(z, k).map((d, i) => h("span", { class: (d.getDay() + 6) % 7 >= 5 ? "vikend" : "",
    style: { left: `${(i / dni) * 100}%`, width: `${100 / dni}%` }, text: d.getDate() })) : [];
  return h("div", { class: "g-osa" }, h("div", { class: "g-nazev" }), h("div", { class: "g-stopa" },
    h("div", { class: "g-mesice" }, mesice), dny.length ? h("div", { class: "g-dny" }, dny) : null));
}

function svatkyAVikendy(z, dni, n) {
  if (dni > 400) return null;
  const v = [];
  for (let i = 0; i < dni; i++) {
    const d = pridejDny(z, i);
    const tyden = (d.getDay() + 6) % 7;
    const sv = n.svatky && svatkyDne(d, n.staty).length;
    if (tyden >= 5 || sv) v.push(h("i", { class: sv ? "g-svatek" : "g-vikend", style: { left: `${(i / dni) * 100}%`, width: `${100 / dni}%` } }));
  }
  return v;
}

function obsahSeznamu(tym, polozky, n) {
  const [, vyska] = rozmery(n);
  const naStranu = Math.max(15, Math.floor((vyska - 50) / (n.poznamky ? 9 : 6.2)));
  const radky = polozky.map((p) => h("tr", { class: jeHotovo(p.pol) ? "hotovo" : "" },
    n.jedenProjekt ? null : h("td", { text: p.projekt ? nazevProjektu(p.projekt) : { soukrome: "Soukromé", dovolene: "Dovolené", bez: "Bez projektu", poznamka: "Poznámka" }[p.druh] || "" }),
    h("td", {}, h("i", { class: "tecka", style: { background: p.barva } }), p.druh === "dovolene" ? p.text : p.nazev),
    h("td", { text: p.druh === "dovolene" ? "Dovolená" : p.druh === "poznamka" ? "Z poznámky" : tym.nazevDruhu(p.pol) }),
    h("td", { text: popisRozsahuTisk(p) }),
    h("td", { text: jeHotovo(p.pol) ? "✓" : "" }),
    n.poznamky ? h("td", { class: "pozn", text: p.druh === "poznamka" ? "" : p.pol.poznamka || "" }) : null));
  const hlavicka = () => h("tr", {}, [n.jedenProjekt ? null : "Projekt", "Termín", "Druh", "Kdy", "Hotovo", n.poznamky ? "Poznámka" : null]
    .filter(Boolean).map((t) => h("th", { text: t })));
  const kusy = rozdelPo(radky, naStranu);
  return (kusy.length ? kusy : [[]]).map((kus, i) => h("div", { class: "seznam-tisk" },
    i === 0 ? h("h3", { text: `Seznam termínů (${polozky.length})` }) : null,
    h("table", {}, h("thead", {}, hlavicka()), h("tbody", {}, kus)),
    !polozky.length ? h("p", { class: "tiche", text: "V tomto období nic není." }) : null));
}

// --- dovolené ---

function lideDovolenych(tym, dov, rok) {
  if (!tym.jeSpravce) return [tym.ja.id];
  const lide = tym.aktivni.map((u) => u.id);
  for (const x of dov.seznam) if (!lide.includes(x.uzivatel || "") && dov.hodiny(x.uzivatel || "", rok).size) lide.push(x.uzivatel || "");
  return lide;
}

function reportDovolenych(tym, n) {
  const dov = new Dovolene(tym.hodnota("dovolene"), tym.nastaveni);
  const roky = [];
  for (let rok = n.od.getFullYear(); rok <= n.do.getFullYear(); rok++) {
    const z = n.od > new Date(rok, 0, 1) ? n.od : new Date(rok, 0, 1), k = n.do < new Date(rok, 11, 31) ? n.do : new Date(rok, 11, 31);
    const lide = lideDovolenych(tym, dov, rok).map((kdo) => {
      const b = dov.bilance(kdo, rok);
      const vObdobi = [...dov.hodiny(kdo, rok)].filter(([d]) => d >= iso(z) && d <= iso(k)).reduce((s, [, x]) => s + x, 0);
      const useky = dov.cloveka(kdo).map((x) => [x, rozsah(x)]).filter(([, r]) => r && r[1] >= z && r[0] <= k)
        .sort((a, b2) => a[1][0] - b2[1][0]).map(([x, r]) => {
          const zz = r[0] < z ? z : r[0], kk = r[1] > k ? k : r[1];
          return [zz, kk, dov.hodinPolozky({ ...x, datum: iso(zz), datum_do: iso(kk) })];
        });
      return { kdo, jmeno: tym.jmeno(kdo, "Bez přihlášení"), ...b, vObdobi, useky };
    }).sort((a, b) => kolator.compare(a.jmeno, b.jmeno));
    roky.push({ rok, od: z, do: k, den: dov.den, lide });
  }
  return roky;
}

function stranyDovolenych(tym, n) {
  const roky = reportDovolenych(tym, n);
  const obsah = h("div", { class: "seznam-tisk" }, roky.map((r) => [
    h("h3", { text: `Dovolené ${r.rok} · období ${datumKratce(r.od, true)} – ${datumKratce(r.do, true)} · 1 den = ${cislo(r.den)} h` }),
    h("table", { class: "cisla" }, h("thead", {}, h("tr", {}, ["Jméno", "Převod z loňska", "Nárok", "K dispozici", "Vyčerpáno", "Naplánováno", "Zbývá", "V období"].map((t) => h("th", { text: t })))),
      h("tbody", {}, r.lide.map((c) => h("tr", {}, h("td", { text: c.jmeno }),
        [c.prevod, c.narok, c.k_dispozici, c.vycerpano, c.naplanovano].map((x) => h("td", { text: hodinyText(x, r.den) })),
        h("td", { class: c.zbyva < 0 ? "zaporne" : "zvyraznene", text: hodinyText(c.zbyva, r.den) }),
        h("td", { text: hodinyText(c.vObdobi, r.den) }))))),
    h("h4", { text: "Rozpis dovolených v období" }),
    r.lide.filter((c) => c.useky.length).map((c) => h("div", { class: "rozpis" }, h("strong", { text: c.jmeno }),
      h("ul", {}, c.useky.map(([z, k, hod]) => h("li", { text: `${datumKratce(z)}${iso(z) !== iso(k) ? ` – ${datumKratce(k, true)}` : ` ${z.getFullYear()}`}  (${hodinyText(hod, r.den)})` }))))),
  ]));
  return [strana(n, obsah, 1, 1)];
}

function listyDovolenych(tym, n) {
  const roky = reportDovolenych(tym, n);
  const prehled = [[{ v: n.nadpis, tucne: true, velikost: 14 }], [`Období ${datumKratce(n.od, true)} – ${datumKratce(n.do, true)}`], []];
  const zahlavi = ["Jméno", "Převod z loňska (h)", "Nárok (h)", "K dispozici (h)", "Vyčerpáno (h)", "Naplánováno (h)", "Zbývá (h)", "Zbývá (dny)", "V období (h)"]
    .map((t) => ({ v: t, tucne: true, barva: "#EEF2EA", ramecek: true }));
  const rozpis = [[{ v: "Rozpis dovolených", tucne: true, velikost: 14 }], [], ["Jméno", "Od", "Do", "Hodin"].map((t) => ({ v: t, tucne: true, barva: "#EEF2EA", ramecek: true }))];
  for (const r of roky) {
    prehled.push([{ v: `Rok ${r.rok}`, tucne: true }], zahlavi);
    for (const c of r.lide) {
      prehled.push([{ v: c.jmeno, ramecek: true }, ...[c.prevod, c.narok, c.k_dispozici, c.vycerpano, c.naplanovano, c.zbyva].map((x) => ({ v: Math.round(x * 10) / 10, ramecek: true })),
        { v: Math.round((c.zbyva / r.den) * 100) / 100, ramecek: true }, { v: Math.round(c.vObdobi * 10) / 10, ramecek: true }]);
      for (const [z, k, hod] of c.useky) rozpis.push([c.jmeno, datumKratce(z, true), datumKratce(k, true), Math.round(hod * 10) / 10].map((v) => ({ v, ramecek: true })));
    }
    prehled.push([]);
  }
  prehled.push([`Hodiny dovolené, 1 den = ${cislo(roky[0]?.den || 8)} h. Pracovní dny bez víkendů a státních svátků.`]);
  return [{ nazev: "Přehled", radky: prehled, sirky: [24, 14, 11, 13, 13, 14, 11, 11, 12], naSirku: true, naStranku: true },
    { nazev: "Rozpis", radky: rozpis, sirky: [24, 14, 14, 10], ukotvit: 3 }];
}

// --- Excel: kalendář po týdnech, časový diagram, seznam termínů ---

function listyExcelu(tym, polozky, n) {
  const hlava = [[{ v: n.nadpis, tucne: true, velikost: 14 }], [`Období ${datumKratce(n.od, true)} – ${datumKratce(n.do, true)}${n.podnadpis ? " · " + n.podnadpis : ""}`]];
  const textNa = (b) => {
    const x = parseInt(b.slice(1), 16);
    return (((x >> 16) & 255) * 299 + ((x >> 8) & 255) * 587 + (x & 255) * 114) / 1000 > 160 ? "#1D2939" : "#FFFFFF";
  };
  const barva = (b) => (n.barvy === "sede" ? sedaBarva(b) : b);

  // Seznam termínů
  const seznam = [...hlava, [], ["Projekt", "Termín", "Druh", "Od", "Do", "Hotovo", "Poznámka"].map((t) => ({ v: t, tucne: true, barva: "#EEF2EA", ramecek: true }))];
  for (const p of polozky) {
    seznam.push([p.projekt ? nazevProjektu(p.projekt) : { soukrome: "Soukromé", dovolene: "Dovolené", bez: "Bez projektu" }[p.druh] || "",
      p.druh === "dovolene" ? p.text : p.nazev, p.druh === "dovolene" ? "Dovolená" : p.druh === "poznamka" ? "Z poznámky" : tym.nazevDruhu(p.pol),
      datumKratce(p.rz[0], true), datumKratce(p.rz[1], true), jeHotovo(p.pol) ? "ano" : "", p.druh === "poznamka" ? "" : p.pol.poznamka || ""]
      .map((v, i) => ({ v, ramecek: true, zalomit: i === 6, ...(i === 1 ? { barva: barva(p.barva), pismo: textNa(barva(p.barva)) } : {}) })));
  }

  // Časový diagram – sloupec za den (nejvýš ~ rok)
  const dni = Math.min(400, pocetDni(n.od, n.do) + 1);
  const diagram = [...hlava, []];
  const radekMesicu = [{ v: "Termín", tucne: true }], radekDnu = [{ v: "", tucne: true }], slouceni = [];
  let mesicOd = 0;
  for (let i = 0; i < dni; i++) {
    const d = pridejDny(n.od, i);
    radekDnu.push({ v: d.getDate(), zarovnat: "center", velikost: 8, barva: (d.getDay() + 6) % 7 >= 5 ? "#F2F4F7" : undefined, ramecek: true });
    radekMesicu.push(i === 0 || d.getDate() === 1 ? { v: `${velke(MESICE[d.getMonth()])} ${d.getFullYear()}`, tucne: true } : "");
    const dalsi = pridejDny(d, 1);
    if (i === dni - 1 || dalsi.getDate() === 1) {
      if (i > mesicOd) slouceni.push(`${sloupec(mesicOd + 1)}4:${sloupec(i + 1)}4`);
      mesicOd = i + 1;
    }
  }
  diagram.push(radekMesicu, radekDnu);
  for (const p of polozky) {
    const radek = [{ v: p.text, ramecek: true }];
    for (let i = 0; i < dni; i++) {
      const d = pridejDny(n.od, i);
      radek.push(d >= p.rz[0] && d <= p.rz[1] ? { v: "", barva: barva(p.barva) } : (d.getDay() + 6) % 7 >= 5 ? { v: "", barva: "#F7F8FA" } : "");
    }
    diagram.push(radek);
  }

  // Kalendář po týdnech (měsíc pod měsícem, termíny jako sloučené pruhy přes dny)
  const kal = [...hlava, []];
  const slouceniKal = [];
  for (const m of mesiceObdobi(n.od, n.do)) {
    kal.push([{ v: `${velke(MESICE[m.getMonth()])} ${m.getFullYear()}`, tucne: true, velikost: 12 }]);
    kal.push(DNY.map((d, i) => ({ v: d, tucne: true, zarovnat: "center", barva: i >= 5 ? "#F2F4F7" : "#EEF2EA", ramecek: true })));
    const posledni = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    for (let pondeli = pridejDny(m, -((m.getDay() + 6) % 7)); pondeli <= posledni; pondeli = pridejDny(pondeli, 7)) {
      const nedele = pridejDny(pondeli, 6);
      const od = pondeli < m ? m : pondeli, doo = nedele > posledni ? posledni : nedele;
      const cisla = [];
      for (let i = 0; i < 7; i++) {
        const d = pridejDny(pondeli, i);
        const sv = n.svatky ? svatkyDne(d, n.staty) : [];
        cisla.push(d >= m && d <= posledni ? { v: `${d.getDate()}${sv.length ? " " + sv[0][1] : ""}`, tucne: true, pismo: sv.length ? "#D92D20" : undefined,
          barva: sv.length ? "#FDECEC" : i >= 5 ? "#F2F4F7" : undefined, ramecek: true } : { v: "", barva: "#FAFAFA" });
      }
      kal.push(cisla);
      const useky = polozky.filter((p) => p.rz[1] >= od && p.rz[0] <= doo).map((p) => {
        const z = p.rz[0] < od ? od : p.rz[0], k = p.rz[1] > doo ? doo : p.rz[1];
        return { p, s: pocetDni(pondeli, z), d: pocetDni(z, k) + 1 };
      }).sort((a, b) => a.s - b.s || b.d - a.d);
      const drahy = [];
      for (const u of useky) {
        let i = drahy.findIndex((k) => k < u.s);
        if (i < 0) { i = drahy.length; drahy.push(-1); }
        drahy[i] = u.s + u.d - 1;
        u.draha = i;
      }
      for (let r = 0; r < drahy.length; r++) {
        const radek = new Array(7).fill("");
        const cislo2 = kal.length + 1;
        for (const u of useky.filter((x) => x.draha === r)) {
          const b = barva(u.p.barva);
          radek[u.s] = { v: u.p.text, barva: b, pismo: textNa(b), velikost: 9 };
          for (let i = u.s + 1; i < u.s + u.d; i++) radek[i] = { v: "", barva: b };
          if (u.d > 1) slouceniKal.push(`${sloupec(u.s)}${cislo2}:${sloupec(u.s + u.d - 1)}${cislo2}`);
        }
        kal.push(radek);
      }
    }
    kal.push([]);
  }
  const listy = [];
  if (n.vzhled === "kalendar") listy.push({ nazev: "Kalendář", radky: kal, sirky: new Array(7).fill(24), slouceni: slouceniKal, naSirku: n.naSirku, naStranku: true, papir: n.papir });
  listy.push({ nazev: "Časový diagram", radky: diagram, sirky: [40, ...new Array(dni).fill(3.2)], slouceni, ukotvit: 5, naSirku: n.naSirku, naStranku: true, papir: n.papir });
  if (n.vzhled === "harmonogram" && listy.length === 1) listy.push({ nazev: "Kalendář", radky: kal, sirky: new Array(7).fill(24), slouceni: slouceniKal, naSirku: n.naSirku, naStranku: true, papir: n.papir });
  listy.push({ nazev: "Seznam termínů", radky: seznam, sirky: [26, 36, 22, 13, 13, 8, 50], ukotvit: 4, naSirku: n.naSirku, naStranku: true, papir: n.papir });
  return listy;
}

function sedaBarva(b) {
  const x = parseInt(b.slice(1), 16);
  const s = Math.round(((x >> 16) & 255) * 0.3 + ((x >> 8) & 255) * 0.59 + (x & 255) * 0.11);
  return `#${[s, s, s].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// --- tisk -------------------------------------------------------------------------------------

let _stranka = null;

function tiskni(strany, p, titulek) {
  document.getElementById("tisk-obsah")?.remove();
  const obal = h("div", { id: "tisk-obsah" }, strany.map((s) => s.cloneNode(true)));
  document.body.append(obal);
  const [w, v] = rozmery(p);
  // velikost stránky přes CSSOM (CSP nepovolí vložený <style>)
  try {
    _stranka ||= new CSSStyleSheet();
    _stranka.replaceSync(`@page { size: ${w}mm ${v}mm; margin: 0; }`);
    if (!document.adoptedStyleSheets.includes(_stranka)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, _stranka];
  } catch { /* starší prohlížeč – velikost vybere uživatel v okně tisku */ }
  const puvodni = document.title;
  document.title = titulek;
  document.body.classList.add("tiskne");
  const uklid = () => {
    document.body.classList.remove("tiskne");
    document.title = puvodni;
    obal.remove();
    window.removeEventListener("afterprint", uklid);
  };
  window.addEventListener("afterprint", uklid);
  setTimeout(() => window.print(), 50);
}
