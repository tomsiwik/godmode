import { createFileRoute, notFound } from '@tanstack/react-router';
import ImageResponse from 'takumi-js/response';
import { DocumentationTemplate } from '@godmode-cli/ui';
import { source } from '@/lib/source';

// Section label pulled from the top-level slug (matches meta.json tabs).
const SECTIONS: Record<string, string> = {
  docs: 'Docs',
  extensions: 'Extensions',
  developers: 'Developers',
};

export const Route = createFileRoute('/og/$')({
  server: {
    handlers: {
      GET({ params, request }) {
        const raw = params._splat?.split('/') ?? [];
        const last = raw[raw.length - 1];
        if (!last || !last.startsWith('image.')) throw notFound();
        const slugs = raw.slice(0, -1);

        const page = source.getPage(slugs);
        if (!page) throw notFound();

        const origin = new URL(request.url).origin;
        const section = SECTIONS[slugs[0]] ?? '';

        return new ImageResponse(
          <DocumentationTemplate
            title={page.data.title}
            description={page.data.description}
            section={section}
            logoUrl={`${origin}/godmode-pixels.svg`}
          />,
          { width: 1200, height: 630, format: 'webp' },
        );
      },
    },
  },
});
