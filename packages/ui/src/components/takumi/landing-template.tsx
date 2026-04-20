import type { ReactNode } from 'react';

export interface LandingTemplateProps {
  /** Line rendered beneath the logo. */
  tagline: ReactNode;
  /** Absolute URL to the godmode wordmark/logo. */
  logoUrl?: string;
  backgroundImage?: string;
}

export default function LandingTemplate({
  tagline,
  logoUrl,
  backgroundImage,
}: LandingTemplateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0a0a',
        color: 'white',
        backgroundImage: backgroundImage || 'linear-gradient(135deg, #1a1a1a 0%, #000 100%)',
        padding: '64px',
        gap: '48px',
      }}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="godmode"
          style={{ height: 120, width: 'auto' }}
        />
      ) : (
        <span
          style={{
            fontSize: 100,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          godmode
        </span>
      )}
      <p
        style={{
          fontSize: 40,
          lineHeight: 1.35,
          margin: 0,
          color: '#a1a1aa',
          textAlign: 'center',
          maxWidth: 900,
          whiteSpace: 'pre-line',
        }}
      >
        {tagline}
      </p>
    </div>
  );
}
