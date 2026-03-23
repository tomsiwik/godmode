import { cn } from '../../lib/cn';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { type JSX, useLayoutEffect, useState } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import type { BundledLanguage } from 'shiki/bundle/web';

const highlightCache = new Map();

let shikiPromise: Promise<typeof import('shiki/bundle/web')> | null = null;

function getShiki() {
  if (!shikiPromise) {
    shikiPromise = import('shiki/bundle/web');
  }
  return shikiPromise;
}

export async function highlight(code: string, lang: BundledLanguage) {
  const cacheKey = `${lang}:${code.length}:${code.slice(0, 50)}:${code.slice(-50)}`;

  const cached = highlightCache.get(cacheKey);
  if (cached) return cached;

  const { codeToHast } = await getShiki();

  const hast = await codeToHast(code, {
    lang,
    themes: {
      light: 'ayu-light',
      dark: 'ayu-dark',
    },
    defaultColor: false,
  });

  const result = toJsxRuntime(hast, {
    Fragment,
    jsx,
    jsxs,
  }) as JSX.Element;

  if (highlightCache.size > 100) {
    const firstKey = highlightCache.keys().next().value;
    if (firstKey) highlightCache.delete(firstKey);
  }
  highlightCache.set(cacheKey, result);

  return result;
}

type Props = {
  code: string;
  lang: BundledLanguage;
  className?: string;
};

export default function CodeBlock({ code, lang, className }: Props) {
  const [content, setContent] = useState<JSX.Element | null>(null);

  useLayoutEffect(() => {
    let isMounted = true;

    if (code) {
      highlight(code, lang).then((result) => {
        if (isMounted) setContent(result);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [code, lang]);

  return content ? (
    <div
      className={cn(
        'overflow-auto no-scrollbar [&_code]:text-[13px]/5 [&_code]:font-mono [&_pre]:p-3 [&_pre]:leading-snug',
        className,
      )}
    >
      {content}
    </div>
  ) : (
    <pre className="p-3 text-[13px] text-fd-muted-foreground">Loading...</pre>
  );
}
