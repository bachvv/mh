// Wedders (Wedding Bands) product data
// P numbers are looked up by: metal → width

export const wedderCategories = [
  {
    id: 'gold-wedders',
    name: 'Gold Wedders',
    image: '/images/gold-wedders.jpg',
    choices: [
      {
        id: 'metal',
        label: 'Metal',
        options: [
          '9ct Yellow Gold',
          '9ct White Gold',
          '9ct Rose Gold',
          '18ct Yellow Gold',
          '18ct White Gold',
          '18ct Rose Gold',
        ],
      },
      {
        id: 'width',
        label: 'Width',
        options: ['2mm', '3mm', '4mm', '5mm', '6mm', '8mm'],
      },
    ],
    // P numbers keyed as "metal|width"
    pNumbers: {
      '9ct Yellow Gold|2mm': 'P410401',
      '9ct Yellow Gold|3mm': 'P410402',
      '9ct Yellow Gold|4mm': 'P410403',
      '9ct Yellow Gold|5mm': 'P410404',
      '9ct Yellow Gold|6mm': 'P410405',
      '9ct Yellow Gold|8mm': 'P410406',

      '9ct White Gold|2mm': 'P410411',
      '9ct White Gold|3mm': 'P410412',
      '9ct White Gold|4mm': 'P410413',
      '9ct White Gold|5mm': 'P410414',
      '9ct White Gold|6mm': 'P410415',
      '9ct White Gold|8mm': 'P410416',

      '9ct Rose Gold|2mm': 'P410421',
      '9ct Rose Gold|3mm': 'P410422',
      '9ct Rose Gold|4mm': 'P410423',
      '9ct Rose Gold|5mm': 'P410424',
      '9ct Rose Gold|6mm': 'P410425',
      '9ct Rose Gold|8mm': 'P410426',

      '18ct Yellow Gold|2mm': 'P410431',
      '18ct Yellow Gold|3mm': 'P410432',
      '18ct Yellow Gold|4mm': 'P410433',
      '18ct Yellow Gold|5mm': 'P410434',
      '18ct Yellow Gold|6mm': 'P410435',
      '18ct Yellow Gold|8mm': 'P410436',

      '18ct White Gold|2mm': 'P410441',
      '18ct White Gold|3mm': 'P410442',
      '18ct White Gold|4mm': 'P410443',
      '18ct White Gold|5mm': 'P410444',
      '18ct White Gold|6mm': 'P410445',
      '18ct White Gold|8mm': 'P410446',

      '18ct Rose Gold|2mm': 'P410451',
      '18ct Rose Gold|3mm': 'P410452',
      '18ct Rose Gold|4mm': 'P410453',
      '18ct Rose Gold|5mm': 'P410454',
      '18ct Rose Gold|6mm': 'P410455',
      '18ct Rose Gold|8mm': 'P410456',
    },
  },
]
