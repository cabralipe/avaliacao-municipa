import { useMemo, useState, type ElementType } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import SpaceDashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded';
import Diversity3RoundedIcon from '@mui/icons-material/Diversity3Rounded';
import TrackChangesRoundedIcon from '@mui/icons-material/TrackChangesRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import ChecklistRtlRoundedIcon from '@mui/icons-material/ChecklistRtlRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';

import { useAuth } from '../../hooks/useAuth';
import type { Role } from '../../types';

const drawerWidth = 280;

interface NavItem {
  label: string;
  to: string;
  icon: ElementType;
  roles?: Role[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: 'Geral',
    items: [{ label: 'Painel', to: '/', icon: SpaceDashboardRoundedIcon }]
  },
  {
    title: 'Escolas',
    items: [
      { label: 'Escolas', to: '/escolas', icon: SchoolRoundedIcon, roles: ['admin'] },
      { label: 'Turmas', to: '/escolas/turmas', icon: Groups2RoundedIcon, roles: ['admin'] },
      { label: 'Alunos', to: '/escolas/alunos', icon: Diversity3RoundedIcon, roles: ['admin'] }
    ]
  },
  {
    title: 'Banco de Itens',
    items: [
      {
        label: 'Competências',
        to: '/itens/competencias',
        icon: TrackChangesRoundedIcon,
        roles: ['admin', 'professor']
      },
      {
        label: 'Habilidades',
        to: '/itens/habilidades',
        icon: BoltRoundedIcon,
        roles: ['admin', 'professor']
      },
      {
        label: 'Questões',
        to: '/itens/questoes',
        icon: QuizRoundedIcon,
        roles: ['admin', 'professor']
      }
    ]
  },
  {
    title: 'Avaliações',
    items: [
      { label: 'Avaliações', to: '/avaliacoes', icon: AssessmentRoundedIcon, roles: ['admin'] },
      { label: 'Cadernos', to: '/avaliacoes/cadernos', icon: MenuBookRoundedIcon, roles: ['admin'] },
      { label: 'Provas', to: '/avaliacoes/provas', icon: AssignmentTurnedInRoundedIcon, roles: ['admin'] }
    ]
  },
  {
    title: 'Respostas',
    items: [
      { label: 'Respostas', to: '/respostas', icon: FactCheckRoundedIcon, roles: ['admin'] },
      {
        label: 'Gabaritos',
        to: '/respostas/gabaritos',
        icon: ChecklistRtlRoundedIcon,
        roles: ['admin']
      }
    ]
  },
  {
    title: 'Relatórios',
    items: [
      {
        label: 'Proficiência por Habilidade',
        to: '/relatorios/proficiencia-habilidade',
        icon: InsightsRoundedIcon,
        roles: ['admin']
      }
    ]
  }
];

const isPathActive = (pathname: string, target: string) => {
  if (target === '/') {
    return pathname === '/';
  }
  return pathname === target || pathname.startsWith(`${target}/`);
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = useMemo(() => {
    const base = user?.username ?? user?.email ?? 'Usuário';
    return base
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [user]);

  const userRole = user?.role ?? null;

  const visibleSections = useMemo(() => {
    if (!userRole) {
      return [];
    }
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (!item.roles || item.roles.length === 0) {
            return true;
          }
          return item.roles.includes(userRole) || userRole === 'superadmin';
        })
      }))
      .filter((section) => section.items.length > 0);
  }, [userRole]);

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleNavigate = (to: string) => {
    navigate(to);
    if (!isDesktop) {
      setMobileOpen(false);
    }
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ px: 3 }}>
        <Stack spacing={0.25}>
          <Typography variant="overline" color="text.secondary">
            Avaliação Municipal
          </Typography>
          <Typography variant="h6" fontWeight={700} color="text.primary">
            Painel Educacional
          </Typography>
        </Stack>
      </Toolbar>
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto', pb: 2 }}>
        <List disablePadding sx={{ mt: 1 }}>
          {visibleSections.map((section) => (
            <Box component="nav" key={section.title} sx={{ mb: 2 }}>
              <Typography
                variant="overline"
                sx={{
                  px: 3,
                  mb: 0.75,
                  letterSpacing: '.08em',
                  color: 'text.secondary'
                }}
              >
                {section.title}
              </Typography>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isPathActive(location.pathname, item.to);
                return (
                  <ListItemButton
                    key={item.to}
                    selected={active}
                    onClick={() => handleNavigate(item.to)}
                    sx={{
                      mx: 1.5,
                      mb: 0.5,
                      borderRadius: 2.5,
                      color: active ? 'primary.contrastText' : 'text.secondary',
                      backgroundColor: active ? 'primary.main' : 'transparent',
                      '& .MuiListItemIcon-root': {
                        color: active ? 'primary.contrastText' : 'text.secondary'
                      },
                      '&:hover': {
                        backgroundColor: active ? 'primary.dark' : 'primary.light',
                        color: 'primary.contrastText',
                        '& .MuiListItemIcon-root': {
                          color: 'primary.contrastText'
                        }
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Icon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontWeight: active ? 600 : 500 }}
                    />
                  </ListItemButton>
                );
              })}
            </Box>
          ))}
        </List>
      </Box>
      <Divider />
      <Box sx={{ px: 3, py: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {user?.username ?? user?.email ?? 'Usuário'}
            </Typography>
            {user?.role && (
              <Typography variant="caption" color="text.secondary" textTransform="capitalize">
                {user.role}
              </Typography>
            )}
          </Box>
        </Stack>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          ml: { lg: `${drawerWidth}px` }
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          {!isDesktop && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              aria-label="abrir navegação"
            >
              <MenuRoundedIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>
              {user?.secretaria?.nome ?? 'Secretaria Municipal'}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              Gestão educacional e resultados das avaliações
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
              {initials}
            </Avatar>
            <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
              <Typography variant="subtitle2">
                {user?.username ?? user?.email ?? 'Usuário'}
              </Typography>
              {user?.role && (
                <Typography variant="caption" color="text.secondary" textTransform="capitalize">
                  {user.role}
                </Typography>
              )}
            </Box>
            <IconButton
              onClick={logout}
              color="primary"
              sx={{
                display: { xs: 'inline-flex', sm: 'none' },
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <LogoutRoundedIcon />
            </IconButton>
            <Button
              variant="outlined"
              color="primary"
              onClick={logout}
              startIcon={<LogoutRoundedIcon />}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Sair
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }}>
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop ? true : mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box'
            }
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: '100%',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          px: { xs: 2.5, md: 4 },
          pb: { xs: 6, md: 8 }
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 72, sm: 80 } }} />
        <Container
          maxWidth="xl"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 3, md: 4 }
          }}
        >
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
