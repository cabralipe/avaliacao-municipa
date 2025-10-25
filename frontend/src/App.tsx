import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { RequireAuth } from './components/RequireAuth';
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
        <Route index element={<DashboardPage />} />
        <Route path="escolas" element={<EscolasPage />} />
        <Route path="escolas/turmas" element={<TurmasPage />} />
        <Route path="escolas/alunos" element={<AlunosPage />} />
        <Route path="itens/competencias" element={<CompetenciasPage />} />
        <Route path="itens/habilidades" element={<HabilidadesPage />} />
        <Route path="itens/questoes" element={<QuestoesPage />} />
        <Route path="avaliacoes" element={<AvaliacoesPage />} />
        <Route path="avaliacoes/cadernos" element={<CadernosPage />} />
        <Route path="avaliacoes/provas" element={<ProvasPage />} />
        <Route path="respostas" element={<RespostasPage />} />
        <Route path="respostas/gabaritos" element={<GabaritosPage />} />
        <Route
          path="relatorios/proficiencia-habilidade"
          element={<ProfHabilidadePage />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
