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
import { loadOpenCv } from '../../utils/opencv';
import { analyzeOmrImage } from '../../omr/analysis';
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
  percent: number;
}

interface QuestionAnalysis {
  ordem: number;
  scores: CellScore[];
  detected: string | null;
}

interface AnalysisStats {
  mean: number;
  stddev: number;
  threshold: number;
  samples: number;
}

interface AnalyzeResult {
  area: NormalizedRect;
  results: QuestionAnalysis[];
  stats: AnalysisStats;
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
const GRID_COLUMNS_MM = [20, 16, 16, 16, 16, 16];
const GRID_PADDING_MM = { top: 18, bottom: 18, left: 22, right: 22 } as const;
const ROW_HEIGHT_MM = 12;
const MARKER_SIZE_MM = 14;
const MARKER_OFFSET_FROM_GRID_MM = 12 - MARKER_SIZE_MM / 2; // 5 mm entre centro do marcador e borda
const PX_PER_MM = 10;

const GRID_INNER_WIDTH_MM = GRID_COLUMNS_MM.reduce((acc, value) => acc + value, 0);
const TOTAL_WIDTH_MM = GRID_INNER_WIDTH_MM + GRID_PADDING_MM.left + GRID_PADDING_MM.right;

const computeTotalHeightMm = (rows: number) =>
  GRID_PADDING_MM.top + GRID_PADDING_MM.bottom + ROW_HEIGHT_MM * rows;

const computeNormalizedGridArea = (rows: number): NormalizedRect => {
  const totalHeightMm = computeTotalHeightMm(rows);
  return {
    top: GRID_PADDING_MM.top / totalHeightMm,
    left: GRID_PADDING_MM.left / TOTAL_WIDTH_MM,
    width: GRID_INNER_WIDTH_MM / TOTAL_WIDTH_MM,
    height: (ROW_HEIGHT_MM * rows) / totalHeightMm
  };
};

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

async function attemptPerspectiveNormalization(
  baseCanvas: HTMLCanvasElement,
  rows: number
): Promise<{ canvas: HTMLCanvasElement; normalizedArea: NormalizedRect } | null> {
  try {
    const cv = await loadOpenCv();
    const src = cv.imread(baseCanvas);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    const blur = new cv.Mat();
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    const binary = new cv.Mat();
    cv.adaptiveThreshold(
      blur,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      35,
      12
    );
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    type MarkerCandidate = {
      center: { x: number; y: number };
      size: number;
    };
    const markers: MarkerCandidate[] = [];

    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * peri, true);
      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const area = cv.contourArea(approx);
        if (area < (src.cols * src.rows) * 0.005) {
          approx.delete();
          contour.delete();
          continue;
        }
        const rect = cv.boundingRect(approx);
        const aspect = rect.width / rect.height;
        if (aspect < 0.75 || aspect > 1.25) {
          approx.delete();
          contour.delete();
          continue;
        }
        const moments = cv.moments(approx);
        if (moments.m00 === 0) {
          approx.delete();
          contour.delete();
          continue;
        }
        const center = {
          x: moments.m10 / moments.m00,
          y: moments.m01 / moments.m00
        };
        markers.push({ center, size: (rect.width + rect.height) / 2 });
        approx.delete();
      } else {
        approx.delete();
      }
      contour.delete();
    }

    contours.delete();
    hierarchy.delete();
    binary.delete();
    blur.delete();
    gray.delete();

    if (markers.length < 4) {
      src.delete();
      return null;
    }

    const orderedMarkers = markers
      .sort((a, b) => b.size - a.size)
      .slice(0, 4)
      .sort((a, b) => a.center.y - b.center.y);

    const topPair = orderedMarkers.slice(0, 2).sort((a, b) => a.center.x - b.center.x);
    const bottomPair = orderedMarkers.slice(2, 4).sort((a, b) => a.center.x - b.center.x);
    const arranged = [topPair[0], topPair[1], bottomPair[0], bottomPair[1]];

    const avgMarkerSize = arranged.reduce((acc, marker) => acc + marker.size, 0) / arranged.length;
    const pxPerMm = avgMarkerSize / MARKER_SIZE_MM;
    const offsetPx = pxPerMm * MARKER_OFFSET_FROM_GRID_MM;

    const srcPoints = [
      { x: arranged[0].center.x + offsetPx, y: arranged[0].center.y + offsetPx },
      { x: arranged[1].center.x - offsetPx, y: arranged[1].center.y + offsetPx },
      { x: arranged[2].center.x + offsetPx, y: arranged[2].center.y - offsetPx },
      { x: arranged[3].center.x - offsetPx, y: arranged[3].center.y - offsetPx }
    ];

    const totalHeightMm = computeTotalHeightMm(rows);
    const destWidth = Math.round(TOTAL_WIDTH_MM * PX_PER_MM);
    const destHeight = Math.round(totalHeightMm * PX_PER_MM);

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      srcPoints[0].x,
      srcPoints[0].y,
      srcPoints[1].x,
      srcPoints[1].y,
      srcPoints[2].x,
      srcPoints[2].y,
      srcPoints[3].x,
      srcPoints[3].y
    ]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,
      0,
      destWidth,
      0,
      0,
      destHeight,
      destWidth,
      destHeight
    ]);

    const transform = cv.getPerspectiveTransform(srcTri, dstTri);
    const warped = new cv.Mat();
    cv.warpPerspective(
      src,
      warped,
      transform,
      new cv.Size(destWidth, destHeight),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255)
    );

    const warpCanvas = document.createElement('canvas');
    warpCanvas.width = destWidth;
    warpCanvas.height = destHeight;
    cv.imshow(warpCanvas, warped);

    warped.delete();
    transform.delete();
    srcTri.delete();
    dstTri.delete();
    src.delete();

    return {
      canvas: warpCanvas,
      normalizedArea: computeNormalizedGridArea(rows)
    };
  } catch (error) {
    console.error('Perspective normalization failed', error);
    return null;
  }
}

