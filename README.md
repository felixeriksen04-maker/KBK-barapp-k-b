# Kbh Bar til Bar

Bar-til-bar-runde i København med start og slutt ved Imperial Hotel (Vester Farimagsgade 9). Sju barer i sju kategorier, rundt 4 km å gå for hvert lag.

| Bar | Kategori | Adresse |
|-----|----------|---------|
| Taphouse | Ølbar | Lavendelstræde 15 |
| Ved Stranden 10 | Vinbar | Ved Stranden 10 |
| Toga Vinstue | Brun bodega | Store Kirkestræde 3 |
| Ruby | Cocktailbar | Nybrogade 10 |
| La Fontaine | Jazzbar | Kompagnistræde 11 |
| Den Glade Gris | Festbar (finale) | Lille Kannikestræde 3 |
| Floss | Rockbar | Larsbjørnsstræde 10 |

## Hva appen gjør

- **Egen rute per lag.** Hvert lag får sin egen rekkefølge på barene, slik at lagene ikke står på samme bar samtidig. Rutene tar hensyn til åpningstider, og alle møtes til finale på samme bar (Den Glade Gris som standard, kan endres i appen).
- **Sanntid.** Lag, deltakere, innsjekkinger og poeng vises med en gang på alle telefoner som åpner appen. Alle lag kan føre poeng. Poengtavla viser hvor hvert lag er og en logg over hvem som ga hvilke poeng.
- **Google Earth-visning.** Med en Google-nøkkel vises byen fotorealistisk i 3D (Googles 3D-fliser via CesiumJS). Uten nøkkel brukes et 3D-kart med bygninger fra OpenStreetMap.
- **3D-gåtur.** Kameraet følger ruta fra bar til bar, enten som drone eller i gatehøyde. Dra i bildet for å stoppe og se deg rundt.
- **Live-modus.** Følger GPS-en og kompasset i telefonen, så bildet snur seg når du snur deg. Foreslår innsjekking når dere er fremme.
- **Drinker og oppgaver** på hver bar, og egne lag-mot-lag-oppgaver på finalen.

## Sanntid

Appen bruker [ntfy.sh](https://ntfy.sh) som felles kanal, uten konto. Alle som åpner lenken havner i rommet som står i `assets/config.js`. Vil dere ha en separat kveld, legg til `?rom=et-eget-navn` i lenken. Romnavnet er tilfeldig, men alle som kjenner det kan lese og skrive poeng. Navnene på deltakerne går derfor gjennom en offentlig tjeneste. ntfy.sh tar vare på meldinger i 12 timer, og appen sender en komprimert kopi av tilstanden hver fjerde time så ingenting forsvinner.

## Google Earth-visning (valgfritt)

1. Gå til [Google Cloud Console](https://console.cloud.google.com/), lag et prosjekt og slå på fakturering.
2. **APIs & Services → Library → Map Tiles API → Enable.**
3. **APIs & Services → Credentials → Create credentials → API key.**
4. Begrens nøkkelen: under **Application restrictions** velger du **Websites** og legger inn `https://felixeriksen04-maker.github.io/*`. Under **API restrictions** velger du **Map Tiles API**.
5. Lim nøkkelen inn i `googleMapsApiKey` i `assets/config.js`, så gjelder den for alle. Du kan også lime den inn under **Lag → Google Earth-visning** i appen, men da gjelder den bare den ene telefonen.

Nøkkelen blir synlig i koden til nettsiden, så begrensningen i punkt 4 er viktig.

## Publisere appen (GitHub Pages)

Appen er en statisk nettside uten byggesteg.

1. **Settings → General → Danger Zone → Change visibility → Public.** GitHub Pages krever offentlig repo på gratisplanen.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch.** Velg grenen med appen og mappen `/ (root)`, og trykk **Save**.
3. Etter et minutt eller to ligger appen på `https://felixeriksen04-maker.github.io/KBK-barapp-k-b/`.

Åpne lenken på telefonen og velg «Legg til på Hjem-skjerm» for å bruke den i fullskjerm. GPS og kompass krever HTTPS, og det har GitHub Pages.

## Kjøre lokalt

```sh
python3 -m http.server 8000
```

Åpne deretter http://localhost:8000.

## Kilder og kreditering

- Kart: [OpenFreeMap](https://openfreemap.org) og © [OpenStreetMap-bidragsytere](https://www.openstreetmap.org/copyright)
- Gangruter: FOSSGIS OSRM (routing.openstreetmap.de). Appen bruker omtrentlige ruter hvis tjenesten ikke svarer.
- 3D-motor: [MapLibre GL JS](https://maplibre.org) 5.24.0 (BSD-3-lisens, ligger i `vendor/`) og [CesiumJS](https://cesium.com/platform/cesiumjs/) 1.145.0 (Apache-2.0, lastes fra jsDelivr når Google-nøkkel er satt)
- Fotorealistisk 3D: Google Map Tiles API
- Sanntid: [ntfy.sh](https://ntfy.sh)
- Fakta om barene er sjekket mot Visit Copenhagen, barenes egne nettsider og Wikipedia i oktober 2026. Åpningstider kan endre seg.
