import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Chip,
  IconButton,
  MenuItem,
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
import TablePagination from '@mui/material/TablePagination';
import PostAddRoundedIcon from '@mui/icons-material/PostAddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';

import { apiClient } from '../../api/client';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import { useAuth } from '../../hooks/useAuth';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import type { Competencia, Habilidade, PaginatedResponse, Questao } from '../../types';

interface QuestaoInput {
  enunciado: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c: string;
  alternativa_d: string;
  alternativa_e: string;
  correta: 'A' | 'B' | 'C' | 'D' | 'E';
  competencia: number | '';
  habilidade: number | '';
  status: 'pendente' | 'aprovada';
}

async function fetchCompetencias(): Promise<Competencia[]> {
  const { data } = await apiClient.get<Competencia[] | PaginatedResponse<Competencia>>('/itens/competencias/', {
    params: { page_size: 0 },
  });
  return Array.isArray(data) ? data : data.results;
}

async function fetchHabilidades(): Promise<Habilidade[]> {
  const { data } = await apiClient.get<Habilidade[] | PaginatedResponse<Habilidade>>('/itens/habilidades/', {
    params: { page_size: 0 },
  });
  return Array.isArray(data) ? data : data.results;
}

const initialState: QuestaoInput = {
  enunciado: '',
  alternativa_a: '',
  alternativa_b: '',
  alternativa_c: '',
  alternativa_d: '',
  alternativa_e: '',
  correta: 'A',
  competencia: '',
  habilidade: '',
  status: 'pendente'
};

