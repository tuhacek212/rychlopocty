// Okno Dovolené jako v programu (dovolene.OknoDovolenych): roční plán (řádek = člověk, sloupec = den),
// tažením přes dny ve svém řádku nová dovolená (správce v kterémkoli), klik = úpravy, pravé = menu;
// dole „Kolik kdo má“. Práva: správce vše, uživatel jen sebe (čísla ostatních nevidí).

import {
  C_DOVOLENA, Dovolene, cislo, dnes, hlidejPrekryvDovolene, hodinDovoleneDenne, hodinyText, iso, nastavRozsah, novyTermin,
  popisRozsahu, pridejDny, prekryvDovolene, rozsah, svatkyDne, textPrekryvu, zIso, zaznamTerminu,
} from "./data.js";
import { otevriExport } from "./export.js";
import { h, ikona, menu, okno, oznam, pole } from "./ui.js";
import { avatar } from "./vzhled.js";

const kolator = new Intl.Collator("cs");
const MESICE = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];
const SIRKA_JMEN = 200, VYSKA_RADKU = 38;
let sirkaDne = 22;

const lzeMenit = (tym, kdo) => tym.jeSpravce || (kdo || "") === tym.ja.id;
const vidiCisla = (tym, kdo) => tym.jeSpravce || (kdo || "") === tym.ja.id;

// lidé v plánu (data.lide_dovolenych): já, aktivní a kdo má v roce dovolenou
function lideDovolenych(tym, dov, rok) {
  const lide = [tym.ja.id, ...tym.aktivni.map((u) => u.id)];
  for (const p of dov.seznam) {
    const r = rozsah(p);
    if (r && r[0].getFullYear() <= rok && r[1].getFullYear() >= rok && !lide.includes(p.uzivatel || "")) lide.push(p.uzivatel || "");
  }
  const unik = [...new Set(lide)];
  return [tym.ja.id, ...unik.filter((k) => k !== tym.ja.id).sort((a, b) => kolator.compare(tym.jmeno(a, "?"), tym.jmeno(b, "?")))];
}

