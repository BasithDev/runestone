// STUB — interface contract for the quick-track sheet (Engineer Q implements it).
// Search results open this to track a title without visiting its details page.
import React from 'react';

export interface QuickTrackTarget {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  /** YYYY-MM-DD (release_date / first_air_date) if known. */
  releaseDate?: string | null;
}

export interface QuickTrackSheetProps {
  visible: boolean;
  target: QuickTrackTarget | null;
  onClose: () => void;
  /** Called after an action succeeded, with a short message for a toast/snackbar. */
  onDone?: (message: string) => void;
}

export default function QuickTrackSheet(_props: QuickTrackSheetProps) {
  return null;
}
