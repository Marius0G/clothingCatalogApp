import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

/**
 * Horizontal card row for the home sections. Bleeds to the screen edges
 * (parent scroll view applies px-6) while keeping content aligned to the grid.
 */
export function CarouselRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-6 mt-3.5"
      contentContainerClassName="gap-3 px-6"
    >
      {children}
    </ScrollView>
  );
}
