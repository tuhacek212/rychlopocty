// Společné funkce pro všechny stránky. Data jsou v window.KK (web/data/data.js).

var KK = window.KK;

var IKONY = {
  misto: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  skupiny: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  pozor: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.5"/></svg>',
  info: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>',
  kalendar: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  telefon: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  email: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  dum: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>'
};

var DNY = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];

function esc(text) {
  return String(text == null ? "" : text).replace(/[&<>"']/g, function (z) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z];
  });
}

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

// „dnes“, „zítra“, nebo „středa 21. 10.“
function kdy(iso) {
  var d = datumZIso(iso), dnes = new Date(), zitra = new Date();
  zitra.setDate(dnes.getDate() + 1);
  if (stejnyDen(d, dnes)) return "dnes";
  if (stejnyDen(d, zitra)) return "zítra";
  return DNY[d.getDay()] + " " + kratkeDatum(d);
}

function velke(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function casTreninku(t) {
  return t.od ? t.od.replace(/^0/, "") + "–" + t.do.replace(/^0/, "") : "čas upřesníme";
}

function textPoradi(poradi) {
  var prvni = poradi.split("/")[0];
  return "Na led jde první skupina " + prvni;
}

// Všechny tréninky jako ploché pole {datum, t}
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

function stavyTreninku(t) {
  var s = [];
  if (t.stav === "zruseno") s.push('<span class="stav stav--zruseno">Zrušeno</span>');
  if (t.stav === "predbezne") s.push('<span class="stav stav--info">' + IKONY.info + "Předběžně – zimák rozpis ještě nezveřejnil</span>");
  if (t.stav === "nenalezeno") s.push('<span class="stav">' + IKONY.pozor + "Led chybí v rozpisu zimáku – ověřte u trenérky</span>");
  if (t.zmena && t.stav !== "zruseno") s.push('<span class="stav">' + IKONY.pozor + "Jiný čas než obvykle · " + esc(t.zmena) + "</span>");
  return s.length ? '<div class="stavy">' + s.join("") + "</div>" : "";
}

function infoTreninku(t) {
  var misto = KK.rozpis.mista[t.misto] || { nazev: t.misto };
  var casti = ['<span>' + IKONY.misto + ' <a href="' + esc(misto.mapa || "#") + '" target="_blank" rel="noopener">' + esc(misto.nazev) + "</a></span>"];
  if (t.poradi) casti.push("<span>" + IKONY.skupiny + " " + esc(textPoradi(t.poradi)) + "</span>");
  return '<p class="tr__info">' + casti.join("") + "</p>";
}

function htmlTreninku(datum, t) {
  var tridy = "tr tr--" + esc(t.typ) + (t.stav === "zruseno" ? " tr--zruseno" : "");
  var cas = t.od
    ? "<strong>" + esc(t.od.replace(/^0/, "")) + "</strong><span>" + esc(t.do.replace(/^0/, "")) + "</span>"
    : "<span>čas<br>upřesníme</span>";
  return '<li class="' + tridy + '">' +
    '<div class="tr__cas">' + cas + "</div>" +
    "<div>" +
    '<div class="typ">' + esc(KK.rozpis.typy[t.typ] || t.typ) + "</div>" +
    '<div class="tr__nazev">' + esc(t.popis) + "</div>" +
    infoTreninku(t) +
    (t.poznamka ? '<p class="tr__pozn">' + esc(t.poznamka) + "</p>" : "") +
    stavyTreninku(t) +
    "</div></li>";
}

// Adresa kalendáře pro odběr (funguje jen na webu, ne při otevření souboru z disku)
function adresaKalendare() {
  if (location.protocol.indexOf("http") !== 0) return null;
  var url = new URL("kalendar.ics", location.href);
  return url.href.replace(/^https?:/, "webcal:");
}

function vyplnKalendar(prvek) {
  var webcal = adresaKalendare();
  if (!webcal) {
    prvek.innerHTML = '<p class="podtitul">Odběr kalendáře funguje po zveřejnění webu.</p>';
    return;
  }
  var google = "https://calendar.google.com/calendar/r?cid=" + encodeURIComponent(webcal);
  prvek.innerHTML =
    '<div class="tlacitka">' +
    '<a class="tlacitko" href="' + esc(webcal) + '">' + IKONY.kalendar + " iPhone / Outlook</a>" +
    '<a class="tlacitko tlacitko--svetle" href="' + esc(google) + '" target="_blank" rel="noopener">Google kalendář (Android)</a>' +
    "</div>";
}
