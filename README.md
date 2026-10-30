# Kbh Bar til Bar

Bar-til-bar-runde i København med start og slutt ved Imperial Hotel (Vester Farimagsgade 9). Ruta har sju barer i sju kategorier og er rundt 3,5 km å gå til sammen.

| # | Bar | Kategori | Adresse |
|---|-----|----------|---------|
| 1 | Taphouse | Ølbar | Lavendelstræde 15 |
| 2 | Ved Stranden 10 | Vinbar | Ved Stranden 10 |
| 3 | Toga Vinstue | Brun bodega | Store Kirkestræde 3 |
| 4 | Ruby | Cocktailbar | Nybrogade 10 |
| 5 | La Fontaine | Jazzbar | Kompagnistræde 11 |
| 6 | Den Glade Gris | Festbar | Lille Kannikestræde 3 |
| 7 | Floss | Rockbar | Larsbjørnsstræde 10 |

## Hva appen gjør

- **3D-kart** over København med ekte bygninger fra OpenStreetMap, i natt- eller dagmodus.
- **3D-gåtur**: kameraet går gatene fra bar til bar i gatehøyde. Dra i kartet for å stoppe og se deg rundt.
- **Live-modus**: følger GPS-en og kompasset i telefonen, så kartet snur seg når du snur deg. Viser avstand og retning til neste bar, og foreslår innsjekking når dere er fremme.
- **Drinker og oppgaver** på hver bar. Oppgavene gir poeng til lagene.
- **Lag og poengtavle**: valgfritt antall lag og deltakere, dommerpoeng, «Hvem må?»-trekning og deling av stillingen i gruppechatten.
- Lenker til Street View og Google Maps for hver bar.

Alt lagres på telefonen (localStorage). La én person være dommer.

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
- 3D-motor: [MapLibre GL JS](https://maplibre.org) 5.24.0 (BSD-3-lisens, ligger i `vendor/`)
- Fakta om barene er sjekket mot Visit Copenhagen, barenes egne nettsider og Wikipedia i oktober 2026. Åpningstider kan endre seg.
