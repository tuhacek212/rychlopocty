// Úvodní stránka: nejbližší trénink, zbytek týdne, nábor a kontakty.

(function () {
  var vse = vsechnyTreninky();
  var budouci = vse.filter(function (x) { return x.t.stav !== "zruseno" && !skoncil(x.datum, x.t); });

  // ----- nejbližší trénink -----
  var box = document.getElementById("nejblizsi");
  var prvni = budouci[0];
  if (!prvni) {
    box.innerHTML = '<div class="karta">V nejbližších týdnech nejsou naplánované žádné tréninky.</div>';
  } else {
    var t = prvni.t;
    var probiha = t.od && datumSCasem(prvni.datum, t.od) <= new Date();
    var dalsi = budouci[1];
    box.innerHTML =
      '<div class="karta nejblizsi">' +
      '<p class="nejblizsi__stitek">' + (probiha ? "Právě probíhá" : "Nejbližší trénink") + "</p>" +
      '<p class="nejblizsi__kdy">' + esc(kdy(prvni.datum)) + " " + esc(casTreninku(t)) + "</p>" +
      '<p class="nejblizsi__co">' + esc((KK.rozpis.typy[t.typ] || t.typ) + " · " + t.popis) + "</p>" +
      infoTreninku(t) +
      (t.poznamka ? '<p class="tr__pozn">' + esc(t.poznamka) + "</p>" : "") +
      stavyTreninku(t) +
      (dalsi ? '<p class="tr__pozn">Potom: ' + esc(kdy(dalsi.datum) + " " + casTreninku(dalsi.t) + " – " + dalsi.t.popis) + "</p>" : "") +
      "</div>";
  }

  // ----- zbytek tohoto týdne -----
  var tyden = KK.rozpis.tydny[0];
  var html = "";
  tyden.dny.forEach(function (den) {
    var zbyvajici = den.treninky.filter(function (t) { return !skoncil(den.datum, t); });
    if (!zbyvajici.length) return;
    html += '<div class="den"><h3 class="den__nadpis">' + esc(velke(kdy(den.datum))) + "</h3>" +
      '<ul class="treninky">' + zbyvajici.map(function (t) { return htmlTreninku(den.datum, t); }).join("") + "</ul></div>";
  });
  document.getElementById("tyden").innerHTML = html || '<p class="podtitul">Tento týden už žádný trénink není. <a href="rozpis.html">Rozpis na další týdny →</a></p>';

  vyplnKalendar(document.getElementById("kalendar"));

  // ----- nábor a kontakt -----
  var klub = KK.klub;
  document.getElementById("nabor").textContent = klub.nabor;
  document.getElementById("nabor-telefon").href = "tel:" + klub.telefon.replace(/\s/g, "");
  document.getElementById("nabor-telefon").textContent = "Zavolat " + klub.telefon;

  document.getElementById("kontakt-obsah").innerHTML =
    '<ul class="kontakty">' +
    "<li>" + IKONY.telefon + '<a href="tel:' + esc(klub.telefon.replace(/\s/g, "")) + '">' + esc(klub.telefon) + "</a></li>" +
    "<li>" + IKONY.email + '<a href="mailto:' + esc(klub.email) + '">' + esc(klub.email) + "</a></li>" +
    "<li>" + IKONY.dum + "<span>" + esc(klub.adresa) + "</span></li>" +
    "</ul>" +
    '<ul class="vedeni">' + klub.vedeni.map(function (v) {
      return "<li><span>" + esc(v.funkce) + "</span><strong>" + esc(v.jmeno) + "</strong></li>";
    }).join("") + "</ul>" +
    '<p class="podtitul" style="margin-top:12px">IČO ' + esc(klub.ico) + " · účet " + esc(klub.ucet) +
    ' · <a href="' + esc(klub.facebook) + '" target="_blank" rel="noopener">Facebook</a></p>';

  document.getElementById("paticka").textContent = "© " + new Date().getFullYear() + " " + klub.nazev;
})();
