import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

/** Design 1c stats row tile: icon, count, label — links to its tab. */
export function StatCard({
  icon,
  value,
  label,
  href,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  href: Href;
}) {
  return (
    <Link href={href} asChild>
      <Pressable className="flex-1 flex-col items-center gap-2 rounded-[15px] border border-hairline bg-card px-1.5 py-3.5 active:bg-paper">
        {icon}
        <Text className="font-sansbold text-[20px] leading-none text-ink">{value}</Text>
        <Text className="font-sans text-[11px] text-soft">{label}</Text>
      </Pressable>
    </Link>
  );
}
