// Obsah jednotlivých stránek. Každá stránka má v <body data-stranka="…"> svůj název.

var STRANKY = {};

// ---------- úvod: nejbližší trénink v modrém panelu ----------
STRANKY.uvod = function () {
  var box = document.getElementById("nejblizsi");
  var budouci = budouciTreninky();
  var prvni = budouci[0];
  if (!prvni) {
    box.innerHTML = '<p class="nejblizsi__co">V nejbližších týdnech nejsou naplánované žádné tréninky.</p>';
  } else {
    var t = prvni.t, dalsi = budouci[1];
    var probiha = t.od && datumSCasem(prvni.datum, t.od) <= new Date();
    var f = forma(t);
    var co = esc(t.typ === "led" && !t.popis ? "Led · " + nazevTreninku(t).toLowerCase() : nazevTreninku(t)) + (f === "rozdeleny" ? " " + htmlPoradi(t) : "");
    var skupiny = f === "skupiny" ? '<ul class="nejblizsi__skupiny">' + t.casti.filter(function (c) { return c.stav !== "zruseno"; }).map(function (c) {
      return "<li><strong>" + esc(bezNuly(c.od) + " – " + bezNuly(c.do)) + "</strong> " + esc(c.skupina) + "</li>";
    }).join("") + "</ul>" : "";
    box.innerHTML =
      '<p class="nejblizsi__stitek">' + (probiha ? "Právě probíhá" : "Nejbližší trénink") + "</p>" +
      '<p class="nejblizsi__kdy">' + esc(kdy(prvni.datum) + " " + casTreninku(t)) + "</p>" +
      '<p class="nejblizsi__co">' + co + "</p>" + skupiny +
      '<p class="nejblizsi__info">' + mistoTreninku(t) + "</p>" +
      (t.poznamka ? '<p class="nejblizsi__info">' + esc(t.poznamka) + "</p>" : "") +
      htmlZrusenychSkupin(t) +
      (stitkyTreninku(t) ? '<div class="stitek-radek">' + stitkyTreninku(t) + "</div>" : "");
  }

  // další tréninky v bílém panelu – včetně zrušených, ať rodiče změnu nepřehlédnou
  var dalsi = vsechnyTreninky().filter(function (x) { return !skoncil(x.datum, x.t); });
  dalsi = dalsi.slice(dalsi.indexOf(dalsi.filter(function (x) { return x.t === (prvni && prvni.t); })[0]) + 1, 99).slice(0, 6);
  document.getElementById("dalsi-treninky").innerHTML = dalsi.map(function (x) {
    var d = datumZIso(x.datum), t = x.t;
    return '<li class="' + (t.stav === "zruseno" ? "zruseno" : "") + '"><span class="dalsi__den">' + DNY_KRATCE[d.getDay()] + " <small>" + kratkeDatum(d) + "</small></span>" +
      '<span class="dalsi__cas">' + esc(casTreninku(t)) + "</span>" +
      '<span class="dalsi__co"><i class="tecka tecka--' + (t.typ === "led" ? "led" : "sucho") + '"></i><span class="dalsi__text">' + esc(kratkyPopis(t)) + "</span> " + stitkyTreninku(t) + "</span></li>";
  }).join("") || '<li class="prazdne">Další tréninky zatím nejsou naplánované.</li>';

  document.getElementById("aktuality-uvod").innerHTML = KK.aktuality.slice(0, 3).map(function (a) {
    var nadpis = a.odkaz ? '<a href="' + esc(a.odkaz) + '">' + esc(a.nadpis) + "</a>" : esc(a.nadpis);
    return '<article class="novinka"><time datetime="' + esc(a.datum) + '">' + esc(plneDatum(a.datum)) + "</time><h3>" + nadpis + "</h3>" +
      (a.text ? "<p>" + esc(a.text) + "</p>" : "") + "</article>";
  }).join("");
  document.getElementById("nabor-text").textContent = KK.klub.nabor;
  document.getElementById("nabor-telefon").href = "tel:" + KK.klub.telefon.replace(/\s/g, "");
  document.getElementById("nabor-telefon").textContent = "Zavolat " + KK.klub.telefon;

};

