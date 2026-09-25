import { createFileRoute } from '@tanstack/react-router';
import { ElectricLogo } from '@godmode-cli/ui';
import { useState } from 'react';
import { LandingHeader } from '@/components/layout/landing-header';
import { InstallCommand } from '@/components/install-command';
import { SITE_URL } from '@/lib/site';

const TITLE = 'Godmode — the swiss army knife for coding agents';
const DESCRIPTION = 'One predictable CLI for every API, MCP server, and local command you install.';
const OG_IMAGE = `${SITE_URL}/og/landing.webp`;
const LOGO_CONTROLS = [
  { key: 'scale', label: 'Scale', min: 0.1, max: 0.8, step: 0.01 },
  { key: 'intensity', label: 'Intensity', min: 0.1, max: 3, step: 0.1 },
  { key: 'glow', label: 'Glow', min: 0, max: 3, step: 0.1 },
  { key: 'thickness', label: 'Thickness', min: 0.5, max: 4, step: 0.1 },
  { key: 'strands', label: 'Strands', min: 1, max: 6, step: 1 },
  { key: 'bend', label: 'Bend', min: 0, max: 2, step: 0.1 },
  { key: 'crackle', label: 'Crackle', min: 0, max: 3, step: 0.1 },
  { key: 'flicker', label: 'Flicker', min: 0, max: 1, step: 0.05 },
  { key: 'fill', label: 'Fill', min: 0, max: 1, step: 0.05 },
  { key: 'speed', label: 'Speed', min: 0.1, max: 4, step: 0.1 },
  { key: 'arcs', label: 'Strike frequency', min: 0, max: 3, step: 0.1 },
  { key: 'arcCount', label: 'Strike count', min: 0, max: 5, step: 1 },
  { key: 'arcReach', label: 'Strike reach', min: 0.1, max: 2, step: 0.05 },
  { key: 'arcDuration', label: 'Strike duration', min: 0.1, max: 3, step: 0.1 },
  { key: 'arcBend', label: 'Strike bend', min: 0, max: 2, step: 0.1 },
  {
    key: 'arcIntensity',
    label: 'Strike brightness',
    min: 0,
    max: 3,
    step: 0.1,
  },
  { key: 'arcThickness', label: 'Strike width', min: 0.1, max: 3, step: 0.1 },
] as const;

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    logoControls:
      search.logoControls === '1' ||
      search.logoControls === 1 ||
      search.logoControls === true
        ? true
        : undefined,
  }),
  component: Home,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:secure_url', content: OG_IMAGE },
      { property: 'og:image:type', content: 'image/webp' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: TITLE },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
      { name: 'twitter:image', content: OG_IMAGE },
      { name: 'twitter:image:alt', content: TITLE },
    ],
  }),
});

function Home() {
  const { logoControls } = Route.useSearch();
  const [logoSettings, setLogoSettings] = useState({
    scale: 0.56,
    intensity: 2.5,
    glow: 0.2,
    thickness: 0.9,
    strands: 3,
    bend: 0.1,
    crackle: 3,
    arcs: 0.9,
    arcCount: 5,
    arcReach: 0.75,
    arcDuration: 0.7,
    arcBend: 0.3,
    arcIntensity: 2.2,
    arcThickness: 0.4,
    flicker: 0.55,
    fill: 0,
    speed: 1.5,
  });

  return (
    <div className="flex flex-col min-h-screen bg-fd-background text-fd-foreground">
      <LandingHeader />
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-24 text-center">
        <div
          className="pointer-events-none fixed inset-0"
          role="img"
          aria-label="godmode"
        >
          <ElectricLogo
            src="/godmode-pixels.svg"
            color="#ede9fe"
            glowColor="#a78bfa"
            {...logoSettings}
            interactive={false}
          />
        </div>
        <div className="relative z-10 flex w-full translate-y-28 flex-col items-center gap-6">
          <p className="max-w-xl text-balance text-lg text-fd-muted-foreground">
            The swiss army knife for coding agents, with extensions.
          </p>
          <InstallCommand className="max-w-lg" />
        </div>
        {logoControls && (
          <aside className="fixed right-4 bottom-4 z-50 max-h-[calc(100vh-2rem)] w-64 overflow-y-auto rounded-lg border border-fd-border bg-fd-background/95 p-4 text-left shadow-xl backdrop-blur">
            <p className="mb-3 text-sm font-medium">Temporary logo controls</p>
            <div className="space-y-3">
              {LOGO_CONTROLS.map(({ key, label, min, max, step }) => (
                <label
                  key={key}
                  className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs"
                >
                  <span className="text-fd-muted-foreground">{label}</span>
                  <output className="font-mono tabular-nums">
                    {logoSettings[key]}
                  </output>
                  <input
                    className="col-span-2 w-full accent-fd-primary"
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={logoSettings[key]}
                    onChange={(event) =>
                      setLogoSettings((current) => ({
                        ...current,
                        [key]: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
