// Administrace webu KK Slaný.
// Účty pro správu webu – všechny vidí totéž, liší se tím, co smí měnit:
//   redaktor – rozpis (zrušení, jiný čas, mimořádný trénink), přidávání a úpravy aktualit, výsledků a fotoalb
//   trenér   – jako redaktor a navíc přihlášky na závody (vidí všechny děti)
//   správce  – navíc mazání, obvyklý týden, trenéři, závodníci, údaje klubu a uživatelé
// Rodič vidí jen Přihlášky a v nich jen své děti (js/prihlasky.js).
// Zatím běží jako ukázka: přihlášení i změny jsou jen v tomto prohlížeči (localStorage).
// Ostré ukládání přibude s databází – vymění se jen objekt Uloziste a funkce prihlas().

var ROLE = {
  redaktor: { nazev: "Redaktor", prava: ["web", "rozpis", "pridat", "upravit"] },
  trener: { nazev: "Trenér", prava: ["web", "rozpis", "pridat", "upravit", "prihlasky"] },
  spravce: { nazev: "Správce", prava: ["web", "rozpis", "pridat", "upravit", "smazat", "sablona", "lide", "klub", "uzivatele", "prihlasky"] },
  rodic: { nazev: "Rodič", prava: ["prihlaska"] }
};

var POPIS_PRAV = [
  ["rozpis", "Rušit tréninky, měnit jejich čas, přidávat mimořádné tréninky a poznámky"],
  ["pridat", "Přidávat aktuality, výsledky závodů a fotoalba"],
  ["upravit", "Upravovat aktuality, výsledky závodů a fotoalba"],
  ["smazat", "Mazat aktuality, výsledky závodů a fotoalba"],
  ["sablona", "Měnit obvyklý týden tréninků"],
  ["lide", "Spravovat trenéry a závodníky"],
  ["klub", "Měnit kontakty a údaje klubu"],
  ["uzivatele", "Přidávat a odebírat uživatele administrace"],
  ["prihlasky", "Přihlášky na závody a soustředění – vidět všechny děti a přihlašovat je"]
];

var UKAZKOVE_HESLO = "ukazka";
var PRIHLASENI = "kkslany-prihlaseni";

var VYCHOZI = {
  vyjimky: function () { return []; },
  sablony: function () { return KK.rozpis.sablony; },
  soustredeni: function () { return KK.rozpis.soustredeni || []; },
  aktuality: function () { return KK.aktuality; },
  zavody: function () { return KK.zavody; },
  galerie: function () { return KK.galerie; },
  treneri: function () { return KK.treneri; },
  zavodnici: function () { return KK.zavodnici; },
  klub: function () { return KK.klub; },
  uzivatele: function () {
    return [
      { email: "spravce@kkslany.cz", jmeno: "Správce webu", role: "spravce" },
      { email: "redaktor@kkslany.cz", jmeno: "Redaktor rozpisu", role: "redaktor" },
      { email: "trenerka@kkslany.cz", jmeno: "Hana Ukázková", role: "trener" },
      { email: "rodic@kkslany.cz", jmeno: "Jana Nováková", role: "rodic" },
      { email: "rodic2@kkslany.cz", jmeno: "Petr Dvořák", role: "rodic" }
    ];
  },
  historie: function () { return []; }
};

// ---------- ukládání (zatím do prohlížeče) ----------

var Uloziste = {
  data: (function () {
    var data = ukazkoveZmeny() || {};
    // obvyklý týden ve starém tvaru (jediný, bez data platnosti) se zahodí
    delete data.sablona;
    // účty trenérky a rodičů přibyly později – doplní se i do dříve uloženého seznamu
    if (data.uzivatele && !data.uzivatele.some(function (u) { return u.role === "rodic"; })) {
      data.uzivatele = data.uzivatele.concat(VYCHOZI.uzivatele().filter(function (u) { return u.role === "trener" || u.role === "rodic"; }));
    }
    return data;
  })(),
  dej: function (klic) {
    return kopie(klic in this.data ? this.data[klic] : VYCHOZI[klic]());
  },
  uloz: function (klic, hodnota, popis) {
    this.data[klic] = hodnota;
    var historie = this.dej("historie");
    historie.unshift({ kdy: new Date().toISOString(), kdo: prihlaseny.jmeno, role: prihlaseny.role, co: popis });
    this.data.historie = historie.slice(0, 200);
    try {
      localStorage.setItem(ULOZISTE_ADMINU, JSON.stringify(this.data));
      oznam("Uloženo: " + popis);
    } catch (e) {
      oznam(e.name === "QuotaExceededError"
        ? "Změnu se nepodařilo uložit – úložiště prohlížeče je plné (ukázka v něm drží i fotky)."
        : "Změnu se nepodařilo uložit – prohlížeč nepovoluje ukládání.");
    }
  },
  // změnil se web? (přihlášky a uživatelé na webu vidět nejsou)
  zmeneno: function () {
    return Object.keys(this.data).some(function (k) { return ["historie", "uzivatele", "deti", "akce", "prihlasky"].indexOf(k) < 0; });
  },
  zahod: function () {
    var uzivatele = this.data.uzivatele;
    this.data = uzivatele ? { uzivatele: uzivatele } : {};
    zahodUkazkoveZmeny();
    if (uzivatele) try { localStorage.setItem(ULOZISTE_ADMINU, JSON.stringify(this.data)); } catch (e) { /* nic */ }
  }
};

// ---------- přihlášení a práva ----------

var prihlaseny = null;

function nactiPrihlaseni() {
  var email = null;
  try { email = sessionStorage.getItem(PRIHLASENI); } catch (e) { /* nic */ }
  prihlaseny = Uloziste.dej("uzivatele").filter(function (u) { return u.email === email; })[0] || null;
}

function prihlas(email, heslo) {
  var uzivatel = Uloziste.dej("uzivatele").filter(function (u) { return u.email === email.trim().toLowerCase(); })[0];
  if (!uzivatel || heslo !== UKAZKOVE_HESLO) return "Nesprávný e-mail nebo heslo.";
  try { sessionStorage.setItem(PRIHLASENI, uzivatel.email); } catch (e) { /* nic */ }
  prihlaseny = uzivatel;
  return null;
}

function odhlas() {
  try { sessionStorage.removeItem(PRIHLASENI); } catch (e) { /* nic */ }
  prihlaseny = null;
  location.hash = "";
  vykresli();
}

function smi(pravo) {
  return !!prihlaseny && ROLE[prihlaseny.role].prava.indexOf(pravo) >= 0;
}

// sekci vidí, kdo má aspoň jedno z jejích práv „vidi“ (bez něj stačí správa webu)
function viditelna(sekce) {
  return (sekce.vidi || ["web"]).some(smi);
}

// ---------- drobné stavební kameny ----------

var A_IKONY = {
  prehled: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  aktuality: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v10a2 2 0 0 1-2 2M8 9h5M8 13h5M8 17h3"/></svg>',
  pohar: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8M9 18h6"/></svg>',
  foto: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="9" cy="11" r="2"/><path d="m21 17-5-5-9 8"/></svg>',
  trener: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  lide: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.2A5 5 0 0 1 21.5 19"/></svg>',
  klub: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/></svg>',
  klic: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M16 7l3 3M14 9l2 2"/></svg>',
  historie: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>',
  plus: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  ok: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  odhlasit: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10"/></svg>'
};

var SEKCE = [
  { id: "prehled", nazev: "Přehled", ikona: A_IKONY.prehled },
  { id: "rozpis", nazev: "Rozpis tréninků", ikona: IKONY.kalendar },
  { id: "prihlasky", nazev: "Přihlášky na závody", ikona: '<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11l2 2 4-4M9 17h6"/></svg>', vidi: ["prihlasky", "prihlaska"] },
  { id: "aktuality", nazev: "Aktuality", ikona: A_IKONY.aktuality },
  { id: "zavody", nazev: "Výsledky závodů", ikona: A_IKONY.pohar },
  { id: "galerie", nazev: "Fotogalerie", ikona: A_IKONY.foto },
  { id: "treneri", nazev: "Trenéři", ikona: A_IKONY.trener, pravo: "lide" },
  { id: "zavodnici", nazev: "Závodníci", ikona: A_IKONY.lide, pravo: "lide" },
  { id: "klub", nazev: "Klub a kontakty", ikona: A_IKONY.klub, pravo: "klub" },
  { id: "uzivatele", nazev: "Uživatelé", ikona: A_IKONY.klic, pravo: "uzivatele" },
  { id: "historie", nazev: "Historie změn", ikona: A_IKONY.historie }
];

// Tlačítko akce. Bez práva je vidět, ale zamčené.
function tl(text, akce, arg, pravo, trida) {
  var muze = !pravo || smi(pravo);
  return '<button type="button" class="a-tl ' + (trida || "") + '" data-akce="' + akce + '" data-arg="' + esc(arg == null ? "" : arg) + '"' +
    (muze ? "" : ' disabled title="Jen pro správce"') + ">" + (muze ? "" : IKONY.zamek) + text + "</button>";
}

function zamceno(text) {
  return '<p class="a-zamceno">' + IKONY.zamek + "<span>" + text + "</span></p>";
}

function hlavicka(nadpis, popis, akce) {
  return '<header class="a-hlavicka"><div><h1>' + nadpis + "</h1>" + (popis ? "<p>" + popis + "</p>" : "") + "</div>" +
    (akce ? '<div class="a-hlavicka__akce">' + akce + "</div>" : "") + "</header>";
}

function stitekRole(role) {
  return '<span class="role role--' + role + '">' + ROLE[role].nazev + "</span>";
}

function oznam(text) {
  var box = document.getElementById("oznameni");
  box.textContent = text;
  box.classList.add("videt");
  clearTimeout(oznam.casovac);
  oznam.casovac = setTimeout(function () { box.classList.remove("videt"); }, 3200);
}

function dnesIso() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function denADatum(iso) {
  var d = datumZIso(iso);
  return DNY_KRATCE[d.getDay()] + " " + kratkeDatum(d);
}

// ---------- formulář v okně ----------

var okno = {};

function htmlPole(p, hodnota) {
  var h = hodnota == null ? "" : hodnota, vstup;
  var spolecne = ' name="' + p.k + '"' + (p.povinne ? " required" : "") + (p.zamknout ? " disabled" : "");
  if (p.typ === "textarea") {
    vstup = "<textarea" + spolecne + ' rows="' + (p.radky || 4) + '">' + esc(h) + "</textarea>";
  } else if (p.typ === "fotka") {
    // hodnota je cesta k obrázku nebo data: URL nově vybrané fotky (skryté pole)
    vstup = '<div class="a-fotka"><img src="' + esc(h || "img/logo-velke.png") + '" alt="" width="60" height="80">' +
      '<input type="file" accept="image/*" data-fotka="' + p.k + '"><input type="hidden" name="' + p.k + '" value="' + esc(h) + '"></div>';
  } else if (p.typ === "select") {
    vstup = "<select" + spolecne + ">" + p.moznosti.map(function (m) {
      return '<option value="' + esc(m[0]) + '"' + (String(m[0]) === String(h) ? " selected" : "") + ">" + esc(m[1]) + "</option>";
    }).join("") + "</select>";
  } else {
    vstup = '<input type="' + (p.typ || "text") + '"' + spolecne + ' value="' + esc(h) + '"' +
      (p.seznam ? ' list="seznam-' + p.k + '"' : "") + (p.typ === "number" ? ' inputmode="numeric"' : "") + ">" +
      (p.seznam ? '<datalist id="seznam-' + p.k + '">' + p.seznam.map(function (s) { return '<option value="' + esc(s) + '">'; }).join("") + "</datalist>" : "");
  }
  return '<label class="pole' + (p.pul ? " pole--pul" : "") + (p.cas ? " pole--cas" : "") + '"><span>' + esc(p.nazev) + (p.povinne ? " <b>*</b>" : "") + "</span>" +
    vstup + (p.napoveda ? "<small>" + esc(p.napoveda) + "</small>" : "") + "</label>";
}

// pole: [{k, nazev, typ, povinne, moznosti, seznam, napoveda, pul}], ulozit(hodnoty) vrátí text chyby nebo nic
function otevriFormular(nastaveni) {
  okno = nastaveni;
  var hodnoty = nastaveni.hodnoty || {};
  document.getElementById("okno-nadpis").textContent = nastaveni.nadpis;
  document.getElementById("okno-uvod").innerHTML = nastaveni.uvod || "";
  document.getElementById("okno-pole").innerHTML = (nastaveni.pole || []).map(function (p) {
    return p.typ === "forma" ? htmlFormy(p, hodnoty) : htmlPole(p, hodnoty[p.k]);
  }).join("");
  nastavFormu(forma(hodnoty));
  document.getElementById("okno-chyba").textContent = "";
  var ok = document.getElementById("okno-ok");
  ok.textContent = nastaveni.tlacitko || "Uložit";
  ok.className = "a-tl " + (nastaveni.nebezpecne ? "a-tl--nebezpecne" : "a-tl--hlavni");
  document.getElementById("okno").showModal();
  var prvni = document.querySelector("#okno-pole input, #okno-pole textarea, #okno-pole select");
  if (prvni) prvni.focus();
}

