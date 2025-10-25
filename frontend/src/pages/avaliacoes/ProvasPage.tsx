import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
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
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';

import { apiClient } from '../../api/client';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import type { Aluno, Avaliacao, Caderno, ProvaAluno } from '../../types';

interface ProvaInput {
  avaliacao: number;
  aluno: number;
  caderno: number | '';
  qr_payload: string;
}

async function fetchProvas(): Promise<ProvaAluno[]> {
  const { data } = await apiClient.get<ProvaAluno[]>('/avaliacoes/provas/');
  return data;
}

async function fetchAvaliacoes(): Promise<Avaliacao[]> {
  const { data } = await apiClient.get<Avaliacao[]>('/avaliacoes/avaliacoes/');
  return data;
}

async function fetchAlunos(): Promise<Aluno[]> {
  const { data } = await apiClient.get<Aluno[]>('/escolas/alunos/');
  return data;
}

async function fetchCadernos(): Promise<Caderno[]> {
  const { data } = await apiClient.get<Caderno[]>('/avaliacoes/cadernos/');
  return data;
}

export function ProvasPage() {
  const queryClient = useQueryClient();
  const { data: provas = [], isLoading } = useQuery({ queryKey: ['provas'], queryFn: fetchProvas });
  const { data: avaliacoes = [] } = useQuery({ queryKey: ['avaliacoes'], queryFn: fetchAvaliacoes });
  const { data: alunos = [] } = useQuery({ queryKey: ['alunos'], queryFn: fetchAlunos });
  const { data: cadernos = [] } = useQuery({ queryKey: ['cadernos'], queryFn: fetchCadernos });

  const [form, setForm] = useState<ProvaInput>({
    avaliacao: 0,
    aluno: 0,
    caderno: '',
    qr_payload: JSON.stringify({}, null, 2)
  });
  const [editing, setEditing] = useState<ProvaAluno | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        avaliacao: editing.avaliacao,
        aluno: editing.aluno,
        caderno: editing.caderno ?? '',
        qr_payload: JSON.stringify(editing.qr_payload ?? {}, null, 2)
      });
    } else {
      setForm({
        avaliacao: avaliacoes[0]?.id ?? 0,
        aluno: alunos[0]?.id ?? 0,
        caderno: '',
        qr_payload: JSON.stringify({}, null, 2)
      });
    }
  }, [editing, avaliacoes, alunos]);

  const avaliacaoLookup = useMemo(() => {
    const map = new Map<number, string>();
    avaliacoes.forEach((item) => map.set(item.id, item.titulo));
    return map;
  }, [avaliacoes]);

  const alunoLookup = useMemo(() => {
    const map = new Map<number, string>();
    alunos.forEach((item) => map.set(item.id, item.nome));
    return map;
  }, [alunos]);

  const cadernoLookup = useMemo(() => {
    const map = new Map<number, string>();
    cadernos.forEach((item) => map.set(item.id, item.codigo));
    return map;
  }, [cadernos]);

  const saveMutation = useMutation({
    mutationFn: async (payload: ProvaInput) => {
      const body = {
        avaliacao: payload.avaliacao,
        aluno: payload.aluno,
        caderno: payload.caderno || null,
        qr_payload: JSON.parse(payload.qr_payload || '{}')
      };
      if (editing) {
        await apiClient.put(`/avaliacoes/provas/${editing.id}/`, body);
      } else {
        await apiClient.post('/avaliacoes/provas/', body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provas'] });
      setEditing(null);
      setError(null);
      setForm({
        avaliacao: avaliacoes[0]?.id ?? 0,
        aluno: alunos[0]?.id ?? 0,
        caderno: '',
        qr_payload: JSON.stringify({}, null, 2)
      });
    },
    onError: (err) => {
      console.error(err);
      setError('Não foi possível salvar a prova. Verifique os dados e tente novamente.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/avaliacoes/provas/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['provas'] })
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      JSON.parse(form.qr_payload || '{}');
    } catch (parseError) {
      setError('JSON do QR Code inválido.');
      return;
    }
    setError(null);
    saveMutation.mutate(form);
  };

  const actionLabel = editing ? 'Atualizar prova' : 'Cadastrar prova';

  return (
    <PageContainer>
      <PageHeader
        title="Provas por aluno"
        description="Associe alunos aos cadernos e gere o QR Code de identificação."
      />

      <PageSection>
        <Stack component="form" spacing={{ xs: 2, md: 3 }} onSubmit={handleSubmit}>
          {error && <Alert severity="error">{error}</Alert>}
          <Grid container spacing={{ xs: 2, md: 3 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label="Avaliação"
                value={form.avaliacao ? String(form.avaliacao) : ''}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, avaliacao: Number(event.target.value) }))
                }
                required
                fullWidth
              >
                <MenuItem value="">Selecione</MenuItem>
                {avaliacoes.map((avaliacao) => (
                  <MenuItem key={avaliacao.id} value={avaliacao.id}>
                    {avaliacao.titulo}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label="Aluno"
                value={form.aluno ? String(form.aluno) : ''}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, aluno: Number(event.target.value) }))
                }
                required
                fullWidth
              >
                <MenuItem value="">Selecione</MenuItem>
                {alunos.map((aluno) => (
                  <MenuItem key={aluno.id} value={aluno.id}>
                    {aluno.nome}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label="Caderno"
                value={form.caderno ? String(form.caderno) : ''}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    caderno: event.target.value ? Number(event.target.value) : ''
                  }))
                }
                fullWidth
              >
                <MenuItem value="">Sem caderno</MenuItem>
                {cadernos
                  .filter((item) => item.avaliacao === form.avaliacao)
                  .map((caderno) => (
                    <MenuItem key={caderno.id} value={caderno.id}>
                      {caderno.codigo}
                    </MenuItem>
                  ))}
              </TextField>
            </Grid>
          </Grid>

          <TextField
            label="Dados do QR Code (JSON)"
            value={form.qr_payload}
            onChange={(event) => setForm((prev) => ({ ...prev, qr_payload: event.target.value }))}
            multiline
            minRows={6}
            fullWidth
          />

          <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
            {editing && (
              <Button variant="text" color="inherit" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              startIcon={<QrCode2RoundedIcon />}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : actionLabel}
            </Button>
          </Stack>
        </Stack>
      </PageSection>

      <PageSection>
        <Stack spacing={2}>
          <Typography variant="h6">Provas cadastradas</Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Avaliação</TableCell>
                  <TableCell>Aluno</TableCell>
                  <TableCell>Caderno</TableCell>
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
                {!isLoading && provas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      Nenhuma prova cadastrada.
                    </TableCell>
                  </TableRow>
                )}
                {provas.map((prova) => (
                  <TableRow key={prova.id} hover>
                    <TableCell>{prova.id}</TableCell>
                    <TableCell>{avaliacaoLookup.get(prova.avaliacao) ?? prova.avaliacao}</TableCell>
                    <TableCell>{alunoLookup.get(prova.aluno) ?? prova.aluno}</TableCell>
                    <TableCell>
                      {prova.caderno ? cadernoLookup.get(prova.caderno) ?? prova.caderno : '—'}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton
                          color="primary"
                          onClick={() => setEditing(prova)}
                          aria-label={`Editar prova ${prova.id}`}
                        >
                          <EditRoundedIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => deleteMutation.mutate(prova.id)}
                          aria-label={`Excluir prova ${prova.id}`}
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
