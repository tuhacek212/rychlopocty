// Stránka rozpisu: přepínání týdnů a výpis dnů s tréninky.

(function () {
  var rozpis = KK.rozpis;
  var tlacitka = document.getElementById("tydny");
  var panel = document.getElementById("tyden");

  document.getElementById("podtitul").textContent = "Sezóna " + rozpis.sezona;
  if (!rozpis.zimakOk) {
    document.getElementById("upozorneni").innerHTML =
      '<p class="hlaska">' + IKONY.pozor + "<span>Rozpis zimního stadionu se teď nepodařilo načíst. " +
      "Časy na ledě jsou obvyklé a mohou se lišit.</span></p>";
  }

  function nazevTydne(tyden, i) {
    if (i === 0) return "Tento týden";
    if (i === 1) return "Příští týden";
    var od = datumZIso(tyden.pondeli), ne = datumZIso(tyden.pondeli);
    ne.setDate(ne.getDate() + 6);
    return od.getDate() + ". – " + kratkeDatum(ne);
  }

  function vykresliTyden(i) {
    var tyden = rozpis.tydny[i];
    var dnes = new Date();
    var od = datumZIso(tyden.pondeli), ne = datumZIso(tyden.pondeli);
    ne.setDate(ne.getDate() + 6);

    var html = '<p class="podtitul">' + tyden.tyden + ". týden · " + kratkeDatum(od) + " – " + kratkeDatum(ne) + " " + ne.getFullYear() + "</p>";
    if (tyden.zimak === "nezverejneno") {
      html += '<p class="hlaska hlaska--info">' + IKONY.info +
        "<span>Zimák rozpis na tento týden ještě nezveřejnil. Časy na ledě jsou zatím obvyklé.</span></p>";
    }

    tyden.dny.forEach(function (den) {
      var d = datumZIso(den.datum);
      var jeDnes = stejnyDen(d, dnes);
      var minuly = d < dnes && !jeDnes;
      var nadpis = velke(DNY[d.getDay()]) + " " + kratkeDatum(d) + (jeDnes ? ' <span class="stitek-dnes">dnes</span>' : "");
      if (!den.treninky.length) {
        html += '<div class="den den--prazdny' + (minuly ? " den--minuly" : "") + '"><h2 class="den__nadpis">' + nadpis + " · bez tréninku</h2></div>";
        return;
      }
      html += '<div class="den' + (minuly ? " den--minuly" : "") + '"' + (jeDnes ? ' id="dnes"' : "") + ">" +
        '<h2 class="den__nadpis">' + nadpis + "</h2>" +
        '<ul class="treninky">' + den.treninky.map(function (t) { return htmlTreninku(den.datum, t); }).join("") + "</ul></div>";
    });
    panel.innerHTML = html;

    Array.prototype.forEach.call(tlacitka.children, function (b, j) {
      b.setAttribute("aria-selected", j === i ? "true" : "false");
      b.tabIndex = j === i ? 0 : -1;
    });
  }

  rozpis.tydny.forEach(function (tyden, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.textContent = nazevTydne(tyden, i);
    b.addEventListener("click", function () { vykresliTyden(i); });
    tlacitka.appendChild(b);
  });

  // šipkami doleva/doprava mezi týdny (přístupnost)
  tlacitka.addEventListener("keydown", function (e) {
    var aktivni = Array.prototype.indexOf.call(tlacitka.children, document.activeElement);
    if (aktivni < 0 || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    var dalsi = Math.max(0, Math.min(rozpis.tydny.length - 1, aktivni + (e.key === "ArrowRight" ? 1 : -1)));
    vykresliTyden(dalsi);
    tlacitka.children[dalsi].focus();
  });

  vykresliTyden(0);
  vyplnKalendar(document.getElementById("kalendar"));
})();