function potvrd(nadpis, uvod, tlacitko, akce) {
  otevriFormular({ nadpis: nadpis, uvod: uvod, tlacitko: tlacitko, nebezpecne: true, pole: [], ulozit: function () { akce(); } });
}

document.getElementById("okno-formular").addEventListener("submit", function (e) {
  e.preventDefault();
  var formular = e.target, hodnoty = {};
  (okno.pole || []).forEach(function (p) {
    if (p.typ === "forma") { hodnoty.forma = ctiFormu(formular); return; }
    var el = formular.elements[p.k];
    if (!el) return;
    var v = el.value.trim();
    hodnoty[p.k] = p.typ === "number" ? (v === "" ? null : Number(v)) : v;
  });
  var chyba = okno.ulozit(hodnoty);
  if (chyba) {
    document.getElementById("okno-chyba").textContent = chyba;
    return;
  }
  document.getElementById("okno").close();
  vykresli();
});
document.querySelector("#okno [data-zavrit]").addEventListener("click", function () { document.getElementById("okno").close(); });

// vybraná fotka se ořízne na výšku 3 : 4 (jako karty na webu) a zmenší, aby se vešla do úložiště
var FOTKA_SIRKA = 450, FOTKA_VYSKA = 600;
document.getElementById("okno-pole").addEventListener("change", function (e) {
  var vstup = e.target, soubor = vstup.files && vstup.files[0];
  if (!vstup.dataset.fotka || !soubor) return;
  var obal = vstup.closest(".a-fotka"), ok = document.getElementById("okno-ok"), chyba = document.getElementById("okno-chyba");
  var obrazek = new Image(), adresa = URL.createObjectURL(soubor);
  ok.disabled = true;
  chyba.textContent = "";
  obrazek.onload = function () {
    var platno = document.createElement("canvas"), pomer = FOTKA_SIRKA / FOTKA_VYSKA;
    var sirka = obrazek.naturalWidth, vyska = obrazek.naturalHeight;
    var vyrezS = Math.min(sirka, vyska * pomer), vyrezV = vyrezS / pomer;
    platno.width = FOTKA_SIRKA;
    platno.height = FOTKA_VYSKA;
    platno.getContext("2d").drawImage(obrazek, (sirka - vyrezS) / 2, (vyska - vyrezV) / 2, vyrezS, vyrezV, 0, 0, FOTKA_SIRKA, FOTKA_VYSKA);
    var data = platno.toDataURL("image/jpeg", 0.82);
    obal.querySelector("input[type=hidden]").value = data;
    obal.querySelector("img").src = data;
    URL.revokeObjectURL(adresa);
    ok.disabled = false;
  };
  obrazek.onerror = function () {
    URL.revokeObjectURL(adresa);
    vstup.value = "";
    chyba.textContent = "Tuhle fotku prohlížeč neumí otevřít. Zkuste ji uložit jako JPG nebo PNG.";
    ok.disabled = false;
  };
  obrazek.src = adresa;
});

// ---------- přihlašovací obrazovka ----------

function htmlPrihlaseni() {
  return '<div class="a-prihlaseni"><div class="a-prihlaseni__karta">' +
    '<a class="a-prihlaseni__znak" href="index.html"><img src="img/brusle.svg" alt="" width="96" height="96"><span>KK Slaný</span></a>' +
    "<h1>Přihlášení</h1>" +
    '<form id="prihlaseni" class="a-prihlaseni__formular">' +
    '<label class="pole"><span>E-mail</span><input type="email" name="email" autocomplete="username" required></label>' +
    '<label class="pole"><span>Heslo</span><input type="password" name="heslo" autocomplete="current-password" required></label>' +
    '<p class="okno__chyba" id="chyba-prihlaseni" role="alert"></p>' +
    '<button class="a-tl a-tl--hlavni a-tl--velke" type="submit">Přihlásit se</button></form>' +
    '<div class="a-ukazka"><p><strong>Ukázka.</strong> Ostré účty přibudou s databází. Zatím si můžete vyzkoušet všechny role:</p>' +
    '<div class="a-ukazka__ucty">' + ["redaktor@kkslany.cz", "trenerka@kkslany.cz", "spravce@kkslany.cz", "rodic@kkslany.cz"].map(function (email) {
      var u = VYCHOZI.uzivatele().filter(function (x) { return x.email === email; })[0];
      return '<button type="button" class="a-ucet" data-ucet="' + email + '">' + stitekRole(u.role) + "<span>" + email + "</span></button>";
    }).join("") +
    "</div><p class=\"a-ukazka__heslo\">Heslo ke všem: <code>" + UKAZKOVE_HESLO + "</code> · druhý rodič: rodic2@kkslany.cz</p></div>" +
    '<a class="a-zpet" href="index.html">← Zpět na web</a>' +
    "</div></div>";
}

function zapojPrihlaseni() {
  var formular = document.getElementById("prihlaseni");
  formular.addEventListener("submit", function (e) {
    e.preventDefault();
    var chyba = prihlas(formular.elements.email.value, formular.elements.heslo.value);
    if (chyba) {
      document.getElementById("chyba-prihlaseni").textContent = chyba;
      return;
    }
    vykresli();
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-ucet]"), function (b) {
    b.addEventListener("click", function () {
      formular.elements.email.value = b.getAttribute("data-ucet");
      formular.elements.heslo.value = UKAZKOVE_HESLO;
      formular.elements.heslo.focus();
    });
  });
}

// ---------- rozvržení administrace ----------

function aktualniSekce() {
  var id = location.hash.replace("#", "");
  var viditelne = SEKCE.filter(viditelna);
  return viditelne.filter(function (s) { return s.id === id; })[0] || viditelne[0];
}

function htmlRozvrzeni(sekce) {
  var odkazy = SEKCE.filter(viditelna).map(function (s) {
    return '<a href="#' + s.id + '"' + (s.id === sekce.id ? ' aria-current="page"' : "") + ">" + s.ikona + "<span>" + s.nazev + "</span>" +
      (s.pravo && !smi(s.pravo) ? '<i class="a-menu__zamek" title="Jen pro čtení">' + IKONY.zamek + "</i>" : "") + "</a>";
  }).join("");
  var lista = '<div class="a-lista">' + IKONY.info + "<span><strong>Ukázka:</strong> změny se ukládají jen v tomto prohlížeči a web je ukáže jen vám. " +
    "Ostré ukládání zapneme s databází.</span>" +
    (Uloziste.zmeneno() ? '<a href="index.html" target="_blank">Zobrazit web se změnami</a>' + tl("Zahodit všechny změny", "zahodit", "", null, "a-tl--odkaz") : "") + "</div>";
  return '<div class="a-rozvrzeni"><aside class="a-bok">' +
    '<a class="a-znak" href="index.html" title="Zpět na web"><img src="img/brusle.svg" alt="" width="44" height="44"><span>KK Slaný<small>administrace</small></span></a>' +
    '<nav class="a-menu" aria-label="Sekce administrace">' + odkazy + "</nav>" +
    '<div class="a-uzivatel"><div><strong>' + esc(prihlaseny.jmeno) + "</strong>" + stitekRole(prihlaseny.role) + "</div>" +
    '<button type="button" class="a-tl a-tl--jemne a-tl--male" data-akce="odhlasit">' + A_IKONY.odhlasit + "Odhlásit</button></div>" +
    '</aside><main class="a-obsah" id="a-obsah">' + lista + VYKRESLENI[sekce.id]() + "</main></div>";
}

function vykresli() {
  var koren = document.getElementById("admin");
  nactiPrihlaseni();
  if (!prihlaseny) {
    document.title = "Přihlášení – KK Slaný";
    koren.innerHTML = htmlPrihlaseni();
    zapojPrihlaseni();
    return;
  }
  var sekce = aktualniSekce();
  document.title = sekce.nazev + " – administrace KK Slaný";
  koren.innerHTML = htmlRozvrzeni(sekce);
}

// ---------- jednotlivé sekce ----------

var VYKRESLENI = {};
var AKCE = {};

// rozpis tak, jak by vypadal se změnami z administrace (obvyklý týden, soustředění, výjimky)
function nahledRozpisu() {
  var rozpis = kopie(KK.rozpis);
  pouzijZmenyRozpisu(rozpis, {
    sablony: "sablony" in Uloziste.data ? Uloziste.dej("sablony") : null,
    soustredeni: "soustredeni" in Uloziste.data ? Uloziste.dej("soustredeni") : null,
    vyjimky: Uloziste.dej("vyjimky")
  });
  return rozpis;
}

// --- přehled ---
VYKRESLENI.prehled = function () {
  var rozpis = nahledRozpisu();
  var dalsi = null, dnes = new Date();
  zobrazeneTydny(rozpis).some(function (tyden) {
    return tyden.dny.some(function (den) {
      return spojNavazujici(den.treninky).some(function (t) {
        if (t.stav === "zruseno" || skoncil(den.datum, t)) return false;
        dalsi = { datum: den.datum, t: t };
        return true;
      });
    });
  });
  var zmeny = Uloziste.dej("vyjimky").length + KK.rozpis.vyjimky.filter(function (v) { return datumZIso(v.datum) >= new Date(dnes.getFullYear(), dnes.getMonth(), dnes.getDate()); }).length;
  var role = ROLE[prihlaseny.role];
  return hlavicka("Dobrý den, " + esc(prihlaseny.jmeno.split(" ")[0]),
    "Jste přihlášeni jako " + role.nazev.toLowerCase() + "." + (prihlaseny.role === "redaktor" ? " Vidíte vše, některé věci ale mění jen správce." : "")) +
    '<div class="a-dlazdice">' +
    '<a class="a-dlazdice__polozka" href="#rozpis"><span>Nejbližší trénink</span><strong>' +
    (dalsi ? esc(velke(kdy(dalsi.datum)) + " " + casTreninku(dalsi.t)) : "žádný") + "</strong>" +
    (dalsi ? "<small>" + esc(kratkyPopis(dalsi.t)) + "</small>" : "") + "</a>" +
    '<a class="a-dlazdice__polozka" href="#rozpis"><span>Změny v rozpisu</span><strong>' + zmeny + "</strong><small>zrušení, jiné časy, mimořádné tréninky</small></a>" +
    '<a class="a-dlazdice__polozka" href="#aktuality"><span>Aktuality</span><strong>' + Uloziste.dej("aktuality").length + "</strong><small>poslední " +
    esc(Uloziste.dej("aktuality").map(function (a) { return plneDatum(a.datum); })[0] || "–") + "</small></a>" +
    "</div>" +
    '<div class="a-dve">' +
    '<section class="a-karta"><h2>Rychlé akce</h2><div class="a-rychle">' +
    '<a class="a-tl a-tl--hlavni" href="#rozpis">' + IKONY.kalendar + "Zrušit nebo posunout trénink</a>" +
    tl(A_IKONY.plus + "Napsat aktualitu", "aktualita", "", "pridat") +
    tl(A_IKONY.plus + "Přidat výsledky závodu", "zavod", "", "pridat") +
    tl(A_IKONY.plus + "Přidat fotoalbum", "album", "", "pridat") +
    "</div></section>" +
    '<section class="a-karta"><h2>Co můžete dělat</h2><ul class="a-prava">' + POPIS_PRAV.map(function (p) {
      var ma = role.prava.indexOf(p[0]) >= 0;
      return '<li class="' + (ma ? "ano" : "ne") + '">' + (ma ? A_IKONY.ok : IKONY.zamek) + "<span>" + p[1] + (ma ? "" : p[0] === "prihlasky" ? " <em>– jen trenér a správce</em>" : " <em>– jen správce</em>") + "</span></li>";
    }).join("") + "</ul></section></div>";
};

// --- rozpis ---
// Změna (výjimka) se pozná podle dne, tréninku a případně skupiny – zrušit jde i jen sk. B.
function stejnaVyjimka(a, b) {
  return a.datum === b.datum && a.id === b.id && (a.skupina || "") === (b.skupina || "");
}

function mistniVyjimka(datum, id, skupina) {
  return Uloziste.dej("vyjimky").filter(function (v) { return stejnaVyjimka(v, { datum: datum, id: id, skupina: skupina }); })[0];
}

