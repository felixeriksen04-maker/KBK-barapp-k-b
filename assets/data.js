// Data for kvelden. Koordinater er [lengdegrad, breddegrad].
// Hvert lag får sin egen rekkefølge på barene (se plan.js), men alle ender på finalebaren.
// Adresser og fakta er sjekket mot Visit Copenhagen, barenes egne sider og Wikipedia (okt. 2026).

export const HOTEL = {
  id: 'hotel',
  name: 'Imperial Hotel',
  address: 'Vester Farimagsgade 9, 1606 København V',
  coord: [12.56157, 55.67571],
};

export const CATEGORIES = {
  ol:       { label: 'Ølbar',       color: '#f0a43a', icon: 'beer' },
  vin:      { label: 'Vinbar',      color: '#c94f7c', icon: 'wine' },
  brun:     { label: 'Brun bodega', color: '#b97a45', icon: 'shot' },
  cocktail: { label: 'Cocktailbar', color: '#f25041', icon: 'cocktail' },
  jazz:     { label: 'Jazzbar',     color: '#5d8ff0', icon: 'note' },
  fest:     { label: 'Festbar',     color: '#ff8fc8', icon: 'pig' },
  rock:     { label: 'Rockbar',     color: '#a079ff', icon: 'bolt' },
};

export const TEAM_COLORS = ['#ff5d5d', '#3fa7ff', '#3ddc84', '#ffc83d', '#c77dff', '#ff8a3d', '#2ee6d6', '#f772c7'];

