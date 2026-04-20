import { createFileRoute } from '@tanstack/react-router';
import ImageResponse from 'takumi-js/response';
import { LandingTemplate } from '@godmode-cli/ui';

const TAGLINE = 'The swiss army knife for coding agents,\nwith extensions.';

export const Route = createFileRoute('/og/landing.webp')({
  server: {
    handlers: {
      GET({ request }) {
        const origin = new URL(request.url).origin;
        return new ImageResponse(
          <LandingTemplate
            tagline={TAGLINE}
            logoUrl={`${origin}/godmode-pixels.svg`}
          />,
          { width: 1200, height: 630, format: 'webp' },
        );
      },
    },
  },
});
