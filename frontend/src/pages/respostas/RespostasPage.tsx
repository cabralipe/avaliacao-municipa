import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Chip,
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
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';

import { apiClient } from '../../api/client';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import type { ProvaAluno, Resposta } from '../../types';

async function fetchProvas(): Promise<ProvaAluno[]> {
  const { data } = await apiClient.get<ProvaAluno[]>('/avaliacoes/provas/');
  return data;
}

async function fetchRespostas(provaId: number): Promise<Resposta[]> {
  const { data } = await apiClient.get<Resposta[]>(
    `/respostas/respostas/?prova_aluno_id=${provaId}`
  );
  return data;
}

function parseAlternativas(texto: string): string[] {
  return texto
    .split(/\s|,|;/)
    .map((item) => item.trim().toUpperCase())
    .filter((item) => Boolean(item));
}

export function RespostasPage() {
  const queryClient = useQueryClient();
  const { data: provas = [] } = useQuery({ queryKey: ['provas'], queryFn: fetchProvas });
  const [provaId, setProvaId] = useState<number>(0);

  const { data: respostas = [], isFetching } = useQuery({
    queryKey: ['respostas', provaId],
    queryFn: () => fetchRespostas(provaId),
    enabled: provaId > 0
  });

  const [textoRespostas, setTextoRespostas] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const coletaMutation = useMutation({
    mutationFn: async () => {
      const alternativas = parseAlternativas(textoRespostas);
      await apiClient.post('/respostas/coletar/', {
        prova_aluno_id: provaId,
        respostas: alternativas
      });
    },
    onSuccess: () => {
      setFeedback('Respostas registradas com sucesso.');
      setTextoRespostas('');
      queryClient.invalidateQueries({ queryKey: ['respostas', provaId] });
    },
    onError: () =>
      setFeedback('Falha ao registrar respostas. Verifique os dados e tente novamente.')
  });

  const provaLookup = useMemo(() => {
    const map = new Map<number, ProvaAluno>();
    provas.forEach((prova) => map.set(prova.id, prova));
    return map;
  }, [provas]);

  const getAlunoNome = (prova: ProvaAluno | undefined) => {
    if (!prova) {
      return '';
    }
    const payload = prova.qr_payload as { aluno_nome?: unknown };
    const nome = payload?.aluno_nome;
    if (typeof nome === 'string' && nome.trim().length > 0) {
      return nome;
    }
    return `Aluno ${prova.aluno}`;
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!provaId) {
      setFeedback('Selecione uma prova antes de salvar.');
      return;
    }
    setFeedback(null);
    coletaMutation.mutate();
  };

  return (
    <PageContainer>
      <PageHeader
        title="Respostas"
        description="Visualize e registre as respostas coletadas por prova."
      />

      <PageSection>
        <Stack component="form" spacing={{ xs: 2, md: 3 }} onSubmit={onSubmit}>
          <TextField
            select
            label="Prova do aluno"
            value={provaId ? String(provaId) : ''}
            onChange={(event) => setProvaId(Number(event.target.value))}
            fullWidth
          >
            <MenuItem value="0">Selecione</MenuItem>
            {provas.map((prova) => (
              <MenuItem key={prova.id} value={prova.id}>
                {`Prova #${prova.id} — ${getAlunoNome(prova)}`}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Respostas (use letras A-E separadas por espaço, vírgula ou nova linha)"
            rows={4}
            multiline
            value={textoRespostas}
            onChange={(event) => setTextoRespostas(event.target.value)}
            placeholder="A B C D E"
            fullWidth
          />
          <Stack direction="row" justifyContent="flex-end">
            <Button
              type="submit"
              variant="contained"
              startIcon={<TaskAltRoundedIcon />}
              disabled={coletaMutation.isPending}
            >
              {coletaMutation.isPending ? 'Enviando...' : 'Registrar respostas'}
            </Button>
          </Stack>
          {feedback && <Alert severity="info">{feedback}</Alert>}
        </Stack>
      </PageSection>

      {provaId > 0 && (
        <PageSection>
          <Stack spacing={2}>
            <Typography variant="h6">Respostas registradas</Typography>
            {provaLookup.get(provaId) && (
              <Typography variant="body2" color="text.secondary">
                {`Prova #${provaId} — Avaliação ${provaLookup.get(provaId)?.avaliacao} — ${getAlunoNome(provaLookup.get(provaId))}`}
              </Typography>
            )}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Alternativa</TableCell>
                    <TableCell>Correção</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isFetching && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  )}
                  {!isFetching && respostas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        Nenhuma resposta registrada.
                      </TableCell>
                    </TableRow>
                  )}
                  {respostas.map((resposta, index) => (
                    <TableRow key={resposta.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{resposta.alternativa}</TableCell>
                      <TableCell>
                        {resposta.correta === null ? (
                          <Chip label="Não corrigido" size="small" color="default" />
                        ) : resposta.correta ? (
                          <Chip label="Correta" size="small" color="success" />
                        ) : (
                          <Chip label="Incorreta" size="small" color="error" variant="outlined" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </PageSection>
      )}
    </PageContainer>
  );
}
