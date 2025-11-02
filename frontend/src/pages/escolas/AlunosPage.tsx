import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
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
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';

import { apiClient } from '../../api/client';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import type { Aluno, Escola, PaginatedResponse, Turma } from '../../types';
import { formatCPF, unformatCPF } from '../../utils/cpf';

interface AlunoInput {
  turma: number;
  nome: string;
  cpf: string;
}

async function fetchTurmas(): Promise<Turma[]> {
  const { data } = await apiClient.get<Turma[] | PaginatedResponse<Turma>>('/escolas/turmas/', {
    params: { page_size: 0 },
  });
  return Array.isArray(data) ? data : data.results;
}

async function fetchEscolas(): Promise<Escola[]> {
  const { data } = await apiClient.get<Escola[] | PaginatedResponse<Escola>>('/escolas/escolas/', {
    params: { page_size: 0 },
  });
  return Array.isArray(data) ? data : data.results;
}

export function AlunosPage() {
  const queryClient = useQueryClient();
  const { data: turmas = [] } = useQuery({ queryKey: ['turmas'], queryFn: fetchTurmas });
  const { data: escolas = [] } = useQuery({ queryKey: ['escolas'], queryFn: fetchEscolas });
  const {
    results: alunos,
    total,
    isLoading,
    page,
    pageSize,
    handlePageChange,
    handleRowsPerPageChange,
  } = usePaginatedResource<Aluno>({
    queryKey: ['alunos'],
    url: '/escolas/alunos/',
    initialPageSize: 10,
  });

  const [form, setForm] = useState<AlunoInput>({ turma: 0, nome: '', cpf: '' });
  const [editing, setEditing] = useState<Aluno | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({ 
        turma: editing.turma, 
        nome: editing.nome, 
        cpf: formatCPF(editing.cpf || '') 
      });
    } else {
      setForm({ turma: turmas[0]?.id ?? 0, nome: '', cpf: '' });
    }
  }, [editing, turmas]);

  const turmasComEscola = useMemo(
    () =>
      turmas.map((turma) => ({
        ...turma,
        escolaNome: escolas.find((escola) => escola.id === turma.escola)?.nome ?? '—'
      })),
    [turmas, escolas]
  );

  const saveMutation = useMutation({
    mutationFn: async (payload: AlunoInput) => {
      // Remove a formatação do CPF antes de enviar
      const payloadWithUnformattedCPF = {
        ...payload,
        cpf: unformatCPF(payload.cpf)
      };
      
      if (editing) {
        await apiClient.put(`/escolas/alunos/${editing.id}/`, payloadWithUnformattedCPF);
      } else {
        await apiClient.post('/escolas/alunos/', payloadWithUnformattedCPF);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alunos'] });
      setEditing(null);
      setForm({ turma: turmas[0]?.id ?? 0, nome: '', cpf: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/escolas/alunos/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alunos'] })
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.turma) {
      return;
    }
    saveMutation.mutate(form);
  };

  const actionLabel = editing ? 'Atualizar aluno' : 'Cadastrar aluno';

  return (
    <PageContainer>
      <PageHeader
        title="Alunos"
        description="Gerencie os alunos e atribua-os às turmas."
      />

      <PageSection>
        <Stack component="form" spacing={{ xs: 2, md: 3 }} onSubmit={handleSubmit}>
          <Grid container spacing={{ xs: 2, md: 3 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label="Turma"
                value={form.turma ? String(form.turma) : ''}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, turma: Number(event.target.value) }))
                }
                required
                fullWidth
              >
                <MenuItem value="">Selecione a turma</MenuItem>
                {turmasComEscola.map((turma) => (
                  <MenuItem key={turma.id} value={turma.id}>
                    {turma.nome} • {turma.escolaNome}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Nome do aluno"
                value={form.nome}
                onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                required
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="CPF"
                value={form.cpf}
                onChange={(event) => {
                  const formattedCPF = formatCPF(event.target.value);
                  setForm((prev) => ({ ...prev, cpf: formattedCPF }));
                }}
                placeholder="000.000.000-00"
                inputProps={{
                  maxLength: 14 // XXX.XXX.XXX-XX
                }}
                fullWidth
              />
            </Grid>
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
              startIcon={<PersonAddRoundedIcon />}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : actionLabel}
            </Button>
          </Stack>
        </Stack>
      </PageSection>

      <PageSection>
        <Stack spacing={2}>
          <Typography variant="h6">Alunos cadastrados</Typography>
          <TableContainer>
            <Table size="medium">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Aluno</TableCell>
                  <TableCell>CPF</TableCell>
                  <TableCell>Turma</TableCell>
                  <TableCell>Escola</TableCell>
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
                {!isLoading && alunos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Nenhum aluno cadastrado.
                    </TableCell>
                  </TableRow>
                )}
                {alunos.map((aluno) => {
                  const turma = turmasComEscola.find((item) => item.id === aluno.turma);
                  return (
                    <TableRow key={aluno.id} hover>
                      <TableCell>{aluno.id}</TableCell>
                      <TableCell>{aluno.nome}</TableCell>
                      <TableCell>{aluno.cpf ? formatCPF(aluno.cpf) : '—'}</TableCell>
                      <TableCell>{turma?.nome ?? aluno.turma}</TableCell>
                      <TableCell>{turma?.escolaNome ?? '—'}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton
                            color="primary"
                            onClick={() => setEditing(aluno)}
                            aria-label={`Editar ${aluno.nome}`}
                          >
                            <EditRoundedIcon />
                          </IconButton>
                          <IconButton
                            color="error"
                            onClick={() => deleteMutation.mutate(aluno.id)}
                            aria-label={`Excluir ${aluno.nome}`}
                          >
                            <DeleteRoundedIcon />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