export function QuestoesPage() {
  const queryClient = useQueryClient();
  const {
    results: questoes,
    total,
    isLoading,
    page,
    pageSize,
    handlePageChange,
    handleRowsPerPageChange,
  } = usePaginatedResource<Questao>({
    queryKey: ['questoes'],
    url: '/itens/questoes/',
    initialPageSize: 10,
  });
  const { data: competencias = [] } = useQuery({
    queryKey: ['competencias'],
    queryFn: fetchCompetencias
  });
  const { data: habilidades = [] } = useQuery({
    queryKey: ['habilidades'],
    queryFn: fetchHabilidades
  });

  const [form, setForm] = useState<QuestaoInput>(initialState);
  const [editing, setEditing] = useState<Questao | null>(null);

  const { user } = useAuth();
  const role = user?.role ?? 'professor';
  const canModerate = role === 'admin' || role === 'superadmin';
  const canDelete = canModerate;

  useEffect(() => {
    if (editing) {
      setForm({
        enunciado: editing.enunciado,
        alternativa_a: editing.alternativa_a,
        alternativa_b: editing.alternativa_b,
        alternativa_c: editing.alternativa_c,
        alternativa_d: editing.alternativa_d,
        alternativa_e: editing.alternativa_e,
        correta: editing.correta,
        competencia: editing.competencia ?? '',
        habilidade: editing.habilidade ?? '',
        status: editing.status
      });
    } else {
      setForm(initialState);
    }
  }, [editing]);

  const saveMutation = useMutation({
    mutationFn: async (payload: QuestaoInput) => {
      const { competencia, habilidade, status, ...rest } = payload;
      const body: Record<string, unknown> = {
        ...rest,
        competencia: competencia || null,
        habilidade: habilidade || null
      };
      if (canModerate) {
        body.status = status;
      }
      if (editing) {
        await apiClient.put(`/itens/questoes/${editing.id}/`, body);
      } else {
        await apiClient.post('/itens/questoes/', body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questoes'] });
      setEditing(null);
      setForm(initialState);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/itens/questoes/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questoes'] })
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveMutation.mutate(form);
  };

  const competenciaLookup = useMemo(() => {
    const map = new Map<number, string>();
    competencias.forEach((item) => map.set(item.id, `${item.codigo} • ${item.descricao}`));
    return map;
  }, [competencias]);

  const habilidadeLookup = useMemo(() => {
    const map = new Map<number, string>();
    habilidades.forEach((item) => map.set(item.id, `${item.codigo} • ${item.descricao}`));
    return map;
  }, [habilidades]);

  const truncate = (value: string) => (value.length > 100 ? `${value.slice(0, 100)}…` : value);

  const actionLabel = editing ? 'Atualizar questão' : 'Cadastrar questão';

  return (
    <PageContainer>
      <PageHeader
        title="Questões"
        description="Cadastre questões e vincule às competências e habilidades."
      />

      <PageSection>
        <Stack component="form" spacing={{ xs: 2.5, md: 3 }} onSubmit={handleSubmit}>
          <TextField
            label="Enunciado"
            value={form.enunciado}
            onChange={(event) => setForm((prev) => ({ ...prev, enunciado: event.target.value }))}
            required
            multiline
            minRows={4}
          />

          <Grid container spacing={{ xs: 2, md: 3 }}>
            {(['a', 'b', 'c', 'd', 'e'] as const).map((alt) => (
              <Grid key={alt} size={{ xs: 12, md: 6 }}>
                <TextField
                  label={`Alternativa ${alt.toUpperCase()}`}
                  value={form[`alternativa_${alt}`]}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, [`alternativa_${alt}`]: event.target.value }))
                  }
                  required
                  multiline
                  minRows={2}
                  fullWidth
                />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={{ xs: 2, md: 3 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="Alternativa correta"
                value={form.correta}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, correta: event.target.value as QuestaoInput['correta'] }))
                }
                fullWidth
              >
                {['A', 'B', 'C', 'D', 'E'].map((alt) => (
                  <MenuItem key={alt} value={alt}>
                    {alt}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="Competência"
                value={form.competencia ? String(form.competencia) : ''}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    competencia: event.target.value ? Number(event.target.value) : ''
                  }))
                }
                fullWidth
              >
                <MenuItem value="">Não informar</MenuItem>
                {competencias.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.codigo}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="Habilidade"
                value={form.habilidade ? String(form.habilidade) : ''}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    habilidade: event.target.value ? Number(event.target.value) : ''
                  }))
                }
                fullWidth
              >
                <MenuItem value="">Não informar</MenuItem>
                {habilidades.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.codigo}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {canModerate ? (
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  select
                  label="Status"
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      status: event.target.value as QuestaoInput['status']
                    }))
                  }
                  fullWidth
                >
                  <MenuItem value="pendente">Pendente</MenuItem>
                  <MenuItem value="aprovada">Aprovada</MenuItem>
                </TextField>
              </Grid>
            ) : (
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Status"
                  value={form.status === 'aprovada' ? 'Aprovada' : 'Pendente'}
                  disabled
                  fullWidth
                />
              </Grid>
            )}
          </Grid>

          <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
            {editing && (
              <Button variant="text" color="inherit" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              startIcon={<PostAddRoundedIcon />}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : actionLabel}
            </Button>
          </Stack>
        </Stack>
      </PageSection>

      <PageSection>
        <Stack spacing={2}>
          <Typography variant="h6">Questões cadastradas</Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Enunciado</TableCell>
                  <TableCell>Competência</TableCell>
                  <TableCell>Habilidade</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && questoes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Nenhuma questão cadastrada.
                    </TableCell>
                  </TableRow>
                )}
                {questoes.map((questao) => (
                  <TableRow key={questao.id} hover>
                    <TableCell>{questao.id}</TableCell>
                    <TableCell>{truncate(questao.enunciado)}</TableCell>
                    <TableCell>
                      {questao.competencia
                        ? competenciaLookup.get(questao.competencia) ?? questao.competencia
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {questao.habilidade
                        ? habilidadeLookup.get(questao.habilidade) ?? questao.habilidade
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={questao.status === 'aprovada' ? 'Aprovada' : 'Pendente'}
                        color={questao.status === 'aprovada' ? 'success' : 'warning'}
                        variant={questao.status === 'aprovada' ? 'filled' : 'outlined'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton
                          color="primary"
                          onClick={() => setEditing(questao)}
                          aria-label={`Editar questão ${questao.id}`}
                        >
                          <EditRoundedIcon />
                        </IconButton>
                        {canDelete && (
                          <IconButton
                            color="error"
                            onClick={() => deleteMutation.mutate(questao.id)}
                            aria-label={`Excluir questão ${questao.id}`}
                          >
                            <DeleteRoundedIcon />
                          </IconButton>
                        )}
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
