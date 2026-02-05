# INSTALAČNÍ INSTRUKCE

## 📦 Co je potřeba

Všechny soubory z této složky nakopírujte na webový server nebo otevřete lokálně v prohlížeči.

## 📂 Struktura souborů (kompletní seznam)

```
/
├── login.html              ← START - Otevřete tento soubor!
├── dashboard.html
├── location.html
├── auth.js
├── dashboard.js
├── app.js
├── styles.css
├── map-config.json
├── README.md
└── data/
    ├── melkovice/
    │   ├── snapshot.csv
    │   └── history.csv
    ├── stranecka/
    │   ├── snapshot.csv
    │   └── history.csv
    └── brniste/
        ├── snapshot.csv
        └── history.csv
```

## 🚀 SPUŠTĚNÍ

### Varianta A: Lokální spuštění (doporučeno pro testování)

1. Rozbalte všechny soubory do jedné složky
2. Otevřete `login.html` v prohlížeči (Chrome, Firefox, Edge)
3. Zadejte přístupový kód:
   - **123456** - Agro Vysočina (2 střediska)
   - **234567** - ZOD Brniště (1 středisko)
   - **345678** - Admin (všechna střediska + admin panel)

### Varianta B: Webový server

1. Nahrajte všechny soubory na webový server (FTP, SSH)
2. Zkontrolujte, že struktura složek je zachována
3. Otevřete v prohlížeči: `https://vase-domena.cz/login.html`

## 🔄 MIGRACE Z PŮVODNÍ VERZE

### Co se změnilo?

**Původní verze:**
```
index.html      ← Vše na jedné stránce včetně loginu
app.js          ← Celá logika
styles.css
data.js         ← Statická data v JS
```

**Nová verze:**
```
login.html      ← Samostatná přihlašovací stránka
dashboard.html  ← Přehled středisek
location.html   ← Detail střediska
auth.js         ← Autentizace
dashboard.js    ← Dashboard logika
app.js          ← Logika detailu (upraveno)
data/           ← CSV soubory místo JS
```

### Kroky migrace:

1. **Zálohujte původní soubory** (index.html, app.js, data.js)
2. **Zkopírujte nové soubory** do jiné složky
3. **Pokud máte vlastní data:**
   - Přeneste je do CSV formátu
   - Uložte do příslušných složek v `data/`
4. **Pokud máte vlastní CSS:**
   - Přeneste styly do `styles.css`
5. **Testujte** před nasazením do produkce

## 📊 FORMÁT CSV DAT

### snapshot.csv (aktuální stav)
```csv
timestamp,enterprise_id,enterprise_name,location_id,location_name,silo_id,silo_name,thermometer_id,sensor_id,depth_m,temp_c,fan_id,fan_running,level_pct
2026-02-03T08:30:00Z,agro_vysocina,Agro Vysocina s.r.o.,melkovice,Melkovice,1,Silo 1,T1,C1,2.0,12.5,F1,false,97
```

### history.csv (historická data)
Stejný formát jako snapshot.csv, ale obsahuje více časových záznamů.

## 🔧 ČASTÉ PROBLÉMY

### "Nepodařilo se načíst data"
- Zkontrolujte, že složka `data/` existuje
- Zkontrolujte, že CSV soubory jsou správně umístěny
- Zkontrolujte formát CSV (kódování UTF-8)

### "Nemáte přístup k tomuto středisku"
- Zadali jste správný přístupový kód?
- Zkontrolujte, že location_id v CSV odpovídá názvům složek

### Aplikace se nezobrazuje správně
- Zkontrolujte, že jsou všechny soubory ve stejné složce
- Zkontrolujte konzoli prohlížeče (F12) pro chyby
- Zkuste vymazat cache prohlížeče (Ctrl+Shift+R)

## 🔐 ZMĚNA PŘÍSTUPOVÝCH KÓDŮ

Pro změnu přístupových kódů upravte soubor `auth.js`:

```javascript
const ACCESS_CODES = {
    '123456': {          // ← Změňte kód zde
        label: 'Agro Vysočina s.r.o.',
        locations: ['melkovice', 'stranecka'],
        defaultLocation: 'melkovice',
        role: 'user'
    },
    // ... další kódy
};
```

Po změně vyčistěte localStorage v prohlížeči:
1. Otevřete konzoli (F12)
2. Napište: `localStorage.clear()`
3. Stiskněte Enter
4. Obnovte stránku (F5)

## 📞 PODPORA

Pokud narazíte na problémy:

1. Zkontrolujte README.md pro detailnější dokumentaci
2. Otevřete konzoli prohlížeče (F12) a zkopírujte chybové hlášky
3. Zkontrolujte, že používáte moderní prohlížeč (Chrome 90+, Firefox 88+, Edge 90+)

---

**Verze aplikace:** 2.0  
**Datum aktualizace:** Únor 2026
