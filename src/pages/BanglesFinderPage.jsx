import ProductFinder from '../components/ProductFinder'
import { bangleStyles, banglePNumbers } from '../data/bangles'

const TIERS = [
  { id: 'Oval', label: 'Oval' },
  { id: 'Round', label: 'Round' },
]

const OPTION_DEFS = [
  { key: 'metals', label: 'Metal' },
  { key: 'diameters', label: 'Diameter' },
]

function BanglesFinderPage() {
  return (
    <ProductFinder
      productName="Bangles"
      styles={bangleStyles}
      pNumbers={banglePNumbers}
      tiers={TIERS}
      optionDefs={OPTION_DEFS}
      cropPath="/bangle-crop"
    />
  )
}

export default BanglesFinderPage
