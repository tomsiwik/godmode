import type { BaseLayoutProps } from '@/components/layout/shared';
import { Github } from 'lucide-react';

export const gitConfig = {
  user: 'tomsiwik',
  repo: 'godmode',
  branch: 'main',
};

const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <img src="/godmode-nav.svg" alt="godmode" className="h-7 dark:invert" />
      ),
      url: '/',
    },
    links: [
      {
        type: 'icon',
        url: githubUrl,
        text: 'GitHub',
        label: 'GitHub',
        icon: <Github />,
        external: true,
      },
    ],
  };
}
