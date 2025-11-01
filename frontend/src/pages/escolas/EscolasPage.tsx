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

import { formatINEP, unformatINEP } from '../../utils/inep';

import { apiClient } from '../../api/client';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import type { Escola } from '../../types';

interface EscolaInput {
  nome: string;
  codigo_inep: string;
}

async function fetchEscolas(): Promise<Escola[]> {
  const { data } = await apiClient.get<Escola[]>('/escolas/escolas/');
  return data;
}

export function EscolasPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['escolas'],
    queryFn: fetchEscolas
  });

  const [form, setForm] = useState<EscolaInput>({ nome: '', codigo_inep: '' });
  const [editing, setEditing] = useState<Escola | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({ 
        nome: editing.nome, 
        codigo_inep: formatINEP(editing.codigo_inep || '') 
      });
    } else {
      setForm({ nome: '', codigo_inep: '' });
    }
  }, [editing]);

  const saveMutation = useMutation({
    mutationFn: async (payload: EscolaInput) => {
      // Remove formatação do código INEP antes de enviar
      const payloadWithUnformattedINEP = {
        ...payload,
        codigo_inep: unformatINEP(payload.codigo_inep)
      };
      
      if (editing) {
        await apiClient.put(`/escolas/escolas/${editing.id}/`, payloadWithUnformattedINEP);
      } else {
        await apiClient.post('/escolas/escolas/', payloadWithUnformattedINEP);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escolas'] });
      setEditing(null);
      setForm({ nome: '', codigo_inep: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/escolas/escolas/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['escolas'] })
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveMutation.mutate(form);
  };

  const actionLabel = editing ? 'Atualizar escola' : 'Cadastrar escola';

  return (
    <PageContainer>
      <PageHeader
        title="Escolas"
        description="Cadastre e gerencie as escolas vinculadas à secretaria."
      />

      <PageSection>
        <Stack
          component="form"
          spacing={{ xs: 2, md: 3 }}
          onSubmit={onSubmit}
        >
          <Grid container spacing={{ xs: 2, md: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Nome da escola"
                value={form.nome}
                onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                required
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Código INEP"
                value={form.codigo_inep}
                onChange={(event) => {
                  const formattedValue = formatINEP(event.target.value);
                  setForm((prev) => ({ ...prev, codigo_inep: formattedValue }));
                }}
                placeholder="12345678"
                inputProps={{
                  maxLength: 8,
                  inputMode: 'numeric',
                  pattern: '[0-9]*'
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
          <Typography variant="h6">Lista de escolas</Typography>
          <TableContainer>
            <Table size="medium">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Nome</TableCell>
                  <TableCell>Código INEP</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      Nenhuma escola cadastrada.
                    </TableCell>
                  </TableRow>
                )}
                {data.map((escola) => (
                  <TableRow key={escola.id} hover>
                    <TableCell>{escola.id}</TableCell>
                    <TableCell>{escola.nome}</TableCell>
                    <TableCell>{escola.codigo_inep || '—'}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton
                          color="primary"
                          onClick={() => setEditing(escola)}
                          aria-label={`Editar ${escola.nome}`}
                        >
                          <EditRoundedIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => deleteMutation.mutate(escola.id)}
                          aria-label={`Excluir ${escola.nome}`}
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
