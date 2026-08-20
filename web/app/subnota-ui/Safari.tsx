'use client';

import type { ReactNode, SVGProps } from 'react';
import { SubnotaMark } from './icons';

const BASE_WIDTH = 1203;
const BASE_HEIGHT = 753;

export function Safari({
  children,
  url = 'subnota.com',
  width = 1500,
  height = 940,
  ...props
}: SVGProps<SVGSVGElement> & {
  children?: ReactNode;
  url?: string;
}) {
  return (
    <svg
      aria-label="Safari browser"
      fill="none"
      height={height}
      role="img"
      viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
      width={width}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <clipPath id="safari-shell-clip">
          <rect fill="white" height={BASE_HEIGHT} width={BASE_WIDTH} />
        </clipPath>
        <clipPath id="safari-content-clip">
          <path
            d="M1 52H1202V741C1202 747.075 1196.92 753 1191 753H12C5.92486 753 1 747.075 1 741V52Z"
            fill="white"
          />
        </clipPath>
      </defs>

      <g clipPath="url(#safari-shell-clip)">
        <path d="M0 52H1202V741C1202 747.627 1196.63 753 1190 753H12C5.37258 753 0 747.627 0 741V52Z" fill="#fffdf9" />
        <path d="M0 12C0 5.37258 5.37258 0 12 0H1190C1196.63 0 1202 5.37258 1202 12V52H0V12Z" fill="#f1eee8" />
        <path d="M1.06738 12C1.06738 5.92487 5.99225 1 12.0674 1H1189.93C1196.01 1 1200.93 5.92487 1200.93 12V51H1.06738V12Z" fill="#faf8f4" />

        <circle cx="27" cy="25" fill="#ee6a5f" r="6" />
        <circle cx="47" cy="25" fill="#f4bf4f" r="6" />
        <circle cx="67" cy="25" fill="#61c554" r="6" />
        <path
          d="M99.57 33.6h13.37c1.7 0 2.58-.87 2.58-2.55V21.55c0-1.68-.88-2.55-2.58-2.55H99.57c-1.69 0-2.57.87-2.57 2.55v9.5c0 1.68.88 2.55 2.57 2.55Zm.1-1.55c-.72 0-1.12-.38-1.12-1.14v-9.23c0-.76.4-1.13 1.12-1.13h3.56v11.5h-3.56Zm13.17-11.5c.72 0 1.12.37 1.12 1.13v9.23c0 .76-.4 1.14-1.12 1.14h-8.12v-11.5h8.12Z"
          fill="#817466"
        />
        <path
          d="M143.91 32.59c.18.17.4.27.65.27.52 0 .93-.41.93-.93 0-.26-.1-.49-.28-.67l-5.47-5.34 5.47-5.33c.18-.18.28-.42.28-.67 0-.52-.41-.93-.93-.93-.25 0-.47.09-.64.27l-6.08 5.94c-.22.2-.33.45-.33.73 0 .27.11.51.32.72l6.08 5.94Z"
          fill="#817466"
        />
        <path
          d="M168.42 32.86c.26 0 .47-.09.65-.27l6.08-5.94c.22-.22.32-.45.32-.73 0-.27-.1-.52-.32-.71l-6.08-5.95a.9.9 0 0 0-.65-.26c-.52 0-.93.4-.93.92 0 .26.11.5.28.67l5.48 5.35-5.48 5.32c-.18.19-.28.42-.28.68 0 .52.41.92.93.92Z"
          fill="#817466"
        />
        <path d="M286 17C286 13.6863 288.686 11 292 11H946C949.314 11 952 13.6863 952 17V35C952 38.3137 949.314 41 946 41H292C288.686 41 286 38.3137 286 35V17Z" fill="#e8e4dc" />
        <text fill="#817466" fontFamily="Arial, sans-serif" fontSize="12" x="580" y="30">
          {url}
        </text>
        <path
          d="M265.5 33.9c.14 0 .35-.05.55-.16 4.5-2.45 6.05-3.57 6.05-6.42v-5.9c0-.94-.37-1.27-1.15-1.61-.87-.37-3.78-1.38-4.63-1.67a2.5 2.5 0 0 0-1.66 0c-.85.24-3.77 1.31-4.63 1.67-.78.33-1.15.67-1.15 1.61v5.9c0 2.85 1.57 3.96 6.05 6.42.2.11.41.16.57.16Zm.42-14.32c1.02.4 3.25 1.19 4.42 1.61.22.08.27.2.27.48v5.36c0 2.29-1.15 2.91-4.67 5.04-.22.12-.33.17-.44.17V19.48c.11 0 .23.03.42.1Z"
          fill="#817466"
        />
        <foreignObject height="30" width="34" x="1117" y="10">
          <div className="safari-menu-mark">
            <SubnotaMark size={16} />
          </div>
        </foreignObject>

        <rect clipPath="url(#safari-content-clip)" fill="#fffdf9" height={BASE_HEIGHT - 52} width={BASE_WIDTH - 2} x="1" y="52" />
        <foreignObject clipPath="url(#safari-content-clip)" height={BASE_HEIGHT - 52} width={BASE_WIDTH - 2} x="1" y="52">
          <div className="safari-mockup-content">
            {children}
          </div>
        </foreignObject>
      </g>
    </svg>
  );
}
