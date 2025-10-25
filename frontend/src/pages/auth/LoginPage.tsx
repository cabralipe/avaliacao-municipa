import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';

import { useAuth } from '../../hooks/useAuth';

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/';

  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(form);
      navigate(from, { replace: true });
    } catch (loginError) {
      setError('Não foi possível autenticar. Verifique suas credenciais.');
      console.error(loginError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(120deg, #1e3a8a 0%, #2563eb 45%, #60a5fa 100%)',
        px: 2
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, md: 6 },
            borderRadius: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            boxShadow: '0 30px 60px rgba(15, 23, 42, 0.25)'
          }}
        >
          <Stack spacing={3} component="form" onSubmit={handleSubmit}>
            <Stack spacing={1}>
              <Typography variant="overline" color="primary.main" letterSpacing={2}>
                Avaliação Municipal
              </Typography>
              <Typography variant="h4" component="h1">
                Bem-vindo de volta
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Acesse sua conta para acompanhar cadastros, avaliações e resultados.
              </Typography>
            </Stack>

            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Usuário"
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, username: event.target.value }))
              }
              required
              autoFocus
              fullWidth
            />
            <TextField
              label="Senha"
              type="password"
              name="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              required
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting}
            >
              {submitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
