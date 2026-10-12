/**
 * The Nexus Live mark, inline so it scales crisply and can pick up the page's
 * own colours. The same geometry ships as public/logo.svg, which is what the
 * icon generator renders every PWA asset from — keep the two in step.
 *
 * The glyph is an N drawn as a node graph: three white nodes and, at the
 * top-right, the live indicator.
 */

type LogoProps = {
  /** Rendered size in pixels. */
  size?: number;
  /** Draw the violet squircle behind the glyph. */
  badge?: boolean;
  /** Animate the live node. */
  pulse?: boolean;
  className?: string;
};

// Fixed ids rather than generated ones: every instance defines the same two
// gradients with the same stops, so sharing them across instances is correct
// and keeps the server and client markup identical.
const BG_ID = 'nexusLogoBg';
const LIVE_ID = 'nexusLogoLive';

export function Logo({ size = 40, badge = true, pulse = false, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label="Nexus Live"
    >
      <defs>
        <linearGradient id={BG_ID} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9a76ff" />
          <stop offset=".48" stopColor="#6017f5" />
          <stop offset="1" stopColor="#330d8c" />
        </linearGradient>
        <linearGradient id={LIVE_ID} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff6b96" />
          <stop offset="1" stopColor="#ff1f64" />
        </linearGradient>
      </defs>

      {badge && (
        <>
          <rect width="512" height="512" rx="116" fill={`url(#${BG_ID})`} />
          <rect
            x="2.5"
            y="2.5"
            width="507"
            height="507"
            rx="113.5"
            fill="none"
            stroke="#fff"
            strokeOpacity=".16"
            strokeWidth="5"
          />
        </>
      )}

      <path
        d="M146 372V140l220 232V140"
        fill="none"
        stroke={badge ? '#fff' : 'currentColor'}
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill={badge ? '#fff' : 'currentColor'}>
        <circle cx="146" cy="140" r="34" />
        <circle cx="146" cy="372" r="34" />
        <circle cx="366" cy="372" r="34" />
      </g>
      <g fill={badge ? '#5a14e0' : '#07060f'}>
        <circle cx="146" cy="140" r="12" />
        <circle cx="146" cy="372" r="12" />
        <circle cx="366" cy="372" r="12" />
      </g>

      {pulse && (
        <circle cx="366" cy="140" r="38" fill="#ff2d6f" opacity=".55" className="animate-pulse-ring" style={{ transformOrigin: '366px 140px' }} />
      )}
      <circle cx="366" cy="140" r="38" fill={badge ? '#fff' : 'none'} />
      <circle cx="366" cy="140" r={badge ? 27 : 38} fill={`url(#${LIVE_ID})`} />
    </svg>
  );
}

type WordmarkProps = {
  size?: number;
  pulse?: boolean;
  className?: string;
};

/** Mark plus name, for headers and the auth screens. */
export function Wordmark({ size = 34, pulse = false, className }: WordmarkProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <Logo size={size} pulse={pulse} />
      <span
        className="font-extrabold tracking-tight text-white"
        style={{ fontSize: size * 0.62, letterSpacing: '-0.03em' }}
      >
        NEXUS<span className="text-live">LIVE</span>
      </span>
    </span>
  );
}
