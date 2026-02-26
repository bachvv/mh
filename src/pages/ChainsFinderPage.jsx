import ProductFinder from '../components/ProductFinder'
import { chainStyles, chainPNumbers } from '../data/chains'

const TIERS = [
  { id: 'Gold', label: 'Solid Chains' },
  { id: 'SemiSolid', label: 'Semi Solid Chains' },
]

const OPTION_DEFS = [
  { key: 'metals',  label: 'Metal' },
  { key: 'lengths', label: 'Length' },
]

function ChainsFinderPage() {
  return (
    <ProductFinder
      productName="Chains"
      styles={chainStyles}
      pNumbers={chainPNumbers}
      tiers={TIERS}
      optionDefs={OPTION_DEFS}
      cropPath="/chain-crop"
    />
  )
}

export default ChainsFinderPage
