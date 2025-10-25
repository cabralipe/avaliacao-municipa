import { FormEvent, useEffect, useState } from 'react';
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
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';

import { apiClient } from '../../api/client';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import type { Escola, Turma } from '../../types';

interface TurmaInput {
  escola: number;
  nome: string;
  ano: string;
}

async function fetchTurmas(): Promise<Turma[]> {
  const { data } = await apiClient.get<Turma[]>('/escolas/turmas/');
  return data;
}

async function fetchEscolas(): Promise<Escola[]> {
  const { data } = await apiClient.get<Escola[]>('/escolas/escolas/');
  return data;
}

export function TurmasPage() {
  const queryClient = useQueryClient();
  const { data: turmas = [], isLoading } = useQuery({ queryKey: ['turmas'], queryFn: fetchTurmas });
  const { data: escolas = [] } = useQuery({ queryKey: ['escolas'], queryFn: fetchEscolas });

  const [form, setForm] = useState<TurmaInput>({ escola: 0, nome: '', ano: '' });
  const [editing, setEditing] = useState<Turma | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({ escola: editing.escola, nome: editing.nome, ano: editing.ano });
    } else {
      setForm({ escola: escolas[0]?.id ?? 0, nome: '', ano: '' });
    }
  }, [editing, escolas]);

  const saveMutation = useMutation({
    mutationFn: async (payload: TurmaInput) => {
      if (editing) {
        await apiClient.put(`/escolas/turmas/${editing.id}/`, payload);
      } else {
        await apiClient.post('/escolas/turmas/', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas'] });
      setEditing(null);
      setForm({ escola: escolas[0]?.id ?? 0, nome: '', ano: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/escolas/turmas/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['turmas'] })
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.escola) {
      return;
    }
    saveMutation.mutate(form);
  };

  const actionLabel = editing ? 'Atualizar turma' : 'Cadastrar turma';

  return (
    <PageContainer>
      <PageHeader
        title="Turmas"
        description="Organize as turmas e associe-as às escolas."
      />

      <PageSection>
        <Stack component="form" spacing={{ xs: 2, md: 3 }} onSubmit={handleSubmit}>
          <Grid container spacing={{ xs: 2, md: 3 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label="Escola"
                value={form.escola ? String(form.escola) : ''}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, escola: Number(event.target.value) }))
                }
                required
                fullWidth
              >
                <MenuItem value="">Selecione uma escola</MenuItem>
                {escolas.map((escola) => (
                  <MenuItem key={escola.id} value={escola.id}>
                    {escola.nome}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Nome da turma"
                value={form.nome}
                onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                required
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Ano/Série"
                value={form.ano}
                onChange={(event) => setForm((prev) => ({ ...prev, ano: event.target.value }))}
                required
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
              startIcon={<AddRoundedIcon />}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : actionLabel}
            </Button>
          </Stack>
        </Stack>
      </PageSection>

      <PageSection>
        <Stack spacing={2}>
          <Typography variant="h6">Turmas cadastradas</Typography>
          <TableContainer>
            <Table size="medium">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Turma</TableCell>
                  <TableCell>Ano</TableCell>
                  <TableCell>Escola</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && turmas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      Nenhuma turma cadastrada.
                    </TableCell>
                  </TableRow>
                )}
                {turmas.map((turma) => (
                  <TableRow key={turma.id} hover>
                    <TableCell>{turma.id}</TableCell>
                    <TableCell>{turma.nome}</TableCell>
                    <TableCell>{turma.ano}</TableCell>
                    <TableCell>
                      {escolas.find((escola) => escola.id === turma.escola)?.nome ?? turma.escola}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton
                          color="primary"
                          onClick={() => setEditing(turma)}
                          aria-label={`Editar ${turma.nome}`}
                        >
                          <EditRoundedIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => deleteMutation.mutate(turma.id)}
                          aria-label={`Excluir ${turma.nome}`}
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
        </Stack>
      </PageSection>
    </PageContainer>
  );
}
