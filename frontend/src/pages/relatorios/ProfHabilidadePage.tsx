import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
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
import Grid from '@mui/material/Grid';
import type { SelectChangeEvent } from '@mui/material/Select';
import AnalyticsRoundedIcon from '@mui/icons-material/AnalyticsRounded';

import { apiClient } from '../../api/client';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import { useAuth } from '../../hooks/useAuth';
import type { Avaliacao, PaginatedResponse } from '../../types';

interface LinhaRelatorio {
  caderno_questao__questao__habilidade__codigo: string | null;
  acertos: number;
}

interface RelatorioParams {
  secretariaId: number;
  dataInicial?: string;
  dataFinal?: string;
  avaliacoes: number[];
}

async function fetchRelatorio({
  secretariaId,
  dataInicial,
  dataFinal,
  avaliacoes,
}: RelatorioParams): Promise<LinhaRelatorio[]> {
  const params: Record<string, string> = {};
  if (avaliacoes.length > 0) {
    params.avaliacao_id = avaliacoes.join(',');
  }
  if (dataInicial) {
    params.data_inicial = dataInicial;
  }
  if (dataFinal) {
    params.data_final = dataFinal;
  }

  const { data } = await apiClient.get<LinhaRelatorio[]>(
    `/relatorios/rede/${secretariaId}/proficiencia-por-habilidade/`,
    { params }
  );
  return data;
}

async function fetchAvaliacoesOptions(): Promise<Avaliacao[]> {
  const { data } = await apiClient.get<Avaliacao[] | PaginatedResponse<Avaliacao>>(
    '/avaliacoes/avaliacoes/',
    { params: { page_size: 0 } }
  );
  return Array.isArray(data) ? data : data.results;
}

export function ProfHabilidadePage() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  interface FormState {
    secretariaId: string;
    dataInicial: string;
    dataFinal: string;
    avaliacoes: string[];
  }

  const [form, setForm] = useState<FormState>({
    secretariaId: user?.secretaria?.id ? String(user.secretaria.id) : '',
    dataInicial: '',
    dataFinal: '',
    avaliacoes: [],
  });

  const [appliedFilters, setAppliedFilters] = useState<RelatorioParams | null>(null);

  useEffect(() => {
    if (!isSuperadmin && user?.secretaria?.id && appliedFilters === null) {
      setForm((prev) => ({ ...prev, secretariaId: String(user.secretaria!.id) }));
      setAppliedFilters({ secretariaId: user.secretaria.id, dataInicial: '', dataFinal: '', avaliacoes: [] });
    }
  }, [isSuperadmin, user?.secretaria?.id, appliedFilters]);

  const { data: avaliacaoOptions = [] } = useQuery({
    queryKey: ['avaliacoes', 'options'],
    queryFn: fetchAvaliacoesOptions,
  });

  const { data = [], isFetching } = useQuery({
    queryKey: ['relatorio-habilidade', appliedFilters],
    queryFn: () => fetchRelatorio(appliedFilters!),
    enabled: appliedFilters !== null,
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const secretariaIdNumeric = Number(form.secretariaId);
    if (!secretariaIdNumeric) {
      return;
    }

    const avaliacaoIds = form.avaliacoes
      .map((value) => Number(value))
      .filter((value) => !Number.isNaN(value));

    setAppliedFilters({
      secretariaId: secretariaIdNumeric,
      dataInicial: form.dataInicial || undefined,
      dataFinal: form.dataFinal || undefined,
      avaliacoes: avaliacaoIds,
    });
  };

  const avaliacaoLookup = useMemo(() => {
    const map = new Map<number, string>();
    avaliacaoOptions.forEach((avaliacao: Avaliacao) => {
      map.set(avaliacao.id, avaliacao.titulo);
    });
    return map;
  }, [avaliacaoOptions]);

  const selectedSecretariaLabel = useMemo(() => {
    if (isSuperadmin) {
      return form.secretariaId ? `Secretaria ${form.secretariaId}` : '';
    }
    return user?.secretaria?.nome ?? '';
  }, [form.secretariaId, isSuperadmin, user?.secretaria?.nome]);

  const handleAvaliacaoChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      avaliacoes: typeof value === 'string' ? value.split(',') : value,
    }));
  };

  return (
    <PageContainer>
      <PageHeader
        title="Proficiência por habilidade"
        description="Veja o total de acertos por habilidade na rede selecionada."
      />

      <PageSection>
        <Stack component="form" spacing={{ xs: 2, md: 3 }} onSubmit={handleSubmit}>
          <Grid container spacing={{ xs: 2, md: 3 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              {isSuperadmin ? (
                <TextField
                  label="ID da secretaria"
                  type="number"
                  value={form.secretariaId}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, secretariaId: event.target.value }))
                  }
                  required
                  InputProps={{ inputProps: { min: 1 } }}
                  helperText="Informe o identificador numérico da secretaria."
                  fullWidth
                />
              ) : (
                <TextField
                  label="Secretaria"
                  value={selectedSecretariaLabel}
                  InputProps={{ readOnly: true }}
                  fullWidth
                />
              )}
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Data inicial"
                type="date"
                value={form.dataInicial}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, dataInicial: event.target.value }))
                }
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Data final"
                type="date"
                value={form.dataFinal}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, dataFinal: event.target.value }))
                }
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel id="filtro-avaliacoes-label">Avaliações</InputLabel>
                <Select
                  labelId="filtro-avaliacoes-label"
                  multiple
                  value={form.avaliacoes}
                  onChange={handleAvaliacaoChange}
                  label="Avaliações"
                  renderValue={(selected) =>
                    selected
                      .map((value) => {
                        const numericId = Number(value);
                        return avaliacaoLookup.get(numericId) ?? `Avaliação ${value}`;
                      })
                      .join(', ')
                  }
                >
                  {avaliacaoOptions.map((avaliacao: Avaliacao) => (
                    <MenuItem key={avaliacao.id} value={String(avaliacao.id)}>
                      {avaliacao.titulo}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end">
            <Button type="submit" variant="contained" startIcon={<AnalyticsRoundedIcon />}>
              Gerar relatório
            </Button>
          </Stack>
        </Stack>
      </PageSection>

      {appliedFilters && (
        <PageSection>
          <Stack spacing={2}>
            <Typography variant="h6">
              {`Resultados encontrados para a secretaria ${appliedFilters.secretariaId}`}
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
