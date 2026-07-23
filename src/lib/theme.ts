/**
 * Non-Tailwind consumers (navigation options, ActivityIndicator, SVG props)
 * read tokens from here. Single source: design/Clothing-App.dc.html.
 */
export const colors = {
  paper: '#f4f1ec',
  card: '#faf8f4',
  bright: '#fbf9f5',
  imagebg: '#efece5',
  sand: '#e6dfd0',
  seg: '#d8d4cb',
  circle: '#ece8e0',
  rosetint: '#f9f1ee',
  olivetint: '#f2efe8',
  roseink: '#8a4a42',
  oliveink: '#565633',
  roseline: '#dfcdcd',
  oliveline: '#e9e6df',
  ink: '#1c1b19',
  dark: '#26241f',
  label: '#4a463f',
  body: '#57534b',
  soft: '#6f6b64',
  muted: '#8f8a80',
  faint: '#a8a298',
  inactive: '#a09a90',
  iconmuted: '#b0aa9e',
  accent: '#8a5a3c',
  sale: '#97403a',
  borderHairline: 'rgba(28,27,25,0.07)',
  border: 'rgba(28,27,25,0.10)',
  borderField: 'rgba(28,27,25,0.14)',
  borderStrong: 'rgba(28,27,25,0.16)',
} as const;

export const fonts = {
  serif: 'PlayfairDisplay_600SemiBold',
  serifMedium: 'PlayfairDisplay_500Medium',
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansBold: 'InstrumentSans_600SemiBold',
} as const;
