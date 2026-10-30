// Innstillinger for den publiserte appen.
export const CONFIG = {
  // Nøkkel til Google Map Tiles API. Gir fotorealistisk 3D av København, slik som i Google Earth.
  // Tom streng = vanlig 3D-kart. Begrens nøkkelen til GitHub Pages-adressen din i Google Cloud Console.
  googleMapsApiKey: '',

  // Sanntid: alle som åpner appen havner i samme rom og ser de samme lagene og poengene.
  // Legg til ?rom=et-annet-navn i lenken for å starte en egen kveld.
  sync: {
    server: 'https://ntfy.sh',
    room: 'kbkbar-dl2c1kv98yyxp6',
  },
};