function mistniVyjimkyTreninku(datum, id) {
  return Uloziste.dej("vyjimky").filter(function (v) { return v.datum === datum && v.id === id; });
}

function ulozVyjimku(vyjimka, popis) {
  var vyjimky = Uloziste.dej("vyjimky").filter(function (v) { return !stejnaVyjimka(v, vyjimka); });
  vyjimky.push(vyjimka);
  Uloziste.uloz("vyjimky", vyjimky, popis);
}

// arg tlačítek: "datum|id" nebo "datum|id|skupina"
function najdiTrenink(arg) {
  var casti = arg.split("|"), datum = casti[0], id = casti[1];
  var den = null;
  nahledRozpisu().tydny.forEach(function (tyden) {
    tyden.dny.forEach(function (d) { if (d.datum === datum) den = d; });
  });
  return { datum: datum, id: id, skupina: casti[2] || "", t: den && den.treninky.filter(function (t) { return t.id === id; })[0] };
}

function popisTreninku(datum, t) {
  return denADatum(datum) + " " + casTreninku(t) + " – " + kratkyPopis(t);
}

function moznostiMist() {
  return Object.keys(KK.rozpis.mista).map(function (k) { return [k, KK.rozpis.mista[k].nazev]; });
}

function moznostiTypu() {
  return Object.keys(KK.rozpis.typy).map(function (k) { return [k, KK.rozpis.typy[k]]; });
}

function kontrolaCasu(h) {
  if (h.od && h.do && h.od >= h.do) return "Konec musí být později než začátek.";
  if ((h.od && !h.do) || (!h.od && h.do)) return "Vyplňte začátek i konec.";
  return null;
}

// ---------- skupiny ve formuláři: sloučený / rozdělený / každá skupina jindy ----------

var RADKU_SKUPIN = 3;

// všechna pořadí skupin z obsah/sezona.json, např. A → B a B → A
function moznostiPoradi() {
  function permutace(pole) {
    if (pole.length <= 1) return [pole];
    var vysledek = [];
    pole.forEach(function (x, i) {
      permutace(pole.slice(0, i).concat(pole.slice(i + 1))).forEach(function (p) { vysledek.push([x].concat(p)); });
    });
    return vysledek;
  }
  return permutace((KK.rozpis.skupiny || ["A", "B"]).slice(0, 3)).map(function (p) { return [p.join(","), p.join(" → ")]; });
}

// h = trénink nebo položka obvyklého týdne (casti, stridani)
function htmlFormy(p, h) {
  var f = forma(h), casti = h.casti || [];
  var poradi = f === "rozdeleny" ? casti.map(function (c) { return c.skupina; }).join(",") : moznostiPoradi()[0][0];
  var navrhy = (KK.rozpis.skupiny || []).concat(["1. sk.", "2. sk.", "1. sk. + základna", "základna"]);
  var radky = "";
  for (var i = 0; i < RADKU_SKUPIN; i++) {
    var c = f === "skupiny" && casti[i] || {};
    radky += '<div class="forma__radek"><input name="sk-nazev-' + i + '" value="' + esc(c.skupina || "") + '" placeholder="Skupina" list="seznam-skupin" aria-label="Skupina ' + (i + 1) + '">' +
      '<input type="time" name="sk-od-' + i + '" value="' + esc(c.od || "") + '" aria-label="Začátek"><span>–</span>' +
      '<input type="time" name="sk-do-' + i + '" value="' + esc(c.do || "") + '" aria-label="Konec"></div>';
  }
  function volba(hodnota, nazev, popis, detail) {
    return '<label class="forma__volba"><input type="radio" name="forma" value="' + hodnota + '"' + (f === hodnota ? " checked" : "") + ">" +
      "<span><strong>" + nazev + "</strong><small>" + popis + "</small></span></label>" +
      (detail ? '<div class="forma__detail" data-pro="' + hodnota + '">' + detail + "</div>" : "");
  }
  return '<fieldset class="forma" data-forma="' + f + '"><legend>Skupiny</legend>' +
    volba("slouceny", "Sloučený", "všichni najednou") +
    volba("rozdeleny", "Rozdělený", "skupiny se v jednom čase střídají",
      '<label class="forma__poradi">Pořadí <select name="poradi">' + moznostiPoradi().map(function (m) {
        return '<option value="' + esc(m[0]) + '"' + (m[0] === poradi ? " selected" : "") + ">" + esc(m[1]) + "</option>";
      }).join("") + "</select></label>" +
      (p.stridani ? '<label class="forma__zaskrtnuti"><input type="checkbox" name="stridani"' + (h.stridani ? " checked" : "") + "> v sudém týdnu obráceně</label>" : "")) +
    volba("skupiny", "Každá skupina jindy", "např. pohybovka – vlastní čas pro každou skupinu",
      radky + '<datalist id="seznam-skupin">' + navrhy.map(function (s) { return '<option value="' + esc(s) + '">'; }).join("") + "</datalist>") +
    "</fieldset>";
}

function ctiFormu(formular) {
  var f = formular.elements.forma.value || "slouceny";
  if (f === "rozdeleny") {
    return { forma: f, stridani: !!(formular.elements.stridani && formular.elements.stridani.checked),
      casti: formular.elements.poradi.value.split(",").map(function (s) { return { skupina: s }; }) };
  }
  var casti = [];
  if (f === "skupiny") {
    for (var i = 0; i < RADKU_SKUPIN; i++) {
      var c = { skupina: formular.elements["sk-nazev-" + i].value.trim(), od: formular.elements["sk-od-" + i].value, do: formular.elements["sk-do-" + i].value };
      if (c.skupina || c.od || c.do) casti.push(c);
    }
  }
  return { forma: f, casti: casti };
}

function kontrolaFormy(fm) {
  if (fm.forma !== "skupiny") return null;
  if (fm.casti.length < 2) return "Vyplňte aspoň dvě skupiny s časem – jinak zvolte sloučený trénink.";
  for (var i = 0; i < fm.casti.length; i++) {
    var c = fm.casti[i];
    if (!c.skupina || !c.od || !c.do) return "U každé skupiny vyplňte název, začátek i konec.";
    if (c.od >= c.do) return c.skupina + ": konec musí být později než začátek.";
  }
  return null;
}

// u „každá skupina jindy“ se celkový čas dopočítá, pole Začátek/Konec se schovají
function nastavFormu(f) {
  var pole = document.querySelector("#okno-pole .forma");
  if (!pole) return;
  pole.setAttribute("data-forma", f);
  Array.prototype.forEach.call(document.querySelectorAll("#okno-pole .pole--cas"), function (el) { el.hidden = f === "skupiny"; });
}

document.getElementById("okno-pole").addEventListener("change", function (e) {
  if (e.target.name === "forma") nastavFormu(e.target.value);
});

function bezStavu(casti) {
  return JSON.stringify((casti || []).map(function (c) { return [c.skupina, c.od || "", c.do || ""]; }));
}

// ---------- týden v administraci ----------

function htmlTreninkuAdmin(den, t, minuly) {
  var arg = den.datum + "|" + t.id;
  var mistni = mistniVyjimkyTreninku(den.datum, t.id);
  var cela = mistni.filter(function (v) { return !v.skupina; })[0];
  var akce = "";
  if (!minuly) {
    if (t.stav === "zruseno") {
      akce = mistni.length ? tl("Obnovit", "obnovit", arg, "rozpis", "a-tl--male") : '<span class="a-pozn">zrušeno – viz Změny a volno</span>';
    } else {
      akce = tl("Upravit", "zmenit", arg, "rozpis", "a-tl--male") +
        (t.novy && cela ? tl("Odebrat", "obnovit", arg, "rozpis", "a-tl--male a-tl--cervene") : tl("Zrušit…", "zrusit", arg, "rozpis", "a-tl--male a-tl--cervene"));
      mistni.filter(function (v) { return v.skupina && v.zruseno; }).forEach(function (v) {
        akce += tl("Obnovit " + nazevSkupiny(v.skupina), "obnovit", arg + "|" + v.skupina, "rozpis", "a-tl--male");
      });
    }
  }
  return htmlBloku(t, mistni.length ? '<span class="stitek stitek--ukazka">vaše změna</span>' : "", akce, mistni.length);
}

// Jeden trénink v tabulce: stejný blok jako na webu, pod ním tlačítka.
function htmlBloku(t, znacky, akce, upraveno) {
  return '<div class="a-blok a-blok--' + (t.typ === "led" ? "led" : "sucho") + (upraveno ? " a-blok--upraveno" : "") + '">' +
    htmlTreninku(t) + (znacky ? '<div class="a-blok__znacky">' + znacky + "</div>" : "") +
    (akce ? '<div class="a-blok__akce">' + akce + "</div>" : "") + "</div>";
}

// Tabulka týdne se sloupci „na ledě“ a „na suchu a další“ – stejně jako rozpis na webu.
// radky: [{nazev, datum?, tridy, led: html, sucho: html}]
function htmlTabulkyAdmin(radky) {
  return '<table class="rozpis a-rozpis"><thead><tr><th>den</th><th class="a-rozpis__led">na ledě</th><th class="a-rozpis__sucho">na suchu a další</th></tr></thead><tbody>' +
    radky.map(function (r) {
      return '<tr class="' + r.tridy + '"><th class="den" scope="row">' + r.nazev + (r.datum ? "<span>" + r.datum + "</span>" : "") + "</th>" +
        '<td class="a-rozpis__led" data-sloupec="na ledě">' + r.led + '</td><td class="a-rozpis__sucho" data-sloupec="na suchu a další">' + r.sucho + "</td></tr>";
    }).join("") + "</tbody></table>";
}

function tlPridat(druh, akce, arg, pravo) {
  return tl(A_IKONY.plus + (druh === "led" ? "led" : "na suchu"), akce, arg, pravo, "a-pridat a-pridat--" + druh);
}

function htmlTydneAdmin(tyden, soustredeni) {
  var dnes = new Date();
  dnes = new Date(dnes.getFullYear(), dnes.getMonth(), dnes.getDate());
  return '<section class="a-karta a-tyden">' + htmlTabulkyAdmin(tyden.dny.map(function (den) {
    var d = datumZIso(den.datum), minuly = d < dnes, vDni = soustredeniVeDni(den.datum, soustredeni);
    function sloupec(druh) {
      return den.treninky.filter(function (t) { return (t.typ === "led") === (druh === "led"); })
        .map(function (t) { return htmlTreninkuAdmin(den, t, minuly); }).join("") +
        (minuly ? "" : tlPridat(druh, "pridat-trenink", den.datum + "|" + druh, "rozpis"));
    }
    return { nazev: DNY_KRATCE[d.getDay()], datum: kratkeDatum(d) + (vDni.length ? '<i class="a-soustr" title="' + esc(vDni[0].nazev) + '">soustředění</i>' : ""),
      led: sloupec("led"), sucho: sloupec("sucho"),
      tridy: (minuly ? "minuly" : "") + (stejnyDen(d, dnes) ? " dnes" : "") + (vDni.length ? " na-soustredeni" : "") };
  })) + "</section>";
}

var vybranyTyden = 0;
var pohledRozpisu = "tydny";

function casKontroly(iso) {
  var d = new Date(iso), dnes = new Date(), vcera = new Date();
  vcera.setDate(dnes.getDate() - 1);
  var cas = d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
  if (stejnyDen(d, dnes)) return "dnes v " + cas;
  if (stejnyDen(d, vcera)) return "včera v " + cas;
  return kratkeDatum(d) + " v " + cas;
}

// Porovnání ledu ze zimáku s obvyklým týdnem pro jeden týden (z dat, jak je sestavil nastroje/sestav.py).
function porovnaniSeZimakem(tyden) {
  if (tyden.zimak === "nezverejneno") return { stav: "info", text: "Zimák týden ještě nezveřejnil – zatím platí obvyklé časy (na webu „předběžně“)." };
  if (tyden.zimak === "chyba") return { stav: "chyba", text: "Rozpis zimáku se nepodařilo načíst – platí obvyklé časy." };
  var rozdily = [];
  tyden.dny.forEach(function (den) {
    den.treninky.forEach(function (t) {
      if (t.typ !== "led") return;
      var kdy = DNY_KRATCE[datumZIso(den.datum).getDay()];
      if (t.stav === "nenalezeno") rozdily.push(kdy + ": obvyklý led na zimáku chybí");
      else if (t.id.indexOf("led-navic") === 0) rozdily.push(kdy + " " + casTreninku(t) + ": led navíc");
      else if (t.zmena) rozdily.push(kdy + " " + casTreninku(t) + ": " + t.zmena.toLowerCase());
    });
  });
  return rozdily.length ? { stav: "zmena", text: rozdily.join(" · ") } : { stav: "ok", text: "Vše sedí s obvyklým týdnem." };
}

