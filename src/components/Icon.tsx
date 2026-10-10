import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

type Shape =
  | { d: string }
  | { circle: [cx: number, cy: number, r: number] }
  | { rect: [x: number, y: number, w: number, h: number, rx: number] };

/** Stroke icons, copied path-for-path from the design (24×24 viewBox). */
const icons = {
  back: [{ d: 'M15 18l-6-6 6-6' }],
  chevronDown: [{ d: 'M6 9l6 6 6-6' }],
  chevronRight: [{ d: 'M9 6l6 6-6 6' }],
  close: [{ d: 'M18 6L6 18M6 6l12 12' }],
  eye: [{ d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z' }, { circle: [12, 12, 3] }],
  warning: [
    { d: 'M12 9v4M12 17h.01' },
    { d: 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z' },
  ],
  info: [{ circle: [12, 12, 9] }, { d: 'M12 8h.01M11 12h1v4h1' }],
  faceId: [
    {
      d: 'M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2M9 10v1M15 10v1M12 10v4h-1M9.5 16a4 4 0 005 0',
    },
  ],
  scan: [
    {
      d: 'M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10',
    },
  ],
  plus: [{ d: 'M12 5v14M5 12h14' }],
  swap: [{ d: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7' }],
  send: [{ d: 'M7 17L17 7M8 7h9v9' }],
  receive: [{ d: 'M17 7L7 17M16 17H7V8' }],
  check: [{ d: 'M20 6L9 17l-5-5' }],
  wallet: [{ rect: [3, 6, 18, 14, 2] }, { d: 'M16 13h2M3 10h18' }],
  explore: [{ circle: [12, 12, 9] }, { d: 'M15.5 8.5l-2 5-5 2 2-5z' }],
  activity: [{ d: 'M3 12h4l3-8 4 16 3-8h4' }],
  sliders: [
    { d: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12' },
    { circle: [16, 6, 2] },
    { circle: [10, 12, 2] },
    { circle: [18, 18, 2] },
  ],
  star: [{ d: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z' }],
  copy: [{ rect: [9, 9, 12, 12, 1] }, { d: 'M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1' }],
  share: [{ d: 'M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13' }],
  flip: [{ d: 'M8 3v18M4 7l4-4 4 4M16 21V3M12 17l4 4 4-4' }],
  hardwareWallet: [{ rect: [7, 2, 10, 20, 2] }, { d: 'M11 18h2' }],
  link: [
    {
      d: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
    },
  ],
  lock: [{ rect: [4, 11, 16, 10, 2] }, { d: 'M8 11V7a4 4 0 018 0v4' }],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof icons;

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 24, color = colors.ink, strokeWidth = 2 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {(icons[name] as Shape[]).map((shape, i) => {
        if ('d' in shape) return <Path key={i} d={shape.d} />;
        if ('circle' in shape) {
          const [cx, cy, r] = shape.circle;
          return <Circle key={i} cx={cx} cy={cy} r={r} />;
        }
        const [x, y, width, height, rx] = shape.rect;
        return <Rect key={i} x={x} y={y} width={width} height={height} rx={rx} />;
      })}
    </Svg>
  );
}
