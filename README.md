# AgroMonitor - Dashboard pro monitoring skladů

## 🚀 JAK TO SPUSTIT

**Nová struktura - vícestránková aplikace:**

1. Otevřete `login.html` v prohlížeči
2. Zadejte přístupový kód (viz níže)
3. Budete automaticky přesměrováni podle typu účtu

## 🔑 PŘÍSTUPOVÉ KÓDY

| Kód    | Účet                    | Střediska               | Přesměrování                |
|--------|-------------------------|-------------------------|-----------------------------|
| 123456 | Agro Vysočina s.r.o.    | Mělkovice, Stránecká    | → Dashboard (výběr)         |
| 234567 | ZOD Brniště a.s.        | Brniště                 | → Detail Brniště (přímo)    |
| 345678 | Admin                   | Všechna střediska       | → Dashboard (admin funkce)  |

## 📁 STRUKTURA APLIKACE

### Stránky:
```
login.html          ← Přihlašovací stránka
dashboard.html      ← Přehled středisek (jen při více střediscích nebo admin)
location.html       ← Detail konkrétního střediska (sila, grafy, log)
```

### Skripty:
```
auth.js             ← Autentizace a správa přístupu
dashboard.js        ← Logika dashboardu
app.js              ← Hlavní logika aplikace (detail střediska)
```

### Data:
```
data/
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

## ✨ FUNKCE

### Normální účet (1 středisko):
- Přímé přesměrování na detail střediska
- Zobrazení sil, teplot, grafů
- Log událostí
- Mapa sil

### Normální účet (více středisek):
- Dashboard s přehledem všech středisek
- Možnost přepínat mezi středisky
- Statistiky pro každé středisko

### Admin účet:
- Dashboard s globálním přehledem
- Celkové statistiky (počet středisek, sil, teploty)
- Problematická měření napříč středisky
- Přístup ke všem střediskům

## ✏️ JAK UPRAVIT DATA

Upravujte CSV soubory ve složce `data/`:

### Změna teploty v snapshot.csv:
```csv
timestamp,enterprise_id,enterprise_name,location_id,location_name,silo_id,silo_name,thermometer_id,sensor_id,depth_m,temp_c,fan_id,fan_running,level_pct
2026-02-03T08:30:00Z,agro_vysocina,Agro Vysocina s.r.o.,melkovice,Melkovice,1,Silo 1,T1,C1,2.0,12.5,F1,false,97
```

Změňte hodnotu `temp_c` (teplota) nebo `level_pct` (naplnění).

Po úpravě **uložte** a stiskněte **F5** (refresh).

## 🔒 BEZPEČNOST

- Přístupové kódy jsou uloženy v `localStorage`
- Po odhlášení je nutné zadat kód znovu
- Každý účet má přístup pouze k přiřazeným střediskům
- Admin vidí všechna střediska a globální statistiky

## 🗺️ MAPA SIL

- Konfigurační soubor: `map-config.json`
- Admin může editovat pozice sil
- Export pozic tlačítkem "Export pozic"

## 🔄 PŘEPÍNÁNÍ MEZI STŘEDISKY

Na stránce `location.html`:
- Tlačítko "← Zpět" pro návrat na dashboard
- Dropdown pro přepnutí na jiné středisko (pokud má účet více středisek)

## 📱 RESPONZIVNÍ DESIGN

Aplikace je optimalizována pro:
- Desktop počítače
- Tablety
- Mobilní telefony

---

**Vytvořeno pro Agro Vysočina s.r.o.**

Verze: 2.0 (Multi-page architecture)
