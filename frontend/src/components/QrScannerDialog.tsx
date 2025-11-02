import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Stack
} from '@mui/material';
import QrScanner from 'qr-scanner';

interface QrScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onDetected: (rawValue: string) => void;
}

declare global {
  interface Window {
    BarcodeDetector?: new (config?: { formats?: string[] }) => {
      detect: (
        source: HTMLVideoElement | HTMLCanvasElement | ImageBitmapSource
      ) => Promise<Array<{ rawValue?: string }>>;
    };
  }
}

export function QrScannerDialog({ open, onClose, onDetected }: QrScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean>(true);
  const [scannerMethod, setScannerMethod] = useState<'barcode' | 'qr-scanner' | 'none'>('none');
  const qrScannerRef = useRef<QrScanner | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    setError(null);

    const cleanup = () => {
      active = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };

    const tryBarcodeDetector = async () => {
      const barcodeCtor = window.BarcodeDetector;
      if (!barcodeCtor) {
        return false;
      }

      try {
        const detector = new barcodeCtor({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        if (!active || !videoRef.current) {
          return false;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScannerMethod('barcode');

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
        return true;
      } catch (err) {
        console.error('BarcodeDetector failed:', err);
        return false;
      }
    };

    const tryQrScanner = async () => {
      try {
        if (!videoRef.current) {
          return false;
        }

        // Verificar se a câmera está disponível
        const hasCamera = await QrScanner.hasCamera();
        if (!hasCamera) {
          setError('Nenhuma câmera foi encontrada no dispositivo.');
          return false;
        }

        qrScannerRef.current = new QrScanner(
          videoRef.current,
          (result) => {
            if (active) {
              active = false;
              onDetected(result.data);
              onClose();
            }
          },
          {
            onDecodeError: (err) => {
              // Ignorar erros de decodificação (normais quando não há QR code na imagem)
              console.debug('QR decode error:', err);
            },
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: 'environment'
          }
        );

        await qrScannerRef.current.start();
        setScannerMethod('qr-scanner');
        return true;
      } catch (err) {
        console.error('QrScanner failed:', err);
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            setError('Acesso à câmera foi negado. Por favor, permita o acesso à câmera e tente novamente.');
          } else if (err.name === 'NotFoundError') {
            setError('Nenhuma câmera foi encontrada no dispositivo.');
          } else if (err.name === 'NotSupportedError') {
            setError('Seu navegador não suporta acesso à câmera.');
          } else {
            setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
          }
        }
        return false;
      }
    };

    const start = async () => {
      // Tentar primeiro com BarcodeDetector (mais rápido)
      const barcodeSuccess = await tryBarcodeDetector();
      if (barcodeSuccess) {
        setSupported(true);
        return;
      }

      // Se BarcodeDetector falhar, tentar com qr-scanner
      const qrScannerSuccess = await tryQrScanner();
      if (qrScannerSuccess) {
        setSupported(true);
        return;
      }

      // Se ambos falharem, mostrar que não é suportado
      setSupported(false);
    };

    start();

    return cleanup;
  }, [open, onClose, onDetected]);

  const getBrowserCompatibilityMessage = () => {
    const userAgent = navigator.userAgent;
    const isChrome = /Chrome/.test(userAgent);
    const isFirefox = /Firefox/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    const isEdge = /Edg/.test(userAgent);

    if (isChrome || isEdge) {
      return 'Para melhor experiência, certifique-se de que está usando a versão mais recente do navegador.';
    } else if (isFirefox) {
      return 'O Firefox pode ter limitações com a leitura de QR Code. Considere usar Chrome ou Edge para melhor compatibilidade.';
    } else if (isSafari) {
      return 'O Safari pode ter limitações com a leitura de QR Code. Considere usar Chrome ou Edge para melhor compatibilidade.';
    }
    return 'Para melhor experiência, recomendamos usar Chrome, Edge ou Firefox nas versões mais recentes.';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Leitura do QR Code</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" component="div">
              <strong>Erro:</strong> {error}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Soluções:</strong>
            </Typography>
            <Typography variant="body2" component="ul" sx={{ mt: 0.5, pl: 2 }}>
              <li>Verifique se permitiu acesso à câmera</li>
              <li>Recarregue a página e tente novamente</li>
              <li>Use a opção manual abaixo para colar o conteúdo do QR Code</li>
            </Typography>
          </Alert>
        )}
        
        {!supported ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" component="div">
              <strong>Leitura automática não disponível</strong>
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Seu navegador não oferece suporte completo à leitura automática de QR Code.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {getBrowserCompatibilityMessage()}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Alternativa:</strong> Use a opção "Processar QR Code manualmente" na página principal para colar o conteúdo do QR Code.
            </Typography>
          </Alert>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {scannerMethod === 'barcode' && 'Usando detector nativo do navegador...'}
              {scannerMethod === 'qr-scanner' && 'Usando scanner compatível...'}
              {scannerMethod === 'none' && 'Iniciando scanner...'}
            </Typography>
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
                backgroundColor: 'black',
                minHeight: 300
              }}
            />
            <Typography variant="body2" color="text.secondary" align="center">
              Posicione o QR Code dentro da área de visualização
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
