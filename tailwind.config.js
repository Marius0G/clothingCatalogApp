/**
 * Design tokens from the canonical design system (design/Clothing-App.dc.html,
 * claude.ai/design project "Aplicație Catalog Haine"). Do not restyle ad-hoc —
 * change the design file first, then mirror here.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // surfaces
        paper: '#f4f1ec', // app background
        card: '#faf8f4', // cards
        bright: '#fbf9f5', // inputs, secondary buttons, text on dark
        imagebg: '#efece5', // image placeholders / hero
        sand: '#e6dfd0', // soft chip / selected swatch
        seg: '#d8d4cb', // segmented control track
        circle: '#ece8e0', // empty-state circle
        rosetint: '#f9f1ee', // Add-chooser wishlist card surface (sampled from mockup)
        olivetint: '#f2efe8', // Add-chooser wardrobe card surface (sampled from mockup)
        roseink: '#8a4a42', // Add-chooser wishlist icon/accent
        oliveink: '#565633', // Add-chooser wardrobe icon/accent
        // ink scale
        ink: '#1c1b19', // primary text
        dark: '#26241f', // primary buttons, dark pill
        label: '#4a463f', // form labels
        body: '#57534b', // long-form body
        soft: '#6f6b64', // secondary text
        muted: '#8f8a80', // tertiary / hints
        faint: '#a8a298', // placeholders, strikethrough
        inactive: '#a09a90', // inactive tab icons
        iconmuted: '#b0aa9e', // empty-state icons
        // accents
        accent: '#8a5a3c', // links, "Shop"
        accentdark: '#6e4529',
        sale: '#97403a', // discount badge
      },
      borderColor: {
        DEFAULT: 'rgba(28,27,25,0.10)',
        hairline: 'rgba(28,27,25,0.07)',
        field: 'rgba(28,27,25,0.14)',
        strong: 'rgba(28,27,25,0.16)',
        roseline: '#dfcdcd', // Add-chooser wishlist card border
        oliveline: '#e9e6df', // Add-chooser wardrobe card border
      },
      fontFamily: {
        serif: ['PlayfairDisplay_600SemiBold'],
        serifmed: ['PlayfairDisplay_500Medium'],
        sans: ['InstrumentSans_400Regular'],
        sansmed: ['InstrumentSans_500Medium'],
        sansbold: ['InstrumentSans_600SemiBold'],
      },
    },
  },
  plugins: [],
};
