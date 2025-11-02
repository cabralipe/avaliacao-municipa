import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';

import { apiClient } from '../../api/client';
import { PageContainer, PageHeader, PageSection } from '../../components/layout/Page';
import type { Avaliacao, Caderno, PaginatedResponse, ProvaAluno } from '../../types';

declare global {
  interface Window {
    BarcodeDetector?: new (config?: { formats?: string[] }) => {
      detect: (
        source: HTMLVideoElement | HTMLCanvasElement | ImageBitmapSource
      ) => Promise<Array<{ rawValue?: string }>>;
    };
  }
}

interface GabaritoResponse {
  prova: {
    id: number;
    aluno_id: number;
    aluno_nome: string;
    avaliacao_id: number;
    avaliacao_titulo: string;
    caderno_id: number | null;
    caderno_codigo: string | null;
  };
  gabarito: Array<{
    ordem: number;
    caderno_questao: number;
    questao: number;
    alternativa_correta: string | null;
  }>;
}

type AlertState = { type: 'error' | 'success' | 'info'; message: string } | null;

async function fetchProvas(): Promise<ProvaAluno[]> {
  const { data } = await apiClient.get<ProvaAluno[] | PaginatedResponse<ProvaAluno>>(
    '/avaliacoes/provas/',
    { params: { page_size: 0 } }
  );
  return Array.isArray(data) ? data : data.results;
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

function payloadValue<T>(prova: ProvaAluno, key: string, fallback?: T): T | undefined {
  const payload = (prova.qr_payload ?? {}) as Record<string, unknown>;
  const value = payload[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  return value as T;
}

interface QrScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onDetected: (rawValue: string) => void;
}

function QrScannerDialog({ open, onClose, onDetected }: QrScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean>(true);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    setError(null);

    const start = async () => {
      const barcodeCtor = window.BarcodeDetector;
      if (!barcodeCtor) {
        setSupported(false);
        return;
      }
      setSupported(true);

      const detector = new barcodeCtor({ formats: ['qr_code'] });
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
      } catch (cameraError) {
        console.error(cameraError);
        setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
        return;
      }

      if (!active || !videoRef.current) {
        return;
      }

      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch (err) {
        console.error(err);
        setError('Não foi possível iniciar a visualização da câmera.');
        return;
      }

      const detect = async () => {
        if (!active || !videoRef.current) {
          return;
        }
        try {
          const results = await detector.detect(videoRef.current);
          const first = results.find((result) => typeof result.rawValue === 'string');
          if (first?.rawValue) {
            active = false;
            onDetected(first.rawValue);
            onClose();
            return;
          }
        } catch (detectError) {
          console.error(detectError);
          setError('Falha ao processar o QR Code. Tente novamente.');
        }
        if (active) {
          rafId = requestAnimationFrame(detect);
        }
      };

      rafId = requestAnimationFrame(detect);
    };

    start();

    return () => {
      active = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [open, onClose, onDetected]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Leitura do QR Code</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {!supported ? (
          <Alert severity="warning">
            O seu navegador não oferece suporte à leitura automática de QR Code. Utilize a opção de colar o
            conteúdo do QR Code manualmente.
          </Alert>
        ) : (
          <Box
            component="video"
            ref={videoRef}
            autoPlay
            muted
            playsInline
            sx={{
              width: '100%',
              borderRadius: 1,
              border: (theme) => `1px solid ${theme.palette.divider}`,
              backgroundColor: 'black'
            }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}

export function ProfessorProvasPage() {
  const { data: provas = [], isLoading: loadingProvas } = useQuery({
    queryKey: ['provas'],
    queryFn: fetchProvas
  });
  const { data: avaliacoes = [] } = useQuery({
    queryKey: ['avaliacoes'],
    queryFn: fetchAvaliacoes
  });
  const { data: cadernos = [] } = useQuery({
    queryKey: ['cadernos'],
    queryFn: fetchCadernos
  });

  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualPayload, setManualPayload] = useState('');
  const [gabaritoData, setGabaritoData] = useState<GabaritoResponse | null>(null);
  const [alert, setAlert] = useState<AlertState>(null);

  const avaliacaoMap = useMemo(() => {
    const map = new Map<number, Avaliacao>();
    avaliacoes.forEach((avaliacao) => map.set(avaliacao.id, avaliacao));
    return map;
  }, [avaliacoes]);

  const cadernoMap = useMemo(() => {
    const map = new Map<number, Caderno>();
    cadernos.forEach((caderno) => map.set(caderno.id, caderno));
    return map;
  }, [cadernos]);

  const hasQrEnabled = useMemo(
    () => avaliacoes.some((avaliacao) => avaliacao.habilitar_correcao_qr),
    [avaliacoes]
  );

  const resetAlert = () => setAlert(null);

  const processQrPayload = useCallback(
    async (rawValue: string) => {
      resetAlert();
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawValue);
      } catch (err) {
        console.error(err);
        setAlert({ type: 'error', message: 'Conteúdo inválido. O QR Code deve conter um JSON válido.' });
        return;
      }

      if (typeof parsed !== 'object' || parsed === null) {
        setAlert({ type: 'error', message: 'Formato inesperado do QR Code.' });
        return;
      }

      const payload = parsed as Record<string, unknown>;
      const provaIdRaw =
        payload.prova_id ?? payload.provaId ?? payload.id ?? payload.prova ?? payload['provaId'];
      const provaId = Number(provaIdRaw);
      if (!Number.isFinite(provaId) || provaId <= 0) {
        setAlert({
          type: 'error',
          message: 'O QR Code não possui o identificador da prova. Gere novamente o código e tente outra vez.'
        });
        return;
      }

      try {
        const { data } = await apiClient.get<GabaritoResponse>(
          `/avaliacoes/provas/${provaId}/gabarito/`
        );
        setGabaritoData(data);
        setAlert({
          type: 'success',
          message: `Gabarito carregado com sucesso para a prova #${data.prova.id}.`
        });
        setManualPayload('');
      } catch (err) {
        console.error(err);
        setGabaritoData(null);
        setAlert({
          type: 'error',
          message:
            'Não foi possível obter o gabarito. Verifique se a liberação por QR Code está ativa para esta avaliação.'
        });
      }
    },
    []
  );

  const handleManualSubmit = () => {
    if (!manualPayload.trim()) {
      setAlert({ type: 'info', message: 'Cole o conteúdo do QR Code para prosseguir.' });
      return;
    }
    processQrPayload(manualPayload.trim());
  };

  const handleDownload = async (prova: ProvaAluno) => {
    resetAlert();
    try {
      const response = await apiClient.get<Blob>(
        `/avaliacoes/provas/${prova.id}/download/`,
        {
          responseType: 'blob'
        }
      );
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const disposition = response.headers?.['content-disposition'];
      const match = typeof disposition === 'string' ? /filename="?([^"]+)"?/i.exec(disposition) : null;
      link.href = url;
      link.download = match?.[1] ?? `prova-${prova.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setAlert({
        type: 'error',
        message:
          'Não foi possível baixar o arquivo. Verifique se a avaliação está liberada para download pelo administrador.'
      });
    }
  };

  const handleOpenGabarito = async (prova: ProvaAluno) => {
    resetAlert();
    try {
      const { data } = await apiClient.get<GabaritoResponse>(
        `/avaliacoes/provas/${prova.id}/gabarito/`
      );
      setGabaritoData(data);
      setAlert({
        type: 'success',
        message: `Gabarito carregado para a prova #${data.prova.id}.`
      });
    } catch (err) {
      console.error(err);
      setGabaritoData(null);
      setAlert({
        type: 'error',
        message:
          'Não foi possível carregar o gabarito. Confirme se a correção via QR Code está habilitada pelo administrador.'
      });
    }
  };

  const renderStatusChip = (active: boolean, label: string, color: 'success' | 'default') => (
    <Chip
      size="small"
      label={label}
      color={active ? color : 'default'}
      variant={active ? 'filled' : 'outlined'}
    />
  );

  const handleManualChange = (event: ChangeEvent<HTMLInputElement>) => {
    setManualPayload(event.target.value);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Provas"
        description="Baixe as provas disponibilizadas e acesse o gabarito sempre que liberado pela equipe gestora."
      />

      {alert && (
        <PageSection>
          <Alert severity={alert.type} onClose={() => setAlert(null)}>
            {alert.message}
          </Alert>
        </PageSection>
      )}

      <PageSection>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
            <Typography variant="h6">Provas por aluno</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<QrCodeScannerRoundedIcon />}
                onClick={() => setScannerOpen(true)}
                disabled={!hasQrEnabled}
              >
                Ler QR Code
              </Button>
              <Button variant="text" onClick={() => setGabaritoData(null)}>
                Limpar seleção
              </Button>
            </Stack>
          </Stack>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Prova</TableCell>
                  <TableCell>Avaliação</TableCell>
                  <TableCell>Aluno</TableCell>
                  <TableCell>Caderno</TableCell>
                  <TableCell align="center">Download</TableCell>
                  <TableCell align="center">Correção via QR</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingProvas && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!loadingProvas && provas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Nenhuma prova disponível no momento.
                    </TableCell>
                  </TableRow>
                )}
                {provas.map((prova) => {
                  const avaliacao = avaliacaoMap.get(prova.avaliacao);
                  const caderno = prova.caderno ? cadernoMap.get(prova.caderno) : null;
                  const alunoNome =
                    payloadValue<string>(prova, 'aluno_nome') ?? `Aluno ${prova.aluno}`;
                  const avaliacaoTitulo =
                    avaliacao?.titulo ?? payloadValue<string>(prova, 'avaliacao_titulo') ?? '—';
                  const downloadLiberado = avaliacao?.liberada_para_professores ?? false;
                  const qrLiberado = avaliacao?.habilitar_correcao_qr ?? false;

                  return (
                    <TableRow key={prova.id}>
                      <TableCell>{`#${prova.id}`}</TableCell>
                      <TableCell>{avaliacaoTitulo}</TableCell>
                      <TableCell>{alunoNome}</TableCell>
                      <TableCell>{caderno?.codigo ?? '—'}</TableCell>
                      <TableCell align="center">
                        {renderStatusChip(downloadLiberado, downloadLiberado ? 'Liberado' : 'Bloqueado', 'success')}
                      </TableCell>
                      <TableCell align="center">
                        {renderStatusChip(qrLiberado, qrLiberado ? 'Ativo' : 'Desativado', 'success')}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton
                            color="primary"
                            onClick={() => handleDownload(prova)}
                            disabled={!downloadLiberado}
                            aria-label={`Baixar prova ${prova.id}`}
                          >
                            <DownloadRoundedIcon />
                          </IconButton>
                          <IconButton
                            color="secondary"
                            onClick={() => handleOpenGabarito(prova)}
                            disabled={!qrLiberado}
                            aria-label={`Visualizar gabarito da prova ${prova.id}`}
                          >
                            <ManageSearchRoundedIcon />
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

      <PageSection>
        <Stack spacing={2}>
          <Typography variant="h6">Processar QR Code manualmente</Typography>
          <TextField
            label="Conteúdo do QR Code"
            placeholder='Exemplo: {"prova_id": 123, ...}'
            value={manualPayload}
            onChange={handleManualChange}
            multiline
            minRows={3}
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="outlined" onClick={() => setManualPayload('')}>
              Limpar
            </Button>
            <Button variant="contained" onClick={handleManualSubmit}>
              Processar QR Code
            </Button>
          </Stack>
        </Stack>
      </PageSection>

      {gabaritoData && (
        <PageSection>
          <Stack spacing={2}>
            <Typography variant="h6">Gabarito carregado</Typography>
            <Typography variant="body2" color="text.secondary">
              {`Prova #${gabaritoData.prova.id} — Avaliação ${gabaritoData.prova.avaliacao_titulo} — ${gabaritoData.prova.aluno_nome}`}
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Questão</TableCell>
                    <TableCell>Alternativa correta</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gabaritoData.gabarito.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} align="center">
                        Nenhum gabarito cadastrado para este caderno.
                      </TableCell>
                    </TableRow>
                  ) : (
                    gabaritoData.gabarito.map((item) => (
                      <TableRow key={item.caderno_questao}>
                        <TableCell>{item.ordem}</TableCell>
                        <TableCell>
                          {item.alternativa_correta ? (
                            <Chip label={item.alternativa_correta} color="success" size="small" />
                          ) : (
                            <Chip label="Sem gabarito" size="small" variant="outlined" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </PageSection>
      )}

      <QrScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={processQrPayload}
      />
    </PageContainer>
  );
}
