import ProductFinder from '../components/ProductFinder'
import { wedderStyles, wedderPNumbers } from '../data/wedders'

const TIERS = [
  { id: 'Gold',    label: 'Plain Wedders' },
  { id: 'MensDiamond', label: "Men's Diamond Wedders" },
  { id: 'DiaWedders', label: 'Diamond Wedders' },
  { id: 'Eternity', label: 'Eternity Bands' },
]

const OPTION_DEFS = [
  { key: 'diamondTypes',   label: 'Diamond Type' },
  { key: 'diamondCuts',    label: 'Diamond Cut' },
  { key: 'metals',         label: 'Metal' },
  { key: 'goldColors',     label: 'Gold Colour / Platinum' },
  { key: 'carats',         label: 'Carat', dependsOn: { key: 'goldColors', values: ['White', 'Yellow', 'Rose'] } },
  { key: 'widths',         label: 'Width' },
  { key: 'finishes',       label: 'Finish' },
  { key: 'diamondWeights', label: 'Diamond Weight' },
  { key: 'fingerSizes',    label: 'Finger Size' },
]

function WeddersPage() {
  return (
    <ProductFinder
      productName="Wedders"
      styles={wedderStyles}
      pNumbers={wedderPNumbers}
      tiers={TIERS}
      optionDefs={OPTION_DEFS}
      cropPath="/wedder-crop"
    />
  )
}

export default WeddersPage
