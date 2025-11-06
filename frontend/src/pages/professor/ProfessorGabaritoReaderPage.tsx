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
  Typography,
} from '@mui/material';
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LoopRoundedIcon from '@mui/icons-material/LoopRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';

import { apiClient } from '../../api/client';
import { QrScannerDialog } from '../../components/QrScannerDialog';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import { analyzeFrame } from '../../omr/frameAnalyzer';
import type {
  Avaliacao,
  Caderno,
  CadernoQuestao,
  PaginatedResponse,
  ProvaAluno,
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
    params: { caderno_id: cadernoId, page_size: 0 },
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
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processingFrameRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  const { data: avaliacoes = [] } = useQuery({ queryKey: ['avaliacoes'], queryFn: fetchAvaliacoes });
  const { data: cadernos = [] } = useQuery({ queryKey: ['cadernos'], queryFn: fetchCadernos });

  const [avaliacaoId, setAvaliacaoId] = useState<number>(0);
  const [cadernoId, setCadernoId] = useState<number>(0);

  const cadernosFiltrados = useMemo(
    () => cadernos.filter((item) => (avaliacaoId ? item.avaliacao === avaliacaoId : true)),
    [cadernos, avaliacaoId]
  );

  const { data: questoes = [] } = useQuery({
    queryKey: ['caderno_questoes', cadernoId],
    queryFn: () => fetchCadernoQuestoes(cadernoId),
    enabled: cadernoId > 0,
  });

  const questoesOrdenadas = useMemo(
    () => [...questoes].sort((a, b) => a.ordem - b.ordem),
    [questoes]
  );
  const questaoIndex = useMemo(() => {
    const map = new Map<number, CadernoQuestao>();
    questoesOrdenadas.forEach((item) => map.set(item.ordem, item));
    return map;
  }, [questoesOrdenadas]);

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<QuestionAnalysis[]>([]);
  const [analysisStats, setAnalysisStats] = useState<AnalysisStats | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [manualAdjustments, setManualAdjustments] = useState<Record<number, string>>({});

  const [liveImage, setLiveImage] = useState<string | null>(null);
  const [liveAnalysis, setLiveAnalysis] = useState<QuestionAnalysis[]>([]);
  const [liveStats, setLiveStats] = useState<AnalysisStats | null>(null);
  const [liveDetectedCount, setLiveDetectedCount] = useState(0);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [provaId, setProvaId] = useState<number | null>(null);
  const [provaInfo, setProvaInfo] = useState<ProvaAluno | null>(null);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);
  const [isValidating, setIsValidating] = useState(false);

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

  const stopCamera = () => {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    processingFrameRef.current = false;
    setCameraActive(false);
  };

  const resetWorkflow = () => {
    setCapturedImage(null);
    setAnalysis([]);
    setAnalysisStats(null);
    setAnalysisError(null);
    setManualAdjustments({});
    setLiveImage(null);
    setLiveAnalysis([]);
    setLiveStats(null);
    setLiveDetectedCount(0);
    setRealtimeError(null);
    setFeedback(null);
    setAlert(null);
    setProvaId(null);
    setProvaInfo(null);
  };

  useEffect(() => {
    if (!cameraActive) {
      return undefined;
    }
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
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
            'Não foi possível acessar a câmera. Verifique permissões do navegador ou tente um dispositivo diferente.',
        });
        stopCamera();
      }
    };
    startCamera();

    return () => {
      stopCamera();
    };
  }, [cameraActive]);

  useEffect(() => {
    if (!cameraActive || questoesOrdenadas.length === 0) {
      return () => undefined;
    }

    let cancelled = false;
    const ensureCanvas = () => {
      if (!analysisCanvasRef.current) {
        analysisCanvasRef.current = document.createElement('canvas');
      }
      return analysisCanvasRef.current;
    };

    const processFrame = async () => {
      if (cancelled || processingFrameRef.current) {
        animationFrameRef.current = window.requestAnimationFrame(processFrame);
        return;
      }
      const video = videoRef.current;
      const canvas = ensureCanvas();
      if (!video || video.readyState < 2) {
        animationFrameRef.current = window.requestAnimationFrame(processFrame);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameRef.current = window.requestAnimationFrame(processFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');

      processingFrameRef.current = true;
      try {
        const frameResult = await analyzeFrame(canvas, questoesOrdenadas.map((item) => item.ordem));
        if (!cancelled) {
          const mapped = frameResult.results.map<QuestionAnalysis>((item) => {
            const questao = questaoIndex.get(item.ordem);
            return {
              ordem: item.ordem,
              cadernoQuestao: questao?.id ?? 0,
              detected: item.detected,
              scores: item.scores.map((score) => ({
                letter: score.letter,
                percent: score.percent,
              })),
            };
          });
          setLiveImage(dataUrl);
          setLiveAnalysis(mapped);
          setLiveStats(frameResult.stats);
          setLiveDetectedCount(mapped.filter((item) => Boolean(item.detected)).length);
          setRealtimeError(null);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setRealtimeError('Falha ao analisar o quadro em tempo real. Ajuste o enquadramento.');
        }
      } finally {
        processingFrameRef.current = false;
      }

      if (!cancelled) {
        animationFrameRef.current = window.requestAnimationFrame(processFrame);
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(processFrame);

    return () => {
      cancelled = true;
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [cameraActive, questoesOrdenadas, questaoIndex]);

  const handleStartCamera = () => {
    if (!cadernoId || questoesOrdenadas.length === 0) {
      setAlert({
        type: 'error',
        message: 'Selecione uma avaliação e caderno com questões cadastradas antes de iniciar a leitura.',
      });
      return;
    }
    resetWorkflow();
    setCameraActive(true);
  };

  const mapResultsToQuestions = (results: QuestionAnalysis[]): QuestionAnalysis[] => {
    return results.map((item) => {
      const questao = questaoIndex.get(item.ordem);
      return {
        ...item,
        cadernoQuestao: questao?.id ?? item.cadernoQuestao,
      };
    });
  };

  const runBackendAnalysis = async (imageData: string) => {
    if (!cadernoId) {
      throw new Error('Selecione um caderno válido antes de validar o gabarito.');
    }
    const response = await fetch(imageData);
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
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const mapped = data.results.map<QuestionAnalysis>((item) => ({
      ordem: item.ordem,
      cadernoQuestao: item.caderno_questao,
      detected: item.detected,
      scores: item.scores,
    }));

    return {
      analysis: mapped,
      stats: data.stats,
      detectedCount: data.detected_count,
    };
  };

  const handleConfirmCurrentFrame = async () => {
    if (!liveImage) {
      setAlert({
        type: 'error',
        message: 'Aguardando leitura estável do gabarito. Ajuste o enquadramento e tente novamente.',
      });
      return;
    }
    stopCamera();
    setIsValidating(true);
    setAnalysisError(null);
    setManualAdjustments({});
    setFeedback('Validando leitura com o servidor...');
    try {
      const backendResult = await runBackendAnalysis(liveImage);
      setCapturedImage(liveImage);
      setAnalysis(mapResultsToQuestions(backendResult.analysis));
      setAnalysisStats(backendResult.stats);
      setFeedback(
        `Leitura confirmada. Foram detectadas ${backendResult.detectedCount} respostas automaticamente.`
      );
    } catch (err) {
      console.error(err);
      if (isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string' && detail.trim().length > 0) {
          setAnalysisError(detail);
        } else {
          setAnalysisError('Falha ao validar o gabarito no servidor.');
        }
      } else if (err instanceof Error) {
        setAnalysisError(err.message);
      } else {
        setAnalysisError('Falha ao validar o gabarito no servidor.');
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleRevalidate = async () => {
    if (!capturedImage) {
      return;
    }
    setIsValidating(true);
    setAnalysisError(null);
    try {
      const backendResult = await runBackendAnalysis(capturedImage);
      setAnalysis(mapResultsToQuestions(backendResult.analysis));
      setAnalysisStats(backendResult.stats);
      setFeedback(
        `Leitura atualizada. Foram detectadas ${backendResult.detectedCount} respostas automaticamente.`
      );
    } catch (err) {
      console.error(err);
      if (isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string' && detail.trim().length > 0) {
          setAnalysisError(detail);
        } else {
          setAnalysisError('Falha ao validar o gabarito no servidor.');
        }
      } else if (err instanceof Error) {
        setAnalysisError(err.message);
      } else {
        setAnalysisError('Falha ao validar o gabarito no servidor.');
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleReset = () => {
    stopCamera();
    resetWorkflow();
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
        message: 'Conteúdo inválido. Informe um QR Code com identificador de prova.',
      });
      return;
    }
    setProvaId(prova);
    setAlert({
      type: 'success',
      message: `Identificação carregada manualmente: prova #${prova}.`,
    });
  };

  const handleQrDetected = async (rawValue: string) => {
    const prova = parseProvaId(rawValue);
    if (!prova) {
      setAlert({
        type: 'error',
        message: 'O QR Code lido não contém o identificador da prova.',
      });
      return;
    }
    setProvaId(prova);
    setAlert({
      type: 'success',
      message: `Prova identificada: #${prova}. Você já pode enviar as respostas.`,
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
        throw new Error('Nenhuma resposta identificada. Confirme a leitura do gabarito primeiro.');
      }
      await apiClient.post('/respostas/coletar/', {
        prova_aluno_id: provaId,
        respostas: finalAnswers,
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
          'Falha ao enviar respostas. Confira se o QR Code corresponde à prova escaneada e tente novamente.',
      });
    },
  });

  const totalQuestoes = questoesOrdenadas.length;

  return (
    <PageContainer>
      <PageHeader
        title="Leitor de gabarito"
        description="Digitalize o gabarito preenchido e valide as respostas automaticamente antes de associá-las ao aluno."
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
            <Typography variant="h6">1. Leitura em tempo real</Typography>
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
              minHeight: 280,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              backgroundColor: '#f9f9f9',
            }}
          >
            {cameraActive ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 2,
                  width: '100%',
                  alignItems: 'stretch',
                }}
              >
                <Box sx={{ position: 'relative', flex: 1, minWidth: 0 }}>
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
                      top: 12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: 'rgba(0,0,0,0.65)',
                      color: '#fff',
                      px: 2,
                      py: 0.5,
                      borderRadius: 999,
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    Enquadre o gabarito alinhando os marcadores pretos e mantenha o papel estável.
                  </Box>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    sx={{
                      position: 'absolute',
                      bottom: 12,
                      left: 12,
                      right: 12,
                      gap: 1,
                    }}
                  >
                    <Chip
                      size="small"
                      color="success"
                      label={`Detecções: ${liveDetectedCount}/${totalQuestoes || '—'}`}
                      variant="filled"
                    />
                    {liveStats && (
                      <Chip
                        size="small"
                        color="default"
                        label={`Limiar: ${formatScore(liveStats.threshold)}`}
                      />
                    )}
                  </Stack>
                  <Button
                    variant="contained"
                    startIcon={<CheckRoundedIcon />}
                    onClick={handleConfirmCurrentFrame}
                    disabled={!liveImage || isValidating}
                    sx={{ mt: 2, width: '100%' }}
                  >
                    Confirmar leitura atual
                  </Button>
                </Box>
                <Paper
                  variant="outlined"
                  sx={{
                    flexBasis: { xs: '100%', md: '38%' },
                    maxHeight: 400,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Box
                    sx={{
                      px: 2,
                      py: 1.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={600}>
                      Pré-visualização das respostas
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Confirme a leitura quando a contagem e as alternativas estiverem corretas.
                    </Typography>
                  </Box>
                  <TableContainer sx={{ flex: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Q.</TableCell>
                          <TableCell>Detecção</TableCell>
                          <TableCell>Confiança</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {liveAnalysis.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} align="center">
                              <Typography variant="body2" color="text.secondary">
                                Aguardando leitura estável...
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          liveAnalysis.slice(0, 15).map((item) => {
                            const bestScore = item.scores.reduce(
                              (acc, current) => (current.percent > acc.percent ? current : acc),
                              { letter: '', percent: 0 }
                            );
                            return (
                              <TableRow key={item.ordem}>
                                <TableCell>{item.ordem}</TableCell>
                                <TableCell>
                                  {item.detected ? (
                                    <Chip label={item.detected} color="success" size="small" />
                                  ) : (
                                    <Chip label="—" variant="outlined" size="small" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  {bestScore.letter
                                    ? `${bestScore.letter} (${Math.round(bestScore.percent * 100)}%)`
                                    : '—'}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {liveStats && (
                    <Box
                      sx={{
                        px: 2,
                        py: 1,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        gap: 1,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Chip
                        size="small"
                        label={`Média: ${formatScore(liveStats.mean)}`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`Desvio: ${formatScore(liveStats.stddev)}`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`Amostras: ${liveStats.samples}`}
                        variant="outlined"
                      />
                    </Box>
                  )}
                </Paper>
              </Box>
            ) : capturedImage ? (
              <Box sx={{ width: '100%', maxWidth: 520 }}>
                <Box
                  sx={{
                    position: 'relative',
                    borderRadius: 2,
                    overflow: 'hidden',
                    boxShadow: 3,
                  }}
                >
                  <Box
                    component="img"
                    src={capturedImage}
                    alt="Gabarito capturado"
                    sx={{ width: '100%', display: 'block' }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 12,
                      left: 12,
                      display: 'flex',
                      gap: 1,
                    }}
                  >
                    <Chip
                      size="small"
                      color="success"
                      label={`Confiança média: ${
                        analysisStats ? formatScore(analysisStats.mean) : '--'
                      }`}
                    />
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<CameraAltRoundedIcon />}
                  onClick={handleStartCamera}
                  sx={{ mt: 2 }}
                >
                  Reativar câmera
                </Button>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Selecione uma avaliação e caderno, depois clique em &quot;Iniciar câmera&quot; para
                realizar a leitura automática do gabarito.
              </Typography>
            )}
          </Paper>
          <canvas ref={analysisCanvasRef} hidden />
          {realtimeError && cameraActive && <Alert severity="warning">{realtimeError}</Alert>}
        </Stack>
      </PageSection>

      {capturedImage && (
        <PageSection>
          <Stack spacing={2}>
            <Typography variant="h6">2. Ajustes e validação</Typography>
            <Typography variant="body2" color="text.secondary">
              As respostas detectadas automaticamente podem ser ajustadas manualmente caso
              necessário. Revalide caso realize alterações ou deseje confirmar novamente com o
              servidor.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<LoopRoundedIcon />}
                onClick={handleRevalidate}
                disabled={isValidating}
              >
                Revalidar com servidor
              </Button>
              <Button variant="outlined" onClick={handleStartCamera}>
                Ler novo gabarito
              </Button>
            </Stack>
            {isValidating && <Alert severity="info">Revalidando leitura...</Alert>}
            {analysisError && <Alert severity="warning">{analysisError}</Alert>}
            {feedback && <Alert severity="success">{feedback}</Alert>}
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
                Estatísticas globais — média {formatScore(analysisStats.mean)}, desvio padrão{' '}
                {formatScore(analysisStats.stddev)}, limiar aplicado{' '}
                {formatScore(analysisStats.threshold)} ({analysisStats.samples} amostras).
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
              Leia o QR Code da prova preenchida para vincular as respostas ao aluno ou cole o
              conteúdo abaixo.
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
