import type { ReactElement, SVGProps } from 'react';

export type IconName =
  | 'home'
  | 'back'
  | 'next'
  | 'replay'
  | 'speaker'
  | 'grid'
  | 'screen'
  | 'settings'
  | 'check'
  | 'close'
  | 'book'
  | 'bulb'
  | 'paste'
  | 'trash'
  | 'stop'
  | 'turtle'
  | 'ear'
  | 'mic'
  | 'image'
  | 'star'
  | 'info'
  | 'chevronRight'
  | 'clock'
  | 'shield'
  | 'coin'
  | 'bus'
  | 'chat'
  | 'building'
  | 'bag'
  | 'cross'
  | 'user'
  | 'question'
  | 'play'
  | 'sparkle'
  | 'textLines'
  | 'mapPin'
  | 'heart'
  | 'scene-health'
  | 'scene-money'
  | 'scene-travel'
  | 'scene-home'
  | 'scene-contact'
  | 'scene-gov'
  | 'scene-shopping'
  | 'scene-safety';

const paths: Record<IconName, ReactElement> = {
  home: (
    <>
      <path d="M3.5 11.5 12 4l8.5 7.5" />
      <path d="M5.5 10v9.5h13V10" />
      <path d="M9.5 19.5v-5h5v5" />
    </>
  ),
  back: (
    <>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </>
  ),
  next: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  replay: (
    <>
      <path d="M4.5 9.5A8 8 0 1 1 4 14" />
      <path d="M4 4v6h6" />
    </>
  ),
  speaker: (
    <>
      <path d="M4 9.5h3.5L13 5.5v13L7.5 14.5H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  screen: (
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="m10 8.5 4.5 2.5-4.5 2.5z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10 4.8 7 4.5 4 5v14c3-.5 6-.2 8 1.5 2-1.7 5-2 8-1.5V5c-3-.5-6-.2-8 1.5z" />
      <path d="M12 6.5v14" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M8.5 14.5a6 6 0 1 1 7 0c-.8.6-1 1.4-1 2h-5c0-.6-.2-1.4-1-2z" />
    </>
  ),
  paste: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5V3h6v1.5" />
      <path d="M8.5 9.5h7M8.5 13.5h7M8.5 17h4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6.5 7l1 13h9l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
  turtle: (
    <>
      <ellipse cx="11" cy="13" rx="6.5" ry="5" />
      <path d="M17.5 12.5h2.8l1.2 2" />
      <path d="M8 18v2M14 18v2M5 13H2.5" />
      <path d="M8 9c1-2.2 5-2.2 6 0" />
    </>
  ),
  ear: (
    <>
      <path d="M6 9a6 6 0 1 1 10 5.5c-1.5 1.2-1.5 2.5-1.5 3.5a3.5 3.5 0 0 1-7 0" />
      <path d="M10 10a2.2 2.2 0 1 1 3.5 1.8" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21M8.5 21h7" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 5-5 4 4 2.5-2.5L20 18" />
    </>
  ),
  star: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  chevronRight: <path d="m9 5 7 7-7 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v6c0 4.5 3.2 7.5 7.5 9 4.3-1.5 7.5-4.5 7.5-9V6z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 9.5h6M9 13h6M12 7v10" />
    </>
  ),
  bus: (
    <>
      <rect x="4" y="4" width="16" height="13" rx="2.5" />
      <path d="M4 10.5h16" />
      <path d="M8 4v6.5M16 4v6.5" />
      <circle cx="8" cy="19" r="1.7" />
      <circle cx="16" cy="19" r="1.7" />
      <path d="M8 17v2M16 17v2" />
    </>
  ),
  chat: (
    <>
      <path d="M20.5 11.5c0 3.6-3.8 6.5-8.5 6.5-1 0-2-.1-2.9-.4L4 20l1-3.6c-1.5-1.2-2.5-2.9-2.5-4.9C2.5 7.9 6.3 5 11 5s9.5 2.9 9.5 6.5z" />
      <path d="M8 11.5h.1M11 11.5h.1M14 11.5h.1" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V6l8-3 8 3v15" />
      <path d="M2.5 21h19" />
      <path d="M9 21v-4h6v4" />
      <path d="M8 8h.1M12 8h.1M16 8h.1M8 12h.1M12 12h.1M16 12h.1" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1.2 13H6.2z" />
      <path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" />
    </>
  ),
  cross: (
    <>
      <path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9a2.8 2.8 0 1 1 4 2.5c-.8.4-1.3 1-1.3 2" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  play: <path d="M8 5.5v13l10-6.5z" />,
  sparkle: (
    <>
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
    </>
  ),
  textLines: (
    <>
      <path d="M4 6h16M4 11h16M4 16h10M4 21h7" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  heart: <path d="M12 20.5S3.5 15 3.5 9.3A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.5 3.3C20.5 15 12 20.5 12 20.5z" />,
  'scene-health': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v9M7.5 12h9" />
    </>
  ),
  'scene-money': (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 9v6" />
    </>
  ),
  'scene-travel': (
    <>
      <rect x="5" y="3.5" width="14" height="14" rx="2.5" />
      <path d="M5 11h14" />
      <circle cx="8.5" cy="20" r="1.5" />
      <circle cx="15.5" cy="20" r="1.5" />
    </>
  ),
  'scene-home': (
    <>
      <path d="m3.5 11 8.5-7.5L20.5 11" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  'scene-contact': (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="3" />
      <path d="M8 8h8M8 12h5" />
      <path d="M8 16h3" />
    </>
  ),
  'scene-gov': (
    <>
      <path d="M3 9 12 4l9 5" />
      <path d="M5 9v9M9.5 9v9M14.5 9v9M19 9v9" />
      <path d="M3 21h18" />
    </>
  ),
  'scene-shopping': (
    <>
      <path d="M4 8h16l-1.5 13h-13z" />
      <path d="M8.5 8a3.5 3.5 0 0 1 7 0" />
    </>
  ),
  'scene-safety': (
    <>
      <path d="M12 3 4.5 6v6c0 4.5 3.2 7.5 7.5 9 4.3-1.5 7.5-4.5 7.5-9V6z" />
      <path d="M12 8v4" />
      <circle cx="12" cy="15.5" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 28, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
