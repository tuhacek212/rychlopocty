// Společné části všech stránek: hlavička s menu, patička a pomocné funkce.
// Data jsou ve window.KK (web/data/data.js, vyrábí ho nastroje/sestav.py).

var KK = window.KK;

var IKONY = {
  misto: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  pozor: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.5"/></svg>',
  info: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>',
  kalendar: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  telefon: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>',
  email: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  facebook: '<svg class="svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.9v3h2.6V21h3z"/></svg>',
  menu: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  sipka: '<svg class="svg sipka" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  ven: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  zamek: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>'
};

var DNY = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];
var DNY_KRATCE = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

var MENU = [
  { id: "uvod", text: "KK Slaný", href: "index.html" },
  { id: "rozpis", text: "Rozpisy", href: "rozpis.html", pod: [
    { text: "Rozpis tréninků", href: "rozpis.html" },
    { text: "Rozpis závodů (ČKS)", href: "https://www.czechskating.org/zavody/?sezona=2026-2027", ven: true },
    { text: "Výsledky našich závodníků", href: "zavody.html" }
  ] },
  { id: "slanska-brusle", text: "Slánská brusle", href: "slanska-brusle.html" },
  { id: "zavodnici", text: "Naši závodníci", href: "zavodnici.html" },
  { id: "treneri", text: "Trenéři", href: "treneri.html" },
  { id: "galerie", text: "Fotogalerie", href: "galerie.html" },
  { id: "kontakt", text: "Kontakt", href: "kontakt.html" }
];

function esc(text) {
  return String(text == null ? "" : text).replace(/[&<>"']/g, function (z) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z];
  });
}

