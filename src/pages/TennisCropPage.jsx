import ProductCropPage from './ProductCropPage'
import { tennisStyles } from '../data/tennis'

const CATALOG_DEFS = [
  { id: 1, label: 'Catalog 1', desc: 'Tennis styles' },
]

const STYLE_NAMES = tennisStyles.map((s) => s.name)

export default function TennisCropPage() {
  return (
    <ProductCropPage
      productName="Tennis"
      backPath="/tennis"
      catalogDefs={CATALOG_DEFS}
      styleNames={STYLE_NAMES}
    />
  )
}
