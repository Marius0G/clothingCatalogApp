/**
 * Icon set copied 1:1 from the design system (design/Clothing-App.dc.html).
 * Thin-stroke editorial line icons; tab icons switch to filled when active.
 */
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/lib/theme';

export type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
};

const defaults = { size: 23, color: colors.ink, strokeWidth: 1.7 };

export function HomeIcon({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={filled ? 'none' : color} strokeWidth={strokeWidth}>
      <Path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </Svg>
  );
}

export function HeartIcon({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={filled ? 'none' : color} strokeWidth={strokeWidth}>
      <Path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />
    </Svg>
  );
}

export function HangerIcon({ size = defaults.size, color = defaults.color, strokeWidth = 1.6, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={filled ? 1.9 : strokeWidth}>
      <Circle cx="12" cy="5" r="1.6" />
      <Path d="M12 6.6v1.9l8.2 5.1a1.3 1.3 0 0 1-.7 2.4H4.5a1.3 1.3 0 0 1-.7-2.4L12 8.5" />
    </Svg>
  );
}

export function SettingsIcon({ size = defaults.size, color = defaults.color, strokeWidth = 1.6, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={filled ? 1.9 : strokeWidth}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </Svg>
  );
}

export function PlusIcon({ size = 26, color = defaults.color, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function BellIcon({ size = 24, color = defaults.color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </Svg>
  );
}

export function BookmarkIcon({ size = 17, color = defaults.color, strokeWidth = 1.6, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={filled ? 'none' : color} strokeWidth={strokeWidth}>
      <Path d="M6 3h12v18l-6-4-6 4z" />
    </Svg>
  );
}

export function LocationIcon({ size = 22, color = defaults.color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M12 21s-6.5-5.6-6.5-10.4a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" />
      <Circle cx="12" cy="10.4" r="2.3" />
    </Svg>
  );
}

export function SearchIcon({ size = 22, color = defaults.color, strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Circle cx="11" cy="11" r="7" />
      <Path d="M20 20l-3.5-3.5" />
    </Svg>
  );
}

export function LinkIcon({ size = 18, color = colors.muted, strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </Svg>
  );
}

export function CameraIcon({ size = 18, color = defaults.color, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="3.5" />
    </Svg>
  );
}

export function CheckIcon({ size = 12, color = '#fff', strokeWidth = 3 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 15, color = defaults.color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function ChevronLeftIcon({ size = 22, color = defaults.color, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M15 6l-6 6 6 6" />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 14, color = colors.muted, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

export function CloseIcon({ size = 22, color = defaults.color, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  );
}

export function SparkleIcon({ size = 16, color = defaults.color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <Path d="M18.5 14l.7 2.1L21 16.8l-1.8.7-.7 2.1-.7-2.1-1.8-.7 1.8-.7z" />
    </Svg>
  );
}

export function ThumbsUpIcon({ size = 18, color = defaults.color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM7 11l4-8a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17 20H7" />
    </Svg>
  );
}

export function ThumbsDownIcon({ size = 18, color = colors.muted, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1zM17 13l-4 8a2 2 0 0 1-2-2v-3H6a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 7 4h10" />
    </Svg>
  );
}

export function RegenerateIcon({ size = 14, color = defaults.color, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" />
    </Svg>
  );
}

export function InfoIcon({ size = 14, color = colors.muted, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 8v5M12 16v.5" />
    </Svg>
  );
}

export function EyeIcon({ size = 20, color = colors.muted, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function TrashIcon({ size = 18, color = colors.muted, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </Svg>
  );
}

export function AppleIcon({ size = 18, color = defaults.color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M16 13.5c0 2.5 2 3.3 2 3.4-.02.05-.32 1.1-1.05 2.17-.63.92-1.29 1.83-2.33 1.85-1.02.02-1.35-.6-2.52-.6-1.17 0-1.53.58-2.5.62-1 .04-1.76-.99-2.4-1.91C4 18.9 3 15.3 4.36 12.86c.67-1.2 1.87-1.96 3.17-1.98 1-.02 1.94.67 2.55.67.61 0 1.76-.83 2.97-.71.5.02 1.93.2 2.84 1.53-.07.05-1.7 1-1.68 3.1M13.8 8.2c.54-.66.9-1.57.8-2.48-.78.03-1.72.52-2.28 1.18-.5.58-.94 1.5-.82 2.4.87.06 1.76-.44 2.3-1.1" />
    </Svg>
  );
}

export function GoogleIcon({ size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2c-.3 1.4-1.1 2.6-2.3 3.4v2.8h3.7C21.7 18.7 23 15.8 23 12.3z" />
      <Path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.8c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v2.9C3.7 21.3 7.6 24 12 24z" />
      <Path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V7.5H1.8C1 9 .5 10.7.5 12.6s.5 3.6 1.3 5.1l3.8-2.9z" />
      <Path fill="#EA4335" d="M12 5.4c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.9 15.1.9 12 .9 7.6.9 3.7 3.6 1.8 7.5l3.8 2.9C6.5 7.4 9 5.4 12 5.4z" />
    </Svg>
  );
}

export function MailIcon({ size = 18, color = colors.bright, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M4.5 5h15A2.5 2.5 0 0 1 22 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 16.5v-9A2.5 2.5 0 0 1 4.5 5z" />
      <Path d="M3 6.5l9 6 9-6" />
    </Svg>
  );
}

export function PersonIcon({ size = defaults.size, color = defaults.color, strokeWidth = 1.6, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={filled ? 'none' : color} strokeWidth={strokeWidth}>
      <Circle cx="12" cy="7.5" r="3.8" />
      <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0z" />
    </Svg>
  );
}

export function FolderIcon({ size = 18, color = defaults.color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M3 7.5V6a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Svg>
  );
}

export function SlidersIcon({ size = 18, color = defaults.color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M4 8h9M17.5 8H20M4 16h3.5M12 16h8" />
      <Circle cx="15.2" cy="8" r="2.2" />
      <Circle cx="9.8" cy="16" r="2.2" />
    </Svg>
  );
}

export function ChatBubbleIcon({ size = 18, color = defaults.color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M21 11.5a8 8 0 0 1-8.5 8 8.6 8.6 0 0 1-3.5-.7L3 20l1.2-5.4A8 8 0 1 1 21 11.5z" />
      <Path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth={2.2} />
    </Svg>
  );
}

export function BookIcon({ size = 18, color = defaults.color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M12 6.5C10.5 4.9 8.4 4 5.5 4H3v15h2.8c2.7 0 4.8.8 6.2 2.3 1.4-1.5 3.5-2.3 6.2-2.3H21V4h-2.5c-2.9 0-5 .9-6.5 2.5z" />
      <Path d="M12 6.5v14.5" />
    </Svg>
  );
}

export function LockIcon({ size = 18, color = defaults.color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M6 10.5h12a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 18 20.5H6A1.5 1.5 0 0 1 4.5 19v-7A1.5 1.5 0 0 1 6 10.5z" />
      <Path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7M12 14.5v2" />
    </Svg>
  );
}

export function CrownIcon({ size = 18, color = defaults.color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M4 18h16M4 18L2.8 8.2l4.7 3.3L12 5l4.5 6.5 4.7-3.3L20 18" />
    </Svg>
  );
}

export function GlobeIcon({ size = 18, color = defaults.color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" />
    </Svg>
  );
}

export function DownloadIcon({ size = 18, color = defaults.color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5" />
      <Path d="M4.5 17.5v1A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-1" />
    </Svg>
  );
}

export function DocIcon({ size = 18, color = defaults.color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <Path d="M14 3v5h5M9 12.5h6M9 16h6" />
    </Svg>
  );
}
