// Vygenerováno skriptem nastroje/sestav.py – needitovat ručně.
window.KK = {
 "rozpis": {
  "sezona": "2026/2027",
  "mista": {
   "zs": {
    "nazev": "ZS Slaný",
    "mapa": "https://www.google.com/maps/search/?api=1&query=Zimn%C3%AD+stadion+Slan%C3%BD+Lacinova+1720"
   },
   "bios": {
    "nazev": "Hala BIOS Slaný",
    "mapa": "https://www.google.com/maps/search/?api=1&query=Hala+BIOS+Slan%C3%BD"
   },
   "haje": {
    "nazev": "ZŠ Háje",
    "mapa": "https://www.google.com/maps/search/?api=1&query=Z%C5%A0+H%C3%A1je+Slan%C3%BD"
   }
  },
  "typy": {
   "led": "Led",
   "sucho": "Suchá příprava",
   "pohyb": "Pohybovka"
  },
  "sablona": [
   {
    "id": "po-led",
    "den": 1,
    "typ": "led",
    "misto": "zs",
    "od": "17:00",
    "do": "18:30",
    "popis": "Rozdělený trénink",
    "poradi": "A/B"
   },
   {
    "id": "po-bios",
    "den": 1,
    "typ": "sucho",
    "misto": "bios",
    "od": "19:00",
    "do": "20:00",
    "popis": "Suchá příprava"
   },
   {
    "id": "ut-led",
    "den": 2,
    "typ": "led",
    "misto": "zs",
    "od": "17:00",
    "do": "18:45",
    "popis": "Rozdělený trénink",
    "poradi": "A/B",
    "poznamka": "Po tréninku ještě 20 min docvičení s Radkou."
   },
   {
    "id": "ct-led",
    "den": 4,
    "typ": "led",
    "misto": "zs",
    "od": "06:00",
    "do": "07:00",
    "popis": "Sloučený trénink"
   },
   {
    "id": "ct-pohyb1",
    "den": 4,
    "typ": "pohyb",
    "misto": "haje",
    "od": "17:00",
    "do": "18:15",
    "popis": "Pohybovka s Radkou – 1. skupina a základna"
   },
   {
    "id": "ct-pohyb2",
    "den": 4,
    "typ": "pohyb",
    "misto": "haje",
    "od": "18:00",
    "do": "19:30",
    "popis": "Pohybovka s Radkou – 2. skupina"
   },
   {
    "id": "so-led",
    "den": 6,
    "typ": "led",
    "misto": "zs",
    "popis": "Rozdělený trénink",
    "stridani": {
     "liche": "A/B",
     "sude": "B/A"
    },
    "poznamka": "Po tréninku ještě 20 min docvičení s Radkou."
   }
  ],
  "vyjimky": [
   {
    "datum": "2026-10-26",
    "id": "po-bios",
    "zruseno": true,
    "poznamka": "Podzimní prázdniny – suchá příprava není."
   }
  ],
  "platnost": {
   "od": "2026-08-01",
   "do": "2027-03-31"
  },
  "zimakOk": true,
  "aktualizovano": "2026-10-24T22:55+02:00",
  "tydny": [
   {
    "tyden": 43,
    "pondeli": "2026-10-19",
    "zimak": "zverejneno",
    "led": [
     {
      "datum": "2026-10-19",
      "od": "17:00",
      "do": "18:30"
     },
     {
      "datum": "2026-10-20",
      "od": "17:00",
      "do": "18:45"
     },
     {
      "datum": "2026-10-22",
      "od": "06:00",
      "do": "07:00"
     },
     {
      "datum": "2026-10-24",
      "od": "06:45",
      "do": "08:15"
     }
    ],
    "dny": [
     {
      "datum": "2026-10-19",
      "treninky": [
       {
        "id": "po-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "17:00",
        "do": "18:30",
        "poradi": "A/B",
        "zdroj": "zimak"
       },
       {
        "id": "po-bios",
        "typ": "sucho",
        "misto": "bios",
        "popis": "Suchá příprava",
        "od": "19:00",
        "do": "20:00"
       }
      ]
     },
     {
      "datum": "2026-10-20",
      "treninky": [
       {
        "id": "ut-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "17:00",
        "do": "18:45",
        "poznamka": "Po tréninku ještě 20 min docvičení s Radkou.",
        "poradi": "A/B",
        "zdroj": "zimak"
       }
      ]
     },
     {
      "datum": "2026-10-21",
      "treninky": []
     },
     {
      "datum": "2026-10-22",
      "treninky": [
       {
        "id": "ct-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Sloučený trénink",
        "od": "06:00",
        "do": "07:00",
        "zdroj": "zimak"
       },
       {
        "id": "ct-pohyb1",
        "typ": "pohyb",
        "misto": "haje",
        "popis": "Pohybovka s Radkou – 1. skupina a základna",
        "od": "17:00",
        "do": "18:15"
       },
       {
        "id": "ct-pohyb2",
        "typ": "pohyb",
        "misto": "haje",
        "popis": "Pohybovka s Radkou – 2. skupina",
        "od": "18:00",
        "do": "19:30"
       }
      ]
     },
     {
      "datum": "2026-10-23",
      "treninky": []
     },
     {
      "datum": "2026-10-24",
      "treninky": [
       {
        "id": "so-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "06:45",
        "do": "08:15",
        "poznamka": "Po tréninku ještě 20 min docvičení s Radkou.",
        "poradi": "A/B",
        "zdroj": "zimak"
       }
      ]
     },
     {
      "datum": "2026-10-25",
      "treninky": []
     }
    ]
   },
   {
    "tyden": 44,
    "pondeli": "2026-10-26",
    "zimak": "zverejneno",
    "led": [
     {
      "datum": "2026-10-26",
      "od": "17:00",
      "do": "18:30"
     },
     {
      "datum": "2026-10-27",
      "od": "17:00",
      "do": "18:45"
     },
     {
      "datum": "2026-10-29",
      "od": "06:00",
      "do": "07:00"
     },
     {
      "datum": "2026-10-31",
      "od": "07:00",
      "do": "08:30"
     }
    ],
    "dny": [
     {
      "datum": "2026-10-26",
      "treninky": [
       {
        "id": "po-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "17:00",
        "do": "18:30",
        "poradi": "A/B",
        "zdroj": "zimak"
       },
       {
        "id": "po-bios",
        "typ": "sucho",
        "misto": "bios",
        "popis": "Suchá příprava",
        "od": "19:00",
        "do": "20:00",
        "poznamka": "Podzimní prázdniny – suchá příprava není.",
        "stav": "zruseno"
       }
      ]
     },
     {
      "datum": "2026-10-27",
      "treninky": [
       {
        "id": "ut-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "17:00",
        "do": "18:45",
        "poznamka": "Po tréninku ještě 20 min docvičení s Radkou.",
        "poradi": "A/B",
        "zdroj": "zimak"
       }
      ]
     },
     {
      "datum": "2026-10-28",
      "treninky": []
     },
     {
      "datum": "2026-10-29",
      "treninky": [
       {
        "id": "ct-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Sloučený trénink",
        "od": "06:00",
        "do": "07:00",
        "zdroj": "zimak"
       },
       {
        "id": "ct-pohyb1",
        "typ": "pohyb",
        "misto": "haje",
        "popis": "Pohybovka s Radkou – 1. skupina a základna",
        "od": "17:00",
        "do": "18:15"
       },
       {
        "id": "ct-pohyb2",
        "typ": "pohyb",
        "misto": "haje",
        "popis": "Pohybovka s Radkou – 2. skupina",
        "od": "18:00",
        "do": "19:30"
       }
      ]
     },
     {
      "datum": "2026-10-30",
      "treninky": []
     },
     {
      "datum": "2026-10-31",
      "treninky": [
       {
        "id": "so-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "07:00",
        "do": "08:30",
        "poznamka": "Po tréninku ještě 20 min docvičení s Radkou.",
        "poradi": "B/A",
        "zdroj": "zimak"
       }
      ]
     },
     {
      "datum": "2026-11-01",
      "treninky": []
     }
    ]
   },
   {
    "tyden": 45,
    "pondeli": "2026-11-02",
    "zimak": "zverejneno",
    "led": [
     {
      "datum": "2026-11-02",
      "od": "17:00",
      "do": "18:30"
     },
     {
      "datum": "2026-11-03",
      "od": "17:00",
      "do": "18:45"
     },
     {
      "datum": "2026-11-05",
      "od": "06:00",
      "do": "07:00"
     },
     {
      "datum": "2026-11-07",
      "od": "07:00",
      "do": "08:30"
     }
    ],
    "dny": [
     {
      "datum": "2026-11-02",
      "treninky": [
       {
        "id": "po-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "17:00",
        "do": "18:30",
        "poradi": "A/B",
        "zdroj": "zimak"
       },
       {
        "id": "po-bios",
        "typ": "sucho",
        "misto": "bios",
        "popis": "Suchá příprava",
        "od": "19:00",
        "do": "20:00"
       }
      ]
     },
     {
      "datum": "2026-11-03",
      "treninky": [
       {
        "id": "ut-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "17:00",
        "do": "18:45",
        "poznamka": "Po tréninku ještě 20 min docvičení s Radkou.",
        "poradi": "A/B",
        "zdroj": "zimak"
       }
      ]
     },
     {
      "datum": "2026-11-04",
      "treninky": []
     },
     {
      "datum": "2026-11-05",
      "treninky": [
       {
        "id": "ct-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Sloučený trénink",
        "od": "06:00",
        "do": "07:00",
        "zdroj": "zimak"
       },
       {
        "id": "ct-pohyb1",
        "typ": "pohyb",
        "misto": "haje",
        "popis": "Pohybovka s Radkou – 1. skupina a základna",
        "od": "17:00",
        "do": "18:15"
       },
       {
        "id": "ct-pohyb2",
        "typ": "pohyb",
        "misto": "haje",
        "popis": "Pohybovka s Radkou – 2. skupina",
        "od": "18:00",
        "do": "19:30"
       }
      ]
     },
     {
      "datum": "2026-11-06",
      "treninky": []
     },
     {
      "datum": "2026-11-07",
      "treninky": [
       {
        "id": "so-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "07:00",
        "do": "08:30",
        "poznamka": "Po tréninku ještě 20 min docvičení s Radkou.",
        "poradi": "A/B",
        "zdroj": "zimak"
       }
      ]
     },
     {
      "datum": "2026-11-08",
      "treninky": []
     }
    ]
   },
   {
    "tyden": 46,
    "pondeli": "2026-11-09",
    "zimak": "zverejneno",
    "led": [
     {
      "datum": "2026-11-09",
      "od": "17:00",
      "do": "18:30"
     },
     {
      "datum": "2026-11-10",
      "od": "17:00",
      "do": "18:45"
     },
     {
      "datum": "2026-11-12",
      "od": "06:00",
      "do": "07:00"
     },
     {
      "datum": "2026-11-14",
      "od": "07:30",
      "do": "09:00"
     }
    ],
    "dny": [
     {
      "datum": "2026-11-09",
      "treninky": [
       {
        "id": "po-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "17:00",
        "do": "18:30",
        "poradi": "A/B",
        "zdroj": "zimak"
       },
       {
        "id": "po-bios",
        "typ": "sucho",
        "misto": "bios",
        "popis": "Suchá příprava",
        "od": "19:00",
        "do": "20:00"
       }
      ]
     },
     {
      "datum": "2026-11-10",
      "treninky": [
       {
        "id": "ut-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "17:00",
        "do": "18:45",
        "poznamka": "Po tréninku ještě 20 min docvičení s Radkou.",
        "poradi": "A/B",
        "zdroj": "zimak"
       }
      ]
     },
     {
      "datum": "2026-11-11",
      "treninky": []
     },
     {
      "datum": "2026-11-12",
      "treninky": [
       {
        "id": "ct-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Sloučený trénink",
        "od": "06:00",
        "do": "07:00",
        "zdroj": "zimak"
       },
       {
        "id": "ct-pohyb1",
        "typ": "pohyb",
        "misto": "haje",
        "popis": "Pohybovka s Radkou – 1. skupina a základna",
        "od": "17:00",
        "do": "18:15"
       },
       {
        "id": "ct-pohyb2",
        "typ": "pohyb",
        "misto": "haje",
        "popis": "Pohybovka s Radkou – 2. skupina",
        "od": "18:00",
        "do": "19:30"
       }
      ]
     },
     {
      "datum": "2026-11-13",
      "treninky": []
     },
     {
      "datum": "2026-11-14",
      "treninky": [
       {
        "id": "so-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "07:30",
        "do": "09:00",
        "poznamka": "Po tréninku ještě 20 min docvičení s Radkou.",
        "poradi": "B/A",
        "zdroj": "zimak"
       }
      ]
     },
     {
      "datum": "2026-11-15",
      "treninky": []
     }
    ]
   },
   {
    "tyden": 47,
    "pondeli": "2026-11-16",
    "zimak": "zverejneno",
    "led": [
     {
      "datum": "2026-11-16",
      "od": "17:00",
      "do": "18:30"
     },
     {
      "datum": "2026-11-17",
      "od": "17:00",
      "do": "18:45"
     },
     {
      "datum": "2026-11-19",
      "od": "06:00",
      "do": "07:00"
     },
     {
      "datum": "2026-11-21",
      "od": "07:00",
      "do": "22:00"
     }
    ],
    "dny": [
     {
      "datum": "2026-11-16",
      "treninky": [
       {
        "id": "po-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "17:00",
        "do": "18:30",
        "poradi": "A/B",
        "zdroj": "zimak"
       },
       {
        "id": "po-bios",
        "typ": "sucho",
        "misto": "bios",
        "popis": "Suchá příprava",
        "od": "19:00",
        "do": "20:00"
       }
      ]
     },
     {
      "datum": "2026-11-17",
      "treninky": [
       {
        "id": "ut-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "17:00",
        "do": "18:45",
        "poznamka": "Po tréninku ještě 20 min docvičení s Radkou.",
        "poradi": "A/B",
        "zdroj": "zimak"
       }
      ]
     },
     {
      "datum": "2026-11-18",
      "treninky": []
     },
     {
      "datum": "2026-11-19",
      "treninky": [
       {
        "id": "ct-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Sloučený trénink",
        "od": "06:00",
        "do": "07:00",
        "zdroj": "zimak"
       },
       {
        "id": "ct-pohyb1",
        "typ": "pohyb",
        "misto": "haje",
        "popis": "Pohybovka s Radkou – 1. skupina a základna",
        "od": "17:00",
        "do": "18:15"
       },
       {
        "id": "ct-pohyb2",
        "typ": "pohyb",
        "misto": "haje",
        "popis": "Pohybovka s Radkou – 2. skupina",
        "od": "18:00",
        "do": "19:30"
       }
      ]
     },
     {
      "datum": "2026-11-20",
      "treninky": []
     },
     {
      "datum": "2026-11-21",
      "treninky": [
       {
        "id": "so-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "07:00",
        "do": "22:00",
        "poznamka": "Po tréninku ještě 20 min docvičení s Radkou.",
        "poradi": "A/B",
        "zdroj": "zimak"
       }
      ]
     },
     {
      "datum": "2026-11-22",
      "treninky": []
     }
    ]
   },
   {
    "tyden": 48,
    "pondeli": "2026-11-23",
    "zimak": "zverejneno",
    "led": [
     {
      "datum": "2026-11-23",
      "od": "17:00",
      "do": "18:30"
     },
     {
      "datum": "2026-11-24",
      "od": "17:00",
      "do": "18:45"
     },
     {
      "datum": "2026-11-26",
      "od": "06:00",
      "do": "07:00"
     },
     {
      "datum": "2026-11-28",
      "od": "07:00",
      "do": "08:30"
     }
    ],
    "dny": [
     {
      "datum": "2026-11-23",
      "treninky": [
       {
        "id": "po-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "17:00",
        "do": "18:30",
        "poradi": "A/B",
        "zdroj": "zimak"
       },
       {
        "id": "po-bios",
        "typ": "sucho",
        "misto": "bios",
        "popis": "Suchá příprava",
        "od": "19:00",
        "do": "20:00"
       }
      ]
     },
     {
      "datum": "2026-11-24",
      "treninky": [
       {
        "id": "ut-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "17:00",
        "do": "18:45",
        "poznamka": "Po tréninku ještě 20 min docvičení s Radkou.",
        "poradi": "A/B",
        "zdroj": "zimak"
       }
      ]
     },
     {
      "datum": "2026-11-25",
      "treninky": []
     },
     {
      "datum": "2026-11-26",
      "treninky": [
       {
        "id": "ct-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Sloučený trénink",
        "od": "06:00",
        "do": "07:00",
        "zdroj": "zimak"
       },
       {
        "id": "ct-pohyb1",
        "typ": "pohyb",
        "misto": "haje",
        "popis": "Pohybovka s Radkou – 1. skupina a základna",
        "od": "17:00",
        "do": "18:15"
       },
       {
        "id": "ct-pohyb2",
        "typ": "pohyb",
        "misto": "haje",
        "popis": "Pohybovka s Radkou – 2. skupina",
        "od": "18:00",
        "do": "19:30"
       }
      ]
     },
     {
      "datum": "2026-11-27",
      "treninky": []
     },
     {
      "datum": "2026-11-28",
      "treninky": [
       {
        "id": "so-led",
        "typ": "led",
        "misto": "zs",
        "popis": "Rozdělený trénink",
        "od": "07:00",
        "do": "08:30",
        "poznamka": "Po tréninku ještě 20 min docvičení s Radkou.",
        "poradi": "B/A",
        "zdroj": "zimak"
       }
      ]
     },
     {
      "datum": "2026-11-29",
      "treninky": []
     }
    ]
   }
  ]
 },
 "aktuality": [
  {
   "datum": "2025-11-22",
   "nadpis": "Slánská brusle 2025",
   "text": "Na letošní Slánské brusli bylo k vidění 166 závodníků ve 13 kategoriích. Děkujeme všem partnerům, bez kterých by se závod nemohl konat.",
   "odkaz": "slanska-brusle.html"
  },
  {
   "datum": "2023-06-10",
   "nadpis": "Soustředění 2023",
   "text": "Letošní soustředění proběhne o měsíc dřív než obvykle, 14.–20. 8. 2023 na ZS ve Slaném. Obědy jsou zajištěné v restauraci na ZS, klub zajistí pitný režim a ovoce. Seznam „Co s sebou“ přijde e-mailem s rozpisem."
  }
 ],
 "klub": {
  "nazev": "Krasobruslařský klub královského města Slaného z.s.",
  "zkratka": "KK Slaný",
  "adresa": "Lacinova 1720, 274 01 Slaný",
  "telefon": "+420 723 427 989",
  "email": "kkslany@email.cz",
  "ico": "27053717",
  "ucet": "0398910329 / 0800",
  "facebook": "https://www.facebook.com/pages/Krasobrusla%C5%99sk%C3%BD-klub-Slan%C3%BD/167057709985872",
  "vedeni": [
   {
    "funkce": "Předseda klubu",
    "jmeno": "Pavel Křivánek",
    "telefon": "+420 723 427 989"
   },
   {
    "funkce": "Místopředseda klubu",
    "jmeno": "Karel Čtrnáctý"
   },
   {
    "funkce": "Pokladník",
    "jmeno": "Marie Lafantová"
   },
   {
    "funkce": "Hlavní trenér",
    "jmeno": "Pavla Stříbrská"
   },
   {
    "funkce": "Člen VV",
    "jmeno": "Dita Čtrnáctá"
   }
  ],
  "nabor": "Klub přijímá děti od 3 let přímo na trénincích, pokud je volná kapacita. Umět bruslit není podmínkou, potřeba jsou krasobruslařské brusle se zoubky. Stačí nejdřív zavolat a domluvit se."
 },
 "treneri": [
  {
   "jmeno": "Pavla Stříbrská",
   "kvalifikace": "trenér II. třídy",
   "foto": "img/treneri/pavla.jpg",
   "role": "Hlavní trenérka"
  },
  {
   "jmeno": "Dita Tuháčková",
   "kvalifikace": "trenér I. třídy",
   "foto": "img/treneri/dita.jpg"
  },
  {
   "jmeno": "Barbora Stříbrská",
   "kvalifikace": "trenér III. třídy",
   "foto": "img/treneri/bara.jpg"
  },
  {
   "jmeno": "Kateřina Macháčková",
   "kvalifikace": "trenér II. třídy",
   "foto": "img/treneri/katerina.jpg"
  },
  {
   "jmeno": "Marie Bártová",
   "kvalifikace": "trenér III. třídy",
   "foto": "img/treneri/marie.jpg",
   "role": "Základna"
  },
  {
   "jmeno": "Radka Hrubá",
   "kvalifikace": "taneční a pohybová průprava",
   "foto": "img/treneri/radkahr.jpg"
  }
 ],
 "zavodnici": {
  "sezona": "2024/2025",
  "zavodnici": [
   {
    "jmeno": "Markéta Pisková",
    "odRoku": 2014,
    "trenerka": "Barbora Stříbrská",
    "kategorie": "Adult",
    "rocnik": 2006,
    "foto": "img/zavodnici/marketa-piskova.jpg"
   },
   {
    "jmeno": "Nela Nechanická",
    "odRoku": 2015,
    "trenerka": "Pavla Stříbrská",
    "kategorie": "Dorostenky",
    "rocnik": 2009,
    "foto": "img/zavodnici/nela-nechanicka.jpg"
   },
   {
    "jmeno": "Veronika Bártová",
    "odRoku": 2015,
    "trenerka": "Dita Tuháčková",
    "kategorie": "Žačky",
    "rocnik": 2010,
    "foto": "img/zavodnici/veronika-bartova.jpg"
   },
   {
    "jmeno": "Pavlína Trojáková",
    "odRoku": 2015,
    "trenerka": "Dita Tuháčková",
    "kategorie": "Dorostenky A",
    "rocnik": 2010,
    "foto": "img/zavodnici/pavlina-trojakova.jpg"
   },
   {
    "jmeno": "Valerie Dobiášová",
    "odRoku": 2015,
    "trenerka": "Dita Tuháčková",
    "kategorie": "Žačky",
    "rocnik": 2011,
    "foto": "img/zavodnici/valerie-dobiasova.jpg"
   },
   {
    "jmeno": "Nicola Kunrtová",
    "odRoku": 2018,
    "trenerka": "Barbora Stříbrská",
    "kategorie": "Žačky",
    "rocnik": 2012,
    "foto": "img/zavodnici/nicola-kunrtova.jpg"
   },
   {
    "jmeno": "Anežka Kunstová",
    "odRoku": 2016,
    "trenerka": "Pavla Stříbrská",
    "kategorie": "Dorostenky A",
    "rocnik": 2010,
    "foto": "img/zavodnici/anezka-kunstova.jpg"
   },
   {
    "jmeno": "Kateřina Macháčková",
    "odRoku": 2018,
    "trenerka": "Pavla Stříbrská",
    "kategorie": "Žačky A",
    "rocnik": 2011,
    "foto": "img/zavodnici/katerina-machackova.jpg"
   },
   {
    "jmeno": "Nikol Hrubá",
    "odRoku": 2016,
    "trenerka": "Pavla Stříbrská",
    "kategorie": "Žačky A",
    "rocnik": 2011,
    "foto": "img/zavodnici/nikol-hruba.jpg"
   },
   {
    "jmeno": "Markéta Dunajová",
    "odRoku": 2018,
    "trenerka": "Barbora Stříbrská",
    "kategorie": "Žačky A",
    "rocnik": 2012,
    "foto": "img/zavodnici/marketa-dunajova.jpg"
   },
   {
    "jmeno": "Aneta Horáková",
    "odRoku": 2017,
    "trenerka": "Barbora Stříbrská",
    "kategorie": "Žačky mladší",
    "rocnik": 2012,
    "foto": "img/zavodnici/aneta-horakova.jpg"
   },
   {
    "jmeno": "Kristýna Hulínová",
    "odRoku": 2018,
    "trenerka": "Barbora Stříbrská",
    "kategorie": "Žačky mladší",
    "rocnik": 2012,
    "foto": "img/zavodnici/kristyna-hulinova.jpg"
   },
   {
    "jmeno": "Julie Hrubá",
    "odRoku": 2016,
    "trenerka": "Pavla Stříbrská",
    "kategorie": "Žactvo mladší",
    "rocnik": 2012,
    "foto": "img/zavodnici/julie-hruba.jpg"
   },
   {
    "jmeno": "Agáta Kolářová",
    "odRoku": 2017,
    "trenerka": "Barbora Stříbrská",
    "kategorie": "Žačky mladší",
    "rocnik": 2013,
    "foto": "img/zavodnici/agata-kolarova.jpg"
   },
   {
    "jmeno": "Viktorie Větrovská",
    "odRoku": 2018,
    "trenerka": "Dita Tuháčková",
    "kategorie": "Žačky nejmladší",
    "rocnik": 2013,
    "foto": "img/zavodnici/viktorie-vetrovska.jpg"
   },
   {
    "jmeno": "Anna Komárková",
    "odRoku": 2017,
    "trenerka": "Barbora Stříbrská",
    "kategorie": "Žačky nejmladší",
    "rocnik": 2014,
    "foto": "img/zavodnici/anna-komarkova.jpg"
   },
   {
    "jmeno": "Miroslav Kunst",
    "odRoku": 2020,
    "trenerka": "Pavla Stříbrská",
    "kategorie": "Žáci A",
    "rocnik": 2011,
    "foto": "img/zavodnici/miroslav-kunst.jpg"
   },
   {
    "jmeno": "Klára Svobodová",
    "odRoku": 2024,
    "trenerka": "Barbora Stříbrská",
    "kategorie": "Žačky mladší",
    "rocnik": 2014,
    "foto": "img/zavodnici/klara-svobodova.jpg"
   },
   {
    "jmeno": "Linda Dobiášová",
    "odRoku": 2018,
    "trenerka": "Dita Tuháčková",
    "kategorie": "Žačky nejmladší",
    "rocnik": 2014,
    "foto": "img/zavodnici/linda-dobiasova.jpg"
   },
   {
    "jmeno": "Denisa Hrdinová",
    "odRoku": 2020,
    "trenerka": "Dita Tuháčková",
    "kategorie": "Žačky nejmladší",
    "rocnik": 2014,
    "foto": "img/zavodnici/denisa-hrdinova.jpg"
   },
   {
    "jmeno": "Ella Šubrtová",
    "odRoku": 2022,
    "trenerka": "Pavla Stříbrská",
    "kategorie": "Žačky mladší A",
    "rocnik": 2014,
    "foto": "img/zavodnici/ella-subrtova.jpg"
   },
   {
    "jmeno": "Malvina Michálková",
    "odRoku": 2020,
    "trenerka": "Barbora Stříbrská",
    "kategorie": "Žačky nejmladší",
    "rocnik": 2015,
    "foto": "img/zavodnici/malvina-michalkova.jpg"
   },
   {
    "jmeno": "Karolína Talapková",
    "odRoku": 2022,
    "trenerka": "Dita Tuháčková",
    "kategorie": "Žačky mladší A",
    "rocnik": 2013,
    "foto": "img/zavodnici/karolina-talapkova.jpg"
   },
   {
    "jmeno": "Tereza Petrachová",
    "odRoku": 2023,
    "trenerka": "Dita Tuháčková",
    "kategorie": "Žačky mladší A",
    "rocnik": 2014,
    "foto": "img/zavodnici/tereza-petrachova.jpg"
   },
   {
    "jmeno": "Naďa Nováčková",
    "odRoku": 2022,
    "trenerka": "Dita Tuháčková",
    "kategorie": "Žačky nejmladší",
    "rocnik": 2016,
    "foto": "img/zavodnici/nada-novackova.jpg"
   },
   {
    "jmeno": "Adéla Hubáčková",
    "odRoku": 2022,
    "trenerka": "Dita Tuháčková",
    "kategorie": "Žačky nejmladší A",
    "rocnik": 2018,
    "foto": "img/zavodnici/adela-hubackova.jpg"
   },
   {
    "jmeno": "Ella Michálková",
    "odRoku": 2022,
    "trenerka": "Pavla Stříbrská",
    "kategorie": "Nováčci mladší A",
    "rocnik": 2019,
    "foto": "img/zavodnici/ella-michalkova.jpg"
   },
   {
    "jmeno": "Agáta Singerová",
    "odRoku": 2022,
    "trenerka": "Pavla Stříbrská",
    "kategorie": "Přípravka Nováčci mladší",
    "rocnik": 2019,
    "foto": "img/zavodnici/agata-singerova.jpg"
   },
   {
    "jmeno": "Anna Jelínková",
    "odRoku": 2023,
    "trenerka": "Pavla Stříbrská",
    "kategorie": "Nováčci mladší A",
    "rocnik": 2018,
    "foto": "img/zavodnici/anna-jelinkova.jpg"
   },
   {
    "jmeno": "Samuel Hrdina",
    "odRoku": 2022,
    "trenerka": "Dita Tuháčková",
    "kategorie": "Nováčci A",
    "rocnik": 2019,
    "foto": "img/zavodnici/samuel-hrdina.jpg"
   }
  ],
  "zakladna": {
   "trenerka": "Marie Bártová",
   "skupiny": [
    {
     "foto": "img/zavodnici/zakladna-1.jpg",
     "deti": "Sofie Adlerová, Jakub Dichter, Sára Adlerová, Anežka Jelenová, Štěpánka Jelenová"
    },
    {
     "foto": "img/zavodnici/zakladna-2.jpg",
     "deti": "Zuzanka, Julinka, Eda, Anička, Valinka"
    }
   ]
  }
 },
 "zavody": [
  {
   "sezona": "2024/2025",
   "zavody": [
    {
     "nazev": "Lounská bruslička, 19. 1. 2025",
     "sekce": [
      {
       "nazev": "Závod ČKS",
       "radky": [
        "dorostenky: 4. Nela Nechanická,",
        "žačky: 2. Verča Bártová, 3. Niky Kunrtová",
        "žačky ml.: 6. Anička Komárková, 11. Julča Hrubá, 12. Aneta Horáková, 16. Viky Větrovská, 18. Týnka Hulínová",
        "žačky nejml.: 20.. Deniska Hrdinová"
       ]
      },
      {
       "nazev": "Klubová soutěž",
       "radky": [
        "žačky A: 5. Kačka Macháčková",
        "žačky ml. A: 6.Ella Šubrtová"
       ]
      }
     ]
    },
    {
     "nazev": "Velka cena Litvínova, 11. 1. 2025",
     "sekce": [
      {
       "nazev": "Závod ČKS",
       "radky": [
        "dorostenky: 10. Nela Nechanická,",
        "žačky ml.: 18. Aneta Horáková, 19. Anička Komárková"
       ]
      }
     ]
    },
    {
     "nazev": "Poděbradské ledové srdce, 11. 1. 2025",
     "sekce": [
      {
       "nazev": "Závod ČKS",
       "radky": [
        "žacky: 2. Verča Bártová, 7. Valka Dobiášová",
        "žačky ml.: 12. Viky Větrovská",
        "žačky nejml.: 6. Linda Dobiášová"
       ]
      },
      {
       "nazev": "Klubová soutěž",
       "radky": [
        "žáci A: 1. Míra Kunst",
        "žačky ml. A - 19.Terka Petrachová"
       ]
      }
     ]
    },
    {
     "nazev": "Ledečská pirueta, 4. 1. 2025",
     "sekce": [
      {
       "nazev": "Závod ČKS",
       "radky": [
        "žačky - 12. Valka Dobiášová",
        "žačky nejml. 10. Linda Dobiášová"
       ]
      }
     ]
    },
    {
     "nazev": "Chomutovská Brusle, 14. 12. 2024",
     "sekce": [
      {
       "nazev": "Závod ČKS",
       "radky": [
        "žactvo: 5. Valerie Dobiášová",
        "žačky ml. : 9. Klára Svobodová"
       ]
      },
      {
       "nazev": "Klubová soutěž",
       "radky": [
        "dorostenky A: 3. Pája Trojáková",
        "žačky: 3. Kateřina Macháčková, 5. Markéta Dunajová",
        "žačky ml.: 4. Tereza Petrachová",
        "nováčci ml. dívky: 13. Anna Jelínková",
        "Ještědsko – turnovská bruslička, 8. 12 2024:"
       ]
      },
      {
       "nazev": "Klubová soutěž",
       "radky": [
        "žačky: 5. Markéta Dunajová"
       ]
      }
     ]
    },
    {
     "nazev": "Velká cena Mělníka, 7. 12. 2024",
     "sekce": [
      {
       "nazev": "Závod ČKS",
       "radky": [
        "žactvo: 8. Nicola Kunrtová",
        "žačky ml. : 5. Anna Komárková, 6. Julie Hrubá, 20. Viktorie Větrovská, 21. Klára Svobodová",
        "žačky nejml.: 2. Linda Dobiášová"
       ]
      },
      {
       "nazev": "Klubová soutěž",
       "radky": [
        "dorostenky A: 3. Anežka Kunstová",
        "žáci: 1: Miroslav Kunst",
        "žačky ml.: 10. Tereza Petrachová",
        "nováčci chlapci A: 2. Samuel Hrdina"
       ]
      }
     ]
    },
    {
     "nazev": "Bílinská bruslička, 30. 11. 2024",
     "sekce": [
      {
       "nazev": "Závod ČKS",
       "radky": [
        "dorostenky 1. Nela Nechanická",
        "žactvo: 1. Veronika Bártová, 4. Nicola Kunrtová",
        "žačky ml. : 4. Julie Hrubá, 11. Kristýna Hulínová",
        "žačky nejml.: 12. Malvína Michálková"
       ]
      },
      {
       "nazev": "Klubová soutěž",
       "radky": [
        "dorostenky A: 3. Anežka Kunstová",
        "žačky: 7. Markéta Dunajová",
        "žáci: 1: Miroslav Kunst",
        "žačky ml.: 1. Ella Šubrtová",
        "nováčci ml. dívky: 3. Anna Jelínková",
        "nováčci chlapci A: 1. Samuel Hrdina"
       ]
      }
     ]
    },
    {
     "nazev": "Slánská brusle - 23. 11. 2024",
     "sekce": [
      {
       "nazev": "Závod ČKS",
       "radky": [
        "Adult: 4 Markéta Pisková",
        "dorostenky 2. Nela Nechanická, 9. Pavlína Trojáková",
        "žactvo: 1. Veronika Bártová, 8. Valerie Dobiášová, 12. Nicola Kunrtová",
        "žačky ml. : 2. Aneta Horáková, 5. Anna Komárková, 6. Julie Hrubá, 14. Agáta Kolářová, 15. Viktorie Větrovská, 17. Kristýna Hulínová, 19. Klára Svobodová",
        "žačky nejml.: 6. Linda Dobiášová, 18. Malvína Michálková, 20. Naděžda Nováčková"
       ]
      },
      {
       "nazev": "Klubová soutěž",
       "radky": [
        "dorostenky A: 4. Anežka Kunstová",
        "žačky: 4. Kateřina Macháčková, 6. Markéta Dunajová",
        "žáci: 1: Miroslav Kunst",
        "žačky ml.: 12. Karolína Talapková, 13. Ella Šubrtová, 15. Tereza Petrachová",
        "žačky nejml.: 15. Adéla Hubáčková",
        "nováčci ml. dívky: 10. Anna Jelínková, 12. Ella Michálková",
        "nováčci chlapci A: 1. Samuel Hrdina",
        "nováčci ml. dívky-přípravka: 1. Agáta Singerová"
       ]
      },
      {
       "nazev": "Mezioddílový závod",
       "radky": [
        "přípravka 3: 2. Jakub Dichter, 4. Sára Adlerová",
        "přípravka 2: 4. Sofie Kriváčková, 5. Anežka Jelenová",
        "přípravka 1: 4. Štěpánka Jelenová"
       ]
      }
     ]
    },
    {
     "nazev": "VC PODŘÍPSKA Memoriál Karla Krejčího - 16. 11.",
     "sekce": [
      {
       "nazev": "Závod ČKS",
       "radky": [
        "Adult: 2. Markéta Pisková",
        "dorostenky 2. Nela Nechanická",
        "žactvo: 3. Veronika Bártová, 9. Valerie Dobiášová",
        "žactvo ml. : 16. Aneta Horáková, 18. Anna Komárková, 21. Viktorie Větrovská, 24. Kristýna Hulínová",
        "žactvo nejml.: 15. Malvína Michálková"
       ]
      },
      {
       "nazev": "Klubová soutěž",
       "radky": [
        "žactvo: 3. Kateřina Macháčková",
        "žactvo ml.: 14. Ella Šubrtová, 15. Tereza Petrachová",
        "nováčci ml. dívky: 8. Ella Michálková"
       ]
      }
     ]
    },
    {
     "nazev": "Memoriál Karla Diviše, Dvůr Králové, 10.11.2024 - klubová soutěž",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Dorostenky: 1. Anežka Kunstová",
        "Žačky nejm.: 11. Deniska Hrdinová",
        "Žačky ml.: 15. Vikča Větrovská"
       ]
      }
     ]
    },
    {
     "nazev": "Malá cena Teplic, 3. 11. 2024 - klubová soutěž",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Dorostenky: 1. Nela Nechanická",
        "Novacci chlapci: 1. Sam Hrdina",
        "Žačky nejm.: 13. Deniska Hrdinová"
       ]
      }
     ]
    },
    {
     "nazev": "Velká cena Náchoda, 2. 11. 2024 - závod Českého poháru",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žačky: 3. Verča Bártová"
       ]
      }
     ]
    },
    {
     "nazev": "Velká cena Ústí nad Labem, 26. 10. 2024 - závod Českého poháru",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žacky ml.: 22. Anetka Horáková"
       ]
      }
     ]
    },
    {
     "nazev": "Velká cena Teplic, 19. 10. 2024 - závod Českého poháru",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Dorostenky: 13. Pája Trojáková",
        "Žačky: 7. Valka Dobiášová, 13. Verča Bártová",
        "Žacky ml.: 22. Týnka Hulínová, 24. Agi Kolářová",
        "Žacky nejml.: 16. Linda Dobiášová"
       ]
      }
     ]
    }
   ]
  },
  {
   "sezona": "2023/2024",
   "zavody": [
    {
     "nazev": "Rokycanské ostří - 10. března 2024",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žačky mladší B: 1. Valka Dobiášová",
        "Žactvo C: 6. Kačka Macháčková",
        "Žactvo mladší C: 9. Týnka Hulínová",
        "Nováčci st. dívky B: 7. Naďa Nováčková"
       ]
      }
     ]
    },
    {
     "nazev": "Teplická bruslička - 25. února 2024",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žačky B: 13. Verča Bártová",
        "Žactvo C: 3. Pája Trojáková, 5. Kačka Macháčková, 6. Anežka Kunstová"
       ]
      }
     ]
    },
    {
     "nazev": "Kralupská klička - 17. února 2024",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Adult A: 1. Markéta Pisková",
        "Žačky mladší B: 6. Niky Kunrtová, 9. Valka Dobiášová",
        "Žačky nejmladší B: 9. Anička Komárková, 13. Linda Dobiášová",
        "Žactvo C: 15. Niky Kazatelová",
        "Žactvo mladší C: 3. Anetka Horáková, 4. Julka Hrubá, 6. Týnka Hulínová, 7. Míra Kunst",
        "Žactvo nejml. C: 19. Deniska Hrdinová, 22. Ella Šubrtová",
        "Nováčci st. dívky B: 9. Naďa Nováčková"
       ]
      }
     ]
    },
    {
     "nazev": "Podkrušnohorská bruslička Litvínov - 11. února 2024",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žačky ml. B: 2 Niky Kunrtová",
        "Žačky C: 9. Anežka Kunstová",
        "Žačky ml. C: 2. Anetka Horáková, 10. Míra Kunst, 16. Julča Hrubá, 20. Kristýnka Hulínová",
        "Žačky nejml. C: 15. Ella Šubrtová"
       ]
      }
     ]
    },
    {
     "nazev": "Velká cená Mostu (pohár ČKS) - 10. února 2024",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žačky: 11. Verča Bártová",
        "Žačky mladší: 6. Valka Dobiášová",
        "Žačky nejml.: 13. Anička Komárková"
       ]
      }
     ]
    },
    {
     "nazev": "Křišťálová brusle Děčín - 3. února 2024",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žačky mladší B: 3. Niky Kunrtová",
        "Žačky nejml. B: 11. Linda Dobiášová",
        "Žactvo C: 5. Pavča Trojáková, 7. Kačka Macháčková, 10. Anežka Kunstová",
        "Žactvo mladší C: 7. Agi Kolářová"
       ]
      }
     ]
    },
    {
     "nazev": "Chebský Špalíček - 27. ledna 2024",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žactvo ml. C: 2. Julka Hrubá",
        "Začátečník ml.: 3 Kája Talapková"
       ]
      }
     ]
    },
    {
     "nazev": "Poděbradské ledové srdce - 20. ledna 2024",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žačky B: 4. Verča Bártová",
        "Žačky ml. B: 2. Valka Dobiášová",
        "Žactvo C: 11. Pája Trojáková",
        "Žactvo ml. C: 10. Julka Hrubá"
       ]
      }
     ]
    },
    {
     "nazev": "VC Litvínov (pohár ČKS) - 13. ledna 2024",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žačky mladší: 11. Valka Dobiášová, 15. Niky Kunrtová",
        "Žačky nejml.: 11. Anička Komárková, 29. Linda Dobiášová"
       ]
      }
     ]
    },
    {
     "nazev": "Lounská bruslička - 6. ledna 2024",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žačky B: 10. Verča Bártová, 14. Nela Nechanická",
        "Žačky mladší B: 8. Niky Kunrtová",
        "Žactvo C: 10. Kačka Macháčková, 12. Anežka Kunstová",
        "Žactvo mladší C: 2. Julča Hrubá, 6. Anetka Horáková, 13. Agi Kolářová, 18. Týnka Hulínová, 19. Míra Kunst",
        "Žactvo nejml. C: 21. Ella Šubertová, 23. Deniska Hrdinová, 24. Malvinka Michálková",
        "Přípravka 1: 3. Ellinka Michálková, 6. Agátka Singerová, 9. Anička Jelínková, 15. Sofinka Stahl",
        "Přípravka 2: 13. Samuel Hrdina"
       ]
      }
     ]
    },
    {
     "nazev": "Velká cena Mělníka - 9. prosince 2023",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žačky mladší B: 1. Niky Kunrtová",
        "Žačky nejmladší B: 4. Linda Dobiášová",
        "Žactvo C: 5. Kačka Macháčková, 6. Pavča Trojáková",
        "Žactvo mladší C: 3. Julča Hrubá, 5. Anetka Horáková",
        "Žactvo nejml. C: 24. Malvinka Michálková, 25. Deniska Hrdinová",
        "Přípravka Nováčci starší: 3. Naďa Nováčková",
        "Přípravka žactvo nejmladší: 1. Domča Vacovská"
       ]
      }
     ]
    },
    {
     "nazev": "VC Chomutova - 9. prosince 2023",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žačky B: 14. Nela Nechanická",
        "Žačky mladší B: 5. Valka Dobiášová",
        "Žačky nejmladší B: 13 Anička Komárková, 26. Viky Větrovská"
       ]
      }
     ]
    },
    {
     "nazev": "Bílinská bruslička - 2. prosince 2023",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žačky B: 3. Nela Nechanická, 4. Verča Bártová",
        "Žačky mladší B: 7. Niky Kunrtová",
        "Žactvo C: 5. Pavča Trojáková, 8. Anežka Kunstová, 10. Niky Kazatelová",
        "Žactvo mladší C: 3. Anetka Horáková, 4. Agi Kolářová, 7. Julka Hrubá, 8. Míra Kunst, 16. Týnka Hulínová"
       ]
      }
     ]
    },
    {
     "nazev": "Slánská brusle - 25. listopad 2023",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Adult A: 1. Markéta Pisková",
        "Žačky B: 4. Nela Nechanická, 6. Verča Bártová",
        "Žactvo C: 5. Kačka Macháčková, 7. Pavča Trojáková, 11. Anežka Kunstová, 14. Niky Kazatelová",
        "Žačky mladší B: 1. Valka Dobiášová, 7. Niky Kunrtová",
        "Žactvo mladší C: 1. Julka Hrubá, 8. Anetka Horáková, 12. Agi Kolářová, 14. Týnka Hulínová, 15. Míra Kunst",
        "Žačky nejmladší B: 1. Anička Komárková, 6. Linda Dobiášová, 10. Viky Větrovská",
        "Žactvo nejml. C: 16. Deniska Hrdinová, 17. Elli Šubrtová, 19. Malvinka Michálková",
        "Začátečník mladší: 4. Kája Talapková",
        "Přípravka Nováčci starší: 1. Naďa Nováčková",
        "Přípravka žactvo nejmladší: 1. Domča Vacovská",
        "Přípravka 1: 2. Ellinka Michálková, 7. Anička Jelínková, 10. Sofinka Stahl",
        "Přípravka 2: 17. Adélka Hubáčková, 24. Samuel Hrdina"
       ]
      }
     ]
    },
    {
     "nazev": "Velká cena Podřipska - Memoriál Karla Krejčího- Roudnice nad Labem - 18. listopadu 2023",
     "sekce": [
      {
       "nazev": "",
       "radky": [
        "Žačky B: 3. Verča Bártová",
        "Žactvo C: 6. Pavča Trojáková",
        "Žačky mladší B: 3. Valka Dobiášová, 7. Niky Kunrtová",
        "Žactvo mladší C: 4. Anetka Horáková, 5. Agi Kolářová, 12. Týnka Hulínová",
        "Žačky nejmladší B: 11. Anička Komárková, 12. Viky Větrovská, 16. Linda Dobiášová,",
        "Žactvo nejml. C: 21. Elli Šubrtová"
       ]
      }
     ]
    }
   ]
  }
 ],
 "galerie": [
  {
   "kategorie": "Soustředění",
   "nazev": "Soustředění 2024",
   "rok": 2024,
   "url": "https://photos.app.goo.gl/XujPkSfQjvcQbnBg8"
  },
  {
   "kategorie": "Soustředění",
   "nazev": "Soustředění 2023",
   "rok": 2023,
   "url": "https://photos.app.goo.gl/opRhMQs21wsvPPfL6"
  },
  {
   "kategorie": "Soustředění",
   "nazev": "Soustředění 2022",
   "rok": 2022,
   "url": "https://photos.app.goo.gl/N3xpynune3fje1zXA"
  },
  {
   "kategorie": "Soustředění",
   "nazev": "Soustředění 2021",
   "rok": 2021,
   "url": "https://photos.app.goo.gl/w649hdEk2juqAtvS9"
  },
  {
   "kategorie": "Soustředění",
   "nazev": "Soustředění 2019",
   "rok": 2019,
   "url": "https://photos.app.goo.gl/FLeXjAHaK8dptYNH7"
  },
  {
   "kategorie": "Soustředění",
   "nazev": "Soustředění 2014",
   "rok": 2014,
   "url": "https://photos.app.goo.gl/5RaV2tBLANoCcC3ZA"
  },
  {
   "kategorie": "Soustředění",
   "nazev": "Soustředění 2013",
   "rok": 2013,
   "url": "https://photos.app.goo.gl/2LgdsW31hk5K8ADN9"
  },
  {
   "kategorie": "Soustředění",
   "nazev": "Soustředění 2011",
   "rok": 2011,
   "url": "https://photos.app.goo.gl/99oh8afN5Ak81asv6"
  },
  {
   "kategorie": "Soustředění",
   "nazev": "Soustředění 2010",
   "rok": 2010,
   "url": "https://photos.app.goo.gl/vpKckwPHquSbbX7x8"
  },
  {
   "kategorie": "Soustředění",
   "nazev": "Soustředění 2009",
   "rok": 2009,
   "url": "https://photos.app.goo.gl/5ycy3f9VAS8VyRNQA"
  },
  {
   "kategorie": "Soustředění",
   "nazev": "Soustředění 2008",
   "rok": 2008,
   "url": "https://photos.app.goo.gl/ZzZkWNJ21yS6Gd1s8"
  },
  {
   "kategorie": "Soustředění",
   "nazev": "Soustředění 2007",
   "rok": 2007,
   "url": "https://photos.app.goo.gl/mAptSkHZuTfuGLkK7"
  },
  {
   "kategorie": "Soustředění",
   "nazev": "Soustředění 2005",
   "rok": 2005,
   "url": "https://photos.app.goo.gl/PC6rtaUJz1jsc4aWA"
  },
  {
   "kategorie": "Slánská brusle",
   "nazev": "Slánská brusle 2023",
   "rok": 2023,
   "url": "https://photos.app.goo.gl/tS93cdDxBfpPWxrf7"
  },
  {
   "kategorie": "Slánská brusle",
   "nazev": "Slánská brusle 2015",
   "rok": 2015,
   "url": "https://photos.app.goo.gl/3DsGp82P73s2ezjE6"
  },
  {
   "kategorie": "Slánská brusle",
   "nazev": "Slánská brusle 2014",
   "rok": 2014,
   "url": "https://goo.gl/photos/rnKjhPWd2nwrUPYdA"
  },
  {
   "kategorie": "Slánská brusle",
   "nazev": "Slánská brusle 2013",
   "rok": 2013,
   "url": "https://photos.app.goo.gl/x3oQ9Nk5mf1fr3dx6"
  },
  {
   "kategorie": "Slánská brusle",
   "nazev": "Slánská brusle 2012",
   "rok": 2012,
   "url": "https://photos.app.goo.gl/LFnsYPEgzG5xYDYx8"
  },
  {
   "kategorie": "Slánská brusle",
   "nazev": "Slánská brusle 2011",
   "rok": 2011,
   "url": "https://photos.app.goo.gl/Ju3BJDauaY9XRJnd9"
  },
  {
   "kategorie": "Slánská brusle",
   "nazev": "Slánská brusle 2010",
   "rok": 2010,
   "url": "https://photos.app.goo.gl/UHZ7ksnFF5Y22ooZA"
  },
  {
   "kategorie": "Slánská brusle",
   "nazev": "Slánská brusle 2009",
   "rok": 2009,
   "url": "https://photos.app.goo.gl/AyqTxbSzAbGt39xz8"
  },
  {
   "kategorie": "Slánská brusle",
   "nazev": "Slánská brusle 2008",
   "rok": 2008,
   "url": "https://photos.app.goo.gl/TbPcjFmXpPTXUGHk8"
  },
  {
   "kategorie": "Slánská brusle",
   "nazev": "Slánská brusle 2007",
   "rok": 2007,
   "url": "https://photos.app.goo.gl/mGLFGtAC7gxWWYNU8"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Vánoční karneval 2023",
   "rok": 2023,
   "url": "https://photos.app.goo.gl/4rsmpszqogJcrPLC7"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Mikulášská 2023",
   "rok": 2023,
   "url": "https://photos.app.goo.gl/FyayeG7aSCsyUnD79"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Vánoční karneval 2022",
   "rok": 2022,
   "url": "https://photos.app.goo.gl/muSEMEnv9HJQMwSj6"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Vánoční karneval 2021",
   "rok": 2021,
   "url": "https://photos.app.goo.gl/Km3ZCvPthodjSV978"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Mikulášská 2021",
   "rok": 2021,
   "url": "https://photos.app.goo.gl/dAiAH5etSyvjak8u9"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Mikulášská 2014",
   "rok": 2014,
   "url": "https://photos.app.goo.gl/zfGo5G3q9BXgrYV8A"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Vánoční karneval 2013",
   "rok": 2013,
   "url": "https://photos.app.goo.gl/XUDum6eMUUGbBRZ97"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Mikulášská 2013",
   "rok": 2013,
   "url": "https://photos.app.goo.gl/ULWtBLCVmLy67ucMA"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Mikulášská 2011",
   "rok": 2011,
   "url": "https://photos.app.goo.gl/K4Mas9CLEAc3rnCy5"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Vánoční karneval 2010",
   "rok": 2010,
   "url": "https://photos.app.goo.gl/HxDYednpznuSfzzo7"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Mikulášská 2010",
   "rok": 2010,
   "url": "https://photos.app.goo.gl/Dt71pkHUqFy7HJop8"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Mikulášská 2009",
   "rok": 2009,
   "url": "https://photos.app.goo.gl/wXfZSn8r4FgC4hyY7"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Vánoční karneval 2008",
   "rok": 2008,
   "url": "https://photos.app.goo.gl/cTUTHp7FBT1SxqWc8"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Mikulášská 2008",
   "rok": 2008,
   "url": "https://photos.app.goo.gl/hpPxh5uqrVTYLxkg7"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Vánoční karneval 2007",
   "rok": 2007,
   "url": "https://photos.app.goo.gl/jtgtzPVvCihEcsq87"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Mikulášská 2007",
   "rok": 2007,
   "url": "https://photos.app.goo.gl/QPnfQsapAyHKb3xz6"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Vánoční karneval 2006",
   "rok": 2006,
   "url": "https://photos.app.goo.gl/w93vMjs11RVDptNf7"
  },
  {
   "kategorie": "Mikuláš a Vánoce",
   "nazev": "Mikulášská 2006",
   "rok": 2006,
   "url": "https://photos.app.goo.gl/h6dN6D5kD4P8tfht5"
  },
  {
   "kategorie": "Ostatní",
   "nazev": "Exibice Queen Slaný 2024",
   "rok": 2024,
   "url": "https://photos.app.goo.gl/AM44tCHpYGTTedj76"
  },
  {
   "kategorie": "Ostatní",
   "nazev": "Jesenice 2014",
   "rok": 2014,
   "url": "https://photos.app.goo.gl/1keyrbgG3sywhuYs8"
  },
  {
   "kategorie": "Ostatní",
   "nazev": "Soseň 2011",
   "rok": 2011,
   "url": "https://photos.app.goo.gl/PoqXR3vUWQufqAq17"
  },
  {
   "kategorie": "Ostatní",
   "nazev": "Mšec 2010",
   "rok": 2010,
   "url": "https://photos.app.goo.gl/vpzGr4Gun4nDQSww7"
  },
  {
   "kategorie": "Ostatní",
   "nazev": "Mšec 2009",
   "rok": 2009,
   "url": "https://photos.app.goo.gl/kASziQhEgxcgwQU48"
  },
  {
   "kategorie": "Ostatní",
   "nazev": "Lanové centrum 2009",
   "rok": 2009,
   "url": "https://photos.app.goo.gl/ivU6qPcRKFGJ7MM7A"
  },
  {
   "kategorie": "Ostatní",
   "nazev": "Dětský den 2009",
   "rok": 2009,
   "url": "https://photos.app.goo.gl/jLzPNPLr31C398uGA"
  },
  {
   "kategorie": "Ostatní",
   "nazev": "Mšec 2008",
   "rok": 2008,
   "url": "https://photos.app.goo.gl/wu6rwKDCjxgErXFq8"
  },
  {
   "kategorie": "Ostatní",
   "nazev": "Zakončení sezóny 2007",
   "rok": 2007,
   "url": "https://photos.app.goo.gl/u6mZEjHtA82rBrAE7"
  },
  {
   "kategorie": "Ostatní",
   "nazev": "1. narozeniny KK Slaný",
   "rok": null,
   "url": "https://goo.gl/photos/ks2YnwwrGYjXz7V39"
  },
  {
   "kategorie": "Ostatní",
   "nazev": "Exhibice Kladno 2006",
   "rok": 2006,
   "url": "https://photos.app.goo.gl/zCbHkoxNjBVH31Y1A"
  }
 ]
};
