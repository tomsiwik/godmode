import type { ReactNode } from 'react';

export interface DocumentationTemplateProps {
  title: ReactNode;
  /** Section label (e.g. "Getting Started", "CLI"). */
  section?: ReactNode;
  /** Short description, rendered under the title. */
  description?: ReactNode;
  /** Absolute URL to the godmode wordmark/logo. */
  logoUrl?: string;
  backgroundImage?: string;
}

export default function DocumentationTemplate({
  title,
  section,
  description,
  logoUrl,
  backgroundImage,
}: DocumentationTemplateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0a0a',
        color: 'white',
        backgroundImage: backgroundImage || 'linear-gradient(135deg, #1a1a1a 0%, #000 100%)',
        padding: '64px',
        justifyContent: 'space-between',
      }}
    >
      {section ? (
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: '#ff0056',
              color: 'white',
              padding: '8px 24px',
              borderRadius: '9999px',
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            {section}
          </div>
        </div>
      ) : (
        <div />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h1
          style={{
            fontSize: 80,
            fontWeight: 800,
            lineHeight: 1.1,
            margin: 0,
            textShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          {title}
        </h1>
        {description ? (
          <p
            style={{
              fontSize: 32,
              lineHeight: 1.35,
              margin: 0,
              color: '#a1a1aa',
            }}
          >
            {description}
          </p>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="godmode"
            style={{ height: 56, width: 'auto' }}
          />
        ) : (
          <span
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            godmode
          </span>
        )}
      </div>
    </div>
  );
}
