import ProductFinder from '../components/ProductFinder'
import { pendantStyles, pendantPNumbers } from '../data/pendants'

const TIERS = [
  { id: 'Birthstone', label: 'Birthstone' },
  { id: 'Engravables', label: 'Engravables' },
  { id: 'Heart', label: 'Heart' },
  { id: 'Initials', label: 'Initials' },
  { id: 'Lockets', label: 'Lockets' },
  { id: 'Motif', label: 'Motif' },
  { id: 'Padlock', label: 'Padlock' },
  { id: 'Pendant Connector', label: 'Pendant Connector' },
  { id: 'Religious', label: 'Religious' },
  { id: 'Zodiacs', label: 'Zodiacs' },
]

const OPTION_DEFS = []

function PendantBarFinderPage() {
  return (
    <ProductFinder
      productName="Pendants"
      styles={pendantStyles}
      pNumbers={pendantPNumbers}
      tiers={TIERS}
      optionDefs={OPTION_DEFS}
      cropPath="/pendant-crop"
    />
  )
}

export default PendantBarFinderPage