function htmlZimaku() {
  var rozpis = KK.rozpis;
  return '<section class="a-karta a-zimak"><div class="a-karta__hlava"><h2>Led ze zimáku VSH Slaný</h2>' +
    '<a class="a-tl a-tl--male" href="https://slany.rozpisy-ledu.cz/" target="_blank" rel="noopener">Rozpis zimáku ' + IKONY.ven + "</a></div>" +
    '<p class="a-pozn">Web si <strong>každé 3 hodiny sám</strong> stáhne rozpis ledu ze slany.rozpisy-ledu.cz (položky „KRASO“) a porovná ho s obvyklým týdnem. ' +
    "Čas ledu ze zimáku má přednost před obvyklým. Poslední kontrola: <strong>" + esc(rozpis.aktualizovano ? casKontroly(rozpis.aktualizovano) : "neznámá") + "</strong>" +
    (rozpis.zimakOk ? "" : ' – <span class="a-chyba">zimák tehdy neodpovídal</span>') + ".</p>" +
    '<table class="a-tabulka"><thead><tr><th>Týden</th><th>Zimák</th><th>Led KRASO na zimáku</th><th>Porovnání</th></tr></thead><tbody>' +
    rozpis.tydny.map(function (tyden) {
      var od = datumZIso(tyden.pondeli), ne = datumZIso(tyden.pondeli);
      ne.setDate(ne.getDate() + 6);
      var p = porovnaniSeZimakem(tyden);
      var stav = { zverejneno: '<span class="stitek stitek--zimak">zveřejněno</span>', nezverejneno: '<span class="stitek stitek--info">ještě ne</span>',
        chyba: '<span class="stitek stitek--zruseno">chyba</span>', vypnuto: '<span class="stitek">nekontroluje se</span>' }[tyden.zimak] || "";
      var led = tyden.led ? tyden.led.map(function (s) { return DNY_KRATCE[datumZIso(s.datum).getDay()] + " " + bezNuly(s.od) + "–" + bezNuly(s.do); }).join(", ") || "žádný" : "–";
      return "<tr><td><strong>" + tyden.tyden + ".</strong> " + kratkeDatum(od) + "–" + kratkeDatum(ne) + "</td><td>" + stav + "</td>" +
        "<td>" + esc(led) + '</td><td class="a-porovnani a-porovnani--' + p.stav + '">' + (p.stav === "ok" ? A_IKONY.ok : p.stav === "info" ? "" : IKONY.pozor) + esc(p.text) + "</td></tr>";
    }).join("") + "</tbody></table></section>";
}

function seznamZmen() {
  var dnes = dnesIso();
  return KK.rozpis.vyjimky.map(function (v) { return { v: v, zverejneno: true }; })
    .concat(Uloziste.dej("vyjimky").map(function (v) { return { v: v, zverejneno: false }; }))
    .filter(function (z) { return (z.v.datumDo || z.v.datum) >= dnes; })
    .sort(function (a, b) { return a.v.datum < b.v.datum ? -1 : 1; });
}

function popisZmeny(v) {
  if (v.datumDo) return "volno – zrušeny všechny tréninky";
  if (v.skupina) return "zrušeno jen " + nazevSkupiny(v.skupina);
  if (v.zruseno) return "zrušeno";
  if (v.id && v.id.indexOf("extra-") === 0) return "mimořádný trénink " + (v.od ? bezNuly(v.od) + " – " + bezNuly(v.do) : "");
  var co = [];
  if (v.od) co.push("jiný čas " + bezNuly(v.od) + " – " + bezNuly(v.do));
  if ("casti" in v) co.push(forma(v) === "slouceny" ? "sloučený" : forma(v) === "rozdeleny" ? "rozdělený " + v.casti.map(function (c) { return c.skupina; }).join(" → ") : "skupiny zvlášť");
  if ("popis" in v) co.push("jiný název");
  return co.join(", ") || "poznámka";
}

function htmlZmen() {
  var sablony = Uloziste.dej("sablony"), zmeny = seznamZmen();
  return '<section class="a-karta"><h2>Naplánované změny</h2>' +
    (zmeny.length ? '<table class="a-tabulka"><thead><tr><th>Kdy</th><th>Trénink</th><th>Změna</th><th>Poznámka</th><th></th></tr></thead><tbody>' +
      zmeny.map(function (z) {
        var v = z.v, sab = sablonaProDen(sablony, v.datum).filter(function (s) { return s.id === v.id; })[0];
        var co = v.datumDo ? "vše" : v.popis || (sab ? sab.popis || velke(kratkyPopis(sab)) : "Trénink");
        return "<tr><td>" + esc(denADatum(v.datum)) + (v.datumDo ? " – " + esc(denADatum(v.datumDo)) : "") + "</td><td>" + esc(co) + "</td><td>" + esc(popisZmeny(v)) + "</td>" +
          "<td>" + esc(v.poznamka || "") + '</td><td class="a-tabulka__akce">' +
          (z.zverejneno ? '<span class="stitek stitek--zimak">na webu</span>' : tl("Odvolat", "obnovit", v.datum + "|" + (v.id || "") + "|" + (v.skupina || ""), "rozpis", "a-tl--male")) + "</td></tr>";
      }).join("") + "</tbody></table>" : '<p class="a-pozn">Žádné změny – platí obvyklý týden a led ze zimáku.</p>') + "</section>";
}

// ---------- obvyklý týden: může se natrvalo změnit od určitého dne ----------
// Každá verze {od, treninky} platí od svého data do začátku další. Starší verze, než ta dnešní, se nezobrazují.

var vybranaSablona = null; // datum „od“ vybrané verze

function seznamSablon() {
  return Uloziste.dej("sablony").sort(function (a, b) { return a.od < b.od ? -1 : 1; });
}

function indexPlatneSablony(sablony, iso) {
  var i = 0;
  sablony.forEach(function (s, j) { if (s.od <= iso) i = j; });
  return i;
}

function indexVybraneSablony(sablony) {
  var platna = indexPlatneSablony(sablony, dnesIso());
  var i = sablony.map(function (s) { return s.od; }).indexOf(vybranaSablona);
  return i >= platna ? i : platna;
}