export const BARS = [
  {
    id: 'taphouse',
    name: 'Taphouse',
    cat: 'ol',
    address: 'Lavendelstræde 15, 1462 København K',
    coord: [12.5714, 55.67635],
    stay: 50,
    opens: 15 * 60,
    tagline: 'Rundt 60 haner med øl som byttes hele tiden',
    about: 'Ølbar med rundt 60 roterende haner, mest fra danske og utenlandske mikrobryggerier. Taplisten står på skjermer i baren og oppdateres fortløpende på nettsiden deres. Ligger et minutt fra Rådhuspladsen, så det er en kort og grei start på kvelden.',
    drinks: [
      { kind: 'Lagets runde', text: 'Start lett med en dansk pils eller lager fra hanen.' },
      { kind: 'Neste', text: 'En IPA eller sour fra et dansk bryggeri. Spør bartenderen hva som er ferskest på tappen.' },
      { kind: 'Kapteinens valg', text: 'Avslutt med en stout eller porter. Lagkapteinen velger fritt fra listen.' },
    ],
    tasks: [
      { id: 'blind', title: 'Blindsmaking', points: 3, text: 'Én på laget lukker øynene. De andre bestiller en øl uten å si hva det er. Gjett stilen (lager, IPA, stout, sour, hvete …). Riktig svar gir poeng.' },
      { id: 'roulette', title: 'Tappe-roulette', points: 1, text: 'Lagkapteinen lukker øynene og peker på taplisten. Hele laget smaker på det kapteinen traff.' },
      { id: 'dansk', title: 'Bestill på dansk', points: 2, text: 'Bestill lagets runde på dansk: «Hvad kan du anbefale? … Så tager vi den, tak!» Går bartenderen over til engelsk, er poenget tapt.' },
    ],
    goodToKnow: 'Åpner 15:00 på hverdager og 12:00 i helgene. Taplisten ligger på taphouse.dk.',
  },
  {
    id: 'vedstranden',
    name: 'Ved Stranden 10',
    cat: 'vin',
    address: 'Ved Stranden 10, 1061 København K',
    coord: [12.58156, 55.67733],
    stay: 50,
    lastIn: 21 * 60 + 10,
    tagline: 'Naturvin ved kanalen, rett overfor Christiansborg',
    about: 'Vinbar i et nyklassisistisk hus fra 1797 ved kanalen, med Christiansborg rett over vannet. Kjent for naturvin og små retter. Den stenger tidligere enn resten av ruta, så derfor kommer den tidlig.',
    drinks: [
      { kind: 'Lagets runde', text: 'Et glass oransjevin (skin contact), naturvinens klassiker.' },
      { kind: 'Alternativ', text: 'En flaske bobler til bordet for hvert lag.' },
      { kind: 'Bonus', text: 'Et glass lett, kjølig rødvin. Spør bartenderen hva de anbefaler.' },
    ],
    tasks: [
      { id: 'sommelier', title: 'Sommelieren', points: 3, text: 'Bestill et glass uten å se flasken. Laget gjetter land eller drue før bartenderen avslører svaret.' },
      { id: 'notat', title: 'Smakstalen', points: 2, text: 'Én på laget holder en smakstale på 20 sekunder, filmet. Den må inneholde ordene «mineralsk», «stalldør» og «Christiansborg». Videoen vises på finalen.' },
      { id: 'kanal', title: 'Kanalbildet', points: 1, text: 'Ta et lagbilde ved kanalen med Christiansborg i bakgrunnen. Alle på laget må være med.' },
    ],
    goodToKnow: 'Stenger rundt kl. 22 og holder stengt på søndager. Kildene er uenige om åpningstidene, så sjekk før dere går.',
  },
  {
    id: 'toga',
    name: 'Toga Vinstue',
    cat: 'brun',
    address: 'Store Kirkestræde 3, 1073 København K',
    coord: [12.58215, 55.67795],
    stay: 45,
    tagline: 'Politikernes bodega, et steinkast fra Christiansborg',
    about: 'Ekte dansk bodega med lave priser og gammel tradisjon som stamsted for politikere fra Christiansborg. Brunt treverk og ingen pynt. Her er det lov å røyke inne, så lufta kan være tung.',
    drinks: [
      { kind: 'Lagets runde', text: 'En fadøl. Klassisk bodega-stil, ingen spørsmål.' },
      { kind: 'Til skålen', text: 'En dansk snaps eller en Gammel Dansk.' },
      { kind: 'Bonus', text: 'En snaps til. Iskald dansk akevitt, felles skål.' },
    ],
    tasks: [
      { id: 'tale', title: 'Valgtalen', points: 3, text: 'Hold en valgtale på 30 sekunder for laget, gjerne på dansk, og få minst én fremmed i baren til å skåle med dere.' },
      { id: 'skaal', title: 'Skål med øyekontakt', points: 1, text: 'Hele laget skåler med «Skål!» og ser alle i øynene. Bryter noen øyekontakten, må dere ta den på nytt.' },
      { id: 'ordre', title: 'Bodega-bestillingen', points: 2, text: 'Bestill på dansk: «To fadøl og to snapse, tak.» Poenget gjelder bare hvis dere klarer det uten engelsk.' },
    ],
    goodToKnow: 'Røyking er tillatt inne. Billig, så dette er stedet å spandere en runde.',
  },
  {
    id: 'ruby',
    name: 'Ruby',
    cat: 'cocktail',
    address: 'Nybrogade 10, 1203 København K',
    coord: [12.57665, 55.67796],
    stay: 60,
    tagline: 'En av Københavns første seriøse cocktailbarer',
    about: 'Cocktailbar i et byhus fra rundt 1740 ved kanalen, rett overfor Thorvaldsens Museum. Ruby var en av de første seriøse cocktailbarene i byen og regnes fortsatt blant de beste. Inngangen er diskret og lett å gå forbi.',
    drinks: [
      { kind: 'Lagets runde', text: 'Husets signaturcocktails. Menyen byttes jevnlig, så spør hva som er nytt.' },
      { kind: 'Klassiker', text: 'Old Fashioned eller Negroni.' },
      { kind: 'Bonus', text: 'En shot av bartenderens favorittbrennevin til hele laget.' },
    ],
    tasks: [
      { id: 'dor', title: 'Finn døra', points: 1, text: 'Finn inngangen uten å spørre noen om vei og uten å se på kartet.' },
      { id: 'tre-ord', title: 'Bartender’s choice', points: 2, text: 'Gi bartenderen tre ord, for eksempel «frisk, bitter, kaos», og drikk det dere får. Alle på laget må smake.' },
      { id: 'navn', title: 'Kveldens cocktail', points: 3, text: 'Finn på navnet på en cocktail som oppsummerer kvelden så langt. Bartenderen må gi navnet tommelen opp.' },
    ],
    goodToKnow: 'Åpner 16:00 på hverdager og har åpent til rundt 02 i helgene. Det kan bli kø, så kom heller litt tidlig enn sent.',
  },
  {
    id: 'lafontaine',
    name: 'La Fontaine',
    cat: 'jazz',
    address: 'Kompagnistræde 11, 1208 København K',
    coord: [12.57615, 55.67737],
    stay: 70,
    opens: 20 * 60,
    tagline: 'Livejazz onsdag, fredag, lørdag og søndag hele året',
    about: 'Liten og trang jazzklubb i et fredet hus fra 1797–98 i Strædet. Livejazz fire kvelder i uka hele året, og stedet er fast scene under Copenhagen Jazz Festival og Vinterjazz. Musikken starter sent, så dette er kveldens rolige pause før festen.',
    drinks: [
      { kind: 'Lagets runde', text: 'En øl eller en whisky. Det passer til jazzen.' },
      { kind: 'Alternativ', text: 'En klassisk gin og tonic.' },
      { kind: 'Bonus', text: 'En dram whisky eller rom ved baren før siste sett.' },
    ],
    tasks: [
      { id: 'applaus', title: 'Jazz-etikette', points: 1, text: 'Hele laget applauderer etter hver solo gjennom et helt sett.' },
      { id: 'band', title: 'Hvem er bandet?', points: 2, text: 'Finn ut hva bandet heter og hvem som spiller hva, uten å google.' },
      { id: 'scat', title: 'Scat-videoen', points: 3, text: 'Én på laget scat-synger i ti sekunder ute på gata etter settet. Filmes og vises på finalen.' },
    ],
    goodToKnow: 'Det kan koste inngang på konsertkvelder. Åpner rundt kl. 20, og musikken starter senere.',
  },
  {
    id: 'gladegris',
    name: 'Den Glade Gris',
    cat: 'fest',
    address: 'Lille Kannikestræde 3, 1170 København K',
    coord: [12.5744, 55.6802],
    stay: 90,
    opens: 20 * 60,
    tagline: 'Gladegris: festbaren midt i Latinerkvarteret',
    about: 'Festbar i Latinerkvarteret med DJ-kvelder, livemusikk og sport på skjermene. Den er også Københavns offisielle Manchester United-bar. Her tar festen av, og her møtes alle lagene til finalen.',
    drinks: [
      { kind: 'Lagets runde', text: 'Shots til hele laget.' },
      { kind: 'Alternativ', text: 'En stor fadøl.' },
      { kind: 'Bonus', text: 'En pitcher øl til bordet, hvis de har.' },
    ],
    tasks: [
      { id: 'tryne', title: 'Grisetryne-bildet', points: 1, text: 'Ta et lagbilde der alle lager grisetryne.' },
      { id: 'united', title: 'United-quiz', points: 2, text: 'Nevn fem Manchester United-spillere, nåværende eller legender, på 30 sekunder.' },
      { id: 'dans', title: 'Dansegulvet', points: 3, text: 'Hele laget på dansegulvet samtidig gjennom en hel låt.' },
    ],
    goodToKnow: 'Programmet varierer mellom DJ, livemusikk og fotball. Sjekk sosiale medier for kveldens program. Åpningstidene fant jeg ikke, så sjekk før dere går.',
  },
  {
    id: 'floss',
    name: 'Floss',
    cat: 'rock',
    address: 'Larsbjørnsstræde 10, 1454 København K',
    coord: [12.5696, 55.67805],
    stay: 55,
    opens: 20 * 60,
    tagline: 'Rockekjeller fra punk-tiden, åpent til langt på natt',
    about: 'Kjellerbar og tidligere tilholdssted for 80-tallets punkere, som fortsatt har litt av rufsen i seg. Rock på anlegget, biljardbord og billige drinker. Det er lov å røyke inne, og det er åpent til langt på natt.',
    drinks: [
      { kind: 'Lagets runde', text: 'Tequila-shots. Floss er kjent for billige shot-tilbud.' },
      { kind: 'Alternativ', text: 'En øl til biljarden.' },
      { kind: 'Bonus', text: 'Én runde shots til før dere går videre.' },
    ],
    tasks: [
      { id: 'biljard', title: 'Biljard', points: 3, text: 'Vinn et parti biljard mot noen som ikke er på laget.' },
      { id: 'luftgitar', title: 'Luftgitar', points: 2, text: 'Én på laget gir alt på luftgitar på neste rockelåt. Filmes og vises på finalen.' },
      { id: 'trivia', title: 'Rock-trivia', points: 1, text: 'Gjett artisten på de tre neste låtene. Minst to riktige gir poeng.' },
    ],
    goodToKnow: 'Røyking er tillatt inne. Happy hour i helgene skal være 22–23, men det står bare i én kilde.',
  },
];

