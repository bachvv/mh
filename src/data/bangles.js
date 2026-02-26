// Bangles Concierge P-number lookup
// Key format: "style|metal|diameter"

export const bangleStyles = [
  // ── Oval ───────────────────────────────────────────────────────
  {
    id: 'Oval2mm',
    name: 'Oval 2mm-2.5mm',
    tier: 'Oval',
    image: '/images/styles/bangles/oval-2mm.png',
    metals: ['10K', '14K', '18K'],
    diameters: ['40mm', '50mm', '60mm', '65mm', '70mm', '75mm'],
  },
  {
    id: 'Oval3.5mm',
    name: 'Oval 3.5mm-4mm',
    tier: 'Oval',
    image: '/images/styles/bangles/oval-3.5mm.png',
    metals: ['10K', '14K', '18K'],
    diameters: ['40mm', '50mm', '60mm', '65mm', '70mm', '75mm'],
  },
  {
    id: 'Oval5.5mm',
    name: 'Oval 5.5mm-6mm',
    tier: 'Oval',
    image: '/images/styles/bangles/oval-5.5mm.png',
    metals: ['10K', '14K', '18K'],
    diameters: ['40mm', '50mm', '60mm', '65mm', '70mm', '75mm'],
  },
  {
    id: 'Oval7mm',
    name: 'Oval 7mm-8mm',
    tier: 'Oval',
    image: '/images/styles/bangles/oval-7mm.png',
    metals: ['10K', '14K', '18K'],
    diameters: ['40mm', '50mm', '60mm', '65mm', '70mm', '75mm'],
  },

  // ── Round ──────────────────────────────────────────────────────
  {
    id: 'Round2mm',
    name: 'Round 2mm-2.5mm',
    tier: 'Round',
    image: '/images/styles/bangles/round-2mm.png',
    metals: ['10K', '14K', '18K'],
    diameters: ['40mm', '50mm', '60mm', '65mm', '70mm', '75mm'],
  },
  {
    id: 'Round3.5mm',
    name: 'Round 3.5mm-4mm',
    tier: 'Round',
    image: '/images/styles/bangles/round-3.5mm.png',
    metals: ['10K', '14K', '18K'],
    diameters: ['40mm', '50mm', '60mm', '65mm', '70mm', '75mm'],
  },
  {
    id: 'Round4.5mm',
    name: 'Round 4.5mm-5mm',
    tier: 'Round',
    image: '/images/styles/bangles/round-4.5mm.png',
    metals: ['10K', '14K', '18K'],
    diameters: ['40mm', '50mm', '60mm', '65mm', '70mm', '75mm'],
  },
  {
    id: 'Round7mm',
    name: 'Round 7mm-8mm',
    tier: 'Round',
    image: '/images/styles/bangles/round-7mm.png',
    metals: ['10K', '14K', '18K'],
    diameters: ['40mm', '50mm', '60mm', '65mm', '70mm', '75mm'],
  },
]

