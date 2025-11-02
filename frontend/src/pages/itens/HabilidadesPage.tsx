import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  IconButton,
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
import { useAuth } from '../../hooks/useAuth';
import type { Habilidade } from '../../types';

interface HabilidadeInput {
  codigo: string;
  descricao: string;
}

async function fetchHabilidades(): Promise<Habilidade[]> {
  const { data } = await apiClient.get<Habilidade[]>('/itens/habilidades/');
  return data;
}

export function HabilidadesPage() {
  const queryClient = useQueryClient();
  const { data: habilidades = [], isLoading } = useQuery({
    queryKey: ['habilidades'],
    queryFn: fetchHabilidades
  });

  const [form, setForm] = useState<HabilidadeInput>({ codigo: '', descricao: '' });
  const [editing, setEditing] = useState<Habilidade | null>(null);

  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'superadmin';

  useEffect(() => {
    if (editing) {
      setForm({ codigo: editing.codigo, descricao: editing.descricao });
    } else {
      setForm({ codigo: '', descricao: '' });
    }
  }, [editing]);

  const saveMutation = useMutation({
    mutationFn: async (payload: HabilidadeInput) => {
      if (editing) {
        await apiClient.put(`/itens/habilidades/${editing.id}/`, payload);
      } else {
        await apiClient.post('/itens/habilidades/', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habilidades'] });
      setEditing(null);
      setForm({ codigo: '', descricao: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/itens/habilidades/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habilidades'] })
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveMutation.mutate(form);
  };

  const actionLabel = editing ? 'Atualizar habilidade' : 'Cadastrar habilidade';
  const columnsCount = canManage ? 4 : 3;

  return (
    <PageContainer>
      <PageHeader
        title="Habilidades"
        description="Mapeie as habilidades trabalhadas e vincule às questões cadastradas."
      />

      {canManage && (
        <PageSection>
          <Stack component="form" spacing={{ xs: 2, md: 3 }} onSubmit={handleSubmit}>
            <Grid container spacing={{ xs: 2, md: 3 }}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Código"
                  value={form.codigo}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, codigo: event.target.value }))
                  }
                  required
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  label="Descrição"
                  value={form.descricao}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, descricao: event.target.value }))
                  }
                  required
                  fullWidth
                  multiline
                  minRows={2}
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
      )}

      <PageSection>
        <Stack spacing={2}>
          <Typography variant="h6">Habilidades cadastradas</Typography>
          {canManage ? null : (
            <Typography variant="body2" color="text.secondary">
              Apenas administradores podem cadastrar ou editar habilidades. Consulte a lista
              abaixo.
            </Typography>
          )}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Código</TableCell>
                  <TableCell>Descrição</TableCell>
                  {canManage && <TableCell align="right">Ações</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={columnsCount} align="center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && habilidades.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columnsCount} align="center">
                      Nenhuma habilidade cadastrada.
                    </TableCell>
                  </TableRow>
                )}
                {habilidades.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.codigo}</TableCell>
                    <TableCell>{item.descricao}</TableCell>
                    {canManage && (
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton
                            color="primary"
                            onClick={() => setEditing(item)}
                            aria-label={`Editar ${item.codigo}`}
                          >
                            <EditRoundedIcon />
                          </IconButton>
                          <IconButton
                            color="error"
                            onClick={() => deleteMutation.mutate(item.id)}
                            aria-label={`Excluir ${item.codigo}`}
                          >
                            <DeleteRoundedIcon />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    )}
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