function velke(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------- data a čas ----------

// "2026-10-19" → Date v místním čase (ne UTC)
function datumZIso(iso) {
  var c = iso.split("-");
  return new Date(+c[0], c[1] - 1, +c[2]);
}

function datumSCasem(iso, cas) {
  var d = datumZIso(iso), c = cas.split(":");
  d.setHours(+c[0], +c[1]);
  return d;
}

function stejnyDen(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function kratkeDatum(d) {
  return d.getDate() + ". " + (d.getMonth() + 1) + ".";
}

function plneDatum(iso) {
  var d = datumZIso(iso);
  return kratkeDatum(d) + " " + d.getFullYear();
}

// „dnes“, „zítra“, nebo „středa 21. 10.“
function kdy(iso) {
  var d = datumZIso(iso), dnes = new Date(), zitra = new Date();
  zitra.setDate(dnes.getDate() + 1);
  if (stejnyDen(d, dnes)) return "dnes";
  if (stejnyDen(d, zitra)) return "zítra";
  return DNY[d.getDay()] + " " + kratkeDatum(d);
}

function bezNuly(cas) {
  return cas.replace(/^0/, "");
}

function casTreninku(t) {
  if (!t.od && t.podleZimaku) return "čas podle zimáku";
  return t.od ? bezNuly(t.od) + " – " + bezNuly(t.do) : "čas upřesníme";
}

// ---------- ukázkové změny z administrace ----------
// Dokud administrace nemá databázi, ukládá změny jen do prohlížeče (localStorage).
// Web je v tomtéž prohlížeči rovnou ukáže, ať je vidět, jak by změna vypadala.

var ULOZISTE_ADMINU = "kkslany-admin";
var PREPISOVANA_DATA = ["aktuality", "zavody", "galerie", "treneri", "zavodnici", "klub"];

function kopie(x) { return JSON.parse(JSON.stringify(x)); }

function ukazkoveZmeny() {
  try { return JSON.parse(localStorage.getItem(ULOZISTE_ADMINU)) || null; } catch (e) { return null; }
}

function zahodUkazkoveZmeny() {
  try { localStorage.removeItem(ULOZISTE_ADMINU); } catch (e) { /* nic */ }
}

function seradTreninky(treninky) {
  treninky.sort(function (a, b) { return (a.od || "99:99") < (b.od || "99:99") ? -1 : 1; });
}

// ---------- skupiny v tréninku ----------
// Trénink může mít části pro skupiny (t.casti):
//   žádné části                      = sloučený trénink, všichni spolu
//   části bez času   [A, B]          = rozdělený trénink, skupiny se v tomto pořadí střídají
//   části s časem    [1. sk. 17:00…] = každá skupina má svůj čas (např. pohybovka)

function nazevSkupiny(s) {
  return s.length <= 2 ? "sk. " + s : s;
}

function forma(t) {
  if (!t.casti || !t.casti.length) return "slouceny";
  return t.casti[0].od ? "skupiny" : "rozdeleny";
}

function dopocitejCas(t) {
  var sCasem = (t.casti || []).filter(function (c) { return c.od; });
  if (!sCasem.length) return;
  var platne = sCasem.filter(function (c) { return c.stav !== "zruseno"; });
  if (!platne.length) platne = sCasem;
  t.od = platne.map(function (c) { return c.od; }).sort()[0];
  t.do = platne.map(function (c) { return c.do; }).sort().pop();
}

// Stejné pravidlo jako pouzij_vyjimku v nastroje/sestav.py: výjimka redaktora má vždy přednost.
function pouzijVyjimku(treninky, v) {
  var cil = treninky.filter(function (t) { return t.id === v.id; })[0];
  if (!cil) {
    if (v.skupina) return;
    cil = { id: v.id, typ: v.typ || "led", misto: v.misto || "zs", od: null, do: null, novy: true };
    treninky.push(cil);
  }
  if (v.skupina) { // jen jedna skupina – ostatní trénují normálně
    var cast = (cil.casti || []).filter(function (c) { return c.skupina === v.skupina; })[0];
    if (!cast) return;
    if (v.poznamka) cast.poznamka = v.poznamka;
    if (v.zruseno) cast.stav = "zruseno";
    if (cil.casti.every(function (c) { return c.stav === "zruseno"; })) cil.stav = "zruseno";
    dopocitejCas(cil);
    return;
  }
  ["od", "do", "popis", "misto", "poznamka", "casti"].forEach(function (k) { if (k in v) cil[k] = JSON.parse(JSON.stringify(v[k])); });
  if (!cil.casti || !cil.casti.length) delete cil.casti;
  if (!cil.popis) delete cil.popis;
  if (v.zruseno) cil.stav = "zruseno";
  else if ("od" in v || "casti" in v) { delete cil.stav; cil.zdroj = "redakce"; }
  dopocitejCas(cil);
}

function pouzijVyjimky(rozpis, vyjimky) {
  rozpis.tydny.forEach(function (tyden) {
    tyden.dny.forEach(function (den) {
      var zmeneno = false;
      // nejdřív změny celých tréninků, pak jednotlivých skupin (jinak by nové skupiny zrušení přepsaly)
      vyjimky.filter(function (v) { return !v.skupina; }).concat(vyjimky.filter(function (v) { return v.skupina; })).forEach(function (v) {
        if (!(v.datum <= den.datum && den.datum <= (v.datumDo || v.datum))) return;
        if (v.datumDo) { // volno na víc dní (prázdniny): zruší všechny tréninky v rozsahu
          den.treninky.forEach(function (t) {
            t.stav = "zruseno";
            if (v.poznamka) t.poznamka = v.poznamka;
          });
        } else {
          pouzijVyjimku(den.treninky, v);
        }
        zmeneno = true;
      });
      if (zmeneno) seradTreninky(den.treninky);
    });
  });
}

// ---------- obvyklý týden a soustředění ----------
// Obvyklých týdnů může být víc: každý platí od svého data do začátku dalšího (dlouhodobá změna rozpisu).

function sablonaProDen(sablony, iso) {
  var serazene = sablony.slice().sort(function (a, b) { return a.od < b.od ? -1 : 1; });
  var platne = serazene.filter(function (s) { return s.od <= iso; });
  return (platne.length ? platne[platne.length - 1] : serazene[0]).treninky;
}

// Soustředění, při kterém se běžné tréninky ruší, je pro rozpis jako volno (stejně jako vyjimky_soustredeni v sestav.py).
function vyjimkySoustredeni(soustredeni) {
  return (soustredeni || []).filter(function (s) { return s.rusiTreninky; }).map(function (s) {
    return { datum: s.od, datumDo: s.do, id: "soustredeni-" + s.id, zruseno: true, poznamka: "Soustředění – " + s.nazev };
  });
}

function soustredeniVeDni(iso, soustredeni) {
  return (soustredeni || KK.rozpis.soustredeni || []).filter(function (s) { return s.od <= iso && iso <= s.do; });
}

function minutyCasu(cas) {
  var c = cas.split(":");
  return +c[0] * 60 + +c[1];
}

function posunCas(cas, oMinut) {
  var m = minutyCasu(cas) + oMinut;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}

// Stejné jako sestav_den v nastroje/sestav.py (bez výjimek – ty přidá pouzijVyjimky).
// Web ho potřebuje, jen když se v administraci změní obvyklý týden nebo soustředění.
function sestavDen(iso, sablona, sloty, cisloTydne) {
  var den = datumZIso(iso).getDay() || 7, volne = (sloty || []).slice(), treninky = [];
  sablona.forEach(function (s) {
    if (s.den !== den) return;
    var t = { id: s.id, typ: s.typ, misto: s.misto, od: s.od || null, do: s.do || null };
    ["popis", "poznamka", "navazuje"].forEach(function (k) { if (s[k]) t[k] = s[k]; });
    if (s.casti && s.casti.length) {
      t.casti = kopie(s.casti);
      if (s.stridani && cisloTydne % 2 === 0) t.casti.reverse(); // v sudém týdnu jde první druhá skupina
      dopocitejCas(t);
    }
    if (s.typ === "led") {
      var obvykleOd = t.od, obvykleDo = t.do;
      if (!sloty) t.stav = "predbezne";
      else if (volne.length) {
        // vezmi led nejblíž obvyklému času
        var slot = volne.reduce(function (nej, v) {
          return obvykleOd && Math.abs(minutyCasu(v.od) - minutyCasu(obvykleOd)) < Math.abs(minutyCasu(nej.od) - minutyCasu(obvykleOd)) ? v : nej;
        });
        volne.splice(volne.indexOf(slot), 1);
        if (obvykleOd && (slot.od !== obvykleOd || slot.do !== obvykleDo)) {
          t.zmena = "Obvykle " + obvykleOd + "–" + obvykleDo;
          var oMinut = minutyCasu(slot.od) - minutyCasu(obvykleOd);
          (t.casti || []).forEach(function (c) { // skupiny s vlastním časem se posunou s ledem
            if (c.od) { c.od = posunCas(c.od, oMinut); c.do = posunCas(c.do, oMinut); }
          });
        }
        t.od = slot.od; t.do = slot.do; t.zdroj = "zimak";
      } else t.stav = "nenalezeno";
    }
    treninky.push(t);
  });
  volne.forEach(function (slot, i) {
    treninky.push({ id: "led-navic-" + (i + 1), typ: "led", misto: "zs", popis: "Trénink na ledě", od: slot.od, do: slot.do,
      zdroj: "zimak", zmena: "Navíc oproti obvyklému rozpisu" });
  });
  seradTreninky(treninky);
  return treninky;
}

// Přestaví celý rozpis z obvyklých týdnů, ledu ze zimáku (tyden.led) a výjimek.
function prestavRozpis(rozpis, sablony, vyjimky) {
  var platnost = rozpis.platnost || {};
  rozpis.tydny.forEach(function (tyden) {
    tyden.dny.forEach(function (den) {
      if ((platnost.od && den.datum < platnost.od) || (platnost.do && den.datum > platnost.do)) { den.treninky = []; return; }
      var sloty = tyden.led ? tyden.led.filter(function (s) { return s.datum === den.datum; }) : null;
      den.treninky = sestavDen(den.datum, sablonaProDen(sablony, den.datum), sloty, tyden.tyden);
    });
  });
  pouzijVyjimky(rozpis, vyjimky);
}

// z = změny z administrace {sablony, soustredeni, vyjimky}; vrací true, když se rozpis změnil
function pouzijZmenyRozpisu(rozpis, z) {
  var zmeneno = false;
  if (z.sablony || z.soustredeni) {
    if (z.sablony) rozpis.sablony = z.sablony;
    if (z.soustredeni) rozpis.soustredeni = z.soustredeni;
    prestavRozpis(rozpis, rozpis.sablony, rozpis.vyjimky.concat(vyjimkySoustredeni(rozpis.soustredeni)));
    zmeneno = true;
  }
  if (z.vyjimky && z.vyjimky.length) { pouzijVyjimky(rozpis, z.vyjimky); zmeneno = true; }
  return zmeneno;
}

function nactiUkazkoveZmeny() {
  var u = ukazkoveZmeny(), zmeneno = false;
  if (!u) return false;
  PREPISOVANA_DATA.forEach(function (k) { if (u[k]) { KK[k] = u[k]; zmeneno = true; } });
  return pouzijZmenyRozpisu(KK.rozpis, u) || zmeneno;
}

// ---------- tréninky ----------

// Na webu je vždy jen stávající a následující týden (data.js jich má víc kvůli kalendáři).
function zobrazeneTydny(rozpis) {
  var dnes = new Date();
  dnes.setHours(0, 0, 0, 0);
  return (rozpis || KK.rozpis).tydny.filter(function (tyden) {
    var nedele = datumZIso(tyden.pondeli);
    nedele.setDate(nedele.getDate() + 6);
    return nedele >= dnes;
  }).slice(0, 2);
}

// Trénink, který jen pokračuje předchozím (suchá příprava hned po ledu), se v přehledech ukazuje jako jeden:
// kopie hlavního tréninku dostane t.pak = [pokračování] a konec celého bloku. Zrušený hlavní trénink se nespojuje.
function spojNavazujici(treninky) {
  var vysledek = [];
  treninky.forEach(function (t) {
    var hlavni = t.navazuje && vysledek.filter(function (h) { return h.id === t.navazuje; })[0];
    if (hlavni && hlavni.stav !== "zruseno" && forma(hlavni) !== "skupiny") {
      hlavni.pak.push(t);
      if (t.stav !== "zruseno" && t.do) hlavni.do = t.do;
    } else {
      vysledek.push(Object.assign({}, t, { pak: [] }));
    }
  });
  return vysledek;
}

// spojit = navazující tréninky jako jeden (úvod, patička); v tabulce rozpisu zůstávají zvlášť
function vsechnyTreninky(spojit, rozpis) {
  var vysledek = [];
  (rozpis || KK.rozpis).tydny.forEach(function (tyden) {
    tyden.dny.forEach(function (den) {
      (spojit ? spojNavazujici(den.treninky) : den.treninky).forEach(function (t) { vysledek.push({ datum: den.datum, t: t }); });
    });
  });
  return vysledek;
}

function skoncil(datum, t) {
  var konec = t.do ? datumSCasem(datum, t.do) : datumZIso(datum);
  if (!t.do) konec.setDate(konec.getDate() + 1);
  return konec < new Date();
}

function budouciTreninky() {
  return vsechnyTreninky(true).filter(function (x) { return x.t.stav !== "zruseno" && !skoncil(x.datum, x.t); });
}

function mistoTreninku(t) {
  var m = KK.rozpis.mista[t.misto] || { nazev: t.misto };
  return m.mapa ? '<a href="' + esc(m.mapa) + '" target="_blank" rel="noopener">' + esc(m.nazev) + "</a>" : esc(m.nazev);
}

// Název bez opakování: na ledě stačí sloučený/rozdělený (sloupec už říká „na ledě“), jinde vlastní popis nebo druh.
function nazevTreninku(t) {
  if (t.popis) return t.popis;
  if (forma(t) === "rozdeleny") return "Rozdělený";
  if (t.typ === "led") return "Sloučený";
  return KK.rozpis.typy[t.typ] || t.typ;
}

// Jednořádkový popis bez HTML (kalendář, přehledy), např. „Led – rozdělený A → B“.
function kratkyPopis(t) {
  var f = forma(t), nazev = nazevTreninku(t);
  if (t.typ === "led" && !t.popis) nazev = "Led – " + nazev.toLowerCase();
  if (f === "rozdeleny") nazev += " " + t.casti.map(function (c) { return c.skupina; }).join(" → ");
  if (f === "skupiny") nazev += " (" + t.casti.map(function (c) { return c.skupina + " od " + bezNuly(c.od); }).join(", ") + ")";
  return nazev + (t.pak || []).map(function (p) { return ", pak " + popisPokracovani(p); }).join("");
}

// „suchá příprava od 19:00“ / „suchá příprava – zrušeno“
function popisPokracovani(p) {
  var n = p.popis || KK.rozpis.typy[p.typ] || p.typ;
  return n.charAt(0).toLowerCase() + n.slice(1) + (p.stav === "zruseno" ? " – zrušeno" : p.od ? " od " + bezNuly(p.od) : "");
}

// Pořadí skupin u rozděleného tréninku: A → B; zrušená skupina je přeškrtnutá.
function htmlPoradi(t) {
  return '<span class="poradi" title="Skupiny se na ledě střídají – první jde sk. ' + esc(t.casti[0].skupina) + '.">' +
    t.casti.map(function (c) {
      return '<span class="sk' + (c.stav === "zruseno" ? " sk--zruseno" : "") + '">' + esc(c.skupina) + "</span>";
    }).join('<span class="poradi__sipka" aria-label="pak">→</span>') + "</span>";
}

// Zrušené skupiny (u rozděleného tréninku nemají vlastní řádek, proto zvlášť)
function htmlZrusenychSkupin(t) {
  if (t.stav === "zruseno" || forma(t) !== "rozdeleny") return "";
  return t.casti.filter(function (c) { return c.stav === "zruseno"; }).map(function (c) {
    return '<span class="trenink__duvod">' + esc(velke(nazevSkupiny(c.skupina))) + " zrušeno" + (c.poznamka ? " – " + esc(c.poznamka) : "") + "</span>";
  }).join("");
}

function stitkyTreninku(t) {
  var s = [];
  if (t.stav === "zruseno") s.push('<span class="stitek stitek--zruseno">zrušeno</span>');
  if (t.stav === "predbezne") s.push('<span class="stitek stitek--info" title="Zimní stadion rozpis na tento týden ještě nezveřejnil.">předběžně</span>');
  if (t.stav === "nenalezeno") s.push('<span class="stitek">' + IKONY.pozor + "na zimáku chybí – ověřte</span>");
  if (t.zmena && t.stav !== "zruseno") s.push('<span class="stitek">' + IKONY.pozor + "změna · " + esc(t.zmena.toLowerCase()) + "</span>");
  if (t.zdroj === "redakce" && !t.zmena && t.stav !== "zruseno") s.push('<span class="stitek">' + IKONY.pozor + (t.novy ? "mimořádně" : "změna") + "</span>");
  return s.join(" ");
}

// Jeden trénink = jeden blok, vždy stejně: čas, pod ním co a kde, pak podrobnosti.
// Když skupiny trénují každá jindy, nahoře je celkový čas a časy skupin až v podrobnostech.
// Led na zimáku místo neuvádí (je ve sloupci „na ledě“). Zrušená skupina se přeškrtne jen sama.
function htmlTreninku(t) {
  var f = forma(t), zruseno = t.stav === "zruseno";
  var co = '<span class="trenink__nazev">' + esc(nazevTreninku(t)) + "</span>" + (f === "rozdeleny" ? " " + htmlPoradi(t) : "");
  if (!(t.typ === "led" && t.misto === "zs")) co += " · " + mistoTreninku(t);
  var hlava = '<span class="trenink__cas">' + esc(casTreninku(t)) + "</span> " + stitkyTreninku(t) +
    '<span class="trenink__popis">' + co + "</span>";
  var skupiny = f !== "skupiny" ? "" : '<ul class="trenink__skupiny">' + t.casti.map(function (c) {
    var pryc = c.stav === "zruseno" && !zruseno;
    return '<li class="' + (pryc ? "zrusena" : "") + '"><span class="trenink__skupina-cas">' + esc(bezNuly(c.od) + " – " + bezNuly(c.do)) + "</span>" +
      "<span>" + esc(c.skupina) + "</span>" + (pryc ? ' <span class="stitek stitek--zruseno">zrušeno</span>' : "") +
      (pryc && c.poznamka ? '<span class="trenink__duvod">' + esc(c.poznamka) + "</span>" : "") + "</li>";
  }).join("") + "</ul>";
  // u zrušeného tréninku se důvod nepřeškrtává, proto stojí samostatně
  var pozn = t.poznamka ? '<span class="' + (zruseno ? "trenink__duvod" : "trenink__pozn") + '">' + esc(t.poznamka) + "</span>" : "";
  return '<div class="trenink trenink--' + (t.typ === "led" ? "led" : "sucho") + (zruseno ? " trenink--zruseno" : "") + '">' +
    hlava + skupiny + htmlZrusenychSkupin(t) + pozn + "</div>";
}

// ---------- soustředění ----------

function terminSoustredeni(s) {
  var od = datumZIso(s.od), konec = datumZIso(s.do);
  var text = DNY_KRATCE[od.getDay()] + " " + kratkeDatum(od);
  return s.od === s.do ? text : text + " – " + DNY_KRATCE[konec.getDay()] + " " + kratkeDatum(konec);
}

function htmlSoustredeni(s) {
  var info = [s.misto ? IKONY.misto + esc(s.misto) : "", s.pro ? "jede: " + esc(s.pro) : ""].filter(Boolean).join(" · ");
  return '<article class="soustredeni"><p class="soustredeni__kdy">' + esc(terminSoustredeni(s) + " " + datumZIso(s.do).getFullYear()) + "</p>" +
    "<h3>" + esc(s.nazev) + "</h3>" + (info ? '<p class="soustredeni__info">' + info + "</p>" : "") +
    (s.poznamka ? '<p class="soustredeni__pozn">' + esc(s.poznamka).replace(/\n/g, "<br>") + "</p>" : "") +
    (s.rusiTreninky ? '<p class="soustredeni__rusi">Běžné tréninky v těchto dnech nejsou.</p>' : "") + "</article>";
}

function budouciSoustredeni(soustredeni) {
  var d = new Date();
  var dnes = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  return (soustredeni || KK.rozpis.soustredeni || []).filter(function (s) { return s.do >= dnes; })
    .sort(function (a, b) { return a.od < b.od ? -1 : 1; });
}

// Adresa kalendáře k odběru (funguje jen na webu, ne při otevření souboru z disku)
function adresaKalendare() {
  if (location.protocol.indexOf("http") !== 0) return null;
  return new URL("kalendar.ics", location.href).href.replace(/^https?:/, "webcal:");
}

function tlacitkaKalendare(trida) {
  var webcal = adresaKalendare();
  if (!webcal) return '<p class="poznamka">Odběr kalendáře funguje po zveřejnění webu.</p>';
  var google = "https://calendar.google.com/calendar/r?cid=" + encodeURIComponent(webcal);
  return '<div class="tlacitka">' +
    '<a class="tlacitko ' + (trida || "") + '" href="' + esc(webcal) + '">' + IKONY.kalendar + " iPhone / Outlook</a>" +
    '<a class="tlacitko tlacitko--svetle" href="' + esc(google) + '" target="_blank" rel="noopener">Google kalendář</a>' +
    "</div>";
}

// ---------- hlavička, menu, patička ----------

function htmlHlavicky(aktivni) {
  var klub = KK.klub;
  var polozky = MENU.map(function (m) {
    var je = m.id === aktivni;
    var odkaz = '<a href="' + m.href + '"' + (je ? ' aria-current="page"' : "") + ">" + m.text + (m.pod ? IKONY.sipka : "") + "</a>";
    var pod = m.pod ? '<ul class="podmenu">' + m.pod.map(function (p) {
      return '<li><a href="' + p.href + '"' + (p.ven ? ' target="_blank" rel="noopener"' : "") + ">" + p.text + "</a></li>";
    }).join("") + "</ul>" : "";
    return "<li" + (je ? ' class="aktivni"' : "") + ">" + odkaz + pod + "</li>";
  }).join("");
  return '<header class="hlavicka">' +
    '<a class="znak" href="index.html"><img src="img/brusle.svg" alt="" width="76" height="76">' +
    '<span class="znak__nazev"><strong>Krasobruslařský klub</strong><span>Královského města Slaného</span></span></a>' +
    '<div class="hlavicka__akce">' +
    '<a href="tel:' + esc(klub.telefon.replace(/\s/g, "")) + '">' + IKONY.telefon + esc(klub.telefon) + "</a>" +
    '<a href="' + esc(klub.facebook) + '" target="_blank" rel="noopener">' + IKONY.facebook + "Facebook</a>" +
    "</div>" +
    '<button class="tl-menu" type="button" aria-expanded="false" aria-controls="menu">' + IKONY.menu + "Menu</button>" +
    "</header>" +
    '<nav class="menu" id="menu" aria-label="Hlavní menu"><ul>' + polozky + "</ul></nav>";
}

function htmlPaticky() {
  var klub = KK.klub;
  var aktuality = KK.aktuality.slice(0, 4).map(function (a) {
    var nadpis = a.odkaz ? '<a href="' + esc(a.odkaz) + '">' + esc(a.nadpis) + "</a>" : esc(a.nadpis);
    return '<li><time datetime="' + esc(a.datum) + '">' + esc(plneDatum(a.datum)) + "</time>" + nadpis + "</li>";
  }).join("");
  var dalsi = budouciTreninky()[0];
  return '<section class="najdete" aria-label="Sociální sítě"><h2>Najdete nás</h2>' +
    '<a href="' + esc(klub.facebook) + '" target="_blank" rel="noopener">' + IKONY.facebook + "Facebook</a></section>" +
    '<footer class="paticka"><div class="paticka__sloupce">' +
    '<section><h2>Aktuality</h2><ul class="aktuality">' + aktuality + "</ul></section>" +
    "<section><h2>Tréninky v mobilu</h2>" +
    (dalsi ? "<p>Nejbližší trénink: <strong style=\"color:#fff\">" + esc(kdy(dalsi.datum) + " " + casTreninku(dalsi.t)) + "</strong></p>" : "") +
    '<p>Rozpis si můžete <a href="rozpis.html#kalendar">přidat do kalendáře v telefonu</a>, změny se v něm objeví samy.</p></section>' +
    '<section><h2>Kontakt</h2><ul class="kontakty">' +
    "<li>" + IKONY.misto + "<span>" + esc(klub.nazev) + "<br>" + esc(klub.adresa) + "</span></li>" +
    "<li>" + IKONY.telefon + '<a href="tel:' + esc(klub.telefon.replace(/\s/g, "")) + '">' + esc(klub.telefon) + "</a></li>" +
    "<li>" + IKONY.email + '<a href="mailto:' + esc(klub.email) + '">' + esc(klub.email) + "</a></li>" +
    "</ul></section>" +
    "</div>" +
    '<div class="paticka__spodek"><ul>' + MENU.slice(1).map(function (m) {
      return '<li><a href="' + m.href + '">' + m.text + "</a></li>";
    }).join("") + "</ul><span>© " + new Date().getFullYear() + " " + esc(klub.nazev) +
    '<a class="prihlaseni" href="admin.html">' + IKONY.zamek + "Přihlášení</a></span></div>" +
    "</footer>";
}

function htmlListyUkazky() {
  return '<div class="lista-ukazky" role="status">' + IKONY.info +
    "<span>Vidíte ukázkové změny z administrace – jen v tomto prohlížeči, ostatní je nevidí.</span>" +
    '<a href="admin.html">Do administrace</a><button type="button" id="zahodit-ukazku">Zahodit změny</button></div>';
}

(function vlozRozvrzeni() {
  if (document.body.getAttribute("data-stranka") === "admin") return;
  var ukazka = nactiUkazkoveZmeny();
  var aktivni = document.body.getAttribute("data-menu");
  var hlava = document.getElementById("rozvrzeni-hlava");
  var pata = document.getElementById("rozvrzeni-pata");
  if (hlava) hlava.outerHTML = (ukazka ? htmlListyUkazky() : "") + htmlHlavicky(aktivni);
  if (pata) pata.outerHTML = htmlPaticky();
  if (ukazka) {
    document.getElementById("zahodit-ukazku").addEventListener("click", function () {
      zahodUkazkoveZmeny();
      location.reload();
    });
  }

  var tlacitko = document.querySelector(".tl-menu");
  var menu = document.getElementById("menu");
  if (tlacitko) {
    tlacitko.addEventListener("click", function () {
      var otevrene = menu.classList.toggle("otevrene");
      tlacitko.setAttribute("aria-expanded", otevrene ? "true" : "false");
    });
  }
})();
