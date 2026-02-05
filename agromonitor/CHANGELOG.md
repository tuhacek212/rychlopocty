# CHANGELOG - AgroMonitor v2.0

## 🎯 Hlavní změny

### ✅ Nová architektura - Multi-page aplikace

**Před:**
- Jedna stránka (index.html) s vším včetně loginu
- Login overlay překrývající aplikaci
- Všechna data v jednom JS souboru

**Po:**
- **login.html** - Samostatná přihlašovací stránka
- **dashboard.html** - Přehled středisek (jen při více střediscích nebo admin)
- **location.html** - Detail konkrétního střediska
- Čistá separace zodpovědností

### 🔑 Inteligentní přesměrování po přihlášení

| Typ účtu | Počet středisek | Přesměrování |
|----------|-----------------|--------------|
| Normální | 1 středisko | → Přímo na detail (`location.html?id=brniste`) |
| Normální | 2+ středisek | → Dashboard pro výběr (`dashboard.html`) |
| Admin | Všechna | → Dashboard s admin funkcemi (`dashboard.html`) |

### 📊 Nový Dashboard

**Pro uživatele s více středisky:**
- Přehledové karty pro každé středisko
- Rychlá statistika (počet sil, průměrná teplota, naplnění)
- Vizuální indikátory problémů
- Kliknutím na kartu → detail střediska

**Pro administrátory:**
- Globální přehled všech středisek
- Celkové statistiky (počet středisek, sil, průměrná teplota)
- Seznam problematických měření napříč středisky
- Plný přístup ke všem střediskům

### 🔐 Vylepšená autentizace

**Nové funkce:**
- Persistentní přihlášení (localStorage)
- Ochrana proti brute-force útokům
- Časový lockout po neúspěšných pokusech
- Automatická validace přístupu ke střediskům

**Bezpečnostní vylepšení:**
- Oddělený auth.js modul
- Centralizovaná správa přístupů
- Validace na úrovni URL parametrů

### 🗂️ Nová datová struktura

**Před:**
```javascript
// data.js
const siloData = {
  "melkovice": { ... },
  "stranecka": { ... }
};
```

**Po:**
```
data/
  melkovice/
    snapshot.csv
    history.csv
  stranecka/
    snapshot.csv
    history.csv
  brniste/
    snapshot.csv
    history.csv
```

**Výhody:**
- Snadnější úprava dat (CSV vs JS)
- Možnost automatického načítání z sensorů
- Lepší škálovatelnost
- Oddělení dat od kódu

### 🎨 UX vylepšení

1. **Tlačítko "Zpět"**
   - Vrací na dashboard (pokud má uživatel více středisek)
   - Automaticky se skryje u uživatelů s 1 střediskem

2. **Přepínání středisek**
   - Dropdown v hlavičce (jen když má smysl)
   - Přímé přepnutí bez návratu na dashboard

3. **Čistší rozhraní**
   - Žádný login overlay
   - Přímý vstup do aplikace
   - Rychlejší navigace

### 📁 Nové soubory

| Soubor | Účel |
|--------|------|
| `login.html` | Přihlašovací stránka |
| `dashboard.html` | Přehled středisek |
| `location.html` | Detail střediska (upraveno z index.html) |
| `auth.js` | Autentizační logika |
| `dashboard.js` | Logika dashboardu |
| `app.js` | Logika detailu (upraveno) |
| `INSTALACE.md` | Instalační instrukce |

### 🔄 Upravené soubory

| Soubor | Změny |
|--------|-------|
| `app.js` | • Odebrána login logika<br>• Přidána podpora URL parametrů<br>• Přidána funkce pro přepínání středisek<br>• Upravena inicializace |
| `styles.css` | • Přidány styly pro back button<br>• Upraveny styly pro dashboard<br>• Vylepšení responzivity |

### ❌ Odebrané soubory

| Soubor | Důvod |
|--------|-------|
| `index.html` | → Nahrazeno `location.html` |
| `data.js` | → Nahrazeno CSV soubory v `data/` |

## 🚀 Jak upgradovat z v1.0 na v2.0

