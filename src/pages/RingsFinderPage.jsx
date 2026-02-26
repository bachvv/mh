import ProductFinder from '../components/ProductFinder'
import { ringStyles, ringPNumbers } from '../data/rings'

const TIERS = [
  { id: 'RoundBrilliant', label: 'Round Brilliant' },
  { id: 'Marquise', label: 'Marquise' },
  { id: 'Asscher', label: 'Asscher' },
  { id: 'Oval', label: 'Oval' },
  { id: 'Pear', label: 'Pear' },
  { id: 'Princess', label: 'Princess' },
  { id: 'Emerald', label: 'Emerald' },
  { id: 'Radiant', label: 'Radiant' },
  { id: 'Cushion', label: 'Cushion' },
  { id: 'ElongatedCushion', label: 'Elongated Cushion' },
  { id: 'Heart', label: 'Heart' },
]

const OPTION_DEFS = [
  { key: 'carats', label: 'Carat Weight' },
  { key: 'metals', label: 'Metal' },
]

function RingsFinderPage() {
  return (
    <ProductFinder
      productName="Rings"
      styles={ringStyles}
      pNumbers={ringPNumbers}
      tiers={TIERS}
      optionDefs={OPTION_DEFS}
      cropPath="/ring-crop"
    />
  )
}

export default RingsFinderPage
