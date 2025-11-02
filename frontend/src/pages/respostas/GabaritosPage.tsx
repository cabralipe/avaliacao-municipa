import { FormEvent, useMemo, useState } from 'react';
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
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';

import { apiClient } from '../../api/client';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import type { Caderno, CadernoQuestao, Gabarito, PaginatedResponse, Questao } from '../../types';

interface GabaritoInput {
  caderno_questao: number;
  alternativa_correta: string;
}

interface CadernoDetail extends Caderno {
  cadernoquestao_set: CadernoQuestao[];
}

async function fetchGabaritos(): Promise<Gabarito[]> {
  const { data } = await apiClient.get<Gabarito[] | PaginatedResponse<Gabarito>>(
    '/respostas/gabaritos/',
    { params: { page_size: 0 } }
  );
  return Array.isArray(data) ? data : data.results;
}

async function fetchCadernos(): Promise<CadernoDetail[]> {
  const { data } = await apiClient.get<CadernoDetail[] | PaginatedResponse<CadernoDetail>>(
    '/avaliacoes/cadernos/',
    { params: { page_size: 0 } }
  );
  return Array.isArray(data) ? data : data.results;
}

async function fetchQuestoes(): Promise<Questao[]> {
  const { data } = await apiClient.get<Questao[] | PaginatedResponse<Questao>>(
    '/itens/questoes/',
    { params: { page_size: 0 } }
  );
  return Array.isArray(data) ? data : data.results;
}

export function GabaritosPage() {
  const queryClient = useQueryClient();
  const { data: gabaritos = [], isLoading } = useQuery({
    queryKey: ['gabaritos'],
    queryFn: fetchGabaritos
  });
  const { data: cadernos = [] } = useQuery({ queryKey: ['cadernos'], queryFn: fetchCadernos });
  const { data: questoes = [] } = useQuery({ queryKey: ['questoes'], queryFn: fetchQuestoes });

  const [form, setForm] = useState<GabaritoInput>({ caderno_questao: 0, alternativa_correta: 'A' });
  const [editing, setEditing] = useState<Gabarito | null>(null);

  const questaoLookup = useMemo(() => {
    const map = new Map<number, Questao>();
    questoes.forEach((questao) => map.set(questao.id, questao));
    return map;
  }, [questoes]);

  const cqOptions = useMemo(() => {
    const options: Array<{ cq: CadernoQuestao; caderno: CadernoDetail; questao: Questao | undefined }> = [];
    cadernos.forEach((caderno) => {
      caderno.cadernoquestao_set.forEach((cq) => {
        options.push({ cq, caderno, questao: questaoLookup.get(cq.questao) });
      });
    });
    return options.sort((a, b) =>
      a.caderno.codigo.localeCompare(b.caderno.codigo) || a.cq.ordem - b.cq.ordem
    );
  }, [cadernos, questaoLookup]);

  const saveMutation = useMutation({
    mutationFn: async (payload: GabaritoInput) => {
      if (editing) {
        await apiClient.put(`/respostas/gabaritos/${editing.id}/`, payload);
      } else {
        await apiClient.post('/respostas/gabaritos/', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gabaritos'] });
      setEditing(null);
      setForm({ caderno_questao: 0, alternativa_correta: 'A' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/respostas/gabaritos/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gabaritos'] })
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveMutation.mutate(form);
  };

  const actionLabel = editing ? 'Atualizar gabarito' : 'Cadastrar gabarito';

  return (
    <PageContainer>
      <PageHeader
        title="Gabaritos"
        description="Defina as alternativas corretas para cada questão dos cadernos."
      />

      <PageSection>
        <Stack component="form" spacing={{ xs: 2, md: 3 }} onSubmit={handleSubmit}>
          <TextField
            select
            label="Questão do caderno"
            value={form.caderno_questao ? String(form.caderno_questao) : ''}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, caderno_questao: Number(event.target.value) }))
            }
            required
          >
            <MenuItem value="">Selecione</MenuItem>
            {cqOptions.map(({ cq, caderno, questao }) => (
              <MenuItem key={cq.id} value={cq.id}>
                {caderno.codigo} • #{cq.ordem} • {questao?.enunciado.slice(0, 50) ?? 'Questão'}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Alternativa correta"
            value={form.alternativa_correta}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, alternativa_correta: event.target.value }))
            }
          >
            {['A', 'B', 'C', 'D', 'E'].map((alt) => (
              <MenuItem key={alt} value={alt}>
                {alt}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
            {editing && (
              <Button variant="text" color="inherit" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              startIcon={<CheckCircleRoundedIcon />}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : actionLabel}
            </Button>
          </Stack>
        </Stack>
      </PageSection>

      <PageSection>
        <Stack spacing={2}>
          <Typography variant="h6">Gabaritos cadastrados</Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Caderno</TableCell>
                  <TableCell>Questão</TableCell>
                  <TableCell>Alternativa</TableCell>
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
                {!isLoading && gabaritos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      Nenhum gabarito cadastrado.
                    </TableCell>
                  </TableRow>
                )}
                {gabaritos.map((gabarito) => {
                  const option = cqOptions.find(({ cq }) => cq.id === gabarito.caderno_questao);
                  return (
                    <TableRow key={gabarito.id} hover>
                      <TableCell>{gabarito.id}</TableCell>
                      <TableCell>{option?.caderno.codigo ?? '—'}</TableCell>
                      <TableCell>
                        {option?.questao?.enunciado.slice(0, 80) ?? gabarito.caderno_questao}
                      </TableCell>
                      <TableCell>
                        <Chip label={gabarito.alternativa_correta} color="primary" size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton
                            color="primary"
                            onClick={() => {
                              setEditing(gabarito);
                              setForm({
                                caderno_questao: gabarito.caderno_questao,
                                alternativa_correta: gabarito.alternativa_correta
                              });
                            }}
                            aria-label={`Editar gabarito ${gabarito.id}`}
                          >
                            <EditRoundedIcon />
                          </IconButton>
                          <IconButton
                            color="error"
                            onClick={() => deleteMutation.mutate(gabarito.id)}
                            aria-label={`Excluir gabarito ${gabarito.id}`}
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
        </Stack>
      </PageSection>
    </PageContainer>
  );
}
