// Malý zapisovač .xlsx (Office Open XML) bez knihoven: listy s texty / čísly, tučné písmo, barva
// výplně a písma, sloučené buňky, šířky sloupců, ukotvení řádků, tisk na šířku / na jednu stránku.
// Zip bez komprese (metoda „store“) – Excel ho otevře bez potíží.

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");

export function sloupec(i) {
  let s = "";
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

const hexBarva = (b) => "FF" + String(b || "").replace("#", "").toUpperCase().padEnd(6, "0").slice(0, 6);

// list = {nazev, sirky: [znaků], radky: [[bunka]], slouceni: ["A1:C1"], ukotvit: počet řádků, naSirku, naStranku}
// bunka = hodnota | {v, tucne, barva (výplň), pismo (barva písma), zarovnat: "center"|"right", ramecek, zalomit, velikost}
export function vytvorXlsx(listy) {
  const styly = new Map([["", 0]]);
  const fonty = ['<font><sz val="10"/><name val="Calibri"/></font>'];
  const vyplne = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const okraje = ["<border/>", '<border><left style="thin"><color rgb="FFD0D5DD"/></left><right style="thin"><color rgb="FFD0D5DD"/></right><top style="thin"><color rgb="FFD0D5DD"/></top><bottom style="thin"><color rgb="FFD0D5DD"/></bottom></border>'];
  const xf = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const index = (pole, xml) => { let i = pole.indexOf(xml); if (i < 0) { pole.push(xml); i = pole.length - 1; } return i; };
  const styl = (b) => {
    if (!b || typeof b !== "object") return 0;
    const klic = JSON.stringify([b.tucne, b.barva, b.pismo, b.zarovnat, b.ramecek, b.zalomit, b.velikost, b.kurziva]);
    if (styly.has(klic)) return styly.get(klic);
    const font = index(fonty, `<font>${b.tucne ? "<b/>" : ""}${b.kurziva ? "<i/>" : ""}<sz val="${b.velikost || 10}"/>${b.pismo ? `<color rgb="${hexBarva(b.pismo)}"/>` : ""}<name val="Calibri"/></font>`);
    const fill = b.barva ? index(vyplne, `<fill><patternFill patternType="solid"><fgColor rgb="${hexBarva(b.barva)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const border = b.ramecek ? 1 : 0;
    const zarovnani = b.zarovnat || b.zalomit ? `<alignment${b.zarovnat ? ` horizontal="${b.zarovnat}"` : ""} vertical="${b.zalomit ? "top" : "center"}"${b.zalomit ? ' wrapText="1"' : ""}/>` : "";
    xf.push(`<xf numFmtId="0" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1"${fill ? ' applyFill="1"' : ""}${border ? ' applyBorder="1"' : ""}${zarovnani ? ' applyAlignment="1"' : ""}>${zarovnani}</xf>`);
    styly.set(klic, xf.length - 1);
    return xf.length - 1;
  };

  const soubory = {};
  listy.forEach((list, li) => {
    const radky = list.radky.map((radek, ri) => {
      const bunky = radek.map((b, si) => {
        if (b == null || b === "") return typeof b === "object" && b ? "" : "";
        const hodnota = typeof b === "object" ? b.v : b;
        const s = styl(typeof b === "object" ? b : null);
        const ref = `${sloupec(si)}${ri + 1}`;
        if (hodnota == null || hodnota === "") return s ? `<c r="${ref}" s="${s}"/>` : "";
        if (typeof hodnota === "number" && Number.isFinite(hodnota)) return `<c r="${ref}" s="${s}"><v>${hodnota}</v></c>`;
        return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(hodnota)}</t></is></c>`;
      }).join("");
      const vyska = list.vysky?.[ri];
      return `<row r="${ri + 1}"${vyska ? ` ht="${vyska}" customHeight="1"` : ""}>${bunky}</row>`;
    }).join("");
    const sirky = (list.sirky || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
    const ukotvit = list.ukotvit ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${list.ukotvit}" topLeftCell="A${list.ukotvit + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    const slouceni = (list.slouceni || []).length ? `<mergeCells count="${list.slouceni.length}">${list.slouceni.map((r) => `<mergeCell ref="${r}"/>`).join("")}</mergeCells>` : "";
    const naStranku = list.naStranku ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : "";
    soubory[`xl/worksheets/sheet${li + 1}.xml`] = `${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${naStranku}${ukotvit}<sheetFormatPr defaultRowHeight="15"/>${sirky ? `<cols>${sirky}</cols>` : ""}<sheetData>${radky}</sheetData>${slouceni}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="${list.papir === "A3" ? 8 : 9}" orientation="${list.naSirku ? "landscape" : "portrait"}"${list.naStranku ? ' fitToWidth="1" fitToHeight="0"' : ""}/></worksheet>`;
  });
  const nazvy = [];
  const jmenoListu = (n) => {
    let j = String(n).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "List";
    for (let i = 2; nazvy.includes(j); i++) j = `${j.slice(0, 28)} ${i}`;
    nazvy.push(j);
    return j;
  };
  soubory["[Content_Types].xml"] = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${listy.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
  soubory["_rels/.rels"] = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  soubory["xl/workbook.xml"] = `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${listy.map((l, i) => `<sheet name="${esc(jmenoListu(l.nazev))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;
  soubory["xl/_rels/workbook.xml.rels"] = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${listy.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${listy.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  soubory["xl/styles.xml"] = `${XML}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="${fonty.length}">${fonty.join("")}</fonts><fills count="${vyplne.length}">${vyplne.join("")}</fills><borders count="${okraje.length}">${okraje.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xf.length}">${xf.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zip(soubory);
}

// --- zip (store) ---

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(soubory) {
  const kod = new TextEncoder();
  const casti = [], centralni = [];
  let posun = 0;
  const d = new Date();
  const cas = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const datum = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const [jmeno, obsah] of Object.entries(soubory)) {
    const j = kod.encode(jmeno), data = kod.encode(obsah), crc = crc32(data);
    const hlava = new DataView(new ArrayBuffer(30));
    hlava.setUint32(0, 0x04034b50, true); hlava.setUint16(4, 20, true); hlava.setUint16(6, 0x0800, true);
    hlava.setUint16(8, 0, true); hlava.setUint16(10, cas, true); hlava.setUint16(12, datum, true);
    hlava.setUint32(14, crc, true); hlava.setUint32(18, data.length, true); hlava.setUint32(22, data.length, true);
    hlava.setUint16(26, j.length, true); hlava.setUint16(28, 0, true);
    casti.push(new Uint8Array(hlava.buffer), j, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, cas, true); c.setUint16(14, datum, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, j.length, true);
    c.setUint32(42, posun, true);
    centralni.push(new Uint8Array(c.buffer), j);
    posun += 30 + j.length + data.length;
  }
  const velikost = centralni.reduce((s, x) => s + x.length, 0);
  const konec = new DataView(new ArrayBuffer(22));
  konec.setUint32(0, 0x06054b50, true);
  konec.setUint16(8, Object.keys(soubory).length, true); konec.setUint16(10, Object.keys(soubory).length, true);
  konec.setUint32(12, velikost, true); konec.setUint32(16, posun, true);
  return new Blob([...casti, ...centralni, new Uint8Array(konec.buffer)],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function stahni(blob, jmeno) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = jmeno;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
