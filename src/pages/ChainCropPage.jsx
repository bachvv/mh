import ProductCropPage from './ProductCropPage'
import { chainStyles } from '../data/chains'

const CATALOG_DEFS = [
  { id: 1, label: 'Catalog 1', desc: 'Chain styles' },
]

const STYLE_NAMES = chainStyles.map((s) => s.name)

export default function ChainCropPage() {
  return (
    <ProductCropPage
      productName="Chains"
      backPath="/chains"
      catalogDefs={CATALOG_DEFS}
      styleNames={STYLE_NAMES}
    />
  )
}
