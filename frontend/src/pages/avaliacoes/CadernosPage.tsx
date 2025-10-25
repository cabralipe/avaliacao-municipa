import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  Button,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
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
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';

import { apiClient } from '../../api/client';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import type { Avaliacao, Caderno, CadernoQuestao, Questao } from '../../types';

interface CadernoInput {
  avaliacao: number;
  codigo: string;
}

interface CadernoDetail extends Caderno {
  cadernoquestao_set: CadernoQuestao[];
}

async function fetchCadernos(): Promise<CadernoDetail[]> {
  const { data } = await apiClient.get<CadernoDetail[]>('/avaliacoes/cadernos/');
  return data;
}

async function fetchAvaliacoes(): Promise<Avaliacao[]> {
  const { data } = await apiClient.get<Avaliacao[]>('/avaliacoes/avaliacoes/');
  return data;
}

async function fetchQuestoes(): Promise<Questao[]> {
  const { data } = await apiClient.get<Questao[]>('/itens/questoes/');
  return data;
}

export function CadernosPage() {
  const queryClient = useQueryClient();
  const { data: cadernos = [], isLoading } = useQuery({
    queryKey: ['cadernos'],
    queryFn: fetchCadernos
  });
  const { data: avaliacoes = [] } = useQuery({ queryKey: ['avaliacoes'], queryFn: fetchAvaliacoes });
  const { data: questoes = [] } = useQuery({ queryKey: ['questoes'], queryFn: fetchQuestoes });

  const [form, setForm] = useState<CadernoInput>({ avaliacao: 0, codigo: '' });
  const [editing, setEditing] = useState<CadernoDetail | null>(null);
  const [selected, setSelected] = useState<CadernoDetail | null>(null);
  const [questaoForm, setQuestaoForm] = useState({ questao: 0, ordem: 1 });

  useEffect(() => {
    if (editing) {
      setForm({ avaliacao: editing.avaliacao, codigo: editing.codigo });
    } else {
      setForm({ avaliacao: avaliacoes[0]?.id ?? 0, codigo: '' });
    }
  }, [editing, avaliacoes]);

  useEffect(() => {
    if (!selected && cadernos.length > 0) {
      setSelected(cadernos[0]);
    } else if (selected) {
      const updated = cadernos.find((item) => item.id === selected.id);
      if (updated) {
        setSelected(updated);
      }
    }
  }, [cadernos, selected]);

  useEffect(() => {
    if (selected) {
      setQuestaoForm({ questao: 0, ordem: selected.cadernoquestao_set.length + 1 });
    }
  }, [selected]);

  const avaliacaoLookup = useMemo(() => {
    const map = new Map<number, string>();
    avaliacoes.forEach((avaliacao) => map.set(avaliacao.id, avaliacao.titulo));
    return map;
  }, [avaliacoes]);

  const questaoLookup = useMemo(() => {
    const map = new Map<number, Questao>();
    questoes.forEach((questao) => map.set(questao.id, questao));
    return map;
  }, [questoes]);

  const saveMutation = useMutation({
    mutationFn: async (payload: CadernoInput) => {
      if (editing) {
        await apiClient.put(`/avaliacoes/cadernos/${editing.id}/`, payload);
      } else {
        await apiClient.post('/avaliacoes/cadernos/', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadernos'] });
      setEditing(null);
      setForm({ avaliacao: avaliacoes[0]?.id ?? 0, codigo: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/avaliacoes/cadernos/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cadernos'] })
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.avaliacao) return;
    saveMutation.mutate(form);
  };

  const addQuestaoMutation = useMutation({
    mutationFn: async (payload: { caderno: number; questao: number; ordem: number }) =>
      apiClient.post('/avaliacoes/cadernos-questoes/', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cadernos'] })
  });

  const removeQuestaoMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/avaliacoes/cadernos-questoes/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cadernos'] })
  });

  const handleQuestaoSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !questaoForm.questao) return;
    addQuestaoMutation.mutate({
      caderno: selected.id,
      questao: questaoForm.questao,
      ordem: questaoForm.ordem
    });
    setQuestaoForm((prev) => ({ questao: 0, ordem: prev.ordem + 1 }));
  };

  const actionLabel = editing ? 'Atualizar caderno' : 'Cadastrar caderno';

  return (
    <PageContainer>
      <PageHeader
        title="Cadernos"
        description="Defina os cadernos e organize a ordem das questões."
      />

      <Grid container spacing={{ xs: 3, lg: 4 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={{ xs: 3, md: 4 }}>
            <PageSection>
              <Stack component="form" spacing={{ xs: 2, md: 3 }} onSubmit={handleSubmit}>
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
                <TextField
                  label="Código do caderno"
                  value={form.codigo}
                  onChange={(event) => setForm((prev) => ({ ...prev, codigo: event.target.value }))}
                  required
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
                <Typography variant="h6">Cadernos cadastrados</Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>Código</TableCell>
                        <TableCell>Avaliação</TableCell>
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
                      {!isLoading && cadernos.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            Nenhum caderno cadastrado.
                          </TableCell>
                        </TableRow>
                      )}
                      {cadernos.map((caderno) => {
                        const active = selected?.id === caderno.id;
                        return (
                          <TableRow
                            key={caderno.id}
                            hover
                            selected={active}
                            sx={{ cursor: 'pointer' }}
                            onClick={() => setSelected(caderno)}
                          >
                            <TableCell>{caderno.id}</TableCell>
                            <TableCell>{caderno.codigo}</TableCell>
                            <TableCell>
                              {avaliacaoLookup.get(caderno.avaliacao) ?? caderno.avaliacao}
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                <IconButton
                                  color="primary"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setEditing(caderno);
                                  }}
                                  aria-label={`Editar ${caderno.codigo}`}
                                >
                                  <EditRoundedIcon />
                                </IconButton>
                                <IconButton
                                  color="error"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    deleteMutation.mutate(caderno.id);
                                  }}
                                  aria-label={`Excluir ${caderno.codigo}`}
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
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <PageSection sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.dark' }}>
                <LibraryBooksRoundedIcon />
              </Avatar>
              <Stack spacing={0.5}>
                <Typography variant="h6">
                  Organização das questões
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Adicione questões, personalize a ordem e monte cadernos consistentes.
                </Typography>
              </Stack>
            </Stack>

            <Divider />

            {selected ? (
              <Stack spacing={{ xs: 2, md: 3 }} flex={1}>
                <Typography variant="subtitle1" color="text.secondary">
                  {`Caderno ${selected.codigo} • ${avaliacaoLookup.get(selected.avaliacao) ?? 'Sem avaliação'}`}
                </Typography>

                <Stack component="form" spacing={2} onSubmit={handleQuestaoSubmit}>
                  <TextField
                    select
                    label="Questão"
                    value={questaoForm.questao ? String(questaoForm.questao) : ''}
                    onChange={(event) =>
                      setQuestaoForm((prev) => ({ ...prev, questao: Number(event.target.value) }))
                    }
                    required
                    fullWidth
                  >
                    <MenuItem value="">Selecione</MenuItem>
                    {questoes.map((questao) => (
                      <MenuItem key={questao.id} value={questao.id}>
                        {questao.id} • {questao.enunciado.slice(0, 60)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    type="number"
                    label="Ordem"
                    value={questaoForm.ordem}
                    onChange={(event) =>
                      setQuestaoForm((prev) => ({ ...prev, ordem: Number(event.target.value) }))
                    }
                    inputProps={{ min: 1 }}
                    required
                    fullWidth
                  />
                  <Stack direction="row" justifyContent="flex-end">
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={addQuestaoMutation.isPending}
                    >
                      {addQuestaoMutation.isPending ? 'Adicionando...' : 'Adicionar questão'}
                    </Button>
                  </Stack>
                </Stack>

                <List sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
                  {selected.cadernoquestao_set
                    .slice()
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((item) => {
                      const questao = questaoLookup.get(item.questao);
                      return (
                        <ListItem
                          key={item.id}
                          secondaryAction={
                            <IconButton
                              edge="end"
                              color="error"
                              onClick={() => removeQuestaoMutation.mutate(item.id)}
                              aria-label="Remover questão"
                            >
                              <DeleteRoundedIcon />
                            </IconButton>
                          }
                          sx={{ borderRadius: 2, mb: 1, bgcolor: 'rgba(37, 99, 235, 0.05)' }}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                              {item.ordem}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primaryTypographyProps={{ fontWeight: 600 }}
                            primary={`Questão ${questao?.id ?? item.questao}`}
                            secondary={questao?.enunciado.slice(0, 120) ?? 'Questão não encontrada'}
                          />
                        </ListItem>
                      );
                    })}
                  {selected.cadernoquestao_set.length === 0 && (
                    <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                      Nenhuma questão adicionada a este caderno até o momento.
                    </Typography>
                  )}
                </List>
              </Stack>
            ) : (
              <Stack spacing={2} alignItems="center" justifyContent="center" flex={1} textAlign="center">
                <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.dark' }}>
                  <DescriptionRoundedIcon />
                </Avatar>
                <Typography variant="subtitle1">Selecione um caderno</Typography>
                <Typography variant="body2" color="text.secondary">
                  Escolha um caderno na listagem para visualizar e organizar suas questões.
                </Typography>
              </Stack>
            )}
          </PageSection>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