export function otevriDovolene({ tym, osobni, rok = new Date().getFullYear(), naKalendar = () => {} }) {
  let aktualniRok = rok;
  const lRok = h("h2");
  const plan = h("div", { class: "plan", tabindex: "0" });
  const tabulka = h("div", { class: "karta tabulka-dovolenych" });
  const poznamka = h("p", { class: "faint" });
  const hlava = h("div", { class: "kal-lista" },
    h("span", { style: { color: C_DOVOLENA, display: "inline-flex" } }, ikona("sun", "ikona", 26)), h("h1", { text: "Dovolené", style: { marginRight: "16px" } }),
    h("button", { type: "button", class: "ikonove", title: "Předchozí rok", onclick: () => { aktualniRok--; obnov(true); } }, ikona("chevron-left")),
    lRok,
    h("button", { type: "button", class: "ikonove", title: "Další rok", onclick: () => { aktualniRok++; obnov(true); } }, ikona("chevron-right")),
    h("button", { type: "button", class: "tlacitko duch", title: "Přejít na dnešek", text: "Dnes", onclick: () => { aktualniRok = new Date().getFullYear(); obnov(true); } }),
    h("span", { class: "mezera" }),
    h("button", { type: "button", class: "tlacitko", title: "PDF, Excel nebo tisk – grafický plán, kolik kdo má a rozpis",
      onclick: () => otevriExport({ tym, osobni, dovolene: true }) }, ikona("print"), "Export…"),
    h("button", { type: "button", class: "tlacitko hlavni", onclick: () => dialogDovolene(tym, { kdo: tym.ja.id }) }, ikona("plus"), "Nová dovolená"));
  const o = okno("Dovolené", [hlava, plan, tabulka, poznamka], [], { trida: "dovolene", bezNadpisu: true });
  const konec = tym.pri(() => obnov(false));
  o.dialog.addEventListener("close", konec);

  plan.addEventListener("wheel", (ev) => {
    if (!ev.ctrlKey) return;
    ev.preventDefault();
    sirkaDne = Math.max(10, Math.min(44, sirkaDne + (ev.deltaY < 0 ? 3 : -3)));
    obnov(false);
  }, { passive: false });

  function obnov(posunout) {
    const dov = new Dovolene(tym.hodnota("dovolene"), tym.nastaveni, ["cz"]);
    lRok.textContent = String(aktualniRok);
    const lide = lideDovolenych(tym, dov, aktualniRok);
    const zacatek = new Date(aktualniRok, 0, 1);
    const dni = Math.round((new Date(aktualniRok + 1, 0, 1) - zacatek) / 86400000);
    const dnesek = zIso(dnes());
    const mrizka = h("div", { class: "plan-mrizka", style: {
      gridTemplateColumns: `${SIRKA_JMEN}px repeat(${dni}, ${sirkaDne}px)`,
      gridTemplateRows: `22px 22px repeat(${lide.length}, ${VYSKA_RADKU}px)` } });
    mrizka.append(h("div", { class: "plan-roh", style: { gridRow: "1 / 3", gridColumn: "1", display: "grid", alignItems: "end", padding: "0 14px 4px" } },
      h("span", { class: "faint", text: tym.jeSpravce ? "Tým" : "Lidé" })));
    // záhlaví: měsíce a dny
    for (let m = 0; m < 12; m++) {
      const od = Math.round((new Date(aktualniRok, m, 1) - zacatek) / 86400000);
      const pocet = new Date(aktualniRok, m + 1, 0).getDate();
      mrizka.append(h("div", { class: "plan-hlava mesic", text: MESICE[m], style: { gridRow: "1", gridColumn: `${od + 2} / span ${pocet}` } }));
    }
    const typyDnu = [];
    for (let i = 0; i < dni; i++) {
      const d = pridejDny(zacatek, i);
      const vikend = d.getDay() === 0 || d.getDay() === 6;
      const svatek = svatkyDne(d, ["cz"]).length > 0;
      const typ = `${vikend ? " vikend" : ""}${svatek ? " svatek" : ""}${+d === +dnesek ? " dnes" : ""}${d.getDate() === 1 ? " prvni" : ""}`;
      typyDnu.push(typ);
      mrizka.append(h("div", { class: `plan-hlava${typ}`, text: sirkaDne >= 16 ? String(d.getDate()) : "", style: { gridRow: "2", gridColumn: String(i + 2) },
        title: svatkyDne(d, ["cz"]).map(([, n]) => n).join(", ") || null }));
    }
    // řádky lidí
    lide.forEach((kdo, j) => {
      const radek = j + 3;
      const u = tym.uzivatele.find((x) => x.id === kdo);
      const b = dov.bilance(kdo, aktualniRok);
      mrizka.append(h("div", { class: "plan-jmeno", style: { gridRow: String(radek), gridColumn: "1", display: "flex", alignItems: "center", gap: "8px" } },
        avatar(u || { id: kdo, jmeno: tym.jmeno(kdo, "Bez přihlášení") }, 26),
        h("div", { style: { display: "grid", minWidth: "0" } }, h("span", { text: tym.jmeno(kdo, "Bez přihlášení"), style: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }),
          vidiCisla(tym, kdo) ? h("small", { text: `zbývá ${hodinyText(b.zbyva, dov.den)}` }) : null)));
      for (let i = 0; i < dni; i++) {
        mrizka.append(h("div", { class: `plan-den${typyDnu[i]}`, dataset: { i: String(i), j: String(j) }, style: { gridRow: String(radek), gridColumn: String(i + 2) } }));
      }
      for (const pol of dov.cloveka(kdo)) {
        const r = rozsah(pol);
        if (!r || r[1] < zacatek || r[0] > new Date(aktualniRok, 11, 31)) continue;
        const z = r[0] < zacatek ? zacatek : r[0];
        const k = r[1] > new Date(aktualniRok, 11, 31) ? new Date(aktualniRok, 11, 31) : r[1];
        const i0 = Math.round((z - zacatek) / 86400000), i1 = Math.round((k - zacatek) / 86400000);
        const cast = hodinDovoleneDenne(pol, dov.den) < dov.den;
        mrizka.append(h("div", { class: `plan-pruh${cast ? " cast" : ""}`, dataset: { id: pol.id },
          title: `${tym.jmeno(kdo, "")} – ${popisRozsahu(...r)}\n${hodinyText(dov.hodinPolozky(pol), dov.den)}${cast ? ` · ${cislo(pol.hodin)} h denně` : ""}`,
          style: { gridRow: String(radek), gridColumn: `${i0 + 2} / ${i1 + 3}`, position: "relative", margin: "9px 2px", top: "0", bottom: "0" },
          onclick: () => { if (lzeMenit(tym, kdo)) dialogDovolene(tym, { pol }); },
          oncontextmenu: (ev) => {
            ev.preventDefault();
            menu(ev.clientX, ev.clientY, [
              lzeMenit(tym, kdo) ? { text: "Upravit…", ikona: "edit", akce: () => dialogDovolene(tym, { pol }) } : null,
              { text: "Ukázat v kalendáři", ikona: "calendar", akce: () => { o.zavri(); naKalendar(r[0]); } },
              lzeMenit(tym, kdo) ? "-" : null,
              lzeMenit(tym, kdo) ? { text: "Smazat", ikona: "trash", nebezpecne: true, akce: () => smazDovolenou(tym, pol) } : null,
            ]);
          } }));
      }
    });
    const rolovani = plan.scrollLeft;
    plan.replaceChildren(mrizka);
    if (posunout) {
      const i = aktualniRok === dnesek.getFullYear() ? Math.round((dnesek - zacatek) / 86400000) : 0;
      plan.scrollLeft = Math.max(0, i * sirkaDne - 3 * sirkaDne);
    } else {
      plan.scrollLeft = rolovani;
    }

    // Kolik kdo má (TabulkaDovolenych) – uživatel vidí jen sebe
    const radky = lide.filter((kdo) => vidiCisla(tym, kdo)).map((kdo) => ({ kdo, b: dov.bilance(kdo, aktualniRok) }));
    tabulka.replaceChildren(h("div", { class: "karta-hlavicka" }, h("h2", { text: `Kolik kdo má ${aktualniRok}` })),
      h("table", { class: "tabulka" },
        h("thead", {}, h("tr", {}, ["Kdo", "Převod z loňska", "Nárok", "Vyčerpáno", "Naplánováno", "Zbývá"].map((t) => h("th", { text: t })))),
        h("tbody", {}, radky.map(({ kdo, b }) => h("tr", {}, h("td", { text: tym.jmeno(kdo, "Bez přihlášení") }),
          [b.prevod, b.narok, b.vycerpano, b.naplanovano].map((x) => h("td", { text: hodinyText(x, dov.den) })),
          h("td", { class: b.zbyva < 0 ? "zaporne" : "zvyraznene", text: hodinyText(b.zbyva, dov.den) }))))));
    poznamka.textContent = `Pracovní den ${cislo(dov.den)} h. Víkendy a státní svátky se nepočítají, vyčerpáno = do dneška včetně.`
      + " Nárok a převod z loňska nastavuje správce v programu na počítači.";
  }

  // tažení přes dny ve svém řádku (správce v kterémkoli) = nová dovolená
  plan.addEventListener("pointerdown", (ev) => {
    const bunka = ev.target.closest(".plan-den");
    if (ev.button !== 0 || !bunka) return;
    const dov = new Dovolene(tym.hodnota("dovolene"), tym.nastaveni);
    const lide = lideDovolenych(tym, dov, aktualniRok);
    const j = +bunka.dataset.j, i0 = +bunka.dataset.i;
    if (!lzeMenit(tym, lide[j])) return;
    ev.preventDefault();
    let i1 = i0;
    const oznac = () => {
      const [a, b] = i0 <= i1 ? [i0, i1] : [i1, i0];
      for (const c of plan.querySelectorAll(`.plan-den[data-j="${j}"]`)) {
        const i = +c.dataset.i;
        c.style.background = i >= a && i <= b ? "var(--c-primary-light)" : "";
      }
    };
    oznac();
    const pohyb = (e) => {
      const c = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(`.plan-den[data-j="${j}"]`);
      if (c && +c.dataset.i !== i1) { i1 = +c.dataset.i; oznac(); }
    };
    const pust = () => {
      document.removeEventListener("pointermove", pohyb);
      document.removeEventListener("pointerup", pust);
      const [a, b] = i0 <= i1 ? [i0, i1] : [i1, i0];
      const zacatek = new Date(aktualniRok, 0, 1);
      dialogDovolene(tym, { kdo: lide[j], od: pridejDny(zacatek, a), do: pridejDny(zacatek, b), poZavreni: () => obnov(false) });
    };
    document.addEventListener("pointermove", pohyb);
    document.addEventListener("pointerup", pust);
  });

  obnov(true);
}