// Lag-mot-lag-oppgaver når alle har kommet fram til finalebaren.
export const DEFAULT_FINALE = 'gladegris';
export const FINALE_TASKS = [
  { id: 'fin-stafett', title: 'Stafettskålen', points: 3, text: 'Lagene stiller på rekke. Én og én drikker en slurk og sender glasset videre. Første lag som er tomt, vinner.' },
  { id: 'fin-video', title: 'Kveldens video', points: 2, text: 'Hvert lag viser sin beste video fra kvelden. Alle stemmer, men ingen kan stemme på eget lag.' },
  { id: 'fin-quiz', title: 'Hvor har dere vært?', points: 2, text: 'Hvert lag får ett spørsmål om hver bar de har besøkt, stilt av de andre lagene. Flest riktige svar vinner.' },
];

// Omtrentlige gangruter langs gatene mellom noen av barene. Brukes til appen har hentet
// ekte gangruter fra OpenStreetMap. Andre strekninger tegnes som rette linjer.
const STREET_SKETCHES = [
  ['hotel', 'taphouse', [[12.56157, 55.67571], [12.5625, 55.6753], [12.5655, 55.675], [12.568, 55.6754], [12.5692, 55.676], [12.5703, 55.6763], [12.5714, 55.67635]]],
  ['taphouse', 'vedstranden', [[12.5714, 55.67635], [12.5728, 55.6762], [12.5742, 55.6763], [12.575, 55.6768], [12.57615, 55.67737], [12.5772, 55.6776], [12.578, 55.6779], [12.5795, 55.6781], [12.5803, 55.6782], [12.5811, 55.6777], [12.58156, 55.67733]]],
  ['vedstranden', 'toga', [[12.58156, 55.67733], [12.5819, 55.6776], [12.58215, 55.67795]]],
  ['toga', 'ruby', [[12.58215, 55.67795], [12.5813, 55.6777], [12.5803, 55.6782], [12.579, 55.678], [12.5778, 55.6779], [12.57665, 55.67796]]],
  ['ruby', 'lafontaine', [[12.57665, 55.67796], [12.5765, 55.6776], [12.57615, 55.67737]]],
  ['lafontaine', 'gladegris', [[12.57615, 55.67737], [12.5755, 55.6776], [12.575, 55.6782], [12.5747, 55.679], [12.5745, 55.6797], [12.5744, 55.6802]]],
  ['gladegris', 'floss', [[12.5744, 55.6802], [12.5735, 55.68], [12.572, 55.6796], [12.5705, 55.6792], [12.5698, 55.6788], [12.5696, 55.67805]]],
  ['floss', 'hotel', [[12.5696, 55.67805], [12.5697, 55.6777], [12.5686, 55.6772], [12.5672, 55.6766], [12.5655, 55.676], [12.5638, 55.6756], [12.56157, 55.67571]]],
];

export function sketchLeg(fromId, toId, fromCoord, toCoord) {
  for (const [a, b, coords] of STREET_SKETCHES) {
    if (a === fromId && b === toId) return coords;
    if (a === toId && b === fromId) return [...coords].reverse();
  }
  return [fromCoord, toCoord];
}