async function analyzeGabaritoImage(
  imageSrc: string,
  questoes: CadernoQuestao[],
  options: { threshold: number; area?: NormalizedRect }
): Promise<AnalyzeResult> {
  if (!questoes.length) {
    return {
      area: manualToNormalized(DEFAULT_MANUAL_AREA),
      results: [],
      stats: { mean: 0, stddev: 0, threshold: clamp01(options.threshold), samples: 0 }
    };
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = image.width;
  baseCanvas.height = image.height;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) {
    throw new Error('Canvas não suportado.');
  }
  baseCtx.drawImage(image, 0, 0);

  let normalizedArea: NormalizedRect | null = options.area ?? null;
  if (!normalizedArea) {
    const detectedArea = detectAnswerGridBounds(baseCtx, baseCanvas.width, baseCanvas.height);
    normalizedArea = fetchNormalized(detectedArea);
  }

  let workingCanvas: HTMLCanvasElement = baseCanvas;
  let workingArea: NormalizedRect = normalizedArea;

  const warpResult = await attemptPerspectiveNormalization(baseCanvas, questoes.length);
  if (warpResult) {
    workingCanvas = warpResult.canvas;
    workingArea = warpResult.normalizedArea;
  }

  const questoesOrdem = questoes.map((questao) => questao.ordem);
  const omrOutcome = await analyzeOmrImage(workingCanvas, questoesOrdem, {
    rows: questoes.length,
    columns: LETTERS.length,
    normalizedArea: workingArea,
    sensitivity: options.threshold
  });

  const results: QuestionAnalysis[] = omrOutcome.results.map((item) => ({
    ordem: item.ordem,
    detected: item.detected,
    scores: item.scores.map((score) => ({
      letter: score.letter,
      percent: score.percent
    }))
  }));

  return {
    area: workingArea,
    results,
    stats: omrOutcome.stats
  };
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
      setAnalysisStats(result.stats);
      setFeedback(
        `Leitura concluída. Foram detectadas ${result.results.filter((item) => item.detected).length} respostas.`
      );
    } catch (err) {
      console.error(err);
      setAnalysisError('Falha ao processar a imagem. Ajuste os marcadores ou capture novamente.');
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