// ---------- rozpis tréninků: týdny jako tabulka ----------
STRANKY.rozpis = function () {
  var rozpis = KK.rozpis;
  var dnes = new Date();
  if (!rozpis.zimakOk) {
    document.getElementById("upozorneni").innerHTML =
      '<p class="hlaska">' + IKONY.pozor + "<span>Rozpis zimního stadionu se teď nepodařilo načíst. " +
      "Časy na ledě jsou obvyklé a mohou se lišit.</span></p>";
  }

  var html = zobrazeneTydny().map(function (tyden, i) {
    var od = datumZIso(tyden.pondeli), ne = datumZIso(tyden.pondeli);
    ne.setDate(ne.getDate() + 6);
    var nadpis = '<h2>' + (i === 0 ? "Tento týden" : "Příští týden") + "</h2>" +
      '<span class="tyden__datum">' + tyden.tyden + ". týden · " + kratkeDatum(od) + " – " + kratkeDatum(ne) + "</span>" +
      (tyden.zimak === "nezverejneno" ? '<span class="stitek stitek--info" title="Zimní stadion rozpis na tento týden ještě nezveřejnil.">led předběžně</span>' : "");

    var radky = tyden.dny.map(function (den) {
      var d = datumZIso(den.datum);
      var naLede = den.treninky.filter(function (t) { return t.typ === "led"; });
      var naSuchu = den.treninky.filter(function (t) { return t.typ !== "led"; });
      var tridy = [];
      if (stejnyDen(d, dnes)) tridy.push("dnes");
      else if (d < dnes) tridy.push("minuly");
      if (!den.treninky.length) tridy.push("volno");
      return '<tr class="' + tridy.join(" ") + '">' +
        '<th class="den" scope="row">' + DNY_KRATCE[d.getDay()] + "<span>" + kratkeDatum(d) + "</span></th>" +
        (den.treninky.length
          ? "<td>" + naLede.map(htmlTreninku).join("") + "</td><td>" + naSuchu.map(htmlTreninku).join("") + "</td>"
          : '<td colspan="2" class="bez">bez tréninku</td>') + "</tr>";
    }).join("");

    return '<section class="tyden" aria-label="' + (i === 0 ? "Tento" : "Příští") + ' týden"><div class="tyden__hlava">' + nadpis + "</div>" +
      '<table class="rozpis"><thead><tr><th>den</th><th>na ledě</th><th>na suchu a další</th></tr></thead>' +
      "<tbody>" + radky + "</tbody></table></section>";
  }).join("");
  document.getElementById("tydny").innerHTML = html;
  document.getElementById("kalendar-tlacitka").innerHTML = tlacitkaKalendare();
};

// ---------- trenéři ----------
STRANKY.treneri = function () {
  document.getElementById("treneri").innerHTML = KK.treneri.map(function (t) {
    var casti = t.jmeno.split(" ");
    return '<article class="trener"><img src="' + esc(t.foto) + '" alt="' + esc(t.jmeno) + '" width="96" height="124" loading="lazy">' +
      "<div><h2>" + esc(casti[0]) + "<br>" + esc(casti.slice(1).join(" ")) + "</h2>" +
      "<p>" + esc(t.kvalifikace) + "</p>" + (t.role ? '<p class="role">' + esc(t.role) + "</p>" : "") + "</div></article>";
  }).join("");
};

// ---------- závodníci ----------
STRANKY.zavodnici = function () {
  var data = KK.zavodnici;
  var seznam = document.getElementById("zavodnici");
  var filtry = document.getElementById("filtry");
  var treneri = data.zavodnici.map(function (z) { return z.trenerka; })
    .filter(function (t, i, pole) { return pole.indexOf(t) === i; }).sort();

  function vykresli(trenerka) {
    seznam.innerHTML = data.zavodnici.filter(function (z) { return !trenerka || z.trenerka === trenerka; }).map(function (z) {
      return '<li class="zavodnik"><img src="' + esc(z.foto) + '" alt="' + esc(z.jmeno) + '" loading="lazy" width="300" height="400">' +
        "<div><h2>" + esc(z.jmeno) + "</h2><dl>" +
        "<dt>kategorie</dt><dd>" + esc(z.kategorie) + "</dd>" +
        "<dt>ročník</dt><dd>" + esc(z.rocnik) + "</dd>" +
        "<dt>v klubu od</dt><dd>" + esc(z.odRoku) + "</dd>" +
        "<dt>trenérka</dt><dd>" + esc(z.trenerka) + "</dd>" +
        "</dl></div></li>";
    }).join("");
    Array.prototype.forEach.call(filtry.children, function (b) {
      b.setAttribute("aria-pressed", (b.getAttribute("data-trenerka") || "") === (trenerka || "") ? "true" : "false");
    });
  }

  [""].concat(treneri).forEach(function (t) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-trenerka", t);
    b.textContent = t ? "trenérka " + t : "Všichni";
    b.addEventListener("click", function () { vykresli(t); });
    filtry.appendChild(b);
  });
  vykresli("");

  document.getElementById("zakladna").innerHTML = data.zakladna.skupiny.map(function (s) {
    return '<figure><img src="' + esc(s.foto) + '" alt="Základna – ' + esc(s.deti) + '" loading="lazy">' +
      "<figcaption>" + esc(s.deti) + "</figcaption></figure>";
  }).join("") + '<p class="poznamka">Trenérka základny: ' + esc(data.zakladna.trenerka) + "</p>";
  document.getElementById("sezona-zavodniku").textContent = data.sezona;
};

