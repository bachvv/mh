import ProductFinder from '../components/ProductFinder'
import { tennisStyles, tennisPNumbers } from '../data/tennis'

const TIERS = [
  { id: 'Necklace', label: 'Necklace' },
  { id: 'Bracelet', label: 'Bracelet' },
]

const OPTION_DEFS = [
  { key: 'tdws', label: 'TDW' },
  { key: 'lengths', label: 'Length' },
]

function TennisFinderPage() {
  return (
    <ProductFinder
      productName="Tennis"
      styles={tennisStyles}
      pNumbers={tennisPNumbers}
      tiers={TIERS}
      optionDefs={OPTION_DEFS}
      cropPath="/tennis-crop"
    />
  )
}

export default TennisFinderPage
