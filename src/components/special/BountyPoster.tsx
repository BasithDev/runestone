import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SpecialTheme } from './specialThemes';

const PARCHMENT = '#EAD7AE';
const INK = '#3B2A1A';

function fmtBounty(votes: number): string {
  if (votes >= 1000) return `${(votes / 1000).toFixed(1)}K`;
  return String(votes);
}

interface Props {
  theme: SpecialTheme;
  rating: number;
  voteCount: number;
  sinceYear?: string;
  ongoing?: boolean;
  fontReady: boolean;
}

/** Rating shown as a One Piece style WANTED poster. */
export default function BountyPoster({ theme, rating, voteCount, sinceYear, ongoing, fontReady }: Props) {
  const display = fontReady ? { fontFamily: theme.displayFont } : { fontWeight: '900' as const };

  return (
    <View style={[s.poster, { shadowColor: theme.secondary }]}>
      <View style={s.inner}>
        <Text style={[s.wanted, display]}>WANTED</Text>
        <Text style={s.deadOrAlive}>DEAD OR ALIVE</Text>

        <View style={s.ratingRow}>
          <MaterialCommunityIcons name="star-four-points" size={20} color={theme.secondary} />
          <Text style={[s.rating, display]}>{rating.toFixed(1)}</Text>
          <Text style={s.outOf}>/10</Text>
        </View>

        <View style={s.rule} />
        <Text style={s.bounty}>
          BOUNTY <Text style={s.bountyNum}>{fmtBounty(voteCount)}</Text> VOTES
        </Text>
        {sinceYear ? (
          <Text style={[s.since, { color: theme.secondary }]}>
            {ongoing ? `STILL SAILING SINCE ${sinceYear}` : `SET SAIL ${sinceYear}`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  poster: {
    backgroundColor: PARCHMENT,
    borderRadius: 6,
    padding: 5,
    transform: [{ rotate: '-1.5deg' }],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  inner: {
    borderWidth: 1.5,
    borderColor: INK + '55',
    borderRadius: 3,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  wanted: { color: INK, fontSize: 30, letterSpacing: 2, lineHeight: 34 },
  deadOrAlive: { color: INK, fontSize: 8, fontWeight: '800', letterSpacing: 3, opacity: 0.75 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  rating: { color: INK, fontSize: 28, lineHeight: 32 },
  outOf: { color: INK, fontSize: 12, fontWeight: '700', opacity: 0.6, marginTop: 8 },
  rule: { height: 1.5, alignSelf: 'stretch', backgroundColor: INK + '40', marginVertical: 6 },
  bounty: { color: INK, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  bountyNum: { fontSize: 13, fontWeight: '900' },
  since: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 },
});
