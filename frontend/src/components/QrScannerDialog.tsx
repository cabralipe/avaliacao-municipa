import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle
} from '@mui/material';

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
            O seu navegador não oferece suporte à leitura automática de QR Code. Utilize a opção de colar o conteúdo do
            QR Code manualmente.
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