export const banglePNumbers = {
  // ── Oval 2mm-2.5mm ────────────────────────────────────────────
  'Oval2mm|10K|40mm': '22800213', 'Oval2mm|14K|40mm': '22800398', 'Oval2mm|18K|40mm': '22800602',
  'Oval2mm|10K|50mm': '22800244', 'Oval2mm|14K|50mm': '22800428', 'Oval2mm|18K|50mm': '22800633',
  'Oval2mm|10K|60mm': '22800275', 'Oval2mm|14K|60mm': '22800459', 'Oval2mm|18K|60mm': '22800664',
  'Oval2mm|10K|65mm': '21908132', 'Oval2mm|14K|65mm': '22800480', 'Oval2mm|18K|65mm': '22800695',
  'Oval2mm|10K|70mm': '22800305', 'Oval2mm|14K|70mm': '22800510', 'Oval2mm|18K|70mm': '22800725',
  'Oval2mm|10K|75mm': '22800336', 'Oval2mm|14K|75mm': '22800541', 'Oval2mm|18K|75mm': '22800756',

  // ── Oval 3.5mm-4mm ───────────────────────────────────────────
  'Oval3.5mm|10K|40mm': '22800817', 'Oval3.5mm|14K|40mm': '22800992', 'Oval3.5mm|18K|40mm': '22801203',
  'Oval3.5mm|10K|50mm': '22800848', 'Oval3.5mm|14K|50mm': '22801029', 'Oval3.5mm|18K|50mm': '22801234',
  'Oval3.5mm|10K|60mm': '22800879', 'Oval3.5mm|14K|60mm': '22801050', 'Oval3.5mm|18K|60mm': '22801265',
  'Oval3.5mm|10K|65mm': '21908149', 'Oval3.5mm|14K|65mm': '22801081', 'Oval3.5mm|18K|65mm': '22801296',
  'Oval3.5mm|10K|70mm': '22800909', 'Oval3.5mm|14K|70mm': '22801111', 'Oval3.5mm|18K|70mm': '22801326',
  'Oval3.5mm|10K|75mm': '22800930', 'Oval3.5mm|14K|75mm': '22801142', 'Oval3.5mm|18K|75mm': '22801357',

  // ── Oval 5.5mm-6mm ───────────────────────────────────────────
  'Oval5.5mm|10K|40mm': '22801418', 'Oval5.5mm|14K|40mm': '22801593', 'Oval5.5mm|18K|40mm': '22801807',
  'Oval5.5mm|10K|50mm': '22801449', 'Oval5.5mm|14K|50mm': '22801623', 'Oval5.5mm|18K|50mm': '22801838',
  'Oval5.5mm|10K|60mm': '22801470', 'Oval5.5mm|14K|60mm': '22801654', 'Oval5.5mm|18K|60mm': '22801869',
  'Oval5.5mm|10K|65mm': '21908156', 'Oval5.5mm|14K|65mm': '22801685', 'Oval5.5mm|18K|65mm': '22801890',
  'Oval5.5mm|10K|70mm': '22801500', 'Oval5.5mm|14K|70mm': '22801715', 'Oval5.5mm|18K|70mm': '22801920',
  'Oval5.5mm|10K|75mm': '22801531', 'Oval5.5mm|14K|75mm': '22801746', 'Oval5.5mm|18K|75mm': '22801951',

  // ── Oval 7mm-8mm ─────────────────────────────────────────────
  'Oval7mm|10K|40mm': '22802019', 'Oval7mm|14K|40mm': '22802194', 'Oval7mm|18K|40mm': '22802408',
  'Oval7mm|10K|50mm': '22802040', 'Oval7mm|14K|50mm': '22802224', 'Oval7mm|18K|50mm': '22802439',
  'Oval7mm|10K|60mm': '22802071', 'Oval7mm|14K|60mm': '22802255', 'Oval7mm|18K|60mm': '22802460',
  'Oval7mm|10K|65mm': '21908163', 'Oval7mm|14K|65mm': '22802286', 'Oval7mm|18K|65mm': '22802491',
  'Oval7mm|10K|70mm': '22802101', 'Oval7mm|14K|70mm': '22802316', 'Oval7mm|18K|70mm': '22802521',
  'Oval7mm|10K|75mm': '22802132', 'Oval7mm|14K|75mm': '22802347', 'Oval7mm|18K|75mm': '22802552',

  // ── Round 2mm-2.5mm ───────────────────────────────────────────
  'Round2mm|10K|40mm': '22798411', 'Round2mm|14K|40mm': '22798596', 'Round2mm|18K|40mm': '22798800',
  'Round2mm|10K|50mm': '22798442', 'Round2mm|14K|50mm': '22798626', 'Round2mm|18K|50mm': '22798831',
  'Round2mm|10K|60mm': '22798473', 'Round2mm|14K|60mm': '22798657', 'Round2mm|18K|60mm': '22798862',
  'Round2mm|10K|65mm': '21908057', 'Round2mm|14K|65mm': '22798688', 'Round2mm|18K|65mm': '22798893',
  'Round2mm|10K|70mm': '22798503', 'Round2mm|14K|70mm': '22798718', 'Round2mm|18K|70mm': '22798923',
  'Round2mm|10K|75mm': '22798534', 'Round2mm|14K|75mm': '22798749', 'Round2mm|18K|75mm': '22798954',

  // ── Round 3.5mm-4mm ───────────────────────────────────────────
  'Round3.5mm|10K|40mm': '22941800', 'Round3.5mm|14K|40mm': '22941985', 'Round3.5mm|18K|40mm': '22942197',
  'Round3.5mm|10K|50mm': '22941831', 'Round3.5mm|14K|50mm': '22942012', 'Round3.5mm|18K|50mm': '22942227',
  'Round3.5mm|10K|60mm': '22941862', 'Round3.5mm|14K|60mm': '22942043', 'Round3.5mm|18K|60mm': '22942258',
  'Round3.5mm|10K|65mm': '22935229', 'Round3.5mm|14K|65mm': '22942074', 'Round3.5mm|18K|65mm': '22942289',
  'Round3.5mm|10K|70mm': '22941893', 'Round3.5mm|14K|70mm': '22942104', 'Round3.5mm|18K|70mm': '22942319',
  'Round3.5mm|10K|75mm': '22941923', 'Round3.5mm|14K|75mm': '22942135', 'Round3.5mm|18K|75mm': '22942340',

  // ── Round 4.5mm-5mm ───────────────────────────────────────────
  'Round4.5mm|10K|40mm': '22799012', 'Round4.5mm|14K|40mm': '22799197', 'Round4.5mm|18K|40mm': '22799401',
  'Round4.5mm|10K|50mm': '22799043', 'Round4.5mm|14K|50mm': '22799227', 'Round4.5mm|18K|50mm': '22799432',
  'Round4.5mm|10K|60mm': '22799074', 'Round4.5mm|14K|60mm': '22799258', 'Round4.5mm|18K|60mm': '22799463',
  'Round4.5mm|10K|65mm': '21908071', 'Round4.5mm|14K|65mm': '22799289', 'Round4.5mm|18K|65mm': '22799494',
  'Round4.5mm|10K|70mm': '22799104', 'Round4.5mm|14K|70mm': '22799319', 'Round4.5mm|18K|70mm': '22799524',
  'Round4.5mm|10K|75mm': '22799135', 'Round4.5mm|14K|75mm': '22799340', 'Round4.5mm|18K|75mm': '22799555',

  // ── Round 7mm-8mm ─────────────────────────────────────────────
  'Round7mm|10K|40mm': '22799616', 'Round7mm|14K|40mm': '22799791', 'Round7mm|18K|40mm': '22800008',
  'Round7mm|10K|50mm': '22799647', 'Round7mm|14K|50mm': '22799821', 'Round7mm|18K|50mm': '22800039',
  'Round7mm|10K|60mm': '22799678', 'Round7mm|14K|60mm': '22799852', 'Round7mm|18K|60mm': '22800060',
  'Round7mm|10K|65mm': '21908088', 'Round7mm|14K|65mm': '22799883', 'Round7mm|18K|65mm': '22800091',
  'Round7mm|10K|70mm': '22799708', 'Round7mm|14K|70mm': '22799913', 'Round7mm|18K|70mm': '22800121',
  'Round7mm|10K|75mm': '22799739', 'Round7mm|14K|75mm': '22799944', 'Round7mm|18K|75mm': '22800152',
}
