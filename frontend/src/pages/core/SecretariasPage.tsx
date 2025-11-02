import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import TablePagination from '@mui/material/TablePagination';
import Grid from '@mui/material/Grid';
import DomainAddRoundedIcon from '@mui/icons-material/DomainAddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';

import { apiClient } from '../../api/client';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import type { Secretaria } from '../../types';

interface SecretariaInput {
  nome: string;
  cnpj: string;
  cidade: string;
}

export function SecretariasPage() {
  const queryClient = useQueryClient();
  const {
    results: secretarias,
    total,
    isLoading,
    page,
    pageSize,
    handlePageChange,
    handleRowsPerPageChange,
  } = usePaginatedResource<Secretaria>({
    queryKey: ['secretarias'],
    url: '/core/secretarias/',
    initialPageSize: 10,
  });

  const [form, setForm] = useState<SecretariaInput>({ nome: '', cnpj: '', cidade: '' });
  const [editing, setEditing] = useState<Secretaria | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({ nome: editing.nome, cnpj: editing.cnpj ?? '', cidade: editing.cidade ?? '' });
    } else {
      setForm({ nome: '', cnpj: '', cidade: '' });
    }
  }, [editing]);

  const saveMutation = useMutation({
    mutationFn: async (payload: SecretariaInput) => {
      if (editing) {
        await apiClient.put(`/core/secretarias/${editing.id}/`, payload);
      } else {
        await apiClient.post('/core/secretarias/', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secretarias'] });
      setEditing(null);
      setForm({ nome: '', cnpj: '', cidade: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/core/secretarias/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['secretarias'] })
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveMutation.mutate(form);
  };

  const actionLabel = editing ? 'Atualizar secretaria' : 'Cadastrar secretaria';

  return (
    <PageContainer>
      <PageHeader
        title="Secretarias"
        description="Gerencie as secretarias habilitadas na plataforma."
      />

      <PageSection>
        <Stack component="form" spacing={{ xs: 2, md: 3 }} onSubmit={handleSubmit}>
          <Grid container spacing={{ xs: 2, md: 3 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Nome"
                value={form.nome}
                onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                required
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="CNPJ"
                value={form.cnpj}
                onChange={(event) => setForm((prev) => ({ ...prev, cnpj: event.target.value }))}
                placeholder="00.000.000/0000-00"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Cidade"
                value={form.cidade}
                onChange={(event) => setForm((prev) => ({ ...prev, cidade: event.target.value }))}
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
              startIcon={<DomainAddRoundedIcon />}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : actionLabel}
            </Button>
          </Stack>
        </Stack>
      </PageSection>

      <PageSection>
        <Stack spacing={2}>
          <Typography variant="h6">Secretarias cadastradas</Typography>
          <TableContainer>
            <Table size="medium">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Nome</TableCell>
                  <TableCell>CNPJ</TableCell>
                  <TableCell>Cidade</TableCell>
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
                {!isLoading && secretarias.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      Nenhuma secretaria cadastrada.
                    </TableCell>
                  </TableRow>
                )}
                {secretarias.map((secretaria) => (
                  <TableRow key={secretaria.id} hover>
                    <TableCell>{secretaria.id}</TableCell>
                    <TableCell>{secretaria.nome}</TableCell>
                    <TableCell>{secretaria.cnpj || '—'}</TableCell>
                    <TableCell>{secretaria.cidade || '—'}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton
                          color="primary"
                          onClick={() => setEditing(secretaria)}
                          aria-label={`Editar ${secretaria.nome}`}
                        >
                          <EditRoundedIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => deleteMutation.mutate(secretaria.id)}
                          aria-label={`Excluir ${secretaria.nome}`}
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
