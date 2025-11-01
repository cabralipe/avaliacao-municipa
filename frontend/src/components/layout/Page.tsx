import { Paper, Stack, Typography, type PaperProps, type StackProps } from '@mui/material';
import type { ReactNode } from 'react';

export interface PageContainerProps extends StackProps {
  children: ReactNode;
}

export function PageContainer({ children, sx, ...rest }: PageContainerProps) {
  return (
    <Stack
      spacing={{ xs: 3, md: 4 }}
      sx={{ width: '100%', ...sx }}
      {...rest}
    >
      {children}
    </Stack>
  );
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      gap={{ xs: 2, md: 3 }}
    >
      <Stack spacing={0.5} flex={1} minWidth={0}>
        <Typography variant="h4" color="text.primary">
          {title}
        </Typography>
        {description && (
          <Typography variant="body1" color="text.secondary">
            {description}
          </Typography>
        )}
      </Stack>
      {actions && <Stack direction="row" gap={1}>{actions}</Stack>}
    </Stack>
  );
}

export interface PageSectionProps extends PaperProps {
  children: ReactNode;
}

export function PageSection({ children, sx, ...rest }: PageSectionProps) {
  return (
    <Paper
      sx={{
        p: { xs: 2.5, md: 4 },
        borderRadius: 2,
        backdropFilter: 'blur(8px)',
        ...sx
      }}
      {...rest}
    >
      {children}
    </Paper>
  );
}
