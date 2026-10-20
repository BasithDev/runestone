import React from 'react';
import { Platform, Text as RNText, TextInput as RNTextInput, TextProps, TextInputProps } from 'react-native';

// App-wide font. iOS already renders San Francisco (the system font); Android
// gets Inter, the closest open alternative (SF may only ship on Apple
// platforms). Inter is registered natively via the expo-font plugin with all
// weights, so fontWeight keeps working.
export const FONT_FAMILY = Platform.select({ android: 'Inter', default: undefined });

const base = FONT_FAMILY ? { fontFamily: FONT_FAMILY } : null;

// Drop-in replacements for react-native's Text / TextInput; an explicit
// fontFamily in `style` still wins.
export function Text({ style, ...props }: TextProps & { ref?: React.Ref<RNText> }) {
  return <RNText {...props} style={base ? [base, style] : style} />;
}

export function TextInput({ style, ...props }: TextInputProps & { ref?: React.Ref<RNTextInput> }) {
  return <RNTextInput {...props} style={base ? [base, style] : style} />;
}

// Instance types, so `useRef<TextInput>(null)` keeps working.
export type Text = RNText;
export type TextInput = RNTextInput;
