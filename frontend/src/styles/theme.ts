import { createTheme } from '@mui/material/styles';

const primary = {
  light: '#60a5fa',
  main: '#2563eb',
  dark: '#1e3a8a',
  contrastText: '#ffffff'
};

const secondary = {
  light: '#fb9a5c',
  main: '#f97316',
  dark: '#c2410c',
  contrastText: '#ffffff'
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary,
    secondary,
    background: {
      default: '#f5f7fb',
      paper: '#ffffff'
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569'
    },
    divider: 'rgba(15, 23, 42, 0.08)'
  },
  shape: {
    borderRadius: 16
  },
  typography: {
    fontFamily: `'Rubik', 'Roboto', 'Helvetica', 'Arial', sans-serif`,
    h1: { fontWeight: 600, fontSize: '2.5rem' },
    h2: { fontWeight: 600, fontSize: '2rem' },
    h3: { fontWeight: 600, fontSize: '1.75rem' },
    h4: { fontWeight: 600, fontSize: '1.5rem' },
    h5: { fontWeight: 600, fontSize: '1.25rem' },
    h6: { fontWeight: 600, fontSize: '1.125rem' },
    subtitle1: { fontWeight: 500 },
    button: { fontWeight: 600, textTransform: 'none' }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 45%, #f5f7fb 100%)',
          minHeight: '100vh',
          color: '#0f172a'
        },
        '*, *::before, *::after': {
          boxSizing: 'border-box'
        },
        a: {
          color: primary.main,
          textDecoration: 'none'
        },
        'a:hover': {
          textDecoration: 'underline'
        },
        '::-webkit-scrollbar': {
          width: 8,
          height: 8
        },
        '::-webkit-scrollbar-thumb': {
          backgroundColor: '#cbd5f5',
          borderRadius: 8
        }
      }
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0
      },
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#0f172a',
          borderBottom: '1px solid rgba(15, 23, 42, 0.08)'
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff',
          borderRight: '1px solid rgba(15, 23, 42, 0.05)'
        }
      }
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0
      },
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)'
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingLeft: 20,
          paddingRight: 20
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14
        },
        notchedOutline: {
          borderColor: 'rgba(15, 23, 42, 0.12)'
        }
      }
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            fontWeight: 600,
            backgroundColor: '#eef2ff'
          }
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: 'rgba(15, 23, 42, 0.06)'
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600
        }
      }
    }
  }
});
