import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
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

interface ManualAreaParams {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface NormalizedRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface CellScore {
  letter: string;
  darkness: number;
}

interface QuestionAnalysis {
  ordem: number;
  scores: CellScore[];
  detected: string | null;
}

interface AnalyzeResult {
  area: NormalizedRect;
  results: QuestionAnalysis[];
}

const DEFAULT_MANUAL_AREA: ManualAreaParams = {
  top: 45,
  left: 6,
  width: 88,
  height: 45
};

const MIN_THRESHOLD = 5;
const MAX_THRESHOLD = 95;

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function clamp01(value: number) {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
}

function manualToNormalized(area: ManualAreaParams): NormalizedRect {
  return {
    top: clamp01(area.top / 100),
    left: clamp01(area.left / 100),
    width: clamp01(area.width / 100),
    height: clamp01(area.height / 100)
  };
}

function fetchNormalized(data: NormalizedRect | null): NormalizedRect {
  if (!data || data.width <= 0 || data.height <= 0) {
    return manualToNormalized(DEFAULT_MANUAL_AREA);
  }
  return {
    top: clamp01(data.top),
    left: clamp01(data.left),
    width: clamp01(data.width),
    height: clamp01(data.height)
  };
}

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

function detectAnswerGridBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): NormalizedRect | null {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const step = Math.max(4, Math.floor(Math.min(width, height) / 220));
  const verticalStart = Math.floor(height * 0.18);
  const horizontalPadding = Math.floor(width * 0.04);
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let hasSamples = false;

  for (let y = verticalStart; y < height; y += step) {
    for (let x = horizontalPadding; x < width - horizontalPadding; x += step) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (brightness < 0.7) {
        hasSamples = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasSamples || maxX <= minX || maxY <= minY) {
    return null;
  }

  const marginX = Math.floor((maxX - minX) * 0.05);
  const marginY = Math.floor((maxY - minY) * 0.05);
  minX = Math.max(minX - marginX, 0);
  minY = Math.max(minY - marginY, 0);
  maxX = Math.min(maxX + marginX, width - 1);
  maxY = Math.min(maxY + marginY, height - 1);

  return {
    top: clamp01(minY / height),
    left: clamp01(minX / width),
    width: clamp01((maxX - minX) / width),
    height: clamp01((maxY - minY) / height)
  };
}

async function analyzeGabaritoImage(
  imageSrc: string,
  questoes: CadernoQuestao[],
  options: { threshold: number; area?: NormalizedRect }
): Promise<AnalyzeResult> {
  if (!questoes.length) {
    return {
      area: manualToNormalized(DEFAULT_MANUAL_AREA),
      results: []
    };
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas não suportado.');
  }
  ctx.drawImage(image, 0, 0);

  const detectedArea = options.area ?? detectAnswerGridBounds(ctx, canvas.width, canvas.height);
  const normalizedArea = fetchNormalized(detectedArea);

  const areaX = Math.floor(normalizedArea.left * canvas.width);
  const areaY = Math.floor(normalizedArea.top * canvas.height);
  const areaWidth = Math.floor(normalizedArea.width * canvas.width);
  const areaHeight = Math.floor(normalizedArea.height * canvas.height);

  const rows = questoes.length;
  const columns = LETTERS.length;
  const rowHeight = areaHeight / rows;
  const columnWidth = areaWidth / columns;

  const results: QuestionAnalysis[] = [];
  const effectiveThreshold = clamp01(options.threshold);

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const questionNumber = questoes[rowIndex].ordem;
    const scores: CellScore[] = [];

    for (let colIndex = 0; colIndex < columns; colIndex += 1) {
      const cellX = areaX + colIndex * columnWidth;
      const cellY = areaY + rowIndex * rowHeight;

      const marginX = columnWidth * 0.18;
      const marginY = rowHeight * 0.2;
      const sampleX = Math.floor(cellX + marginX);
      const sampleY = Math.floor(cellY + marginY);
      const sampleWidth = Math.max(2, Math.floor(columnWidth - marginX * 2));
      const sampleHeight = Math.max(2, Math.floor(rowHeight - marginY * 2));

      const imageData = ctx.getImageData(sampleX, sampleY, sampleWidth, sampleHeight);
      const { data } = imageData;
      let darknessSum = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        darknessSum += 1 - brightness;
      }

      const sampleCount = data.length / 4;
      const avgDarkness = sampleCount ? darknessSum / sampleCount : 0;
      scores.push({ letter: LETTERS[colIndex], darkness: avgDarkness });
    }

    const best = scores.reduce(
      (acc, current) => (current.darkness > acc.darkness ? current : acc),
      { letter: '', darkness: 0 }
    );
    const detected = best.darkness >= effectiveThreshold ? best.letter : null;

    results.push({
      ordem: questionNumber,
      scores,
      detected
    });
  }

  return { area: normalizedArea, results };
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

  const [manualArea, setManualArea] = useState<ManualAreaParams>(DEFAULT_MANUAL_AREA);
  const [threshold, setThreshold] = useState<number>(38);
  const [useAutoArea, setUseAutoArea] = useState<boolean>(true);
  const [answerArea, setAnswerArea] = useState<NormalizedRect>(manualToNormalized(DEFAULT_MANUAL_AREA));
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<QuestionAnalysis[]>([]);
  const [manualAdjustments, setManualAdjustments] = useState<Record<number, string>>({});
  const [analysisError, setAnalysisError] = useState<string | null>(null);
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
    setAnswerArea(useAutoArea ? answerArea : manualToNormalized(manualArea));
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

    if (useAutoArea) {
      try {
        const detected = detectAnswerGridBounds(ctx, canvas.width, canvas.height);
        setAnswerArea(fetchNormalized(detected));
      } catch (err) {
        console.error(err);
        setAnswerArea(manualToNormalized(DEFAULT_MANUAL_AREA));
      }
    } else {
      setAnswerArea(manualToNormalized(manualArea));
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

  const handleManualAreaChange =
    (field: keyof ManualAreaParams) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      setManualArea((prev) => {
        const updated = { ...prev, [field]: Number.isFinite(value) ? value : prev[field] };
        if (!useAutoArea) {
          setAnswerArea(manualToNormalized(updated));
        }
        return updated;
      });
    };

  const handleThresholdChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isFinite(value)) {
      setThreshold(Math.min(Math.max(value, MIN_THRESHOLD), MAX_THRESHOLD));
    }
  };

  const handleToggleAutoArea = (_event: ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setUseAutoArea(checked);
    if (!checked) {
      setAnswerArea(manualToNormalized(manualArea));
    }
  };

  const handleAnalyze = async () => {
    if (!capturedImage) {
      setAnalysisError('Capture a imagem do gabarito antes de analisar.');
      return;
    }
    if (questoesOrdenadas.length === 0) {
      setAnalysisError('Selecione um caderno com questões cadastradas.');
      return;
    }
    try {
      setAnalysisError(null);
      const result = await analyzeGabaritoImage(capturedImage, questoesOrdenadas, {
        threshold: clamp01(threshold / 100),
        area: useAutoArea ? undefined : manualToNormalized(manualArea)
      });
      setAnswerArea(result.area);
      setAnalysis(result.results);
      setFeedback(
        `Leitura concluída. Foram detectadas ${result.results.filter((item) => item.detected).length} respostas.`
      );
    } catch (err) {
      console.error(err);
      setAnalysisError('Falha ao processar a imagem. Ajuste os marcadores ou capture novamente.');
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
                  <Box
                    sx={{
                      position: 'absolute',
                      top: `${answerArea.top * 100}%`,
                      left: `${answerArea.left * 100}%`,
                      width: `${answerArea.width * 100}%`,
                      height: `${answerArea.height * 100}%`,
                      border: '2px dashed rgba(255, 255, 255, 0.85)',
                      boxShadow: '0 0 0 2000px rgba(0,0,0,0.28)',
                      pointerEvents: 'none'
                    }}
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
            <FormControlLabel
              control={<Switch checked={useAutoArea} onChange={handleToggleAutoArea} />}
              label="Detectar área automaticamente"
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Posição superior (%)"
                type="number"
                value={manualArea.top}
                onChange={handleManualAreaChange('top')}
                helperText="Ajusta o início vertical da tabela."
                inputProps={{ min: 0, max: 100 }}
                disabled={useAutoArea}
              />
              <TextField
                label="Posição esquerda (%)"
                type="number"
                value={manualArea.left}
                onChange={handleManualAreaChange('left')}
                helperText="Ajusta a margem esquerda."
                inputProps={{ min: 0, max: 100 }}
                disabled={useAutoArea}
              />
              <TextField
                label="Largura (%)"
                type="number"
                value={manualArea.width}
                onChange={handleManualAreaChange('width')}
                helperText="Ajusta a largura do quadro."
                inputProps={{ min: 5, max: 100 }}
                disabled={useAutoArea}
              />
              <TextField
                label="Altura (%)"
                type="number"
                value={manualArea.height}
                onChange={handleManualAreaChange('height')}
                helperText="Ajusta a altura total."
                inputProps={{ min: 5, max: 100 }}
                disabled={useAutoArea}
              />
              <TextField
                label="Sensibilidade (%)"
                type="number"
                value={threshold}
                onChange={handleThresholdChange}
                helperText="Quanto maior, mais preenchido o quadrado precisa estar."
                inputProps={{ min: MIN_THRESHOLD, max: MAX_THRESHOLD }}
              />
            </Stack>
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
                      (acc, current) => (current.darkness > acc.darkness ? current : acc),
                      { letter: '', darkness: 0 }
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
                            ? `${bestScore.letter} (${Math.round(bestScore.darkness * 100)}%)`
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
