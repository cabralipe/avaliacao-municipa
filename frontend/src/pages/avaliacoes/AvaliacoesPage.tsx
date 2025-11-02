import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import Grid from '@mui/material/Grid';
import TablePagination from '@mui/material/TablePagination';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';

import { apiClient } from '../../api/client';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import type { Avaliacao, PaginatedResponse, Turma } from '../../types';

interface AvaliacaoInput {
  titulo: string;
  data_aplicacao: string;
  turmas: number[];
  liberada_para_professores: boolean;
  habilitar_correcao_qr: boolean;
}

async function fetchTurmas(): Promise<Turma[]> {
  const { data } = await apiClient.get<Turma[] | PaginatedResponse<Turma>>('/escolas/turmas/', {
    params: { page_size: 0 },
  });
  return Array.isArray(data) ? data : data.results;
}

export function AvaliacoesPage() {
  const queryClient = useQueryClient();
  const { data: turmas = [] } = useQuery({ queryKey: ['turmas'], queryFn: fetchTurmas });
  const {
    results: avaliacoes,
    total,
    isLoading,
    page,
    pageSize,
    handlePageChange,
    handleRowsPerPageChange,
  } = usePaginatedResource<Avaliacao>({
    queryKey: ['avaliacoes'],
    url: '/avaliacoes/avaliacoes/',
    initialPageSize: 10,
  });

  const [form, setForm] = useState<AvaliacaoInput>({
    titulo: '',
    data_aplicacao: '',
    turmas: [],
    liberada_para_professores: false,
    habilitar_correcao_qr: false
  });
  const [editing, setEditing] = useState<Avaliacao | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        titulo: editing.titulo,
        data_aplicacao: editing.data_aplicacao,
        turmas: editing.turmas,
        liberada_para_professores: editing.liberada_para_professores,
        habilitar_correcao_qr: editing.habilitar_correcao_qr
      });
    } else {
      setForm({
        titulo: '',
        data_aplicacao: '',
        turmas: [],
        liberada_para_professores: false,
        habilitar_correcao_qr: false
      });
    }
  }, [editing]);

  const turmasMap = useMemo(() => {
    const map = new Map<number, Turma>();
    turmas.forEach((turma) => map.set(turma.id, turma));
    return map;
  }, [turmas]);

  const saveMutation = useMutation({
    mutationFn: async (payload: AvaliacaoInput) => {
      if (editing) {
        await apiClient.put(`/avaliacoes/avaliacoes/${editing.id}/`, payload);
      } else {
        await apiClient.post('/avaliacoes/avaliacoes/', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avaliacoes'] });
      setEditing(null);
      setForm({
        titulo: '',
        data_aplicacao: '',
        turmas: [],
        liberada_para_professores: false,
        habilitar_correcao_qr: false
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/avaliacoes/avaliacoes/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['avaliacoes'] })
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveMutation.mutate(form);
  };

  const handleTurmasChange = (event: SelectChangeEvent<string[]>) => {
    const { value } = event.target;
    const values = Array.isArray(value) ? value : value.split(',');
    setForm((prev) => ({ ...prev, turmas: values.map((item) => Number(item)) }));
  };

  const toggleMutation = useMutation({
    mutationFn: async (payload: {
      id: number;
      field: 'liberada_para_professores' | 'habilitar_correcao_qr';
      value: boolean;
    }) => {
      await apiClient.patch(`/avaliacoes/avaliacoes/${payload.id}/`, {
        [payload.field]: payload.value
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['avaliacoes'] })
  });

  const handleToggle =
    (avaliacao: Avaliacao, field: 'liberada_para_professores' | 'habilitar_correcao_qr') =>
    (_event: ChangeEvent<HTMLInputElement>, checked: boolean) => {
      toggleMutation.mutate({ id: avaliacao.id, field, value: checked });
    };

  const actionLabel = editing ? 'Atualizar avaliação' : 'Cadastrar avaliação';

  return (
    <PageContainer>
      <PageHeader
        title="Avaliações"
        description="Agende avaliações e defina para quais turmas serão aplicadas."
      />

      <PageSection>
        <Stack component="form" spacing={{ xs: 2, md: 3 }} onSubmit={handleSubmit}>
          <Grid container spacing={{ xs: 2, md: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Título"
                value={form.titulo}
                onChange={(event) => setForm((prev) => ({ ...prev, titulo: event.target.value }))}
                required
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Data de aplicação"
                type="date"
                value={form.data_aplicacao}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, data_aplicacao: event.target.value }))
                }
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>

          <FormControl fullWidth>
            <InputLabel id="avaliacoes-turmas-label">Turmas participantes</InputLabel>
            <Select
              labelId="avaliacoes-turmas-label"
              multiple
              value={form.turmas.map(String)}
              onChange={handleTurmasChange}
              label="Turmas participantes"
              renderValue={(selected) =>
                selected
                  .map((value) => turmasMap.get(Number(value))?.nome ?? value)
                  .join(', ')
              }
            >
              {turmas.map((turma) => (
                <MenuItem key={turma.id} value={String(turma.id)}>
                  {turma.nome} • {turma.ano}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
            {editing && (
              <Button variant="text" color="inherit" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              startIcon={<EventAvailableRoundedIcon />}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : actionLabel}
            </Button>
          </Stack>
        </Stack>
      </PageSection>

      <PageSection>
        <Stack spacing={2}>
          <Typography variant="h6">Avaliações cadastradas</Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Título</TableCell>
                  <TableCell>Data</TableCell>
                  <TableCell>Turmas</TableCell>
                  <TableCell align="center">Download liberado</TableCell>
                  <TableCell align="center">Correção via QR</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && avaliacoes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Nenhuma avaliação cadastrada.
                    </TableCell>
                  </TableRow>
                )}
                {avaliacoes.map((avaliacao) => (
                  <TableRow key={avaliacao.id} hover>
                    <TableCell>{avaliacao.id}</TableCell>
                    <TableCell>{avaliacao.titulo}</TableCell>
                    <TableCell>{avaliacao.data_aplicacao}</TableCell>
                    <TableCell sx={{ whiteSpace: 'pre-wrap' }}>
                      {avaliacao.turmas
                        .map((id) => turmasMap.get(id)?.nome ?? id)
                        .join(', ') || '—'}
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={avaliacao.liberada_para_professores}
                        onChange={handleToggle(avaliacao, 'liberada_para_professores')}
                        inputProps={{
                          'aria-label': `Liberar download da avaliação ${avaliacao.titulo}`
                        }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={avaliacao.habilitar_correcao_qr}
                        onChange={handleToggle(avaliacao, 'habilitar_correcao_qr')}
                        inputProps={{
                          'aria-label': `Habilitar correção via QR da avaliação ${avaliacao.titulo}`
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton
                          color="primary"
                          onClick={() => setEditing(avaliacao)}
                          aria-label={`Editar ${avaliacao.titulo}`}
                        >
                          <EditRoundedIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => deleteMutation.mutate(avaliacao.id)}
                          aria-label={`Excluir ${avaliacao.titulo}`}
                        >
                          <DeleteRoundedIcon />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[5, 10, 20, 50]}
          />
        </Stack>
      </PageSection>
    </PageContainer>
  );
}
