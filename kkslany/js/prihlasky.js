// Přihlášky na závody a soustředění (sekce administrace „Přihlášky na závody“).
// Trenér vypíše akci s uzávěrkou, rodič u ní za své dítě odpoví „chce jet“ / „nejede“,
// trenér pak dítě přihlásí (u svazu ho přihlásí sám, odsud si zkopíruje seznam).
// Rodič vidí a mění jen své děti – odpovědi ostatních nevidí. Každá změna jde do historie (kdo a kdy).
// Zatím ukázka v prohlížeči jako zbytek administrace. V ostrém provozu to musí hlídat databáze:
// řádek přihlášky smí měnit jen rodič toho dítěte nebo trenér, nikdo jiný ho ani nepřečte.

function datumZaDni(n) {
  var d = new Date();
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// ukázková data – vymyšlené děti a rodiče, data akcí se počítají od dneška
VYCHOZI.deti = function () {
  return [
    { id: "d1", jmeno: "Eliška Nováková", rocnik: 2015, kategorie: "Mladší žačky", rodice: ["rodic@kkslany.cz"] },
    { id: "d2", jmeno: "Tereza Nováková", rocnik: 2018, kategorie: "Nejmladší žačky", rodice: ["rodic@kkslany.cz"] },
    { id: "d3", jmeno: "Klára Dvořáková", rocnik: 2016, kategorie: "Mladší žačky", rodice: ["rodic2@kkslany.cz"] },
    { id: "d4", jmeno: "Natálie Svobodová", rocnik: 2013, kategorie: "Starší žačky", rodice: ["svobodova@example.cz"] },
    { id: "d5", jmeno: "Adéla Černá", rocnik: 2014, kategorie: "Starší žačky", rodice: ["cerna@example.cz", "cerny@example.cz"] },
    { id: "d6", jmeno: "Sofie Malá", rocnik: 2017, kategorie: "Nejmladší žačky", rodice: ["mala@example.cz"] }
  ];
};

VYCHOZI.akce = function () {
  return [
    { id: "a1", druh: "zavod", nazev: "Velká cena (ukázka)", datum: datumZaDni(9), misto: "Praha", uzaverka: datumZaDni(-2) },
    { id: "a2", druh: "zavod", nazev: "Pohár ČKS (ukázka)", datum: datumZaDni(17), misto: "Kladno", uzaverka: datumZaDni(7),
      odkaz: "https://www.czechskating.org/zavody/?sezona=2026-2027", poznamka: "Startovné 500 Kč. Sraz hodinu před startem kategorie." },
    { id: "a3", druh: "zavod", nazev: "Mikulášský pohár (ukázka)", datum: datumZaDni(38), misto: "Louny", uzaverka: datumZaDni(21) },
    { id: "a4", druh: "soustredeni", nazev: "Zimní soustředění (ukázka)", datum: datumZaDni(66), datumDo: datumZaDni(69), misto: "Mělník", uzaverka: datumZaDni(30),
      poznamka: "Ubytování a strava v ceně, doprava vlastní." }
  ];
};

VYCHOZI.prihlasky = function () {
  var kdy = new Date(Date.now() - 3 * 864e5).toISOString();
  return [
    { akce: "a1", dite: "d1", zajem: "ano", kdo: "Jana Nováková", kdy: kdy, stav: "prihlaseno", stavKdo: "Hana Ukázková", stavKdy: kdy },
    { akce: "a1", dite: "d3", zajem: "ano", kdo: "Petr Dvořák", kdy: kdy, stav: "prihlaseno", stavKdo: "Hana Ukázková", stavKdy: kdy },
    { akce: "a1", dite: "d4", zajem: "ano", kdo: "Ukázkový rodič", kdy: kdy, stav: "prihlaseno", stavKdo: "Hana Ukázková", stavKdy: kdy },
    { akce: "a1", dite: "d5", zajem: "ne", kdo: "Ukázkový rodič", kdy: kdy, poznamka: "Jsme na horách." },
    { akce: "a2", dite: "d3", zajem: "ano", kdo: "Petr Dvořák", kdy: kdy },
    { akce: "a2", dite: "d4", zajem: "ano", kdo: "Ukázkový rodič", kdy: kdy, poznamka: "Pojedeme vlastním autem, můžeme vzít ještě dvě děti." },
    { akce: "a2", dite: "d6", zajem: "ne", kdo: "Ukázkový rodič", kdy: kdy }
  ];
};

var pohledPrihlasek = "akce";

function konecAkce(a) { return a.datumDo || a.datum; }

function terminAkce(a) {
  return terminSoustredeni({ od: a.datum, do: konecAkce(a) }) + " " + datumZIso(konecAkce(a)).getFullYear();
}

function poUzaverce(a) { return !!a.uzaverka && a.uzaverka < dnesIso(); }

function najdi(klic, id) { return Uloziste.dej(klic).filter(function (x) { return x.id === id; })[0]; }

function prihlaskaDitete(prihlasky, akce, dite) {
  return prihlasky.filter(function (p) { return p.akce === akce && p.dite === dite; })[0];
}

// rodič smí jen své děti, trenér všechny
function smiDite(d) {
  return !!d && (smi("prihlasky") || (smi("prihlaska") && d.rodice.indexOf(prihlaseny.email) >= 0));
}

function pocetDeti(n) { return n + " " + (n === 1 ? "dítě" : n > 1 && n < 5 ? "děti" : "dětí"); }

function serazeneAkce(budouci) {
  var dnes = dnesIso();
  return Uloziste.dej("akce").filter(function (a) { return (konecAkce(a) >= dnes) === budouci; })
    .sort(function (a, b) { return (a.datum < b.datum ? -1 : 1) * (budouci ? 1 : -1); });
}

function htmlHlavyAkce(a, akce) {
  var uzaverka = !a.uzaverka ? "" : poUzaverce(a) ? '<span class="p-uzaverka p-uzaverka--po">Odpovědi uzavřené</span>'
    : '<span class="p-uzaverka">Odpovědět do <strong>' + esc(kratkeDatum(datumZIso(a.uzaverka))) + "</strong></span>";
  return '<div class="p-akce__hlava"><div class="p-akce__nazev">' +
    '<span class="p-druh p-druh--' + a.druh + '">' + (a.druh === "soustredeni" ? "soustředění" : "závod") + "</span>" + uzaverka +
    "<h2>" + esc(a.nazev) + "</h2>" +
    '<p class="a-pozn">' + esc(terminAkce(a)) + (a.misto ? " · " + esc(a.misto) : "") +
    (a.odkaz ? ' · <a href="' + esc(a.odkaz) + '" target="_blank" rel="noopener">propozice</a>' : "") + "</p>" +
    (a.poznamka ? '<p class="p-akce__pozn">' + esc(a.poznamka) + "</p>" : "") + "</div>" +
    (akce ? '<div class="a-polozka__akce">' + akce + "</div>" : "") + "</div>";
}

function stitekStavu(p) {
  if (p && p.stav === "prihlaseno") return '<span class="stitek stitek--zimak">přihlášeno</span>';
  if (p && p.stav === "neprihlaseno") return '<span class="stitek">trenér nepřihlásil</span>';
  if (p && p.zajem === "ano") return '<span class="stitek stitek--info">čeká na trenéra</span>';
  return "";
}

function kdyZmena(iso) {
  return new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ---------- pohled rodiče ----------

function mojeDeti() {
  return Uloziste.dej("deti").filter(function (d) { return d.rodice.indexOf(prihlaseny.email) >= 0; });
}

function tlOdpovedi(arg, hodnota, text, p, zavreno) {
  return '<button type="button" class="p-tl p-tl--' + hodnota + '" data-akce="odpoved" data-arg="' + esc(arg + "|" + hodnota) + '"' +
    ' aria-pressed="' + !!(p && p.zajem === hodnota) + '"' + (zavreno ? " disabled" : "") + ">" + text + "</button>";
}

function htmlPrihlaskyRodice() {
  var deti = mojeDeti(), prihlasky = Uloziste.dej("prihlasky"), akce = serazeneAkce(true);
  var jmena = deti.map(function (d) { return d.jmeno.split(" ")[0]; });
  var obsah;
  if (!deti.length) {
    obsah = '<section class="a-karta"><p>K vašemu účtu zatím není přiřazené žádné dítě. Napište trenérovi, ať vás k dítěti přidá.</p></section>';
  } else if (!akce.length) {
    obsah = '<section class="a-karta"><p class="a-pozn">Teď nejsou vypsané žádné závody ani soustředění.</p></section>';
  } else {
    obsah = akce.map(function (a) {
      var zavreno = poUzaverce(a);
      return '<section class="a-karta p-akce">' + htmlHlavyAkce(a) + '<ul class="p-deti">' + deti.map(function (d) {
        var p = prihlaskaDitete(prihlasky, a.id, d.id), arg = a.id + "|" + d.id;
        return '<li><div class="p-dite"><strong>' + esc(d.jmeno) + '</strong><span class="a-pozn">' + esc(d.kategorie || "") + "</span></div>" +
          '<div class="p-volba" role="group" aria-label="' + esc(d.jmeno) + '">' +
          tlOdpovedi(arg, "ano", "Chce jet", p, zavreno) + tlOdpovedi(arg, "ne", "Nejede", p, zavreno) + "</div>" +
          '<div class="p-stav">' + stitekStavu(p) + "</div>" +
          '<div class="p-poznamka">' + (p && p.poznamka ? "<span>„" + esc(p.poznamka) + "“</span>" : "") +
          (zavreno ? "" : tl(p && p.poznamka ? "upravit" : "Poznámka pro trenéra", "odpoved-poznamka", arg, "", "a-tl--odkaz")) + "</div></li>";
      }).join("") + "</ul>" +
        (zavreno ? '<p class="a-pozn p-akce__pata">Odpověď teď změní jen trenér – zavolejte mu.</p>' : "") + "</section>";
    }).join("");
  }
  return hlavicka("Přihlášky na závody", deti.length ? "Dejte trenérům vědět, kam chce " + esc(jmena.join(" a ")) + " jet. Trenér pak dítě přihlásí." : "") +
    obsah + '<p class="p-soukromi">' + IKONY.zamek + "<span>Vidíte jen své děti. Odpovědi ostatních rodičů nevidíte a nemůžete je změnit.</span></p>";
}

// arg: "akce|dite|ano" nebo "akce|dite|ne"
AKCE.odpoved = function (arg) {
  var c = arg.split("|"), a = najdi("akce", c[0]), d = najdi("deti", c[1]);
  if (!a || !smiDite(d) || (!smi("prihlasky") && poUzaverce(a))) return;
  var prihlasky = Uloziste.dej("prihlasky"), p = prihlaskaDitete(prihlasky, a.id, d.id);
  if (p && p.zajem === c[2]) return;
  if (!p) { p = { akce: a.id, dite: d.id }; prihlasky.push(p); }
  p.zajem = c[2]; p.kdo = prihlaseny.jmeno; p.kdy = new Date().toISOString();
  Uloziste.uloz("prihlasky", prihlasky, d.jmeno + " – " + a.nazev + ": " + (c[2] === "ano" ? "chce jet" : "nejede"));
  vykresli();
};

AKCE["odpoved-poznamka"] = function (arg) {
  var c = arg.split("|"), a = najdi("akce", c[0]), d = najdi("deti", c[1]);
  if (!a || !smiDite(d)) return;
  var prihlasky = Uloziste.dej("prihlasky"), p = prihlaskaDitete(prihlasky, a.id, d.id);
  otevriFormular({
    nadpis: "Poznámka pro trenéra", uvod: "<strong>" + esc(d.jmeno) + "</strong> – " + esc(a.nazev),
    hodnoty: { poznamka: p && p.poznamka },
    pole: [{ k: "poznamka", nazev: "Poznámka", typ: "textarea", radky: 3, napoveda: "Např. „Pojedeme vlastním autem“ nebo „Přijedeme až odpoledne“." }],
    ulozit: function (h) {
      if (!p) { p = { akce: a.id, dite: d.id }; prihlasky.push(p); }
      if (h.poznamka) p.poznamka = h.poznamka; else delete p.poznamka;
      Uloziste.uloz("prihlasky", prihlasky, d.jmeno + " – " + a.nazev + ": poznámka" + (h.poznamka ? " „" + h.poznamka + "“" : " smazána"));
    }
  });
};

// ---------- pohled trenéra ----------

var PORADI_ODPOVEDI = { ano: 0, "": 1, ne: 2 };

function htmlAkceTrenera(a, deti, prihlasky) {
  var radky = deti.map(function (d) { return { d: d, p: prihlaskaDitete(prihlasky, a.id, d.id) || {} }; });
  radky.sort(function (x, y) {
    return (x.p.stav === "prihlaseno" ? -1 : PORADI_ODPOVEDI[x.p.zajem || ""]) - (y.p.stav === "prihlaseno" ? -1 : PORADI_ODPOVEDI[y.p.zajem || ""]) ||
      x.d.jmeno.localeCompare(y.d.jmeno, "cs");
  });
  function pocet(podminka) { return radky.filter(podminka).length; }
  var prihlaseno = pocet(function (r) { return r.p.stav === "prihlaseno"; });
  var souhrn = '<p class="p-souhrn"><span class="p-souhrn--ano">chce jet <strong>' + pocet(function (r) { return r.p.zajem === "ano"; }) + "</strong></span>" +
    "<span>nejede <strong>" + pocet(function (r) { return r.p.zajem === "ne"; }) + "</strong></span>" +
    "<span>bez odpovědi <strong>" + pocet(function (r) { return !r.p.zajem; }) + "</strong></span>" +
    '<span class="p-souhrn--prihlaseno">přihlášeno <strong>' + prihlaseno + "</strong></span></p>";
  var akce = tl("Upravit", "akce-upravit", a.id, "prihlasky", "a-tl--male") +
    tl("Seznam přihlášených", "akce-seznam", a.id, "prihlasky", "a-tl--male") +
    tl("Smazat", "akce-smazat", a.id, "smazat", "a-tl--male a-tl--cervene");
  return '<section class="a-karta p-akce">' + htmlHlavyAkce(a, akce) + souhrn +
    '<table class="a-tabulka p-tabulka"><thead><tr><th>Dítě</th><th>Odpověď rodiče</th><th>Poznámka</th><th>Přihláška</th></tr></thead><tbody>' +
    radky.map(function (r) {
      var d = r.d, p = r.p, arg = a.id + "|" + d.id;
      var odpoved = p.zajem ? '<span class="p-odpoved p-odpoved--' + p.zajem + '">' + (p.zajem === "ano" ? "chce jet" : "nejede") + "</span>" +
        '<span class="a-pozn p-kdo">' + esc(p.kdo) + ", " + esc(kdyZmena(p.kdy)) + "</span>" : '<span class="a-pozn">bez odpovědi</span>';
      var stav;
      if (p.stav === "prihlaseno") {
        stav = '<span class="stitek stitek--zimak">přihlášeno</span>' +
          (p.zajem === "ne" ? ' <span class="stitek">' + IKONY.pozor + "rodič teď píše, že nejede</span>" : "") +
          tl("Zrušit", "prihlasit", arg + "|zrusit", "prihlasky", "a-tl--male a-tl--jemne");
      } else {
        stav = (p.stav === "neprihlaseno" ? '<span class="stitek">nepřihlášeno</span>' : "") +
          tl("Přihlásit", "prihlasit", arg + "|ano", "prihlasky", "a-tl--male" + (p.zajem === "ano" ? " a-tl--hlavni" : "")) +
          (p.zajem === "ano" && p.stav !== "neprihlaseno" ? tl("Nepřihlásit", "prihlasit", arg + "|ne", "prihlasky", "a-tl--male a-tl--jemne") : "");
      }
      return '<tr class="' + (p.zajem === "ne" && p.stav !== "prihlaseno" ? "p-nejede" : "") + '"><td><strong>' + esc(d.jmeno) + '</strong><span class="a-pozn p-kdo">' +
        esc([d.kategorie, d.rocnik].filter(Boolean).join(" · ")) + "</span></td>" +
        "<td>" + odpoved + "</td><td>" + esc(p.poznamka || "") + '</td><td class="p-tabulka__stav">' + stav + "</td></tr>";
    }).join("") + "</tbody></table></section>";
}

function htmlDeti() {
  var deti = Uloziste.dej("deti").sort(function (a, b) { return a.jmeno.localeCompare(b.jmeno, "cs"); });
  return '<section class="a-karta"><div class="a-karta__hlava"><h2>Děti a rodiče <small>' + pocetDeti(deti.length) + "</small></h2>" +
    tl(A_IKONY.plus + "Přidat dítě", "dite", "", "prihlasky", "a-tl--male a-tl--hlavni") + "</div>" +
    '<p class="a-pozn">Rodič se přihlásí svým e-mailem a uvidí jen děti, u kterých je jeho e-mail. Dítě může mít víc rodičů.</p>' +
    '<table class="a-tabulka"><thead><tr><th>Dítě</th><th>Kategorie</th><th>Rodiče (e-mail)</th><th></th></tr></thead><tbody>' +
    deti.map(function (d) {
      return "<tr><td><strong>" + esc(d.jmeno) + "</strong>" + (d.rocnik ? ' <span class="a-pozn">' + esc(d.rocnik) + "</span>" : "") + "</td>" +
        "<td>" + esc(d.kategorie || "") + "</td><td>" + d.rodice.map(esc).join("<br>") + "</td>" +
        '<td class="a-tabulka__akce">' + tl("Upravit", "dite", d.id, "prihlasky", "a-tl--male") +
        tl("Odebrat", "dite-odebrat", d.id, "smazat", "a-tl--male a-tl--cervene") + "</td></tr>";
    }).join("") + "</tbody></table></section>";
}

function htmlPrihlaskyTrenera() {
  var deti = Uloziste.dej("deti"), prihlasky = Uloziste.dej("prihlasky");
  var pohledy = [["akce", "Závody a soustředění"], ["deti", "Děti a rodiče"]];
  var obsah;
  if (pohledPrihlasek === "deti") obsah = htmlDeti();
  else {
    var budouci = serazeneAkce(true), probehle = serazeneAkce(false);
    obsah = (budouci.map(function (a) { return htmlAkceTrenera(a, deti, prihlasky); }).join("") ||
      '<section class="a-karta"><p class="a-pozn">Žádná akce není vypsaná.</p></section>') +
      (probehle.length ? '<details class="a-karta p-probehle"><summary>Proběhlé akce (' + probehle.length + ")</summary><ul class=\"a-radky\">" +
        probehle.map(function (a) {
          var n = prihlasky.filter(function (p) { return p.akce === a.id && p.stav === "prihlaseno"; }).length;
          return "<li><div><strong>" + esc(a.nazev) + '</strong><span class="a-pozn">' + esc(terminAkce(a)) + " · přihlášeno " + pocetDeti(n) + "</span></div></li>";
        }).join("") + "</ul></details>" : "");
  }
  return hlavicka("Přihlášky na závody", "Rodiče u každé akce odpoví, jestli dítě chce jet. Vy pak dítě přihlásíte.",
    tl(A_IKONY.plus + "Vypsat závod / soustředění", "akce-nova", "", "prihlasky", "a-tl--hlavni")) +
    '<nav class="a-pohledy" aria-label="Části přihlášek">' + pohledy.map(function (p) {
      return '<button type="button" data-akce="pohled-prihlasek" data-arg="' + p[0] + '" aria-pressed="' + (pohledPrihlasek === p[0]) + '">' + p[1] + "</button>";
    }).join("") + "</nav>" + obsah;
}

VYKRESLENI.prihlasky = function () {
  return smi("prihlasky") ? htmlPrihlaskyTrenera() : htmlPrihlaskyRodice();
};

AKCE["pohled-prihlasek"] = function (p) {
  pohledPrihlasek = p;
  vykresli();
};

// arg: "akce|dite|ano" (přihlásit), "…|ne" (nepřihlásit), "…|zrusit" (vrátit do čekání)
AKCE.prihlasit = function (arg) {
  if (!smi("prihlasky")) return;
  var c = arg.split("|"), a = najdi("akce", c[0]), d = najdi("deti", c[1]);
  var prihlasky = Uloziste.dej("prihlasky"), p = prihlaskaDitete(prihlasky, a.id, d.id);
  if (!p) { p = { akce: a.id, dite: d.id }; prihlasky.push(p); }
  if (c[2] === "zrusit") delete p.stav; else p.stav = c[2] === "ano" ? "prihlaseno" : "neprihlaseno";
  p.stavKdo = prihlaseny.jmeno; p.stavKdy = new Date().toISOString();
  Uloziste.uloz("prihlasky", prihlasky, d.jmeno + " – " + a.nazev + ": " + { ano: "přihlášeno", ne: "nepřihlášeno", zrusit: "přihláška zrušena" }[c[2]]);
  vykresli();
};

function upravAkci(id) {
  if (!smi("prihlasky")) return;
  var seznam = Uloziste.dej("akce"), a = seznam.filter(function (x) { return x.id === id; })[0];
  otevriFormular({
    nadpis: a ? "Upravit akci" : "Vypsat závod nebo soustředění",
    uvod: a ? "" : "Rodiče ji uvidí v přihláškách a za své dítě odpoví, jestli chce jet.",
    hodnoty: a || { druh: "zavod" },
    pole: [
      { k: "druh", nazev: "Druh", typ: "select", moznosti: [["zavod", "Závod"], ["soustredeni", "Soustředění"]], pul: true },
      { k: "misto", nazev: "Kde", pul: true },
      { k: "nazev", nazev: "Název", povinne: true },
      { k: "datum", nazev: "Datum", typ: "date", povinne: true, pul: true },
      { k: "datumDo", nazev: "Do (u vícedenní akce)", typ: "date", pul: true },
      { k: "uzaverka", nazev: "Odpovědět do", typ: "date", pul: true, napoveda: "Pak už odpověď změní jen trenér." },
      { k: "odkaz", nazev: "Propozice (odkaz)", typ: "url", pul: true },
      { k: "poznamka", nazev: "Informace pro rodiče", typ: "textarea", radky: 3, napoveda: "Startovné, sraz, doprava…" }
    ],
    ulozit: function (h) {
      if (h.datumDo && h.datumDo < h.datum) return "Konec musí být stejný nebo pozdější den než začátek.";
      if (h.uzaverka && h.uzaverka > h.datum) return "Uzávěrka musí být nejpozději v den akce.";
      var cil = a || { id: "a" + Date.now().toString(36) };
      ["druh", "nazev", "datum", "datumDo", "misto", "uzaverka", "odkaz", "poznamka"].forEach(function (k) { if (h[k]) cil[k] = h[k]; else delete cil[k]; });
      if (!a) seznam.push(cil);
      Uloziste.uloz("akce", seznam, (a ? "Upravena akce " : "Vypsána akce ") + cil.nazev + " (" + terminAkce(cil) + ")");
    }
  });
}

AKCE["akce-nova"] = function () { upravAkci(null); };
AKCE["akce-upravit"] = upravAkci;
AKCE["akce-smazat"] = function (id) {
  if (!smi("smazat")) return;
  var a = najdi("akce", id);
  potvrd("Smazat akci?", "<strong>" + esc(a.nazev) + "</strong> zmizí i se všemi odpověďmi rodičů.", "Smazat", function () {
    Uloziste.data.prihlasky = Uloziste.dej("prihlasky").filter(function (p) { return p.akce !== id; });
    Uloziste.uloz("akce", Uloziste.dej("akce").filter(function (x) { return x.id !== id; }), "Smazána akce " + a.nazev);
  });
};

// seznam přihlášených k zkopírování (např. do přihlášky u svazu)
AKCE["akce-seznam"] = function (id) {
  var a = najdi("akce", id), prihlasky = Uloziste.dej("prihlasky");
  var seznam = Uloziste.dej("deti").filter(function (d) {
    var p = prihlaskaDitete(prihlasky, id, d.id);
    return p && p.stav === "prihlaseno";
  }).map(function (d) { return [d.jmeno, d.rocnik, d.kategorie].filter(Boolean).join(", "); });
  otevriFormular({
    nadpis: "Přihlášení – " + a.nazev, uvod: pocetDeti(seznam.length) + ". Seznam si zkopírujte, např. do přihlášky u svazu.",
    tlacitko: "Hotovo", hodnoty: { seznam: seznam.join("\n") },
    pole: [{ k: "seznam", nazev: "Jméno, ročník, kategorie", typ: "textarea", radky: Math.max(3, seznam.length + 1) }],
    ulozit: function () {}
  });
};

function upravDite(id) {
  if (!smi("prihlasky")) return;
  var deti = Uloziste.dej("deti"), d = deti.filter(function (x) { return x.id === id; })[0];
  var kategorie = deti.map(function (x) { return x.kategorie; }).filter(function (k, i, p) { return k && p.indexOf(k) === i; });
  otevriFormular({
    nadpis: d ? "Upravit dítě" : "Přidat dítě",
    hodnoty: d ? Object.assign({}, d, { rodice: d.rodice.join(", ") }) : {},
    pole: [
      { k: "jmeno", nazev: "Jméno a příjmení", povinne: true },
      { k: "rocnik", nazev: "Ročník", typ: "number", pul: true },
      { k: "kategorie", nazev: "Kategorie", pul: true, seznam: kategorie },
      { k: "rodice", nazev: "E-maily rodičů", povinne: true, napoveda: "Víc e-mailů oddělte čárkou. Rodič se tímto e-mailem přihlásí a uvidí jen své děti." }
    ],
    ulozit: function (h) {
      var rodice = h.rodice.toLowerCase().split(/[\s,;]+/).filter(Boolean);
      if (rodice.some(function (e) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); })) return "Zkontrolujte e-maily rodičů.";
      var cil = d || { id: "d" + Date.now().toString(36) };
      cil.jmeno = h.jmeno; cil.rodice = rodice;
      if (h.rocnik) cil.rocnik = h.rocnik; else delete cil.rocnik;
      if (h.kategorie) cil.kategorie = h.kategorie; else delete cil.kategorie;
      if (!d) deti.push(cil);
      Uloziste.uloz("deti", deti, (d ? "Upraveno dítě " : "Přidáno dítě ") + cil.jmeno);
    }
  });
}

AKCE.dite = function (id) { upravDite(id || null); };
AKCE["dite-odebrat"] = function (id) {
  if (!smi("smazat")) return;
  var d = najdi("deti", id);
  potvrd("Odebrat dítě?", "<strong>" + esc(d.jmeno) + "</strong> zmizí i se všemi svými přihláškami a rodiče ho už neuvidí.", "Odebrat", function () {
    Uloziste.data.prihlasky = Uloziste.dej("prihlasky").filter(function (p) { return p.dite !== id; });
    Uloziste.uloz("deti", Uloziste.dej("deti").filter(function (x) { return x.id !== id; }), "Odebráno dítě " + d.jmeno);
  });
};
