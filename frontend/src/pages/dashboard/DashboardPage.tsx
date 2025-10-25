import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';

import { apiClient } from '../../api/client';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';

interface Summary {
  escolas: number;
  turmas: number;
  alunos: number;
  questoes: number;
  avaliacoes: number;
}

async function fetchSummary(): Promise<Summary> {
  const [escolas, turmas, alunos, questoes, avaliacoes] = await Promise.all([
    apiClient.get('/escolas/escolas/'),
    apiClient.get('/escolas/turmas/'),
    apiClient.get('/escolas/alunos/'),
    apiClient.get('/itens/questoes/'),
    apiClient.get('/avaliacoes/avaliacoes/')
  ]);

  return {
    escolas: escolas.data.length ?? 0,
    turmas: turmas.data.length ?? 0,
    alunos: alunos.data.length ?? 0,
    questoes: questoes.data.length ?? 0,
    avaliacoes: avaliacoes.data.length ?? 0
  };
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchSummary
  });

  const stats = useMemo(
    () => [
      { label: 'Escolas cadastradas', value: data?.escolas ?? 0 },
      { label: 'Turmas ativas', value: data?.turmas ?? 0 },
      { label: 'Alunos acompanhados', value: data?.alunos ?? 0 },
      { label: 'Questões disponíveis', value: data?.questoes ?? 0 },
      { label: 'Avaliações planejadas', value: data?.avaliacoes ?? 0 }
    ],
    [data]
  );

  return (
    <PageContainer>
      <PageHeader
        title="Painel Geral"
        description="Visão rápida dos principais cadastros e acompanhamentos da rede."
      />

      <Grid container spacing={{ xs: 2, md: 3 }}>
        {stats.map((item) => (
          <Grid key={item.label} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <PageSection
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)'
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {item.label}
              </Typography>
              {isLoading ? (
                <Skeleton variant="text" animation="wave" height={56} sx={{ width: '60%' }} />
              ) : (
                <Typography variant="h3" color="primary.main" fontWeight={700}>
                  {item.value}
                </Typography>
              )}
            </PageSection>
          </Grid>
        ))}
      </Grid>

      <PageSection sx={{ background: 'linear-gradient(135deg, #2563eb0f, #f8fafc)', border: '1px solid rgba(37, 99, 235, 0.12)' }}>
        <Stack spacing={1.5}>
          <Typography variant="h6">Acompanhamento contínuo</Typography>
          <Typography variant="body1" color="text.secondary">
            Utilize os módulos de banco de itens, avaliações e relatórios para conduzir ciclos de aprendizagem baseados em evidências. Cadastre novas questões, organize cadernos personalizados e acompanhe a proficiência dos estudantes com os relatórios dedicados.
          </Typography>
        </Stack>
      </PageSection>
    </PageContainer>
  );
}
