# potok saobraćajke

Uvoz saobraćajnih nezgoda u Potok. Aplikacija u pregledaču čita xlsx fajlove MUP-a sa data.gov.rs (sve nezgode u Srbiji od 2015. godine) i za svaku nezgodu pravi podgrupu sa mestom na mapi, pinom i opisom. Nezgode se zatim gledaju u aplikaciji Mapa (potok-mapa) iste grupe.

Napravljena je po šablonu [potok-vite](https://github.com/aberged/potok-vite/tree/align-alt-descriptions): Vite, TypeScript, Tailwind, daisyUI sa prefiksom `d-` i lit-html. Jedina zavisnost za podatke je [fflate](https://github.com/101arrowz/fflate) (MIT), koja raspakuje xlsx. SheetJS se ne koristi, jer je njegova verzija na npm-u zastarela i ranjiva.

## Šta traži od Potoka

Uvoz radi samo na proširenom Potok serveru:

- **`createChildren`**: grupno pravljenje podgrupa, do 100 po pozivu, sa ključem (`key`), mestom (`lat`, `lng`) i pinom;
- **pin `warning`** (Upozorenje) u `getMapConfig().pins.icons`, uz postojeće `problem` i `transport`.

Na starijem serveru aplikacija to kaže na prvom ekranu i ne nudi uvoz. Isto važi kad server na poziv odgovori `unknown_method`.

## Postavljanje

1. Napravi javni koren, na primer „Saobraćajne nezgode“, a ispod njega po jednu grupu za svaku godinu: „Nezgode 2015“, „Nezgode 2016“… Grupa godine se pravi iz preseta Mapa, javna je i ne nasleđuje članove. Mapa ostaje u podrazumevanom opisu.
2. U grupi godine otvori **Izmeni grupu → Alternativni opisi → Novi opis**. Nazovi ga „Uvoz“, uključi **Koristi API**, nalepi ceo sadržaj `dist/potok-build.html` i klikni **Sačuvaj opis**.
3. Otvori opis „Uvoz“ na stranici grupe. U pregledu u formi za izmenu aplikacija ne radi (greška `preview`).

Godina se čita iz naziva grupe („Nezgode 2025“ → 2025): uvoze se samo nezgode iz te godine, a redovi iz drugih godina se preskaču kao „druga godina“. Godina može da se promeni i na ekranu. Ako je polje prazno, ili naziv nema godinu, uvoze se sve godine.

**Poseban profil.** Uvoz radi u ime onoga ko ga pokreće: svaka nova grupa upisuje autora kao člana i admina. Zato je bolje da uvoz radi poseban profil, na primer „Saobraćajke uvoz“, koji je admin grupa godina, a ne nečiji lični profil. Jedna godina daje oko 33.000 članstava. Profil treba da ima prava `edit_group` i `create_subgroups` u grupi godine (`can_manage_children` i `can_create_children` iz `getGroup`).

## Kako radi

1. **Provera:** `createChildren` postoji, `getGroup()` daje prava za pravljenje podgrupa, a `getMapConfig()` ima pinove `warning`, `problem` i `transport`.
2. **Izbor fajlova:** jedan ili više xlsx fajlova. Više fajlova se spaja u jedan uvoz.
3. **Čitanje** na glavnoj niti, deo po deo, sa trakom napretka. Godina traje oko sekunde. Web Worker nije potreban, a blob worker u okviru bez `allow-same-origin` nije pouzdan.
4. **Pregled:** broj redova, nezgoda i nezgoda po posledicama, preskočeni redovi po razlozima, sa do pet primera, nezgode sa više situacija i sukobi posledica. Tri primera opisa stižu kroz `previewDescription`, onako kako ih server prikazuje (u elementu `rich-content`).
5. **Uvoz:** traka napretka, napravljeno, već postojalo, neuspelo, brzina u poslednjih 30 s i preostalo vreme, uz pauzu i nastavak. Kartica mora da ostane otvorena.
6. **Izveštaj:** brojevi i CSV svih preskočenih i neuspelih redova, kao fajl za preuzimanje (Blob link) i kao tekst za kopiranje, ako okvir ne dozvoli preuzimanje.

### Jedna nezgoda, jedna podgrupa

Isti ID u više redova je jedna nezgoda sa više situacija (oko 2.250 ID-jeva u svim fajlovima, svaki u svom fajlu). Nezgoda je jedna podgrupa, a sve vrste i situacije idu u njen opis. Ako bi redovi istog ID-ja navodili različite posledice, uzimaju se najteže, a pregled to broji kao sukob. U fajlovima do 2026. takvih nema.

| | |
|---|---|
| ključ | `mup:<ID>`: ponovni uvoz ne pravi duplikate, jer server postojeću grupu vraća sa `created: false` |
| naziv | `Povređeni · Barajevo · 05.01.2025. 18:50` (`Poginuli`, `Materijalna šteta`), najviše 120 znakova |
| pin | poginuli → `problem`, povređeni → `warning`, materijalna šteta → `transport` |
| mesto | `lat`, `lng` na 6 decimala |
| vidljivost | javna (`isPublic: true`), ne nasleđuje članove (`inheritsMembers: false`) |

Opis je markdown, uvek latinicom. Server ga renderuje uz `breaks: true`, pa blokove razdvaja prazan red:

```markdown
## Saobraćajna nezgoda sa povređenim licima

**Nedelja, 5. januar 2025. u 18:50** · Barajevo (PU Beograd)

- **Posledice:** povređena lica
- **Vrsta:** nezgoda sa parkiranim vozilima
- **Situacija:** Ostali sudari sa parkiranim vozilom
- **Doba dana:** veče
- **Mesto:** [44.619215, 20.366175](https://www.openstreetmap.org/?mlat=44.619215&mlon=20.366175#map=18/44.619215/20.366175)

Izvor: MUP Republike Srbije, data.gov.rs, 2025. · ID nezgode: 1510533
```

Nezgoda sa više vrsta ima red „Vrste:“, a sa više situacija ugnežđenu listu pod „Situacije:“. Doba dana: noć 22–05, jutro 05–09, prepodne 09–12, popodne 12–17, veče 17–22. Dan u nedelji se računa preko `Date.UTC`, pa vremenska zona gledaoca ne pomera nezgodu na drugi dan. Tekst iz fajla se escapuje za markdown.

**Izvor:** podnožje dolazi iz konstante `SOURCE` u [src/describe/describe.ts](src/describe/describe.ts). Pre prvog uvoza na produkciji treba proveriti tačan naziv skupa podataka, njegov URL na data.gov.rs i tekst licence, pa ih upisati tamo.

### Anomalije u podacima

Fajlovi nemaju zaglavlje i imaju 9 kolona: ID, policijska uprava, opština, `dd.mm.yyyy,HH:MM`, dužina, širina, posledice, vrsta i situacija. Ako prva ćelija (A1) nije broj, prvi red se smatra zaglavljem i preskače se.

- **Koordinate 2024:** brojevi bez decimalne tačke, sa promenljivim brojem cifara (`20358773`, `2041225`, `20255599344`). Tačka ide posle prve dve cifre, jer je Srbija uvek između 18 i 23° E i 41 i 46° N. Zarez se čita kao decimalna tačka.
- **Koordinate kao brojevi ili tekst:** neke godine ih pišu kao tekst, a neke kao brojeve. Čitaju se isto.
- **Float šum** (`44.592669999999998`) se zaokružuje na 6 decimala.
- **Zamenjene dužina i širina** se okreću. Red koji ni posle toga nije u Srbiji (širina 41,8–46,3, dužina 18,8–23,1) preskače se kao „van Srbije“. U 2024. takva su 2 reda, sa dužinom `45767` i `45797`. Treći čudan red iz 2024. (ID 1497334) ima širinu u naučnom zapisu, `4.5249694523101998E+18`: to su iste cifre bez tačke kao kod ostalih, pa postaje 45,249695 i ostaje (Novi Sad).
- **Datum** se čita kao `dd.mm.yyyy,HH:MM`, a ako je ćelija Excelov broj dana, i tako. Nevažeći datum se preskače kao „loš datum“.
- **Verzal i artefakti** (`NAJMANjE`, `SKRETANjA`, `Sa mat.stetom`, `Sa povredjenim`, en-crta ili crtica) prolaze kroz tabele prevoda u [src/data/lookups.ts](src/data/lookups.ts). Nepoznate posledice preskaču red. Nepoznata vrsta ostaje kako je u fajlu, sa velikim početnim slovom, a pregled je broji.
- **Nazivi** dobijaju veliko početno slovo, po pravilima `AreaImport.title_case/1` iz potok-ide: „PETROVAC NA MLAVI“ → „Petrovac na Mlavi“, „KNjAŽEVAC“ → „Knjaževac“. Opština uvek ide sa PU, jer „Palilula“ postoji i u Beogradu i u Nišu.
- **Razmak pre zareza** u situacijama (`van raskrsnice , bez`) se briše.
- **Ćelije:** deljeni stringovi (`t="s"`), inline (`t="inlineStr"`), formule (`t="str"`) i brojevi, uz XML entitete i Excelove `_xHHHH_` oznake.

Stanje fajlova od 11. 11. 2026, dobijeno sa `ALL_YEARS=1 npm test`:

| fajl | redova | nezgoda | preskočeno |
|---|---:|---:|---:|
| 2015 | 6.763 | 6.703 | 0 |
| 2016 | 36.165 | 35.974 | 0 |
| 2017 | 36.672 | 36.472 | 0 |
| 2018 | 35.993 | 35.818 | 0 |
| 2019 | 35.956 | 35.744 | 0 |
| 2020 | 30.891 | 30.687 | 0 |
| 2021 | 34.751 | 34.533 | 0 |
| 2022 | 33.399 | 33.191 | 0 |
| 2023 | 32.974 | 32.747 | 0 |
| 2024 | 32.330 | 32.131 | 2 van Srbije |
| 2025 | 33.415 | 33.187 | 0 |
| 2026 (do 30. 9.) | 25.878 | 25.679 | 0 |

### Slanje i nastavak

- **Paketi** počinju od 50 nezgoda i kreću se između 25 i 100, tako da jedan poziv traje 1–2 s. Svaki poziv troši jedan token limita upisa.
- **`rate_limited`:** čeka 1, 2, pa 4 s i šalje isti paket ponovo.
- **Poziv bez odgovora** (SDK odustaje posle 10 s), `disconnected`, `timeout` ili `conflict`: isti paket ide ponovo, uz pauzu koja raste do 30 s. Ključevi čine to bezbednim: ono što je server već napravio vraća se sa `created: false` i broji se kao „već postojalo“.
- **`invalid_group` sa `index`:** server nije sačuvao ništa. Ta nezgoda se beleži kao neuspela i ide u CSV, a ostatak paketa se šalje ponovo. Bez `index`-a, i za `too_large`, paket se deli na pola.
- **`forbidden`, `stale_app`, `unknown_method`** i nepoznate greške zaustavljaju uvoz, uz jasnu poruku.

Posle svakog paketa aplikacija u `localStorage` upisuje samo otisak i potvrđen indeks, nikad same podatke (oko 150 bajtova, a aplikacija ima 256 KB). Otisak čine imena, veličine i vreme izmene fajlova, broj nezgoda i heš prvih i poslednjih 100 ključeva. Potok ponovo učitava aplikaciju posle prekida veze. Kad se posle toga izaberu isti fajlovi, pregled nudi nastavak od paketa pre poslednjeg potvrđenog.

## Brzi start

```sh
npm install
npm run dev      # lokalno, na portu 5180, uz dev mock potok API-ja
npm test
npm run build    # tsc + vite build → dist/potok-build.html
```

U dev režimu [src/dev-tools.ts](src/dev-tools.ts) upisuje config mape sa pinovima `problem`, `warning` i `transport` (`potok-dev:map-config`) i grupu „Nezgode 2025“ (`potok-dev:group`), pa provera prolazi. Parametri:

- `?group=Nezgode%202015` daje drugi naziv grupe, pa i godinu;
- `?lang=en` ili `?lang=sr-Cyrl` menja jezik;
- `?pins=old` igra server bez pina `warning`, a `?rights=none` gledaoca koji ne sme da pravi podgrupe.

Dev mock pravi grupe odmah, a cela godina ne staje u `localStorage`, pa grupe žive do sledećeg učitavanja. Markdown u primerima opisa ostaje običan tekst, jer pravi prikaz daje tek server. Za novi početak pokreni `localStorage.clear()`.

## Testovi

`npm test` pokreće vitest:

- [src/xlsx/sheet.test.ts](src/xlsx/sheet.test.ts): zip, workbook i relacije, deljeni i inline stringovi, formule, brojevi, entiteti, `_xHHHH_` i zaglavlje;
- [src/data/data.test.ts](src/data/data.test.ts): prvi red 2025, koordinate 2024, float šum, ID 1110717 u dva reda, `NAJMANjE` sa en-crtom i crticom, `" , "`, nazivi, red van Srbije, loš datum, sukob posledica, filter godine;
- [src/describe/describe.test.ts](src/describe/describe.test.ts): dani u nedelji (5. 1. 2025. je nedelja, 19. 11. 2015. četvrtak), doba dana, naziv, pin, opis iz plana, escapovanje;
- [src/import/runner.test.ts](src/import/runner.test.ts): runner sa lažnim API-jem (`rate_limited` pa uspeh, timeout pa `created: false`, neispravan indeks, pauza, nastavak od kursora), kursor i CSV;
- [src/real-files.test.ts](src/real-files.test.ts): pravi fajlovi iz `../saobracajke`, ako postoje. Za 2015: 6.763 reda, nezgoda koliko i različitih ID-jeva, nijedan red van Srbije. Za 2024: tačno 2 reda van Srbije, a red u naučnom zapisu ostaje. Bez fajlova se ti testovi preskaču. `ALL_YEARS=1 npm test` čita sve godine i ispisuje brojeve iz tabele iznad.

## Jezici

Stranica Potoka upisuje jezik u `<html lang>` okvira: `sr`, `sr-Cyrl` ili `en`. Reči aplikacije su u [src/i18n.ts](src/i18n.ts). Srpski je referenca, a ćirilica se računa iz njega. Nazivi i opisi podgrupa su podaci: pišu se jednom, za sve, uvek latinicom.

## Struktura

| Fajl | Šta je |
|---|---|
| [index.html](index.html) | koren aplikacije i opis za karticu linka, koji mora da bude u `<body>` |
| [src/main.ts](src/main.ts) | ulaz |
| [src/xlsx/](src/xlsx/) | `unzip.ts` (fflate, samo prvi list i deljeni stringovi) i `sheet.ts` (redovi, ćelije, zaglavlje) |
| [src/data/](src/data/) | `lookups.ts` (tabele za posledice i vrstu), `title-case.ts`, `normalize.ts` (red → nezgoda ili razlog preskakanja), `accidents.ts` (grupisanje po ID-ju, godina, rezime), `read.ts` (fajlovi → redovi, deo po deo) |
| [src/describe/](src/describe/) | `dates.ts` (dani, meseci, doba dana) i `describe.ts` (naziv, pin, opis, `SOURCE`) |
| [src/import/](src/import/) | `children.ts` (nezgoda → `PotokNewChild`), `runner.ts` (paketi i greške), `cursor.ts` (otisak i nastavak), `report.ts` (CSV) |
| [src/store/](src/store/) | stanje i akcije |
| [src/views/](src/views/) | lit-html ekrani: izbor fajlova, pregled, uvoz, izveštaj |
| [src/views/icons.ts](src/views/icons.ts) | Heroicons, piše ga [scripts/icons.py](scripts/icons.py) iz `../potok-ide/deps/heroicons` |
| [src/dev-tools.ts](src/dev-tools.ts), [src/dev-theme.css](src/dev-theme.css) | samo za dev |
| [src/potok.ts](src/potok.ts), [src/potok-dev.ts](src/potok-dev.ts), [vite.config.ts](vite.config.ts), [tsconfig.json](tsconfig.json) | iz šablona, bez izmena |

## Licenca

MIT, vidi [LICENSE](LICENSE). Ikonice su iz Heroicons-a (MIT), vidi [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Build nosi i licence koda koji pakuje: na vrhu skripte je pun tekst licenci lit-html-a (BSD-3-Clause) i fflate-a (MIT), a u CSS-u su napomene Tailwind CSS-a i daisyUI-ja (MIT).

Podaci nisu deo repozitorijuma. Pripadaju MUP-u Republike Srbije i objavljeni su na data.gov.rs, pod uslovima tog portala.