// ---------- fotogalerie ----------
STRANKY.galerie = function () {
  var poradi = [];
  KK.galerie.forEach(function (a) { if (poradi.indexOf(a.kategorie) < 0) poradi.push(a.kategorie); });
  document.getElementById("galerie").innerHTML = poradi.map(function (k) {
    var alba = KK.galerie.filter(function (a) { return a.kategorie === k; })
      .sort(function (a, b) { return (b.rok || 0) - (a.rok || 0); });
    return '<section class="kategorie-alb"><h2>' + esc(k) + '</h2><ul class="alba">' + alba.map(function (a) {
      var nazev = a.rok ? a.nazev.replace(String(a.rok), "").trim() : a.nazev;
      return '<li><a class="album' + (a.rok ? "" : " album--bez-roku") + '" href="' + esc(a.url) + '" target="_blank" rel="noopener">' +
        (a.rok ? '<span class="album__rok">' + a.rok + "</span>" : "") +
        '<span class="album__nazev">' + esc(nazev || a.nazev) + "</span></a></li>";
    }).join("") + "</ul></section>";
  }).join("");
};

// ---------- výsledky závodů ----------
STRANKY.zavody = function () {
  document.getElementById("zavody").innerHTML = KK.zavody.map(function (s, i) {
    return '<section class="sezona"><h2>Sezóna ' + esc(s.sezona) + "</h2>" + s.zavody.map(function (z, j) {
      return '<details class="zavod"' + (i === 0 && j < 2 ? " open" : "") + "><summary>" + esc(z.nazev) + "</summary>" +
        '<div class="zavod__obsah">' + z.sekce.map(function (sekce) {
          return (sekce.nazev ? "<h3>" + esc(sekce.nazev) + "</h3>" : "") +
            "<ul>" + sekce.radky.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>";
        }).join("") + "</div></details>";
    }).join("") + "</section>";
  }).join("");
};

// ---------- kontakt ----------
STRANKY.kontakt = function () {
  var klub = KK.klub;
  document.getElementById("vedeni").innerHTML = klub.vedeni.map(function (v) {
    return "<tr><td>" + esc(v.funkce) + "</td><td><strong>" + esc(v.jmeno) + "</strong>" +
      (v.telefon ? '<br><a href="tel:' + esc(v.telefon.replace(/\s/g, "")) + '">' + esc(v.telefon) + "</a>" : "") + "</td></tr>";
  }).join("");
  document.getElementById("udaje").innerHTML =
    "<li>" + IKONY.misto + "<span>" + esc(klub.adresa) + "</span></li>" +
    "<li>" + IKONY.telefon + '<a href="tel:' + esc(klub.telefon.replace(/\s/g, "")) + '">' + esc(klub.telefon) + "</a></li>" +
    "<li>" + IKONY.email + '<a href="mailto:' + esc(klub.email) + '">' + esc(klub.email) + "</a></li>" +
    "<li>" + IKONY.facebook + '<a href="' + esc(klub.facebook) + '" target="_blank" rel="noopener">Facebook</a></li>';
  document.getElementById("ico").textContent = klub.ico;
  document.getElementById("ucet").textContent = klub.ucet;
};

(function () {
  var stranka = document.body.getAttribute("data-stranka");
  if (STRANKY[stranka]) STRANKY[stranka]();
})();
