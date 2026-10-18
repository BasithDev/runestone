// ── Special detail-page themes ────────────────────────
// A handful of hand-picked titles get their own premium look on the
// content details screen. Add a new entry here to theme another title.
import { createContext, useContext } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

type McIcon = keyof typeof MaterialCommunityIcons.glyphMap;

export interface SpecialTheme {
  key: string;
  /** Page background (replaces black). */
  background: string;
  /** Hero overlay gradient, top → bottom; last stop should equal background. */
  heroGradient: [string, string, ...string[]];
  /** Primary accent (titles, headers, icons). */
  accent: string;
  /** Secondary accent (chips, glows). */
  secondary: string;
  /** Muted text on this background. */
  muted: string;
  /** Display font family (loaded via expo-font). */
  displayFont: string;
  tagline: string;
  /** Slowly rotating decoration in the hero. */
  heroIcon: McIcon;
  /** Icon in front of section headers. */
  sectionIcon: McIcon;
  /** Rating card style. */
  ratingCard: 'bounty';
}

const ONE_PIECE: SpecialTheme = {
  key: 'one-piece',
  background: '#06142E',
  heroGradient: ['rgba(6,20,46,0.05)', 'rgba(6,20,46,0.55)', 'rgba(6,20,46,0.92)', '#06142E'],
  accent: '#F4C430',     // Straw Hat gold
  secondary: '#D7263D',  // Luffy red
  muted: '#8FA3C7',
  displayFont: 'PirataOne_400Regular',
  tagline: 'The Grand Line awaits',
  heroIcon: 'ship-wheel',
  sectionIcon: 'anchor',
  ratingCard: 'bounty',
};

/** Themes keyed by `${mediaType}-${tmdbId}`. */
const THEMES: Record<string, SpecialTheme> = {
  'tv-37854': ONE_PIECE, // One Piece (anime, 1999)
};

export function getSpecialTheme(mediaType: string, tmdbId: number): SpecialTheme | null {
  return THEMES[`${mediaType}-${tmdbId}`] ?? null;
}

export const SpecialThemeContext = createContext<SpecialTheme | null>(null);
export const useSpecialTheme = () => useContext(SpecialThemeContext);
