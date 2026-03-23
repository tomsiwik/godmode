import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { Header, Footer } from '@godmode-cli/ui';
import appCss from '@/styles/app.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Godmode — better than mcp' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: () => (
    <html>
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        <Header />
        <main role="main" className="bg-zinc-950/10">
          <Outlet />
        </main>
        <Footer />
        <Scripts />
      </body>
    </html>
  ),
});
