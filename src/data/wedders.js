// Gold Wedders P-number lookup
// Key format: "style|metal|width|finish"
// P numbers sourced from Michael Hill catalog

export const wedderStyles = [
  { id: 'Lite Half Round', name: 'Lite Half Round', image: '/images/styles/lite-half-round.svg' },
  { id: 'Half Round',      name: 'Half Round',      image: '/images/styles/half-round.svg' },
  // TODO: add remaining styles from catalog images
  // { id: '...', name: '...', image: '/images/styles/....svg' },
]

export const wedderMetals = [
  '9ct Yellow Gold',
  '9ct White Gold',
  '9ct Rose Gold',
  '18ct Yellow Gold',
  '18ct White Gold',
  '18ct Rose Gold',
  'Platinum',
]

export const wedderWidths = ['2mm', '3mm', '4mm', '5mm', '6mm', '8mm']

export const wedderFinishes = ['Polished', 'Brushed']

// P-numbers keyed as "style|metal|width|finish"
// Populate each block from the catalog images provided
export const wedderPNumbers = {
  // ── Lite Half Round ────────────────────────────────────
  // Polished
  // 'Lite Half Round|9ct Yellow Gold|2mm|Polished': '',
  // 'Lite Half Round|9ct Yellow Gold|3mm|Polished': '',
  // 'Lite Half Round|9ct Yellow Gold|4mm|Polished': '',
  // 'Lite Half Round|9ct Yellow Gold|5mm|Polished': '',
  // 'Lite Half Round|9ct Yellow Gold|6mm|Polished': '',
  // 'Lite Half Round|9ct Yellow Gold|8mm|Polished': '',
  // Brushed
  // 'Lite Half Round|9ct Yellow Gold|2mm|Brushed': '',
  // ... (repeat for all metals)

  // ── Half Round ─────────────────────────────────────────
  // Polished
  'Half Round|9ct Yellow Gold|2mm|Polished':  'P410401',
  'Half Round|9ct Yellow Gold|3mm|Polished':  'P410402',
  'Half Round|9ct Yellow Gold|4mm|Polished':  'P410403',
  'Half Round|9ct Yellow Gold|5mm|Polished':  'P410404',
  'Half Round|9ct Yellow Gold|6mm|Polished':  'P410405',
  'Half Round|9ct Yellow Gold|8mm|Polished':  'P410406',

  'Half Round|9ct White Gold|2mm|Polished':   'P410411',
  'Half Round|9ct White Gold|3mm|Polished':   'P410412',
  'Half Round|9ct White Gold|4mm|Polished':   'P410413',
  'Half Round|9ct White Gold|5mm|Polished':   'P410414',
  'Half Round|9ct White Gold|6mm|Polished':   'P410415',
  'Half Round|9ct White Gold|8mm|Polished':   'P410416',

  'Half Round|9ct Rose Gold|2mm|Polished':    'P410421',
  'Half Round|9ct Rose Gold|3mm|Polished':    'P410422',
  'Half Round|9ct Rose Gold|4mm|Polished':    'P410423',
  'Half Round|9ct Rose Gold|5mm|Polished':    'P410424',
  'Half Round|9ct Rose Gold|6mm|Polished':    'P410425',
  'Half Round|9ct Rose Gold|8mm|Polished':    'P410426',

  'Half Round|18ct Yellow Gold|2mm|Polished': 'P410431',
  'Half Round|18ct Yellow Gold|3mm|Polished': 'P410432',
  'Half Round|18ct Yellow Gold|4mm|Polished': 'P410433',
  'Half Round|18ct Yellow Gold|5mm|Polished': 'P410434',
  'Half Round|18ct Yellow Gold|6mm|Polished': 'P410435',
  'Half Round|18ct Yellow Gold|8mm|Polished': 'P410436',

  'Half Round|18ct White Gold|2mm|Polished':  'P410441',
  'Half Round|18ct White Gold|3mm|Polished':  'P410442',
  'Half Round|18ct White Gold|4mm|Polished':  'P410443',
  'Half Round|18ct White Gold|5mm|Polished':  'P410444',
  'Half Round|18ct White Gold|6mm|Polished':  'P410445',
  'Half Round|18ct White Gold|8mm|Polished':  'P410446',

  'Half Round|18ct Rose Gold|2mm|Polished':   'P410451',
  'Half Round|18ct Rose Gold|3mm|Polished':   'P410452',
  'Half Round|18ct Rose Gold|4mm|Polished':   'P410453',
  'Half Round|18ct Rose Gold|5mm|Polished':   'P410454',
  'Half Round|18ct Rose Gold|6mm|Polished':   'P410455',
  'Half Round|18ct Rose Gold|8mm|Polished':   'P410456',

  // Half Round Brushed — fill from catalog images
  // 'Half Round|9ct Yellow Gold|2mm|Brushed': '',

  // ── Additional styles — fill from catalog images ────────
  // 'StyleName|metal|width|Polished': '',
  // 'StyleName|metal|width|Brushed': '',

  // ── Platinum — fill from catalog images ────────────────
}
