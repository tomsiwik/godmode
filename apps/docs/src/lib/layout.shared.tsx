import type { BaseLayoutProps } from '@/components/layout/shared';

export const gitConfig = {
  user: 'tomsiwik',
  repo: 'godmode',
  branch: 'main',
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'Godmode',
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
