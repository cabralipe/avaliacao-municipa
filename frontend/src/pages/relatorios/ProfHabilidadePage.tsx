import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import AnalyticsRoundedIcon from '@mui/icons-material/AnalyticsRounded';

import { apiClient } from '../../api/client';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import { useAuth } from '../../hooks/useAuth';

interface LinhaRelatorio {
  caderno_questao__questao__habilidade__codigo: string | null;
  acertos: number;
}

async function fetchRelatorio(secretariaId: number): Promise<LinhaRelatorio[]> {
  const { data } = await apiClient.get<LinhaRelatorio[]>(
    `/relatorios/rede/${secretariaId}/proficiencia-por-habilidade/`
  );
  return data;
}

export function ProfHabilidadePage() {
  const { user } = useAuth();
  const [secretariaId, setSecretariaId] = useState<number>(user?.secretaria?.id ?? 0);
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  const { data = [], isFetching, refetch } = useQuery({
    queryKey: ['relatorio-habilidade', submittedId],
    queryFn: () => fetchRelatorio(submittedId ?? 0),
    enabled: submittedId !== null
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (secretariaId > 0) {
      setSubmittedId(secretariaId);
      refetch();
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Proficiência por habilidade"
        description="Veja o total de acertos por habilidade na rede selecionada."
      />

      <PageSection>
        <Stack component="form" spacing={{ xs: 2, md: 3 }} onSubmit={handleSubmit}>
          <TextField
            label="ID da secretaria"
            type="number"
            value={secretariaId || ''}
            onChange={(event) => setSecretariaId(Number(event.target.value))}
            required
            InputProps={{ inputProps: { min: 1 } }}
            helperText="Informe o identificador numérico da secretaria para gerar o relatório."
            fullWidth
          />
          <Stack direction="row" justifyContent="flex-end">
            <Button type="submit" variant="contained" startIcon={<AnalyticsRoundedIcon />}>
              Gerar relatório
            </Button>
          </Stack>
        </Stack>
      </PageSection>

      {submittedId && (
        <PageSection>
          <Stack spacing={2}>
            <Typography variant="h6">
              {`Resultados encontrados para a secretaria ${submittedId}`}
            </Typography>
            {isFetching && <Alert severity="info">Buscando dados...</Alert>}
            {!isFetching && data.length === 0 && (
              <Alert severity="warning">Nenhum dado para a secretaria informada.</Alert>
            )}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Habilidade</TableCell>
                    <TableCell>Acertos</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((linha) => (
                    <TableRow key={linha.caderno_questao__questao__habilidade__codigo ?? 'sem-codigo'}>
                      <TableCell>
                        {linha.caderno_questao__questao__habilidade__codigo ?? 'Sem código'}
                      </TableCell>
                      <TableCell>{linha.acertos}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </PageSection>
      )}
    </PageContainer>
  );
}
