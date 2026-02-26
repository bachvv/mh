import ProductCropPage from './ProductCropPage'
import { ringStyles } from '../data/rings'

const CATALOG_DEFS = [
  { id: 1, label: 'Catalog 1', desc: 'Ring styles' },
]

const STYLE_NAMES = ringStyles.map((s) => s.name)

export default function RingCropPage() {
  return (
    <ProductCropPage
      productName="Rings"
      backPath="/rings"
      catalogDefs={CATALOG_DEFS}
      styleNames={STYLE_NAMES}
    />
  )
}
