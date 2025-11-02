import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { RequireAuth } from './components/RequireAuth';
import { RequireRole } from './components/RequireRole';
import { FullScreenSpinner } from './components/FullScreenSpinner';
import { useAuth } from './hooks/useAuth';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { LoginPage } from './pages/auth/LoginPage';
import { EscolasPage } from './pages/escolas/EscolasPage';
import { TurmasPage } from './pages/escolas/TurmasPage';
import { AlunosPage } from './pages/escolas/AlunosPage';
import { CompetenciasPage } from './pages/itens/CompetenciasPage';
import { HabilidadesPage } from './pages/itens/HabilidadesPage';
import { QuestoesPage } from './pages/itens/QuestoesPage';
import { AvaliacoesPage } from './pages/avaliacoes/AvaliacoesPage';
import { CadernosPage } from './pages/avaliacoes/CadernosPage';
import { ProvasPage } from './pages/avaliacoes/ProvasPage';
import { RespostasPage } from './pages/respostas/RespostasPage';
import { GabaritosPage } from './pages/respostas/GabaritosPage';
import { ProfHabilidadePage } from './pages/relatorios/ProfHabilidadePage';

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return <FullScreenSpinner />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route
          index
          element={
            <RequireRole allowed={['admin', 'professor']}>
              <DashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="escolas"
          element={
            <RequireRole allowed={['admin']}>
              <EscolasPage />
            </RequireRole>
          }
        />
        <Route
          path="escolas/turmas"
          element={
            <RequireRole allowed={['admin']}>
              <TurmasPage />
            </RequireRole>
          }
        />
        <Route
          path="escolas/alunos"
          element={
            <RequireRole allowed={['admin']}>
              <AlunosPage />
            </RequireRole>
          }
        />
        <Route
          path="itens/competencias"
          element={
            <RequireRole allowed={['admin', 'professor']}>
              <CompetenciasPage />
            </RequireRole>
          }
        />
        <Route
          path="itens/habilidades"
          element={
            <RequireRole allowed={['admin', 'professor']}>
              <HabilidadesPage />
            </RequireRole>
          }
        />
        <Route
          path="itens/questoes"
          element={
            <RequireRole allowed={['admin', 'professor']}>
              <QuestoesPage />
            </RequireRole>
          }
        />
        <Route
          path="avaliacoes"
          element={
            <RequireRole allowed={['admin']}>
              <AvaliacoesPage />
            </RequireRole>
          }
        />
        <Route
          path="avaliacoes/cadernos"
          element={
            <RequireRole allowed={['admin']}>
              <CadernosPage />
            </RequireRole>
          }
        />
        <Route
          path="avaliacoes/provas"
          element={
            <RequireRole allowed={['admin']}>
              <ProvasPage />
            </RequireRole>
          }
        />
        <Route
          path="respostas"
          element={
            <RequireRole allowed={['admin']}>
              <RespostasPage />
            </RequireRole>
          }
        />
        <Route
          path="respostas/gabaritos"
          element={
            <RequireRole allowed={['admin']}>
              <GabaritosPage />
            </RequireRole>
          }
        />
        <Route
          path="relatorios/proficiencia-habilidade"
          element={
            <RequireRole allowed={['admin']}>
              <ProfHabilidadePage />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
