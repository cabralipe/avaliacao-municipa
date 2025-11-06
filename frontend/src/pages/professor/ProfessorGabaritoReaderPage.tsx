import { useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';

import { apiClient } from '../../api/client';
import { QrScannerDialog } from '../../components/QrScannerDialog';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import type {
  Avaliacao,
  Caderno,
  CadernoQuestao,
  PaginatedResponse,
  ProvaAluno
} from '../../types';

interface CellScore {
  letter: string;
  percent: number;
}

interface QuestionAnalysis {
  ordem: number;
  cadernoQuestao: number;
  scores: CellScore[];
  detected: string | null;
}

interface AnalysisStats {
  mean: number;
  stddev: number;
  threshold: number;
  samples: number;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

async function fetchAvaliacoes(): Promise<Avaliacao[]> {
  const { data } = await apiClient.get<Avaliacao[] | PaginatedResponse<Avaliacao>>(
    '/avaliacoes/avaliacoes/',
    { params: { page_size: 0 } }
  );
  return Array.isArray(data) ? data : data.results;
}

async function fetchCadernos(): Promise<Caderno[]> {
  const { data } = await apiClient.get<Caderno[] | PaginatedResponse<Caderno>>(
    '/avaliacoes/cadernos/',
    { params: { page_size: 0 } }
  );
  return Array.isArray(data) ? data : data.results;
}

async function fetchCadernoQuestoes(cadernoId: number): Promise<CadernoQuestao[]> {
  const { data } = await apiClient.get<
    CadernoQuestao[] | PaginatedResponse<CadernoQuestao>
  >('/avaliacoes/cadernos-questoes/', {
    params: { caderno_id: cadernoId, page_size: 0 }
  });
  return Array.isArray(data) ? data : data.results;
}

function parseProvaId(rawValue: string): number | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch (err) {
    console.error(err);
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const payload = parsed as Record<string, unknown>;
  const provaIdRaw =
    payload.prova_id ?? payload.provaId ?? payload.id ?? payload.prova ?? payload['provaId'];
  const provaId = Number(provaIdRaw);
  if (!Number.isFinite(provaId) || provaId <= 0) {
    return null;
  }
  return provaId;
}

export function ProfessorGabaritoReaderPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const queryClient = useQueryClient();

  const { data: avaliacoes = [] } = useQuery({ queryKey: ['avaliacoes'], queryFn: fetchAvaliacoes });
  const { data: cadernos = [] } = useQuery({ queryKey: ['cadernos'], queryFn: fetchCadernos });

  const [avaliacaoId, setAvaliacaoId] = useState<number>(0);
  const [cadernoId, setCadernoId] = useState<number>(0);

  const cadernosFiltrados = useMemo(
    () => cadernos.filter((item) => (avaliacaoId ? item.avaliacao === avaliacaoId : true)),
    [cadernos, avaliacaoId]
  );

  const { data: questoes = [], isLoading: carregandoQuestoes } = useQuery({
    queryKey: ['caderno_questoes', cadernoId],
    queryFn: () => fetchCadernoQuestoes(cadernoId),
    enabled: cadernoId > 0
  });

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<QuestionAnalysis[]>([]);
  const [manualAdjustments, setManualAdjustments] = useState<Record<number, string>>({});
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisStats, setAnalysisStats] = useState<AnalysisStats | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [provaId, setProvaId] = useState<number | null>(null);
  const [provaInfo, setProvaInfo] = useState<ProvaAluno | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);

  const questoesOrdenadas = useMemo(() => [...questoes].sort((a, b) => a.ordem - b.ordem), [questoes]);
  const alunoNomeDetectado = useMemo(() => {
    if (!provaInfo) {
      return null;
    }
    const payload = (provaInfo.qr_payload ?? {}) as Record<string, unknown>;
    const nome = payload.aluno_nome;
    if (typeof nome === 'string' && nome.trim().length > 0) {
      return nome;
    }
    return `Aluno ${provaInfo.aluno}`;
  }, [provaInfo]);

  const formatScore = (value: number) => `${(value * 100).toFixed(1)}%`;

  useEffect(() => {
    if (!cameraActive) {
      return undefined;
    }
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error(err);
        setAlert({
          type: 'error',
          message:
            'Não foi possível acessar a câmera. Verifique permissões do navegador ou tente um dispositivo diferente.'
        });
        setCameraActive(false);
      }
    };
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };
  }, [cameraActive]);

  const resetWorkflow = () => {
    setCapturedImage(null);
    setAnalysis([]);
    setManualAdjustments({});
    setFeedback(null);
    setAlert(null);
    setProvaId(null);
    setProvaInfo(null);
    setAnalysisError(null);
    setAnalysisStats(null);
  };

  const handleStartCamera = () => {
    resetWorkflow();
    setCameraActive(true);
  };

  const handleCapture = () => {
    if (!cameraActive || !videoRef.current) {
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current ?? document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setAlert({ type: 'error', message: 'Canvas não suportado pelo navegador.' });
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/png');
    setCapturedImage(imageData);
    setAnalysis([]);
    setManualAdjustments({});
    setFeedback(null);
    setAnalysisError(null);
    setCameraActive(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

  };

  const handleReset = () => {
    if (cameraActive && streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraActive(false);
    }
    resetWorkflow();
  };

  const handleAnalyze = async () => {
    if (!capturedImage) {
      setAnalysisError('Capture a imagem do gabarito antes de analisar.');
      return;
    }
    if (questoesOrdenadas.length === 0 || !cadernoId) {
      setAnalysisError('Selecione um caderno com questões cadastradas.');
      return;
    }
    try {
      setAnalysisError(null);
      setFeedback(null);
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append('caderno_id', String(cadernoId));
      formData.append('imagem', blob, 'gabarito.png');

      const { data } = await apiClient.post<{
        results: {
          ordem: number;
          caderno_questao: number;
          detected: string | null;
          scores: CellScore[];
        }[];
        stats: AnalysisStats;
        detected_count: number;
      }>('/respostas/omr/analisar/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const mappedResults: QuestionAnalysis[] = data.results.map((item) => ({
        ordem: item.ordem,
        cadernoQuestao: item.caderno_questao,
        detected: item.detected,
        scores: item.scores
      }));

      setAnalysis(mappedResults);
      setAnalysisStats(data.stats);
      setFeedback(
        `Leitura concluída. Foram detectadas ${data.detected_count} respostas com boa confiança.`
      );
    } catch (err) {
      console.error(err);
      if (isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string' && detail.trim().length > 0) {
          setAnalysisError(detail);
          setAnalysisStats(null);
          return;
        }
      }
      setAnalysisError(
        'Falha ao processar a imagem. Verifique o enquadramento do gabarito e tente novamente.'
      );
      setAnalysisStats(null);
    }
  };

  const handleManualSet = (ordem: number, letter: string) => {
    setManualAdjustments((prev) => {
      const updated = { ...prev };
      if (updated[ordem] === letter) {
        delete updated[ordem];
      } else {
        updated[ordem] = letter;
      }
      return updated;
    });
  };

  const finalAnswers = useMemo(() => {
    if (analysis.length === 0 && Object.keys(manualAdjustments).length === 0) {
      return [];
    }
    return questoesOrdenadas.map((questao) => {
      const manual = manualAdjustments[questao.ordem];
      if (manual) {
        return manual;
      }
      const auto = analysis.find((item) => item.ordem === questao.ordem)?.detected;
      return auto ?? '';
    });
  }, [analysis, manualAdjustments, questoesOrdenadas]);

  const [scannerManualText, setScannerManualText] = useState('');

  const handleScanManual = () => {
    const prova = parseProvaId(scannerManualText.trim());
    if (!prova) {
      setAlert({
        type: 'error',
        message: 'Conteúdo inválido. Informe um QR Code com identificador de prova.'
      });
      return;
    }
    setProvaId(prova);
    setAlert({
      type: 'success',
      message: `Identificação carregada manualmente: prova #${prova}.`
    });
  };

  const handleQrDetected = async (rawValue: string) => {
    const prova = parseProvaId(rawValue);
    if (!prova) {
      setAlert({
        type: 'error',
        message: 'O QR Code lido não contém o identificador da prova.'
      });
      return;
    }
    setProvaId(prova);
    setAlert({
      type: 'success',
      message: `Prova identificada: #${prova}. Você já pode enviar as respostas.`
    });
    try {
      const { data } = await apiClient.get<ProvaAluno>(`/avaliacoes/provas/${prova}/`);
      setProvaInfo(data);
    } catch (err) {
      console.error(err);
      setProvaInfo(null);
    }
  };

  const enviarMutation = useMutation({
    mutationFn: async () => {
      if (!provaId) {
        throw new Error('Leia o QR Code da prova para vincular as respostas.');
      }
      if (finalAnswers.length === 0) {
        throw new Error('Nenhuma resposta identificada. Capture o gabarito primeiro.');
      }
      await apiClient.post('/respostas/coletar/', {
        prova_aluno_id: provaId,
        respostas: finalAnswers
      });
    },
    onSuccess: () => {
      setFeedback('Respostas enviadas com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['respostas'] });
    },
    onError: (error: unknown) => {
      console.error(error);
      setAlert({
        type: 'error',
        message:
          'Falha ao enviar respostas. Confira se o QR Code corresponde à prova escaneada e tente novamente.'
      });
    }
  });

  const totalQuestoes = questoesOrdenadas.length;

  return (
    <PageContainer>
      <PageHeader
        title="Leitor de gabarito"
        description="Digitalize o gabarito preenchido, valide as respostas e associe-as ao aluno via QR Code."
      />

      {alert && (
        <PageSection>
          <Alert severity={alert.type} onClose={() => setAlert(null)}>
            {alert.message}
          </Alert>
        </PageSection>
      )}

      <PageSection>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 2, md: 3 }}>
          <FormControl fullWidth sx={{ flex: 1 }}>
            <InputLabel id="avaliacao-select">Avaliação</InputLabel>
            <Select
              labelId="avaliacao-select"
              value={avaliacaoId ? String(avaliacaoId) : ''}
              label="Avaliação"
              onChange={(event) => {
                const value = Number(event.target.value);
                setAvaliacaoId(value);
                setCadernoId(0);
                handleReset();
              }}
            >
              <MenuItem value="">Selecione</MenuItem>
              {avaliacoes.map((avaliacao) => (
                <MenuItem key={avaliacao.id} value={avaliacao.id}>
                  {avaliacao.titulo}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ flex: 1 }}>
            <InputLabel id="caderno-select">Caderno</InputLabel>
            <Select
              labelId="caderno-select"
              value={cadernoId ? String(cadernoId) : ''}
              label="Caderno"
              onChange={(event) => {
                const value = Number(event.target.value);
                setCadernoId(value);
                handleReset();
              }}
              disabled={!avaliacaoId}
            >
              <MenuItem value="">Selecione</MenuItem>
              {cadernosFiltrados.map((caderno) => (
                <MenuItem key={caderno.id} value={caderno.id}>
                  {caderno.codigo}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </PageSection>

      <PageSection>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Typography variant="h6">1. Captura do gabarito</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<CameraAltRoundedIcon />}
                onClick={handleStartCamera}
                disabled={!cadernoId || cameraActive}
              >
                Iniciar câmera
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleReset}
                startIcon={<RefreshRoundedIcon />}
              >
                Limpar
              </Button>
            </Stack>
          </Stack>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              minHeight: 260,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              backgroundColor: '#f9f9f9'
            }}
          >
            {cameraActive ? (
              <Box sx={{ position: 'relative', width: '100%', maxWidth: 520 }}>
                <Box
                  component="video"
                  ref={videoRef}
                  muted
                  autoPlay
                  playsInline
                  sx={{ width: '100%', borderRadius: 2, boxShadow: 3 }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    px: 2,
                    py: 0.5,
                    borderRadius: 999,
                    fontSize: 12
                  }}
                >
                  Enquadre o gabarito alinhando os marcadores pretos.
                </Box>
                <Button
                  variant="contained"
                  startIcon={<CameraAltRoundedIcon />}
                  onClick={handleCapture}
                  sx={{ mt: 2, width: '100%' }}
                >
                  Capturar gabarito
                </Button>
              </Box>
            ) : capturedImage ? (
              <Box sx={{ width: '100%', maxWidth: 520 }}>
                <Box
                  sx={{
                    position: 'relative',
                    borderRadius: 2,
                    overflow: 'hidden',
                    boxShadow: 3
                  }}
                >
                  <Box
                    component="img"
                    src={capturedImage}
                    alt="Gabarito capturado"
                    sx={{ width: '100%', display: 'block' }}
                  />
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Selecione uma avaliação e caderno, depois clique em &quot;Iniciar câmera&quot; para capturar o gabarito
                preenchido. Certifique-se de que os marcadores pretos estejam visíveis.
              </Typography>
            )}
          </Paper>
          <canvas ref={canvasRef} hidden />
        </Stack>
      </PageSection>

      {capturedImage && (
        <PageSection>
          <Stack spacing={2}>
            <Typography variant="h6">2. Ajuste e análise do gabarito</Typography>
            <Typography variant="body2" color="text.secondary">
              O gabarito capturado será processado pelo leitor automático baseado em OpenCV. Caso a
              leitura não identifique todas as respostas, ajuste manualmente na tabela abaixo.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={handleAnalyze}
                startIcon={<ReplayRoundedIcon />}
                disabled={carregandoQuestoes}
              >
                Analisar gabarito
              </Button>
              <Button
                variant="outlined"
                startIcon={<CameraAltRoundedIcon />}
                onClick={handleStartCamera}
              >
                Capturar novamente
              </Button>
            </Stack>
            {analysisError && <Alert severity="warning">{analysisError}</Alert>}
            {feedback && <Alert severity="info">{feedback}</Alert>}
          </Stack>
        </PageSection>
      )}

      {analysis.length > 0 && (
        <PageSection>
          <Stack spacing={2}>
            <Typography variant="h6">3. Conferência das respostas</Typography>
            <Typography variant="body2" color="text.secondary">
              Clique em uma alternativa para ajustar manualmente. Clique novamente para limpar.
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Questão</TableCell>
                    <TableCell>Detectado</TableCell>
                    <TableCell>Confiança</TableCell>
                    <TableCell align="right">Ajustar</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analysis.map((item) => {
                    const manual = manualAdjustments[item.ordem];
                    const detected = manual ?? item.detected ?? '';
                    const bestScore = item.scores.reduce(
                      (acc, current) => (current.percent > acc.percent ? current : acc),
                      { letter: '', percent: 0 }
                    );
                    return (
                      <TableRow key={item.ordem} hover>
                        <TableCell>{item.ordem}</TableCell>
                        <TableCell>
                          {detected ? (
                            <Chip
                              label={detected}
                              color={manual ? 'secondary' : 'success'}
                              size="small"
                            />
                          ) : (
                            <Chip label="Sem marca" size="small" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>
                          {bestScore.letter
                            ? `${bestScore.letter} (${Math.round(bestScore.percent * 100)}%)`
                            : '—'}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            {LETTERS.map((letter) => (
                              <Tooltip title={`Marcar ${letter}`} key={letter}>
                                <IconButton
                                  size="small"
                                  color={manual === letter ? 'primary' : 'default'}
                                  onClick={() => handleManualSet(item.ordem, letter)}
                                >
                                  {letter}
                                </IconButton>
                              </Tooltip>
                            ))}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="body2" color="text.secondary">
              Total de questões: {totalQuestoes}. Respostas identificadas: {finalAnswers.filter((item) => item).length}.
            </Typography>
            {analysisStats && (
              <Typography variant="body2" color="text.secondary">
                Estatísticas: média global {formatScore(analysisStats.mean)}, desvio padrão {formatScore(analysisStats.stddev)},
                limiar aplicado {formatScore(analysisStats.threshold)} (amostras {analysisStats.samples}).
              </Typography>
            )}
          </Stack>
        </PageSection>
      )}

      {finalAnswers.length > 0 && (
        <PageSection>
          <Stack spacing={2}>
            <Typography variant="h6">4. Associação com a prova</Typography>
            <Typography variant="body2">
              Leia o QR Code da prova preenchida para vincular as respostas ao aluno ou cole o conteúdo abaixo.
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Button
                variant="contained"
                startIcon={<QrCodeScannerRoundedIcon />}
                onClick={() => setScannerOpen(true)}
              >
                Ler QR Code
              </Button>
              <TextField
                label="Conteúdo do QR Code"
                value={scannerManualText}
                onChange={(event) => setScannerManualText(event.target.value)}
                sx={{ flex: 1 }}
                placeholder='Exemplo: {"prova_id": 123}'
              />
              <Button variant="outlined" onClick={handleScanManual}>
                Usar conteúdo
              </Button>
            </Stack>

            {provaId && (
              <Alert severity="success">
                Prova identificada: #{provaId}
                {alunoNomeDetectado && <> — {alunoNomeDetectado}</>}
              </Alert>
            )}

            <Divider />

            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                endIcon={<SendRoundedIcon />}
                onClick={() => enviarMutation.mutate()}
                disabled={!provaId || enviarMutation.isPending}
              >
                {enviarMutation.isPending ? 'Enviando...' : 'Enviar respostas'}
              </Button>
            </Stack>
          </Stack>
        </PageSection>
      )}

      <QrScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleQrDetected}
      />
    </PageContainer>
  );
}