### Krok 1: Zálohování
```bash
# Zálohujte původní soubory
cp index.html index.html.backup
cp app.js app.js.backup
cp data.js data.js.backup
```

### Krok 2: Konverze dat
```javascript
// Původní data.js
const siloData = {
  "melkovice": {
    "1": { level: 97, temps: [...] }
  }
};

// ↓ Převeďte na CSV ↓

// data/melkovice/snapshot.csv
timestamp,enterprise_id,enterprise_name,location_id,location_name,silo_id,silo_name,thermometer_id,sensor_id,depth_m,temp_c,fan_id,fan_running,level_pct
2026-02-03T08:30:00Z,agro_vysocina,Agro Vysocina s.r.o.,melkovice,Melkovice,1,Silo 1,T1,C1,2.0,12.5,F1,false,97
```

### Krok 3: Nasazení nových souborů
```bash
# Nahrajte nové soubory
upload login.html dashboard.html location.html
upload auth.js dashboard.js
upload data/ (složka s CSV)
```

### Krok 4: Aktualizace přístupových kódů
Upravte `auth.js` podle vašich potřeb.

### Krok 5: Testování
1. Otevřete `login.html`
2. Vyzkoušejte všechny přístupové kódy
3. Zkontrolujte navigaci mezi stránkami
4. Ověřte zobrazení dat

## 📋 Checklist pro nasazení

- [ ] Zálohovat původní soubory
- [ ] Zkopírovat všechny nové soubory
- [ ] Vytvořit složku `data/` se správnou strukturou
- [ ] Převést data do CSV formátu
- [ ] Upravit přístupové kódy v `auth.js` (pokud potřeba)
- [ ] Testovat všechny přístupové kódy
- [ ] Testovat navigaci mezi stránkami
- [ ] Testovat na mobilních zařízeních
- [ ] Vyčistit localStorage u uživatelů (`localStorage.clear()`)
- [ ] Nasadit do produkce

## 🐛 Známé problémy a řešení

### Problem: "Nepodařilo se načíst data"
**Řešení:** Zkontrolujte, že složka `data/` obsahuje CSV soubory

### Problem: Aplikace se nezobrazuje
**Řešení:** Vyčistěte cache prohlížeče (Ctrl+Shift+R)

### Problem: Přihlášení nefunguje
**Řešení:** Vyčistěte localStorage: `localStorage.clear()`

## 🎉 Výhody nové verze

### Pro uživatele:
- ✅ Rychlejší přístup k datům (přímo na detail, ne přes dashboard)
- ✅ Přehlednější navigace
- ✅ Lepší UX na mobilních zařízeních
- ✅ Persistentní přihlášení (nemusí zadávat kód pořád)

### Pro administrátory:
- ✅ Globální přehled všech středisek
- ✅ Centralizované upozornění na problémy
- ✅ Snadnější správa více středisek

### Pro vývojáře:
- ✅ Čistší architektura (separace zodpovědností)
- ✅ Snadnější údržba (každá stránka má svůj účel)
- ✅ Lepší škálovatelnost (snadné přidání dalších středisek)
- ✅ Flexibilnější datová vrstva (CSV místo JS)

## 📊 Statistiky

| Metrika | v1.0 | v2.0 |
|---------|------|------|
| Počet HTML souborů | 1 | 3 |
| Počet JS modulů | 1 | 3 |
| Řádků kódu (celkem) | ~2200 | ~2500 |
| Datové soubory | 1 (JS) | 6 (CSV) |
| Kliknutí k datům | 1-2 | 0-1 |

## 🔮 Budoucí vylepšení

- [ ] Real-time aktualizace dat (WebSocket)
- [ ] Export reportů do PDF/Excel
- [ ] Push notifikace při problémech
- [ ] Mobile aplikace (React Native)
- [ ] API pro externí systémy
- [ ] Historické reporty a analýzy
- [ ] Prediktivní údržba pomocí ML

---

**Verze:** 2.0  
**Datum vydání:** Únor 2026  
**Kompatibilita:** Chrome 90+, Firefox 88+, Edge 90+, Safari 14+
