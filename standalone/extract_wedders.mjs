// Extract all 6 ProductFinder data sets (Wedders/Chains/Rings/Tennis/Bangles/Pendants)
// from src/data/*.js into a single JSON the build script will inline.
// Tier + option definitions are duplicated here from each *FinderPage.jsx since
// those configs aren't exported from the source modules.
import { wedderStyles,  wedderPNumbers  } from '/home/bach/projects/mh/src/data/wedders.js';
import { chainStyles,   chainPNumbers   } from '/home/bach/projects/mh/src/data/chains.js';
import { ringStyles,    ringPNumbers    } from '/home/bach/projects/mh/src/data/rings.js';
import { tennisStyles,  tennisPNumbers  } from '/home/bach/projects/mh/src/data/tennis.js';
import { bangleStyles,  banglePNumbers  } from '/home/bach/projects/mh/src/data/bangles.js';
import { pendantStyles, pendantPNumbers } from '/home/bach/projects/mh/src/data/pendants.js';
import fs from 'fs';

const FINDERS = {
  wedders: {
    name: 'Wedders',
    tiers: [
      { id: 'Gold',        label: 'Plain Wedders' },
      { id: 'MensDiamond', label: "Men's Diamond Wedders" },
      { id: 'DiaWedders',  label: 'Diamond Wedders' },
      { id: 'Eternity',    label: 'Eternity Bands' },
    ],
    optionDefs: [
      { key: 'diamondTypes',   label: 'Diamond Type' },
      { key: 'diamondCuts',    label: 'Diamond Cut' },
      { key: 'metals',         label: 'Metal' },
      { key: 'goldColors',     label: 'Gold Colour / Platinum' },
      { key: 'carats',         label: 'Carat', dependsOn: { key: 'goldColors', values: ['White', 'Yellow', 'Rose'] } },
      { key: 'widths',         label: 'Width' },
      { key: 'finishes',       label: 'Finish' },
      { key: 'diamondWeights', label: 'Diamond Weight' },
      { key: 'fingerSizes',    label: 'Finger Size' },
    ],
    styles: wedderStyles,
    pNumbers: wedderPNumbers,
  },
  chains: {
    name: 'Chains',
    tiers: [
      { id: 'Gold',      label: 'Solid Chains' },
      { id: 'SemiSolid', label: 'Semi Solid Chains' },
    ],
    optionDefs: [
      { key: 'metals',  label: 'Metal' },
      { key: 'lengths', label: 'Length' },
    ],
    styles: chainStyles,
    pNumbers: chainPNumbers,
  },
  rings: {
    name: 'Rings',
    tiers: [
      { id: 'RoundBrilliant',   label: 'Round Brilliant' },
      { id: 'Marquise',         label: 'Marquise' },
      { id: 'Asscher',          label: 'Asscher' },
      { id: 'Oval',             label: 'Oval' },
      { id: 'Pear',             label: 'Pear' },
      { id: 'Princess',         label: 'Princess' },
      { id: 'Emerald',          label: 'Emerald' },
      { id: 'Radiant',          label: 'Radiant' },
      { id: 'Cushion',          label: 'Cushion' },
      { id: 'ElongatedCushion', label: 'Elongated Cushion' },
      { id: 'Heart',            label: 'Heart' },
    ],
    optionDefs: [
      { key: 'carats', label: 'Carat Weight' },
      { key: 'metals', label: 'Metal' },
    ],
    styles: ringStyles,
    pNumbers: ringPNumbers,
  },
  tennis: {
    name: 'Tennis',
    tiers: [
      { id: 'Necklace', label: 'Necklace' },
      { id: 'Bracelet', label: 'Bracelet' },
    ],
    optionDefs: [
      { key: 'tdws',    label: 'TDW' },
      { key: 'lengths', label: 'Length' },
    ],
    styles: tennisStyles,
    pNumbers: tennisPNumbers,
  },
  bangles: {
    name: 'Bangles',
    tiers: [
      { id: 'Oval',  label: 'Oval' },
      { id: 'Round', label: 'Round' },
    ],
    optionDefs: [
      { key: 'metals',    label: 'Metal' },
      { key: 'diameters', label: 'Diameter' },
    ],
    styles: bangleStyles,
    pNumbers: banglePNumbers,
  },
  pendants: {
    name: 'Pendants',
    tiers: [
      { id: 'Birthstone',        label: 'Birthstone' },
      { id: 'Engravables',       label: 'Engravables' },
      { id: 'Heart',             label: 'Heart' },
      { id: 'Initials',          label: 'Initials' },
      { id: 'Lockets',           label: 'Lockets' },
      { id: 'Motif',             label: 'Motif' },
      { id: 'Padlock',           label: 'Padlock' },
      { id: 'Pendant Connector', label: 'Pendant Connector' },
      { id: 'Religious',         label: 'Religious' },
      { id: 'Zodiacs',           label: 'Zodiacs' },
    ],
    optionDefs: [],
    styles: pendantStyles,
    pNumbers: pendantPNumbers,
  },
};

const summary = Object.entries(FINDERS).map(([k, v]) =>
  `${k}: ${v.styles.length} styles, ${Object.keys(v.pNumbers).length} P-numbers, ${v.tiers.length} tiers, ${v.optionDefs.length} option defs`
).join('\n');

fs.writeFileSync('/home/bach/projects/mh/standalone/finders.data.json', JSON.stringify(FINDERS));
console.log(summary);
console.log(`\nWrote finders.data.json (${(fs.statSync('/home/bach/projects/mh/standalone/finders.data.json').size / 1024).toFixed(1)} KB)`);