// Úprava / nová dovolená (dovolene.DialogDovolene): kdo (jen správce), od–do, Celé dny | Jen část dne, popis
export function dialogDovolene(tym, { pol = null, kdo = "", od = null, do: doo = null, poZavreni = null } = {}) {
  const dov = new Dovolene(tym.hodnota("dovolene"), tym.nastaveni);
  const rz = pol ? rozsah(pol) : null;
  const komu = pol ? pol.uzivatel || "" : kdo || tym.ja.id;
  const vyberKdo = tym.jeSpravce ? h("select", {}, tym.aktivni.map((u) => h("option", { value: u.id, text: u.jmeno, selected: u.id === komu }))) : null;
  if (vyberKdo && ![...vyberKdo.options].some((o) => o.selected)) vyberKdo.append(h("option", { value: komu, text: tym.jmeno(komu, "Bez přihlášení"), selected: true }));
  const z0 = rz ? rz[0] : od || zIso(dnes()), k0 = rz ? rz[1] : doo || z0;
  const odIn = h("input", { type: "date", value: iso(z0) }), doIn = h("input", { type: "date", value: iso(k0) });
  const castecna = pol ? hodinDovoleneDenne(pol, dov.den) < dov.den : false;
  let rezim = castecna ? "cast" : "cely";
  const hodin = h("input", { type: "number", min: 0.5, max: dov.den, step: 0.5, value: castecna ? pol.hodin : dov.den / 2, style: { width: "110px" } });
  const segRezim = h("div", { class: "segment", role: "group" }, [["cely", "Celé dny"], ["cast", "Jen část dne"]].map(([k, t]) => h("button", { type: "button", text: t,
    "aria-pressed": String(k === rezim), dataset: { k }, onclick: () => { rezim = k; for (const b of segRezim.children) b.setAttribute("aria-pressed", String(b.dataset.k === k)); obnovInfo(); } })));
  const popis = h("input", { value: pol?.nazev && pol.nazev !== "Dovolená" ? pol.nazev : "", maxlength: 200, placeholder: "Dovolená" });
  const info = h("p", { class: "tiche" });
  const poleHodin = pole("Hodin denně", hodin);

  function udaje() {
    const z = zIso(odIn.value), k = zIso(doIn.value) || z;
    if (!z) return null;
    return { z: k < z ? k : z, k: k < z ? z : k, kdo: vyberKdo ? vyberKdo.value : komu, hodin: rezim === "cast" ? Number(hodin.value) : 0 };
  }
  function obnovInfo() {
    poleHodin.hidden = rezim !== "cast";
    const u = udaje();
    const ok = o?.dialog.querySelector(".tlacitko.hlavni");
    if (!u) { info.textContent = ""; return; }
    const jina = prekryvDovolene(tym.hodnota("dovolene"), u.kdo, u.z, u.k, pol?.id || "");
    if (jina) {
      info.textContent = textPrekryvu(jina);
      info.style.color = "var(--c-danger)";
      if (ok) ok.disabled = true;
      return;
    }
    info.style.color = "";
    if (ok) ok.disabled = false;
    const zkusebni = { datum: iso(u.z), datum_do: iso(u.k), hodin: u.hodin };
    const bere = dov.hodinPolozky(zkusebni);
    if (vidiCisla(tym, u.kdo)) {
      const bil = dov.bilance(u.kdo, u.z.getFullYear());
      const puvodni = pol ? dov.hodinPolozky(pol) : 0;
      info.textContent = `Bere ${hodinyText(bere, dov.den)} · pak zbývá ${hodinyText(bil.zbyva + puvodni - bere, dov.den)}`;
    } else {
      info.textContent = `Bere ${hodinyText(bere, dov.den)}`;
    }
  }
  for (const p of [odIn, doIn, hodin]) p.addEventListener("input", obnovInfo);
  vyberKdo?.addEventListener("change", obnovInfo);

  const tlacitka = [
    pol && lzeMenit(tym, komu) ? { text: "Smazat", nebezpecne: true, ikona: "trash", akce: () => smazDovolenou(tym, pol) } : null,
    { text: "Zrušit" },
    { text: pol ? "Uložit" : "Přidat dovolenou", hlavni: true, ikona: "check", akce: async () => {
      const u = udaje();
      if (!u) throw new Error("Vyber datum.");
      if (u.kdo !== tym.ja.id && !tym.jeSpravce) throw new Error("Dovolenou kolegům zadává správce.");
      if (rezim === "cast" && !(u.hodin > 0 && u.hodin < dov.den)) throw new Error(`Část dne = méně než ${cislo(dov.den)} h.`);
      const nazev = popis.value.trim() || "Dovolená";
      hlidejPrekryvDovolene(tym.hodnota("dovolene"), u.kdo, u.z, u.k, pol?.id || "");
      await tym.uprav("dovolene", (s) => {
        hlidejPrekryvDovolene(s, u.kdo, u.z, u.k, pol?.id || "");
        if (!pol) {
          const udaje2 = { nazev, uzivatel: u.kdo, barva: C_DOVOLENA, poznamka: "", stav: "Plánováno" };
          nastavRozsah(udaje2, u.z, u.k);
          if (u.hodin) udaje2.hodin = u.hodin;
          s.push(novyTermin(udaje2, tym.ja.jmeno));
          return;
        }
        const x = s.find((y) => y && y.id === pol.id);
        if (!x) throw new Error("Dovolenou už mezitím někdo smazal.");
        if (!tym.jeSpravce && (x.uzivatel || "") !== tym.ja.id) throw new Error("Cizí dovolenou měnit nemůžeš.");
        x.nazev = nazev;
        x.uzivatel = u.kdo;
        nastavRozsah(x, u.z, u.k);
        if (u.hodin) x.hodin = u.hodin; else delete x.hodin;
        zaznamTerminu(x, `Upraveno: ${popisRozsahu(u.z, u.k)}`, tym.ja.jmeno);
      });
      oznam(pol ? "Dovolená uložena" : "Dovolená přidána");
    } },
  ];
  const o = okno(pol ? "Upravit dovolenou" : "Nová dovolená", [
    vyberKdo ? pole("Kdo", vyberKdo) : null,
    h("div", { class: "dve-pole" }, pole("Od", odIn), pole("Do", doIn)),
    h("div", { class: "pole" }, h("span", { text: "Rozsah" }), segRezim), poleHodin,
    pole("Popis (nepovinné)", popis), info,
  ], tlacitka);
  if (poZavreni) o.dialog.addEventListener("close", poZavreni);
  obnovInfo();
  odIn.focus();
}

function smazDovolenou(tym, pol) {
  const r = rozsah(pol);
  okno("Smazat dovolenou?", [h("p", { text: `${tym.jmeno(pol.uzivatel, "")}${r ? ` · ${popisRozsahu(...r)}` : ""}` })], [
    { text: "Zrušit" },
    { text: "Smazat", nebezpecne: true, ikona: "trash", akce: async () => {
      let smazana = null, index = -1;
      await tym.uprav("dovolene", (s) => {
        index = s.findIndex((x) => x && x.id === pol.id);
        if (index < 0) return false;
        if (!tym.jeSpravce && (s[index].uzivatel || "") !== tym.ja.id) throw new Error("Cizí dovolenou mazat nemůžeš.");
        smazana = s.splice(index, 1)[0];
      });
      if (smazana) {
        oznam("Dovolená smazána", false, { text: "Vrátit", fn: () => tym.uprav("dovolene", (s) => {
          if (s.some((x) => x && x.id === smazana.id)) return false;
          s.splice(Math.min(index, s.length), 0, smazana);
        }).catch((e) => oznam(e?.message || "Nepovedlo se.", true)) });
      }
    } },
  ]);
}
