// Fotogalerie: odkazy na alba ve Fotkách Google, filtr podle kategorie.

(function () {
  var alba = KK.galerie.slice().sort(function (a, b) { return (b.rok || 0) - (a.rok || 0); });
  var kategorie = ["Vše"].concat(KK.galerie.map(function (a) { return a.kategorie; }).filter(function (k, i, pole) {
    return pole.indexOf(k) === i;
  }));
  var filtry = document.getElementById("filtry");
  var seznam = document.getElementById("alba");

  function slug(text) {
    return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
  }

  function vykresli(vybrana) {
    seznam.innerHTML = alba.filter(function (a) { return vybrana === "Vše" || a.kategorie === vybrana; }).map(function (a) {
      var nazev = a.rok ? a.nazev.replace(String(a.rok), "").trim() : a.nazev;
      return '<li><a class="album album--' + slug(a.kategorie) + '" href="' + esc(a.url) + '" target="_blank" rel="noopener">' +
        (a.rok ? '<span class="album__rok">' + a.rok + "</span>" : "") +
        '<span class="album__nazev">' + esc(nazev || a.nazev) + "</span></a></li>";
    }).join("");
    Array.prototype.forEach.call(filtry.children, function (b) {
      b.setAttribute("aria-pressed", b.textContent === vybrana ? "true" : "false");
    });
  }

  kategorie.forEach(function (k) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = k;
    b.addEventListener("click", function () { vykresli(k); });
    filtry.appendChild(b);
  });
  vykresli("Vše");
})();
