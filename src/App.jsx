import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CreditCalculator from './pages/CreditCalculator'
import GoldClubTracker from './pages/GoldClubTracker'
import RotationPage from './pages/RotationPage'
import IncentivesPage from './pages/IncentivesPage'
import ConversionPage from './pages/ConversionPage'
import DevPage from './pages/DevPage'
import ObservationPage from './pages/ObservationPage'
import ClockworkPage from './pages/ClockworkPage'
import ConciergePage from './pages/ConciergePage'
import WeddersPage from './pages/WeddersPage'
import WedderCropPage from './pages/WedderCropPage'
import ChainsFinderPage from './pages/ChainsFinderPage'
import ChainCropPage from './pages/ChainCropPage'
import RingsFinderPage from './pages/RingsFinderPage'
import RingCropPage from './pages/RingCropPage'
import TennisFinderPage from './pages/TennisFinderPage'
import TennisCropPage from './pages/TennisCropPage'
import WatchesPage from './pages/WatchesPage'
import WatchPairPage from './pages/WatchPairPage'
import FindByPhotoPage from './pages/FindByPhotoPage'
import ImageAdminPage from './pages/ImageAdminPage'
import BanglesFinderPage from './pages/BanglesFinderPage'
import PendantBarFinderPage from './pages/PendantBarFinderPage'
import CatalogProcessPage from './pages/CatalogProcessPage'
import MigrateSkusPage from './pages/MigrateSkusPage'
import ManagersReportPage from './pages/ManagersReportPage'
import SpreadAnalysisPage from './pages/SpreadAnalysisPage'
import BookingPage from './pages/BookingPage'
import BookingAdminPage from './pages/BookingAdminPage'
import SPProfilePage from './pages/SPProfilePage'
import AdminPage from './pages/AdminPage'
import AccessLogPage from './pages/AccessLogPage'
import RepairsPage from './pages/RepairsPage'
import CaratClubPage from './pages/CaratClubPage'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/credit-calculator" element={<CreditCalculator />} />
      <Route path="/gold-club-tracker" element={<GoldClubTracker />} />
      <Route path="/rotation" element={<RotationPage />} />
      <Route path="/incentives" element={<IncentivesPage />} />
      <Route path="/conversion" element={<ConversionPage />} />
      <Route path="/dev" element={<DevPage />} />
      <Route path="/observation" element={<ObservationPage />} />
      <Route path="/clockwork" element={<ClockworkPage />} />
      <Route path="/findsku" element={<ConciergePage />} />
      <Route path="/wedders" element={<WeddersPage />} />
      <Route path="/wedder-crop" element={<WedderCropPage />} />
      <Route path="/chains" element={<ChainsFinderPage />} />
      <Route path="/chain-crop" element={<ChainCropPage />} />
      <Route path="/rings" element={<RingsFinderPage />} />
      <Route path="/ring-crop" element={<RingCropPage />} />
      <Route path="/tennis" element={<TennisFinderPage />} />
      <Route path="/tennis-crop" element={<TennisCropPage />} />
      <Route path="/bangles" element={<BanglesFinderPage />} />
      <Route path="/pendant-bar" element={<PendantBarFinderPage />} />
      <Route path="/watches" element={<WatchesPage />} />
      <Route path="/watch-pair" element={<WatchPairPage />} />
      <Route path="/find-by-photo" element={<FindByPhotoPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/images" element={<ImageAdminPage />} />
      <Route path="/admin/booking" element={<BookingAdminPage />} />
      <Route path="/admin/migrate-skus" element={<MigrateSkusPage />} />
      <Route path="/admin/access-log" element={<AccessLogPage />} />
      <Route path="/repairs" element={<RepairsPage />} />
      <Route path="/carat-club" element={<CaratClubPage />} />
      <Route path="/image-admin" element={<ImageAdminPage />} />
      <Route path="/catalog-process" element={<CatalogProcessPage />} />
      <Route path="/managers-report" element={<ManagersReportPage />} />
      <Route path="/spread-analysis" element={<SpreadAnalysisPage />} />
      <Route path="/booking" element={<BookingPage />} />
      <Route path="/booking/admin" element={<BookingAdminPage />} />
      <Route path="/booking/:slug" element={<BookingPage />} />
      <Route path="/sp/:slug" element={<SPProfilePage />} />
    </Routes>
  )
}

export default App
