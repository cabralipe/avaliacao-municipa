import { Box, CircularProgress, Typography } from '@mui/material';

export function FullScreenSpinner() {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        background:
          'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(15,23,42,0.04) 40%, rgba(255,255,255,0.8) 100%)'
      }}
    >
      <CircularProgress size={56} thickness={4} color="primary" />
      <Typography variant="subtitle1" color="text.secondary">
        Carregando...
      </Typography>
    </Box>
  );
}