function predchoziDen(iso) {
  var d = datumZIso(iso);
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function nazevVerze(sablony, i) {
  return i === indexPlatneSablony(sablony, dnesIso()) ? "obvyklý týden" : "obvyklý týden od " + plneDatum(sablony[i].od);
}

// obvyklý týden vykreslený stejně jako rozpis na webu
function htmlSablony() {
  var sablony = seznamSablon(), platna = indexPlatneSablony(sablony, dnesIso()), vybrana = indexVybraneSablony(sablony);
  var verze = sablony[vybrana], sablona = verze.treninky, dalsi = sablony[vybrana + 1];
  var radky = [1, 2, 3, 4, 5, 6, 7].map(function (cislo) {
    function sloupec(druh) {
      return sablona.filter(function (s) { return s.den === cislo && (s.typ === "led") === (druh === "led"); })
        .sort(function (a, b) { return (a.od || (a.casti && a.casti[0].od) || "") < (b.od || (b.casti && b.casti[0].od) || "") ? -1 : 1; })
        .map(function (s) {
          var t = kopie(s);
          dopocitejCas(t);
          if (!t.od) t.podleZimaku = true;
          var stridani = s.stridani ? '<span class="a-pozn">v sudém týdnu obráceně: ' + esc(s.casti.map(function (c) { return c.skupina; }).reverse().join(" → ")) + "</span>" : "";
          return htmlBloku(t, stridani, smi("sablona") ? tl("Upravit", "sablona-upravit", s.id, "sablona", "a-tl--male") + tl("Smazat", "sablona-smazat", s.id, "sablona", "a-tl--male a-tl--cervene") : "");
        }).join("") + (smi("sablona") ? tlPridat(druh, "sablona-nova", cislo + "|" + druh, "sablona") : "");
    }
    return { nazev: velke(DNY_KRATCE[cislo % 7]), led: sloupec("led"), sucho: sloupec("sucho"), tridy: "" };
  });
  var zalozky = sablony.map(function (s, j) {
    if (j < platna) return "";
    return '<button type="button" class="a-zalozka" data-akce="sablona-verze" data-arg="' + esc(s.od) + '" aria-pressed="' + (j === vybrana) + '">' +
      (j === platna ? "Platí teď" : "Od " + plneDatum(s.od)) + "</button>";
  }).join("");
  var popis = vybrana === platna
    ? (dalsi ? "Platí do " + plneDatum(predchoziDen(dalsi.od)) + ". " : "Opakuje se každý týden sezóny. ") +
      "Úprava tady platí hned. Když se rozpis mění natrvalo až od určitého dne, použijte „Změna od data“."
    : "Platí od " + plneDatum(verze.od) + (dalsi ? " do " + plneDatum(predchoziDen(dalsi.od)) : "") + ". Do té doby zůstává obvyklý týden, který platí teď.";
  var akce = smi("sablona") ? (vybrana !== platna ? tl("Změnit datum", "sablona-datum", verze.od, "sablona", "a-tl--male") +
    tl("Zrušit tuto změnu", "sablona-zrusit-verzi", verze.od, "sablona", "a-tl--male a-tl--cervene") : "") +
    tl(A_IKONY.plus + "Změna od data…", "sablona-naplanovat", "", "sablona", "a-tl--male a-tl--hlavni") : "";
  return (smi("sablona") ? "" : zamceno("Obvyklý týden mění jen správce. Jednotlivé tréninky ale můžete zrušit nebo upravit v rozpisu po týdnech.")) +
    '<section class="a-karta a-tyden"><div class="a-karta__hlava"><h2>Obvyklý týden</h2><div class="a-polozka__akce">' + akce + "</div></div>" +
    (sablony.length - platna > 1 ? '<div class="a-zalozky">' + zalozky + "</div>" : "") +
    '<p class="a-pozn">' + popis + " Čas ledu se bere ze zimáku.</p>" +
    htmlTabulkyAdmin(radky) + "</section>";
}

AKCE["sablona-verze"] = function (od) {
  vybranaSablona = od;
  vykresli();
};

// datum začátku nové verze: nejdřív zítra, v sezóně, a ne stejné jako jiná verze
function kontrolaDataVerze(od, sablony, puvodni) {
  var platnost = KK.rozpis.platnost || {};
  if (od <= dnesIso()) return "Změna může začít nejdřív zítra. Co platí od dneška, upravte přímo v obvyklém týdnu, který platí teď.";
  if (platnost.do && od > platnost.do) return "Sezóna končí " + plneDatum(platnost.do) + ".";
  if (sablony.some(function (s) { return s.od === od && s.od !== puvodni; })) return "Od tohoto dne už změna naplánovaná je.";
  return null;
}

AKCE["sablona-naplanovat"] = function () {
  if (!smi("sablona")) return;
  var sablony = seznamSablon();
  otevriFormular({
    nadpis: "Změna obvyklého týdne od data",
    uvod: "Od zvoleného dne bude platit nový obvyklý týden. Na začátku je stejný jako ten současný – pak v něm upravíte, co se mění. Do té doby platí beze změny ten současný.",
    pole: [{ k: "od", nazev: "Platí od", typ: "date", povinne: true, pul: true, napoveda: "Obvykle pondělí, kdy nový rozpis začíná." }],
    ulozit: function (h) {
      var chyba = kontrolaDataVerze(h.od, sablony);
      if (chyba) return chyba;
      sablony.push({ od: h.od, treninky: kopie(sablonaProDen(sablony, h.od)) });
      vybranaSablona = h.od;
      Uloziste.uloz("sablony", sablony, "Naplánována změna obvyklého týdne od " + plneDatum(h.od));
    }
  });
};

AKCE["sablona-datum"] = function (od) {
  if (!smi("sablona")) return;
  var sablony = seznamSablon(), verze = sablony.filter(function (s) { return s.od === od; })[0];
  otevriFormular({
    nadpis: "Od kdy změna platí", hodnoty: { od: od },
    pole: [{ k: "od", nazev: "Platí od", typ: "date", povinne: true, pul: true }],
    ulozit: function (h) {
      var chyba = kontrolaDataVerze(h.od, sablony, od);
      if (chyba) return chyba;
      verze.od = h.od;
      vybranaSablona = h.od;
      Uloziste.uloz("sablony", sablony, "Změna obvyklého týdne přesunuta z " + plneDatum(od) + " na " + plneDatum(h.od));
    }
  });
};

AKCE["sablona-zrusit-verzi"] = function (od) {
  if (!smi("sablona")) return;
  potvrd("Zrušit změnu od " + plneDatum(od) + "?", "I potom bude platit obvyklý týden, který platí teď.", "Zrušit změnu", function () {
    vybranaSablona = null;
    Uloziste.uloz("sablony", seznamSablon().filter(function (s) { return s.od !== od; }), "Zrušena změna obvyklého týdne od " + plneDatum(od));
  });
};

// ---------- soustředění ----------

function htmlSoustredeniAdmin() {
  var seznam = budouciSoustredeni(Uloziste.dej("soustredeni"));
  return '<section class="a-karta"><div class="a-karta__hlava"><h2>Soustředění</h2>' + tl(A_IKONY.plus + "Přidat soustředění", "soustredeni", "", "rozpis", "a-tl--male a-tl--hlavni") + "</div>" +
    (seznam.length ? '<div class="soustredeni-seznam">' + seznam.map(function (s) {
      return '<div class="a-soustredeni">' + htmlSoustredeni(s) + '<div class="a-blok__akce">' +
        tl("Upravit", "soustredeni", s.id, "rozpis", "a-tl--male") + tl("Smazat", "soustredeni-smazat", s.id, "rozpis", "a-tl--male a-tl--cervene") + "</div></div>";
    }).join("") + "</div>" : '<p class="a-pozn">Žádné soustředění není naplánované.</p>') + "</section>";
}

AKCE.soustredeni = function (id) {
  var seznam = Uloziste.dej("soustredeni"), s = seznam.filter(function (x) { return x.id === id; })[0];
  otevriFormular({
    nadpis: s ? "Upravit soustředění" : "Nové soustředění",
    uvod: "Ukáže se v rozpisu tréninků, na úvodní stránce a v kalendáři v mobilu.",
    hodnoty: s ? Object.assign({}, s, { rusiTreninky: s.rusiTreninky ? "ano" : "ne" }) : { od: dnesIso(), rusiTreninky: "ano" },
    pole: [
      { k: "nazev", nazev: "Název", povinne: true, napoveda: "Např. „Zimní soustředění“" },
      { k: "od", nazev: "Od", typ: "date", povinne: true, pul: true },
      { k: "do", nazev: "Do (včetně)", typ: "date", povinne: true, pul: true },
      { k: "misto", nazev: "Kde", pul: true, napoveda: "Např. Mělník, zimní stadion" },
      { k: "pro", nazev: "Kdo jede", pul: true, napoveda: "Např. závodníci, 1. skupina" },
      { k: "rusiTreninky", nazev: "Běžné tréninky v těchto dnech", typ: "select",
        moznosti: [["ano", "Ruší se – trenéři jsou na soustředění"], ["ne", "Platí dál"]] },
      { k: "poznamka", nazev: "Informace pro rodiče", typ: "textarea", radky: 4, napoveda: "Sraz, program, co s sebou, cena…" }
    ],
    ulozit: function (h) {
      if (h.do < h.od) return "Konec musí být stejný nebo pozdější den než začátek.";
      var cil = s || { id: "s" + Date.now().toString(36) };
      ["nazev", "od", "do", "misto", "pro", "poznamka"].forEach(function (k) { if (h[k]) cil[k] = h[k]; else delete cil[k]; });
      if (h.rusiTreninky === "ano") cil.rusiTreninky = true; else delete cil.rusiTreninky;
      if (!s) seznam.push(cil);
      Uloziste.uloz("soustredeni", seznam, (s ? "Upraveno" : "Přidáno") + " soustředění " + cil.nazev + " (" + terminSoustredeni(cil) + ")");
    }
  });
};

AKCE["soustredeni-smazat"] = function (id) {
  var seznam = Uloziste.dej("soustredeni"), s = seznam.filter(function (x) { return x.id === id; })[0];
  potvrd("Smazat soustředění?", "<strong>" + esc(s.nazev + " · " + terminSoustredeni(s)) + "</strong>" +
    (s.rusiTreninky ? "<br>Běžné tréninky v těchto dnech se zase obnoví." : ""), "Smazat", function () {
    Uloziste.uloz("soustredeni", seznam.filter(function (x) { return x.id !== id; }), "Smazáno soustředění " + s.nazev);
  });
};

VYKRESLENI.rozpis = function () {
  var rozpis = nahledRozpisu();
  var dnes = dnesIso();
  var tydny = rozpis.tydny.filter(function (t) {
    var ne = datumZIso(t.pondeli);
    ne.setDate(ne.getDate() + 6);
    return ne >= datumZIso(dnes);
  });
  if (vybranyTyden >= tydny.length) vybranyTyden = 0;
  var tyden = tydny[vybranyTyden];
  var zimakVPoradku = KK.rozpis.tydny.every(function (t) { var s = porovnaniSeZimakem(t).stav; return s === "ok" || s === "info"; });

  var pohledy = [
    ["tydny", "Rozpis po týdnech", ""],
    ["sablona", "Obvyklý týden", ""],
    ["zmeny", "Změny a volno", seznamZmen().length ? '<span class="a-pocet">' + seznamZmen().length + "</span>" : ""],
    ["soustredeni", "Soustředění", budouciSoustredeni(rozpis.soustredeni).length ? '<span class="a-pocet">' + budouciSoustredeni(rozpis.soustredeni).length + "</span>" : ""],
    ["zimak", "Zimák", zimakVPoradku ? '<i class="a-ok">' + A_IKONY.ok + "</i>" : '<i class="a-pozor">' + IKONY.pozor + "</i>"]
  ];
  var obsah;
  if (pohledRozpisu === "sablona") obsah = htmlSablony();
  else if (pohledRozpisu === "zmeny") obsah = htmlZmen();
  else if (pohledRozpisu === "zimak") obsah = htmlZimaku();
  else if (pohledRozpisu === "soustredeni") obsah = htmlSoustredeniAdmin();
  else {
    var p = porovnaniSeZimakem(tyden);
    obsah = '<div class="a-tydny-hlava"><div class="a-zalozky" role="group" aria-label="Týden">' + tydny.map(function (t, i) {
      var od = datumZIso(t.pondeli), ne = datumZIso(t.pondeli);
      ne.setDate(ne.getDate() + 6);
      return '<button type="button" class="a-zalozka" data-akce="tyden" data-arg="' + i + '" aria-pressed="' + (i === vybranyTyden) + '">' +
        (i === 0 ? "Tento týden" : i === 1 ? "Příští týden" : kratkeDatum(od) + "–" + kratkeDatum(ne)) + "</button>";
    }).join("") + "</div>" +
      '<p class="a-porovnani a-porovnani--' + p.stav + '">' + tyden.tyden + ". týden · zimák: " + (p.stav === "ok" ? A_IKONY.ok : p.stav === "info" ? "" : IKONY.pozor) + esc(p.text) + "</p></div>" +
      htmlTydneAdmin(tyden, rozpis.soustredeni);
  }

  return hlavicka("Rozpis tréninků", "Obvyklý týden + led ze zimáku + vaše změny = rozpis na webu.",
    tl(A_IKONY.plus + "Volno / prázdniny", "volno", "", "rozpis") + tl(A_IKONY.plus + "Soustředění", "soustredeni", "", "rozpis") +
    tl(A_IKONY.plus + "Mimořádný trénink", "pridat-trenink", "", "rozpis", "a-tl--hlavni")) +
    '<nav class="a-pohledy" aria-label="Části rozpisu">' + pohledy.map(function (p) {
      return '<button type="button" data-akce="pohled" data-arg="' + p[0] + '" aria-pressed="' + (pohledRozpisu === p[0]) + '">' + p[1] + p[2] + "</button>";
    }).join("") + "</nav>" + obsah;
};

AKCE.tyden = function (i) {
  vybranyTyden = Number(i);
  vykresli();
};

AKCE.pohled = function (p) {
  pohledRozpisu = p;
  vykresli();
};

AKCE.volno = function () {
  var platnost = KK.rozpis.platnost || {};
  otevriFormular({
    nadpis: "Volno / prázdniny", uvod: "Zruší všechny tréninky ve zvolených dnech – na ledě i na suchu.",
    hodnoty: { od: dnesIso() },
    pole: [
      { k: "od", nazev: "Od", typ: "date", povinne: true, pul: true },
      { k: "do", nazev: "Do (včetně)", typ: "date", povinne: true, pul: true },
      { k: "poznamka", nazev: "Důvod (uvidí ho rodiče na webu)", povinne: true, napoveda: "Např. „Vánoční prázdniny“" }
    ],
    ulozit: function (h) {
      if (h.do < h.od) return "Konec volna musí být stejný nebo pozdější den než začátek.";
      if (h.od < dnesIso()) return "Volno nejde zadat do minulosti.";
      if (platnost.do && h.od > platnost.do) return "Sezóna končí " + plneDatum(platnost.do) + ".";
      var v = { datum: h.od, datumDo: h.do, id: "volno-" + Date.now().toString(36), zruseno: true, poznamka: h.poznamka };
      ulozVyjimku(v, "Volno " + plneDatum(h.od) + " – " + plneDatum(h.do) + ": " + h.poznamka);
    }
  });
};

// Zrušit celý trénink, nebo jen jednu skupinu – ostatní skupiny trénují normálně.
AKCE.zrusit = function (arg) {
  var x = najdiTrenink(arg);
  var skupiny = (x.t.casti || []).filter(function (c) { return c.stav !== "zruseno"; });
  var pole = [];
  if (skupiny.length > 1) {
    pole.push({ k: "skupina", nazev: "Co zrušit", typ: "select", moznosti: [["", "Celý trénink – všechny skupiny"]].concat(skupiny.map(function (c) {
      return [c.skupina, "Jen " + nazevSkupiny(c.skupina) + (c.od ? " (" + bezNuly(c.od) + " – " + bezNuly(c.do) + ")" : "")];
    })) });
  }
  pole.push({ k: "poznamka", nazev: "Důvod (uvidí ho rodiče na webu)", napoveda: "Např. „Turnaj na zimáku“ nebo „Nemoc trenérky“." });
  otevriFormular({
    nadpis: "Zrušit trénink", uvod: "<strong>" + esc(popisTreninku(x.datum, x.t)) + "</strong>", tlacitko: "Zrušit", nebezpecne: true,
    pole: pole,
    ulozit: function (h) {
      var v = { datum: x.datum, id: x.id, zruseno: true };
      if (h.skupina) v.skupina = h.skupina;
      if (h.poznamka) v.poznamka = h.poznamka;
      ulozVyjimku(v, (h.skupina ? "Zrušena " + nazevSkupiny(h.skupina) + ": " : "Zrušen trénink ") + popisTreninku(x.datum, x.t));
    }
  });
};

AKCE.zmenit = function (arg) {
  var x = najdiTrenink(arg), mistni = mistniVyjimka(x.datum, x.id);
  otevriFormular({
    nadpis: x.t.novy ? "Upravit mimořádný trénink" : "Upravit trénink", uvod: esc(popisTreninku(x.datum, x.t)) + '<br><span class="a-pozn">Změna platí jen pro tento den.</span>',
    hodnoty: { od: x.t.od, do: x.t.do, poznamka: x.t.poznamka, popis: x.t.popis, casti: x.t.casti },
    pole: [
      { k: "forma", typ: "forma" },
      { k: "od", nazev: "Začátek", typ: "time", pul: true, cas: true },
      { k: "do", nazev: "Konec", typ: "time", pul: true, cas: true },
      { k: "popis", nazev: "Název (nepovinné)", napoveda: "Prázdné = „Sloučený“, „Rozdělený“ nebo druh tréninku." },
      { k: "poznamka", nazev: "Poznámka pro rodiče" }
    ],
    ulozit: function (h) {
      var fm = h.forma;
      var chyba = kontrolaFormy(fm) || (fm.forma !== "skupiny" && kontrolaCasu(h));
      if (chyba) return chyba;
      // navazuje na předchozí změnu téhož tréninku; do výjimky jde jen to, co se opravdu liší
      var v = mistni ? kopie(mistni) : { datum: x.datum, id: x.id };
      delete v.zruseno;
      var jineSkupiny = bezStavu(fm.casti) !== bezStavu(x.t.casti);
      if (jineSkupiny || "casti" in v) v.casti = fm.casti;
      var jinyCas = fm.forma !== "skupiny" && h.od && (h.od !== x.t.od || h.do !== x.t.do);
      if (fm.forma === "skupiny") { delete v.od; delete v.do; }
      else if (jinyCas || jineSkupiny || (h.od && "od" in v)) { v.od = h.od; v.do = h.do; }
      if (h.popis !== (x.t.popis || "") || "popis" in v) v.popis = h.popis;
      if (h.poznamka) v.poznamka = h.poznamka;
      else if (x.t.poznamka || "poznamka" in v) v.poznamka = "";
      if (!mistni && Object.keys(v).length === 2) return "Nic jste nezměnili.";
      ulozVyjimku(v, "Změněn trénink " + popisTreninku(x.datum, x.t) + (jinyCas ? " → " + bezNuly(h.od) + " – " + bezNuly(h.do) : ""));
    }
  });
};

// Odvolá změnu: jedné skupiny, celého tréninku (i se zrušenými skupinami), nebo volno.
AKCE.obnovit = function (arg) {
  var x = najdiTrenink(arg), klic = { datum: x.datum, id: x.id, skupina: x.skupina };
  var v = mistniVyjimka(x.datum, x.id, x.skupina);
  var popis = v && v.datumDo ? "volno " + plneDatum(v.datum) + " – " + plneDatum(v.datumDo)
    : (x.skupina ? nazevSkupiny(x.skupina) + ", " : "") + (x.t ? popisTreninku(x.datum, x.t) : denADatum(x.datum) + " " + (v && v.popis || ""));
  var zbyle = Uloziste.dej("vyjimky").filter(function (z) {
    if (stejnaVyjimka(z, klic)) return false;
    // celý trénink zrušený přes jednotlivé skupiny: obnoví se všechny
    return v || x.skupina || !(z.datum === x.datum && z.id === x.id && z.skupina);
  });
  Uloziste.uloz("vyjimky", zbyle, "Odvolána změna: " + popis);
  vykresli();
};

// druhy tréninku pro sloupec: led, nebo vše ostatní (na suchu a další)
function typyProDruh(druh) {
  return moznostiTypu().filter(function (m) { return !druh || (m[0] === "led") === (druh === "led"); });
}

function vychoziMisto(druh) {
  return druh === "sucho" ? (Object.keys(KK.rozpis.mista).filter(function (k) { return k !== "zs"; })[0] || "zs") : "zs";
}

// arg: "" (tlačítko nahoře) nebo "datum|led" / "datum|sucho" (tlačítko ve sloupci)
AKCE["pridat-trenink"] = function (arg) {
  var casti = (arg || "").split("|"), pevneDatum = casti[0], druh = casti[1] || "";
  var typy = typyProDruh(druh);
  otevriFormular({
    nadpis: druh === "led" ? "Mimořádný trénink na ledě" : druh === "sucho" ? "Mimořádný trénink na suchu" : "Mimořádný trénink",
    uvod: pevneDatum ? velke(DNY[datumZIso(pevneDatum).getDay()]) + " " + plneDatum(pevneDatum) : "Na libovolný den dopředu.",
    hodnoty: { typ: typy[0][0], misto: vychoziMisto(druh), datum: dnesIso() },
    pole: (pevneDatum ? [] : [{ k: "datum", nazev: "Datum", typ: "date", povinne: true }]).concat(
      typy.length > 1 ? [{ k: "typ", nazev: "Druh", typ: "select", moznosti: typy, pul: true }] : [],
      [
        { k: "misto", nazev: "Kde", typ: "select", moznosti: moznostiMist(), pul: typy.length > 1 },
        { k: "forma", typ: "forma" },
        { k: "od", nazev: "Začátek", typ: "time", pul: true, cas: true },
        { k: "do", nazev: "Konec", typ: "time", pul: true, cas: true },
        { k: "popis", nazev: "Název (nepovinné)", napoveda: "Např. „Soustředění“. Prázdné = „Sloučený“, „Rozdělený“ nebo druh tréninku." },
        { k: "poznamka", nazev: "Poznámka pro rodiče" }
      ]),
    ulozit: function (h) {
      var fm = h.forma, datum = pevneDatum || h.datum;
      var chyba = kontrolaFormy(fm) || (fm.forma !== "skupiny" && (!h.od ? "Vyplňte začátek a konec." : kontrolaCasu(h)));
      if (chyba) return chyba;
      if (datum < dnesIso()) return "Trénink nejde přidat do minulosti.";
      var v = { datum: datum, id: "extra-" + Date.now().toString(36), typ: h.typ || typy[0][0], misto: h.misto };
      if (fm.casti.length) v.casti = fm.casti;
      if (fm.forma !== "skupiny") { v.od = h.od; v.do = h.do; }
      if (h.popis) v.popis = h.popis;
      if (h.poznamka) v.poznamka = h.poznamka;
      var t = kopie(v);
      dopocitejCas(t);
      ulozVyjimku(v, "Mimořádný trénink " + denADatum(datum) + " " + bezNuly(t.od) + " – " + bezNuly(t.do));
    }
  });
};

function polaSablony(druh, sablona, s) {
  var typy = typyProDruh(druh);
  // na co může trénink navazovat: jiný obvyklý trénink (ve stejný den – hlídá se při uložení)
  var navazuje = [["", "Ne – samostatný trénink"]].concat(sablona.filter(function (x) { return x !== s; }).sort(function (a, b) {
    return a.den - b.den || ((a.od || "") < (b.od || "") ? -1 : 1);
  }).map(function (x) {
    var t = kopie(x);
    dopocitejCas(t);
    return [x.id, velke(DNY_KRATCE[x.den % 7]) + " " + (t.od ? bezNuly(t.od) + " " : "") + "– " + kratkyPopis(x)];
  }));
  return [{ k: "den", nazev: "Den", typ: "select", moznosti: [1, 2, 3, 4, 5, 6, 7].map(function (d) { return [String(d), velke(DNY[d % 7])]; }), pul: true }]
    .concat(typy.length > 1 ? [{ k: "typ", nazev: "Druh", typ: "select", moznosti: typy, pul: true }] : [], [
      { k: "forma", typ: "forma", stridani: true },
      { k: "od", nazev: "Začátek", typ: "time", pul: true, cas: true, napoveda: druh === "led" ? "Prázdné = podle zimáku" : "" },
      { k: "do", nazev: "Konec", typ: "time", pul: true, cas: true },
      { k: "misto", nazev: "Kde", typ: "select", moznosti: moznostiMist() },
      { k: "popis", nazev: "Název (nepovinné)", napoveda: "Např. „Pohybovka s Radkou“. Prázdné = „Sloučený“, „Rozdělený“ nebo druh tréninku." },
      { k: "poznamka", nazev: "Poznámka", napoveda: "Např. „+ 20 min docvičení s Radkou“" },
      { k: "navazuje", nazev: "Navazuje na", typ: "select", moznosti: navazuje,
        napoveda: "Např. suchá příprava hned po ledu – na úvodní stránce a v kalendáři se ukáže jako jeden trénink." }
    ]);
}

// id = upravovaný obvyklý trénink; nový dostane predvolba "den|led" nebo "den|sucho" z tlačítka ve sloupci
function upravSablonu(id, predvolba) {
  if (!smi("sablona")) return;
  var sablony = seznamSablon(), vybrana = indexVybraneSablony(sablony), sablona = sablony[vybrana].treninky;
  var kde = vybrana === indexPlatneSablony(sablony, dnesIso()) ? "" : " (změna od " + plneDatum(sablony[vybrana].od) + ")";
  var s = sablona.filter(function (x) { return x.id === id; })[0];
  var casti = (predvolba || "").split("|");
  var druh = s ? (s.typ === "led" ? "led" : "sucho") : casti[1] || "led";
  var typy = typyProDruh(druh);
  otevriFormular({
    nadpis: (s ? "Upravit obvyklý trénink" : "Nový obvyklý trénink") + (druh === "led" ? " na ledě" : " na suchu"),
    uvod: kde ? "Platí pro obvyklý týden od " + esc(plneDatum(sablony[vybrana].od)) + "." : "",
    hodnoty: s ? Object.assign({}, s, { den: String(s.den) }) : { den: casti[0] || "1", typ: typy[0][0], misto: vychoziMisto(druh) },
    pole: polaSablony(druh, sablona, s),
    ulozit: function (h) {
      var fm = h.forma, typ = h.typ || typy[0][0];
      var chyba = kontrolaFormy(fm) || (fm.forma !== "skupiny" && kontrolaCasu(h));
      if (chyba) return chyba;
      if (fm.forma !== "skupiny" && !h.od && typ !== "led") return "Vyplňte čas – podle zimáku se řídí jen led.";
      var predchozi = sablona.filter(function (x) { return x.id === h.navazuje; })[0];
      if (predchozi && predchozi.den !== Number(h.den)) return "Navazovat jde jen na trénink ve stejný den.";
      var cil = s || { id: "sab-" + Date.now().toString(36) };
      cil.den = Number(h.den); cil.typ = typ; cil.misto = h.misto;
      if (h.od && fm.forma !== "skupiny") { cil.od = h.od; cil.do = h.do; } else { delete cil.od; delete cil.do; }
      if (fm.casti.length) cil.casti = fm.casti; else delete cil.casti;
      if (fm.stridani) cil.stridani = true; else delete cil.stridani;
      ["popis", "poznamka", "navazuje"].forEach(function (k) { if (h[k]) cil[k] = h[k]; else delete cil[k]; });
      if (!s) sablona.push(cil);
      Uloziste.uloz("sablony", sablony, (s ? "Upraven" : "Přidán") + " obvyklý trénink" + kde + ": " + velke(DNY[cil.den % 7]) + " – " + kratkyPopis(cil));
    }
  });
}

AKCE["sablona-nova"] = function (predvolba) { upravSablonu(null, predvolba); };
AKCE["sablona-upravit"] = function (id) { upravSablonu(id); };
AKCE["sablona-smazat"] = function (id) {
  if (!smi("sablona")) return;
  var sablony = seznamSablon(), vybrana = indexVybraneSablony(sablony), verze = sablony[vybrana];
  var s = verze.treninky.filter(function (x) { return x.id === id; })[0];
  potvrd("Smazat obvyklý trénink?", esc(velke(DNY[s.den % 7]) + " – " + kratkyPopis(s)) + " zmizí z " + esc(nazevVerze(sablony, vybrana)) + ".", "Smazat", function () {
    verze.treninky = verze.treninky.filter(function (x) { return x.id !== id; });
    verze.treninky.forEach(function (x) { if (x.navazuje === id) delete x.navazuje; });
    Uloziste.uloz("sablony", sablony, "Smazán obvyklý trénink (" + nazevVerze(sablony, vybrana) + "): " + velke(DNY[s.den % 7]) + " – " + kratkyPopis(s));
  });
};

// --- obecný seznam (aktuality, alba, trenéři…) ---
// nastaveni: {klic, nazev, pole, popis(polozka), pravoPridat, pravoUpravit, pravoSmazat, nova(), seradit?}
function upravPolozku(nastaveni, index) {
  var seznam = Uloziste.dej(nastaveni.klic);
  var polozka = index == null || index === "" ? null : seznam[Number(index)];
  if (!smi(polozka ? nastaveni.pravoUpravit : nastaveni.pravoPridat)) return;
  otevriFormular({
    nadpis: (polozka ? "Upravit – " : "Nová položka – ") + nastaveni.nazev.toLowerCase(),
    hodnoty: polozka || nastaveni.nova(),
    pole: nastaveni.pole(),
    ulozit: function (h) {
      var cil = polozka || {};
      nastaveni.pole().forEach(function (p) {
        if (h[p.k] === "" || h[p.k] == null) delete cil[p.k]; else cil[p.k] = h[p.k];
      });
      if (!polozka) seznam[nastaveni.naKonec ? "push" : "unshift"](cil);
      if (nastaveni.seradit) seznam.sort(nastaveni.seradit);
      Uloziste.uloz(nastaveni.klic, seznam, (polozka ? "Upraveno" : "Přidáno") + " – " + nastaveni.nazev.toLowerCase() + ": " + nastaveni.popis(cil));
    }
  });
}

function smazPolozku(nastaveni, index) {
  if (!smi(nastaveni.pravoSmazat)) return;
  var seznam = Uloziste.dej(nastaveni.klic), polozka = seznam[Number(index)];
  potvrd("Opravdu smazat?", "<strong>" + esc(nastaveni.popis(polozka)) + "</strong>", "Smazat", function () {
    seznam.splice(Number(index), 1);
    Uloziste.uloz(nastaveni.klic, seznam, "Smazáno – " + nastaveni.nazev.toLowerCase() + ": " + nastaveni.popis(polozka));
  });
}

function akcePolozky(nastaveni, index) {
  return tl("Upravit", nastaveni.akce + "-upravit", index, nastaveni.pravoUpravit, "a-tl--male") +
    tl("Smazat", nastaveni.akce + "-smazat", index, nastaveni.pravoSmazat, "a-tl--male a-tl--cervene");
}

function zaregistrujSeznam(nastaveni) {
  AKCE[nastaveni.akce] = function () { upravPolozku(nastaveni, null); };
  AKCE[nastaveni.akce + "-upravit"] = function (i) { upravPolozku(nastaveni, i); };
  AKCE[nastaveni.akce + "-smazat"] = function (i) { smazPolozku(nastaveni, i); };
  return nastaveni;
}

function poznamkaPrav(nastaveni) {
  if (smi(nastaveni.pravoSmazat) && smi(nastaveni.pravoUpravit)) return "";
  if (smi(nastaveni.pravoUpravit)) return zamceno("Přidávat a upravovat můžete, mazat jen správce.");
  return zamceno("Tuto část spravuje správce. Vy ji vidíte jen pro kontrolu.");
}

// --- aktuality ---
var SEZNAM_AKTUALIT = zaregistrujSeznam({
  klic: "aktuality", nazev: "Aktualita", akce: "aktualita",
  pravoPridat: "pridat", pravoUpravit: "upravit", pravoSmazat: "smazat",
  nova: function () { return { datum: dnesIso() }; },
  popis: function (a) { return a.nadpis; },
  seradit: function (a, b) { return a.datum < b.datum ? 1 : -1; },
  pole: function () {
    return [
      { k: "datum", nazev: "Datum", typ: "date", povinne: true, pul: true },
      { k: "nadpis", nazev: "Nadpis", povinne: true },
      { k: "text", nazev: "Text", typ: "textarea", radky: 5 },
      { k: "odkaz", nazev: "Odkaz (nepovinné)", napoveda: "Např. slanska-brusle.html nebo celá adresa https://…" }
    ];
  }
});

VYKRESLENI.aktuality = function () {
  var n = SEZNAM_AKTUALIT;
  return hlavicka("Aktuality", "Nejnovější čtyři se ukazují v patičce každé stránky.", tl(A_IKONY.plus + "Nová aktualita", "aktualita", "", "pridat", "a-tl--hlavni")) +
    poznamkaPrav(n) +
    '<div class="a-seznam">' + Uloziste.dej("aktuality").map(function (a, i) {
      return '<article class="a-karta a-polozka"><div><time>' + esc(plneDatum(a.datum)) + "</time><h2>" + esc(a.nadpis) + "</h2>" +
        (a.text ? "<p>" + esc(a.text) + "</p>" : "") + (a.odkaz ? '<p class="a-pozn">Odkaz: ' + esc(a.odkaz) + "</p>" : "") + "</div>" +
        '<div class="a-polozka__akce">' + akcePolozky(n, i) + "</div></article>";
    }).join("") + "</div>";
};

// --- výsledky závodů (seznam sezón se závody) ---
function textVysledku(zavod) {
  return zavod.sekce.map(function (s) {
    return (s.nazev ? s.nazev + ":\n" : "") + s.radky.join("\n");
  }).join("\n\n");
}

function sekceZTextu(text) {
  var sekce = [], aktualni = null;
  text.split(/\r?\n/).forEach(function (radek) {
    radek = radek.trim();
    if (!radek) return;
    if (/:$/.test(radek) && radek.length < 50) {
      aktualni = { nazev: radek.replace(/:$/, ""), radky: [] };
      sekce.push(aktualni);
    } else {
      if (!aktualni) { aktualni = { radky: [] }; sekce.push(aktualni); }
      aktualni.radky.push(radek);
    }
  });
  return sekce.filter(function (s) { return s.radky.length; });
}

function upravZavod(arg) {
  var zavody = Uloziste.dej("zavody");
  var casti = arg ? arg.split("|").map(Number) : null;
  var zavod = casti ? zavody[casti[0]].zavody[casti[1]] : null;
  if (!smi(zavod ? "upravit" : "pridat")) return;
  otevriFormular({
    nadpis: zavod ? "Upravit výsledky" : "Výsledky závodu",
    hodnoty: zavod ? { sezona: zavody[casti[0]].sezona, nazev: zavod.nazev, vysledky: textVysledku(zavod) } : { sezona: KK.rozpis.sezona },
    pole: [
      { k: "sezona", nazev: "Sezóna", povinne: true, pul: true, seznam: zavody.map(function (s) { return s.sezona; }) },
      { k: "nazev", nazev: "Závod a datum", povinne: true, napoveda: "Např. Lounská bruslička, 19. 1. 2025" },
      { k: "vysledky", nazev: "Výsledky", typ: "textarea", radky: 9, povinne: true,
        napoveda: "Každý řádek jedna kategorie. Řádek končící dvojtečkou (např. „Závod ČKS:“) je nadpis skupiny." }
    ],
    ulozit: function (h) {
      var sekce = sekceZTextu(h.vysledky);
      if (!sekce.length) return "Vyplňte aspoň jeden řádek výsledků.";
      var novy = { nazev: h.nazev, sekce: sekce };
      if (zavod) zavody[casti[0]].zavody.splice(casti[1], 1);
      var sezona = zavody.filter(function (s) { return s.sezona === h.sezona; })[0];
      if (!sezona) {
        sezona = { sezona: h.sezona, zavody: [] };
        zavody.push(sezona);
        zavody.sort(function (a, b) { return a.sezona < b.sezona ? 1 : -1; });
      }
      sezona.zavody.unshift(novy);
      Uloziste.uloz("zavody", zavody.filter(function (s) { return s.zavody.length; }), (zavod ? "Upraveny" : "Přidány") + " výsledky: " + h.nazev);
    }
  });
}

AKCE.zavod = function () { upravZavod(null); };
AKCE["zavod-upravit"] = upravZavod;
AKCE["zavod-smazat"] = function (arg) {
  if (!smi("smazat")) return;
  var zavody = Uloziste.dej("zavody"), c = arg.split("|").map(Number), z = zavody[c[0]].zavody[c[1]];
  potvrd("Smazat výsledky?", "<strong>" + esc(z.nazev) + "</strong>", "Smazat", function () {
    zavody[c[0]].zavody.splice(c[1], 1);
    Uloziste.uloz("zavody", zavody.filter(function (s) { return s.zavody.length; }), "Smazány výsledky: " + z.nazev);
  });
};

VYKRESLENI.zavody = function () {
  return hlavicka("Výsledky závodů", "Výsledky našich závodníků podle sezón.", tl(A_IKONY.plus + "Přidat závod", "zavod", "", "pridat", "a-tl--hlavni")) +
    poznamkaPrav({ pravoUpravit: "upravit", pravoSmazat: "smazat" }) +
    Uloziste.dej("zavody").map(function (s, i) {
      return '<section class="a-karta"><h2>Sezóna ' + esc(s.sezona) + '</h2><ul class="a-radky">' + s.zavody.map(function (z, j) {
        var pocet = z.sekce.reduce(function (n, x) { return n + x.radky.length; }, 0);
        return "<li><div><strong>" + esc(z.nazev) + '</strong><span class="a-pozn">' + pocet + " " + (pocet === 1 ? "řádek" : pocet < 5 ? "řádky" : "řádků") + " výsledků</span></div>" +
          '<div class="a-polozka__akce">' + tl("Upravit", "zavod-upravit", i + "|" + j, "upravit", "a-tl--male") + tl("Smazat", "zavod-smazat", i + "|" + j, "smazat", "a-tl--male a-tl--cervene") + "</div></li>";
      }).join("") + "</ul></section>";
    }).join("");
};

// --- fotogalerie ---
var SEZNAM_ALB = zaregistrujSeznam({
  klic: "galerie", nazev: "Album", akce: "album",
  pravoPridat: "pridat", pravoUpravit: "upravit", pravoSmazat: "smazat",
  nova: function () { return { rok: new Date().getFullYear() }; },
  popis: function (a) { return a.nazev; },
  pole: function () {
    var kategorie = Uloziste.dej("galerie").map(function (a) { return a.kategorie; }).filter(function (k, i, p) { return p.indexOf(k) === i; });
    return [
      { k: "kategorie", nazev: "Skupina", povinne: true, pul: true, seznam: kategorie, napoveda: "Vyberte nebo napište novou" },
      { k: "rok", nazev: "Rok", typ: "number", pul: true },
      { k: "nazev", nazev: "Název alba", povinne: true },
      { k: "url", nazev: "Odkaz na album", typ: "url", povinne: true, napoveda: "Odkaz ze sdílení ve Fotkách Google" }
    ];
  }
});

VYKRESLENI.galerie = function () {
  var alba = Uloziste.dej("galerie"), poradi = [];
  alba.forEach(function (a) { if (poradi.indexOf(a.kategorie) < 0) poradi.push(a.kategorie); });
  return hlavicka("Fotogalerie", "Alba jsou ve Fotkách Google, sem se vkládá jen odkaz.", tl(A_IKONY.plus + "Přidat album", "album", "", "pridat", "a-tl--hlavni")) +
    poznamkaPrav(SEZNAM_ALB) +
    poradi.map(function (k) {
      return '<section class="a-karta"><h2>' + esc(k) + '</h2><ul class="a-radky">' + alba.map(function (a, i) {
        if (a.kategorie !== k) return "";
        return "<li><div><strong>" + esc(a.nazev) + '</strong><a class="a-pozn" href="' + esc(a.url) + '" target="_blank" rel="noopener">otevřít album</a></div>' +
          '<div class="a-polozka__akce">' + akcePolozky(SEZNAM_ALB, i) + "</div></li>";
      }).join("") + "</ul></section>";
    }).join("");
};

// --- trenéři ---
var SEZNAM_TRENERU = zaregistrujSeznam({
  klic: "treneri", nazev: "Trenér", akce: "trener",
  pravoPridat: "lide", pravoUpravit: "lide", pravoSmazat: "lide", naKonec: true,
  nova: function () { return { foto: "img/logo-velke.png" }; },
  popis: function (t) { return t.jmeno; },
  pole: function () {
    return [
      { k: "jmeno", nazev: "Jméno a příjmení", povinne: true },
      { k: "kvalifikace", nazev: "Kvalifikace", povinne: true, napoveda: "Např. trenér II. třídy" },
      { k: "role", nazev: "Role (nepovinné)", napoveda: "Např. Hlavní trenérka, Základna" },
      { k: "foto", nazev: "Fotka", typ: "fotka", napoveda: "Ořízne se na výšku (3 : 4) podle středu." }
    ];
  }
});

VYKRESLENI.treneri = function () {
  return hlavicka("Trenéři", "", tl(A_IKONY.plus + "Přidat trenéra", "trener", "", "lide", "a-tl--hlavni")) +
    poznamkaPrav(SEZNAM_TRENERU) +
    '<div class="a-mrizka">' + Uloziste.dej("treneri").map(function (t, i) {
      return '<article class="a-karta a-osoba"><img src="' + esc(t.foto) + '" alt="" width="64" height="82" loading="lazy">' +
        "<div><h2>" + esc(t.jmeno) + '</h2><p class="a-pozn">' + esc(t.kvalifikace) + (t.role ? " · " + esc(t.role) : "") + "</p>" +
        '<div class="a-polozka__akce">' + akcePolozky(SEZNAM_TRENERU, i) + "</div></div></article>";
    }).join("") + "</div>";
};

// --- závodníci (objekt se sezónou, seznamem a základnou) ---
function upravZavodnika(index) {
  if (!smi("lide")) return;
  var data = Uloziste.dej("zavodnici"), z = index === "" || index == null ? null : data.zavodnici[Number(index)];
  var treneri = Uloziste.dej("treneri").map(function (t) { return [t.jmeno, t.jmeno]; });
  otevriFormular({
    nadpis: z ? "Upravit závodníka" : "Nový závodník",
    hodnoty: z || { odRoku: new Date().getFullYear(), trenerka: treneri[0] && treneri[0][0] },
    pole: [
      { k: "jmeno", nazev: "Jméno a příjmení", povinne: true },
      { k: "kategorie", nazev: "Kategorie", povinne: true, pul: true, seznam: data.zavodnici.map(function (x) { return x.kategorie; }).filter(function (k, i, p) { return p.indexOf(k) === i; }) },
      { k: "rocnik", nazev: "Ročník", typ: "number", povinne: true, pul: true },
      { k: "odRoku", nazev: "V klubu od roku", typ: "number", pul: true },
      { k: "trenerka", nazev: "Trenérka", typ: "select", moznosti: treneri, pul: true },
      { k: "foto", nazev: "Fotka", typ: "fotka", napoveda: "Ořízne se na výšku (3 : 4) podle středu." }
    ],
    ulozit: function (h) {
      var cil = z || {};
      ["jmeno", "kategorie", "rocnik", "odRoku", "trenerka", "foto"].forEach(function (k) { cil[k] = h[k]; });
      if (!cil.foto) cil.foto = "img/logo-velke.png";
      if (!z) data.zavodnici.push(cil);
      Uloziste.uloz("zavodnici", data, (z ? "Upraven" : "Přidán") + " závodník: " + cil.jmeno);
    }
  });
}

AKCE.zavodnik = function () { upravZavodnika(null); };
AKCE["zavodnik-upravit"] = upravZavodnika;
AKCE["zavodnik-smazat"] = function (index) {
  if (!smi("lide")) return;
  var data = Uloziste.dej("zavodnici"), z = data.zavodnici[Number(index)];
  potvrd("Odebrat ze soupisky?", "<strong>" + esc(z.jmeno) + "</strong>", "Odebrat", function () {
    data.zavodnici.splice(Number(index), 1);
    Uloziste.uloz("zavodnici", data, "Odebrán závodník: " + z.jmeno);
  });
};

VYKRESLENI.zavodnici = function () {
  var data = Uloziste.dej("zavodnici");
  return hlavicka("Závodníci", "Soupiska pro sezónu " + esc(data.sezona) + " – " + data.zavodnici.length + " závodníků.", tl(A_IKONY.plus + "Přidat závodníka", "zavodnik", "", "lide", "a-tl--hlavni")) +
    poznamkaPrav({ pravoUpravit: "lide", pravoSmazat: "lide" }) +
    '<section class="a-karta"><table class="a-tabulka"><thead><tr><th></th><th>Jméno</th><th>Kategorie</th><th>Ročník</th><th>Trenérka</th><th></th></tr></thead><tbody>' +
    data.zavodnici.map(function (z, i) {
      return '<tr><td class="a-tabulka__fotka"><img src="' + esc(z.foto) + '" alt="" width="36" height="48" loading="lazy"></td><td><strong>' + esc(z.jmeno) + "</strong></td><td>" + esc(z.kategorie) + "</td><td>" + esc(z.rocnik) + "</td><td>" + esc(z.trenerka) + "</td>" +
        '<td class="a-tabulka__akce">' + tl("Upravit", "zavodnik-upravit", i, "lide", "a-tl--male") + tl("Odebrat", "zavodnik-smazat", i, "lide", "a-tl--male a-tl--cervene") + "</td></tr>";
    }).join("") + "</tbody></table></section>";
};

// --- klub a kontakty ---
var POLE_KLUBU = [
  { k: "nazev", nazev: "Název klubu", povinne: true },
  { k: "adresa", nazev: "Adresa", povinne: true },
  { k: "telefon", nazev: "Telefon", typ: "tel", povinne: true, pul: true },
  { k: "email", nazev: "E-mail", typ: "email", povinne: true, pul: true },
  { k: "ico", nazev: "IČO", pul: true },
  { k: "ucet", nazev: "Bankovní účet", pul: true },
  { k: "facebook", nazev: "Facebook", typ: "url" },
  { k: "nabor", nazev: "Nábor – krátký text", typ: "textarea", radky: 3 }
];

AKCE.klub = function () {
  if (!smi("klub")) return;
  var klub = Uloziste.dej("klub");
  otevriFormular({
    nadpis: "Údaje klubu", hodnoty: klub, pole: POLE_KLUBU,
    ulozit: function (h) {
      POLE_KLUBU.forEach(function (p) { klub[p.k] = h[p.k]; });
      Uloziste.uloz("klub", klub, "Upraveny údaje klubu");
    }
  });
};

function upravVedeni(index) {
  if (!smi("klub")) return;
  var klub = Uloziste.dej("klub"), v = index === "" || index == null ? null : klub.vedeni[Number(index)];
  otevriFormular({
    nadpis: v ? "Upravit člena vedení" : "Nový člen vedení", hodnoty: v || {},
    pole: [{ k: "funkce", nazev: "Funkce", povinne: true }, { k: "jmeno", nazev: "Jméno", povinne: true }, { k: "telefon", nazev: "Telefon (nepovinné)", typ: "tel" }],
    ulozit: function (h) {
      var cil = v || {};
      cil.funkce = h.funkce; cil.jmeno = h.jmeno;
      if (h.telefon) cil.telefon = h.telefon; else delete cil.telefon;
      if (!v) klub.vedeni.push(cil);
      Uloziste.uloz("klub", klub, "Vedení klubu: " + cil.funkce + " – " + cil.jmeno);
    }
  });
}

AKCE.vedeni = function () { upravVedeni(null); };
AKCE["vedeni-upravit"] = upravVedeni;
AKCE["vedeni-smazat"] = function (index) {
  if (!smi("klub")) return;
  var klub = Uloziste.dej("klub"), v = klub.vedeni[Number(index)];
  potvrd("Odebrat z vedení?", "<strong>" + esc(v.funkce + " – " + v.jmeno) + "</strong>", "Odebrat", function () {
    klub.vedeni.splice(Number(index), 1);
    Uloziste.uloz("klub", klub, "Odebrán z vedení: " + v.jmeno);
  });
};

VYKRESLENI.klub = function () {
  var klub = Uloziste.dej("klub");
  return hlavicka("Klub a kontakty", "Údaje v patičce a na stránce Kontakt.", tl("Upravit údaje", "klub", "", "klub", "a-tl--hlavni")) +
    (smi("klub") ? "" : zamceno("Kontakty a údaje klubu mění jen správce.")) +
    '<div class="a-dve"><section class="a-karta"><h2>Údaje</h2><dl class="a-udaje">' + POLE_KLUBU.map(function (p) {
      return "<dt>" + esc(p.nazev) + "</dt><dd>" + esc(klub[p.k] || "–") + "</dd>";
    }).join("") + "</dl></section>" +
    '<section class="a-karta"><div class="a-karta__hlava"><h2>Vedení klubu</h2>' + tl(A_IKONY.plus + "Přidat", "vedeni", "", "klub", "a-tl--male") + '</div><ul class="a-radky">' +
    klub.vedeni.map(function (v, i) {
      return "<li><div><strong>" + esc(v.jmeno) + '</strong><span class="a-pozn">' + esc(v.funkce) + (v.telefon ? " · " + esc(v.telefon) : "") + "</span></div>" +
        '<div class="a-polozka__akce">' + tl("Upravit", "vedeni-upravit", i, "klub", "a-tl--male") + tl("Odebrat", "vedeni-smazat", i, "klub", "a-tl--male a-tl--cervene") + "</div></li>";
    }).join("") + "</ul></section></div>";
};

// --- uživatelé ---
function upravUzivatele(index) {
  if (!smi("uzivatele")) return;
  var uzivatele = Uloziste.dej("uzivatele"), u = index === "" || index == null ? null : uzivatele[Number(index)];
  otevriFormular({
    nadpis: u ? "Upravit uživatele" : "Nový uživatel",
    uvod: u ? "" : "Ve skutečném provozu dostane nový uživatel e-mail s odkazem pro nastavení hesla.",
    hodnoty: u || { role: "redaktor" },
    pole: [
      { k: "jmeno", nazev: "Jméno", povinne: true },
      { k: "email", nazev: "E-mail", typ: "email", povinne: true },
      { k: "role", nazev: "Role", typ: "select", moznosti: [["redaktor", "Redaktor – rozpis, aktuality, výsledky, fotky"],
        ["trener", "Trenér – jako redaktor a navíc přihlášky na závody"], ["spravce", "Správce – vše včetně uživatelů"],
        ["rodic", "Rodič – jen přihlášky svých dětí"]] }
    ],
    ulozit: function (h) {
      var email = h.email.toLowerCase();
      if (uzivatele.some(function (x) { return x.email === email && x !== u; })) return "Uživatel s tímto e-mailem už existuje.";
      if (u && u.email === prihlaseny.email && h.role !== "spravce") return "Sami sobě roli správce odebrat nemůžete.";
      var cil = u || {};
      cil.jmeno = h.jmeno; cil.email = email; cil.role = h.role;
      if (!u) uzivatele.push(cil);
      if (u && u.email === prihlaseny.email) try { sessionStorage.setItem(PRIHLASENI, email); } catch (e) { /* nic */ }
      Uloziste.uloz("uzivatele", uzivatele, (u ? "Upraven" : "Přidán") + " uživatel " + cil.jmeno + " (" + ROLE[cil.role].nazev.toLowerCase() + ")");
    }
  });
}

AKCE.uzivatel = function () { upravUzivatele(null); };
AKCE["uzivatel-upravit"] = upravUzivatele;
AKCE["uzivatel-smazat"] = function (index) {
  if (!smi("uzivatele")) return;
  var uzivatele = Uloziste.dej("uzivatele"), u = uzivatele[Number(index)];
  if (u.email === prihlaseny.email) { oznam("Sami sebe odebrat nemůžete."); return; }
  potvrd("Odebrat uživatele?", "<strong>" + esc(u.jmeno) + "</strong> se už nebude moct přihlásit.", "Odebrat", function () {
    uzivatele.splice(Number(index), 1);
    Uloziste.uloz("uzivatele", uzivatele, "Odebrán uživatel " + u.jmeno);
  });
};

VYKRESLENI.uzivatele = function () {
  return hlavicka("Uživatelé", "Kdo se může přihlásit do administrace.", tl(A_IKONY.plus + "Přidat uživatele", "uzivatel", "", "uzivatele", "a-tl--hlavni")) +
    (smi("uzivatele") ? "" : zamceno("Uživatele přidává a odebírá jen správce.")) +
    '<section class="a-karta"><table class="a-tabulka"><thead><tr><th>Jméno</th><th>E-mail</th><th>Role</th><th></th></tr></thead><tbody>' +
    Uloziste.dej("uzivatele").map(function (u, i) {
      return "<tr><td><strong>" + esc(u.jmeno) + "</strong>" + (u.email === prihlaseny.email ? ' <span class="a-pozn">(vy)</span>' : "") + "</td><td>" + esc(u.email) + "</td><td>" + stitekRole(u.role) + "</td>" +
        '<td class="a-tabulka__akce">' + tl("Upravit", "uzivatel-upravit", i, "uzivatele", "a-tl--male") + tl("Odebrat", "uzivatel-smazat", i, "uzivatele", "a-tl--male a-tl--cervene") + "</td></tr>";
    }).join("") + "</tbody></table></section>" +
    '<section class="a-karta"><h2>Rozdíl mezi rolemi</h2><table class="a-tabulka a-tabulka--prava"><thead><tr><th></th>' +
    Object.keys(ROLE).map(function (r) { return "<th>" + ROLE[r].nazev + "</th>"; }).join("") + "</tr></thead><tbody>" +
    POPIS_PRAV.concat([["prihlaska", "Přihlašovat své dítě na závody a soustředění"]]).map(function (p) {
      return "<tr><td>" + p[1] + "</td>" + Object.keys(ROLE).map(function (r) {
        return '<td class="' + (ROLE[r].prava.indexOf(p[0]) >= 0 ? "ano" : "ne") + '">' + (ROLE[r].prava.indexOf(p[0]) >= 0 ? A_IKONY.ok : "–") + "</td>";
      }).join("") + "</tr>";
    }).join("") + "</tbody></table></section>";
};

// --- historie ---
VYKRESLENI.historie = function () {
  var historie = Uloziste.dej("historie");
  return hlavicka("Historie změn", "Kdo a kdy co změnil.") +
    '<section class="a-karta">' + (historie.length ? '<ul class="a-historie">' + historie.map(function (h) {
      return '<li><time>' + esc(new Date(h.kdy).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })) + "</time>" +
        "<div><strong>" + esc(h.kdo) + "</strong> " + stitekRole(h.role) + "<span>" + esc(h.co) + "</span></div></li>";
    }).join("") + "</ul>" : '<p class="a-pozn">Zatím žádné změny.</p>') + "</section>";
};

// ---------- obecné akce ----------

AKCE.odhlasit = odhlas;
AKCE.zahodit = function () {
  potvrd("Zahodit všechny změny?", "Web se vrátí do zveřejněné podoby.", "Zahodit", function () {
    Uloziste.zahod();
    oznam("Změny zahozeny.");
  });
};

document.addEventListener("click", function (e) {
  var cil = e.target.closest("[data-akce]");
  if (!cil || cil.disabled) return;
  var akce = AKCE[cil.getAttribute("data-akce")];
  if (akce) akce(cil.getAttribute("data-arg"));
});

window.addEventListener("hashchange", function () {
  vykresli();
  window.scrollTo(0, 0);
});

// až po načtení všech skriptů (přihlášky jsou v js/prihlasky.js)
document.addEventListener("DOMContentLoaded", vykresli);
