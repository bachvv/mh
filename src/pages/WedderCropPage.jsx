import ProductCropPage from './ProductCropPage'
import { wedderStyles } from '../data/wedders'

const CATALOG_DEFS = [
  { id: 1, label: 'Catalog 1', desc: 'Flat' },
  { id: 2, label: 'Catalog 2', desc: 'High Dome + Round High Dome' },
  { id: 3, label: 'Catalog 3', desc: 'Lite Half Round + Half Round' },
  { id: 4, label: 'Catalog 4', desc: 'Bevel Two Tone + Flat Groove + Vert Side Bevel' },
  { id: 5, label: 'Catalog 5', desc: 'Flat Bevel + Reverse Bevel' },
]

const STYLE_NAMES = wedderStyles.map((s) => s.name)

export default function WedderCropPage() {
  return (
    <ProductCropPage
      productName="Wedders"
      backPath="/wedders"
      catalogDefs={CATALOG_DEFS}
      styleNames={STYLE_NAMES}
    />
  )
}
