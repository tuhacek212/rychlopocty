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
  return t.od ? bezNuly(t.od) + " – " + bezNuly(t.do) : "čas upřesníme";
}

// ---------- ukázkové změny z administrace ----------
// Dokud administrace nemá databázi, ukládá změny jen do prohlížeče (localStorage).
// Web je v tomtéž prohlížeči rovnou ukáže, ať je vidět, jak by změna vypadala.

var ULOZISTE_ADMINU = "kkslany-admin";
var PREPISOVANA_DATA = ["aktuality", "zavody", "galerie", "treneri", "zavodnici", "klub"];

function ukazkoveZmeny() {
  try { return JSON.parse(localStorage.getItem(ULOZISTE_ADMINU)) || null; } catch (e) { return null; }
}

function zahodUkazkoveZmeny() {
  try { localStorage.removeItem(ULOZISTE_ADMINU); } catch (e) { /* nic */ }
}

function seradTreninky(treninky) {
  treninky.sort(function (a, b) { return (a.od || "99:99") < (b.od || "99:99") ? -1 : 1; });
}

// Stejné pravidlo jako v nastroje/sestav.py: výjimka redaktora má vždy přednost.
function pouzijVyjimky(rozpis, vyjimky) {
  rozpis.tydny.forEach(function (tyden) {
    tyden.dny.forEach(function (den) {
      var zmeneno = false;
      vyjimky.forEach(function (v) {
        if (!(v.datum <= den.datum && den.datum <= (v.datumDo || v.datum))) return;
        if (v.datumDo) { // volno na víc dní (prázdniny): zruší všechny tréninky v rozsahu
          den.treninky.forEach(function (t) {
            t.stav = "zruseno";
            if (v.poznamka) t.poznamka = v.poznamka;
          });
          zmeneno = true;
          return;
        }
        var cil = den.treninky.filter(function (t) { return t.id === v.id; })[0];
        if (!cil) {
          cil = { id: v.id, typ: v.typ || "led", misto: v.misto || "zs", popis: v.popis || "Trénink", od: null, do: null, novy: true };
          den.treninky.push(cil);
        }
        ["od", "do", "popis", "misto", "poznamka", "poradi"].forEach(function (k) { if (k in v) cil[k] = v[k]; });
        if (v.zruseno) cil.stav = "zruseno";
        else if ("od" in v) { delete cil.stav; cil.zdroj = "redakce"; }
        zmeneno = true;
      });
      if (zmeneno) seradTreninky(den.treninky);
    });
  });
}

function nactiUkazkoveZmeny() {
  var u = ukazkoveZmeny(), zmeneno = false;
  if (!u) return false;
  PREPISOVANA_DATA.forEach(function (k) { if (u[k]) { KK[k] = u[k]; zmeneno = true; } });
  if (u.vyjimky && u.vyjimky.length) { pouzijVyjimky(KK.rozpis, u.vyjimky); zmeneno = true; }
  return zmeneno || !!u.sablona;
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

function vsechnyTreninky() {
  var vysledek = [];
  KK.rozpis.tydny.forEach(function (tyden) {
    tyden.dny.forEach(function (den) {
      den.treninky.forEach(function (t) { vysledek.push({ datum: den.datum, t: t }); });
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
  return vsechnyTreninky().filter(function (x) { return x.t.stav !== "zruseno" && !skoncil(x.datum, x.t); });
}

function mistoTreninku(t) {
  var m = KK.rozpis.mista[t.misto] || { nazev: t.misto };
  return m.mapa ? '<a href="' + esc(m.mapa) + '" target="_blank" rel="noopener">' + esc(m.nazev) + "</a>" : esc(m.nazev);
}

function textPoradi(poradi) {
  return "první na led sk. " + poradi.split("/")[0];
}

function stitkyTreninku(t) {
  var s = [];
  if (t.stav === "zruseno") s.push('<span class="stitek stitek--zruseno">zrušeno</span>');
  if (t.stav === "predbezne") s.push('<span class="stitek stitek--info" title="Zimní stadion rozpis na tento týden ještě nezveřejnil.">předběžně</span>');
  if (t.stav === "nenalezeno") s.push('<span class="stitek">' + IKONY.pozor + "na zimáku chybí – ověřte</span>");
  if (t.zmena && t.stav !== "zruseno") s.push('<span class="stitek">' + IKONY.pozor + "změna · " + esc(t.zmena.toLowerCase()) + "</span>");
  if (t.zdroj === "redakce" && !t.zmena && t.stav !== "zruseno") s.push('<span class="stitek">' + IKONY.pozor + (t.novy ? "mimořádně" : "změna času") + "</span>");
  return s.join(" ");
}

// Jeden trénink na jeden až dva řádky. Led na zimáku místo neuvádí (je ve sloupci „na ledě“).
function htmlTreninku(t) {
  var popis = [esc(t.popis)];
  if (!(t.typ === "led" && t.misto === "zs")) popis.push(mistoTreninku(t));
  if (t.poradi) popis.push("první sk. " + esc(t.poradi.split("/")[0]));
  var zruseno = t.stav === "zruseno";
  // u zrušeného tréninku se důvod nepřeškrtává, proto stojí samostatně
  var pozn = t.poznamka ? '<span class="trenink__pozn">' + esc(t.poznamka) + "</span>" : "";
  if (pozn && !zruseno) popis.push(pozn);
  return '<div class="trenink trenink--' + (t.typ === "led" ? "led" : "sucho") + (zruseno ? " trenink--zruseno" : "") + '">' +
    '<span class="trenink__cas">' + esc(casTreninku(t)) + "</span> " + stitkyTreninku(t) +
    '<span class="trenink__popis">' + popis.join(" · ") + "</span>" + (pozn && zruseno ? '<span class="trenink__duvod">' + pozn + "</span>" : "") +
    "</div>";
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
    '<a class="znak" href="index.html"><img src="img/logo-velke.png" alt="" width="82" height="56">' +
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
    "<p>Přidejte si rozpis do kalendáře v telefonu, změny se v něm objeví samy.</p>" + tlacitkaKalendare() + "</section>" +
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
