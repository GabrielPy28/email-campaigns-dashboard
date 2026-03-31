import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./LoginPage";
import { RootRedirect } from "./RootRedirect";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { CampanasPage } from "./dashboard/CampanasPage";
import { NuevaCampanaPage } from "./dashboard/NuevaCampanaPage";
import { PlantillasPage } from "./dashboard/PlantillasPage";
import { NuevaPlantillaPage } from "./dashboard/NuevaPlantillaPage";
import { EditarPlantillaPage } from "./dashboard/EditarPlantillaPage";
import { SendersPage } from "./dashboard/SendersPage";
import { ListasPage } from "./dashboard/ListasPage";
import { ListaDetallePage } from "./dashboard/ListaDetallePage";
import { CreadoresPage } from "./dashboard/CreadoresPage";
import { PruebasPage } from "./dashboard/PruebasPage";
import { QrCodesPage } from "./dashboard/QrCodesPage";
import { ReportesLayout } from "./dashboard/reportes/ReportesLayout";
import { ReportesIndexPage } from "./dashboard/reportes/ReportesIndexPage";
import { ReportesCampanasPage } from "./dashboard/reportes/ReportesCampanasPage";
import { ReportesSendersPage } from "./dashboard/reportes/ReportesSendersPage";
import { ReportesPlantillasPage } from "./dashboard/reportes/ReportesPlantillasPage";
import { ReportesRecipientesPage } from "./dashboard/reportes/ReportesRecipientesPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/dashboard/campanas" replace />} />
        <Route path="campanas" element={<CampanasPage />} />
        <Route path="campanas/nueva" element={<NuevaCampanaPage />} />
        <Route path="plantillas" element={<PlantillasPage />} />
        <Route path="plantillas/nueva" element={<NuevaPlantillaPage />} />
        <Route path="plantillas/editar/:id" element={<EditarPlantillaPage />} />
        <Route path="senders" element={<SendersPage />} />
        <Route path="listas" element={<ListasPage />} />
        <Route path="listas/:listId" element={<ListaDetallePage />} />
        <Route path="creadores" element={<CreadoresPage />} />
        <Route path="pruebas" element={<PruebasPage />} />
        {/*<Route path="codigos-qr" element={<QrCodesPage />} />*/}
        <Route path="reportes" element={<ReportesLayout />}>
          <Route index element={<ReportesIndexPage />} />
          <Route path="campanas" element={<ReportesCampanasPage />} />
          <Route path="senders" element={<ReportesSendersPage />} />
          <Route path="plantillas" element={<ReportesPlantillasPage />} />
          <Route path="recipientes" element={<ReportesRecipientesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
