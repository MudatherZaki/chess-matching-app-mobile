import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { MemberJoinedPayload } from '@/types';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import { Avatar } from './Avatar';

const VISIBLE_MS = 6000;

/**
 * Drops in from the top when someone joins one of your gatherings. Tapping it
 * opens the gathering; it hides itself after a few seconds.
 */
export default function JoinedBanner({
  joined,
  onPress,
  onDismiss,
}: {
  joined: MemberJoinedPayload | null;
  onPress: (gatheringId: string) => void;
  onDismiss: () => void;
}) {
  const { top } = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!joined) return;
    slide.setValue(0);
    Animated.spring(slide, { toValue: 1, useNativeDriver: true }).start();
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [joined, slide, onDismiss]);

  if (!joined) return null;

  const { member } = joined;
  const name = member.fullName || `@${member.username}`;
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] });

  return (
    <Animated.View
      style={[styles.wrap, { top: top + spacing.sm, opacity: slide, transform: [{ translateY }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.banner}
        onPress={() => {
          onDismiss();
          onPress(joined.gatheringId);
        }}>
        <Avatar photoUrl={member.photoUrl} username={member.username} size={40} shape="circle" />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {name} joined
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {joined.venueName} · {joined.memberCount} going
          </Text>
        </View>
        <TouchableOpacity onPress={onDismiss} hitSlop={12}>
          <Icon name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 10 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '66',
    padding: 12,
    ...shadow.md,
  },
  text: { flex: 1, marginHorizontal: spacing.sm + 4 },
  title: { ...typography.bodyBold, fontWeight: '800', color: colors.textPrimary },
  sub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
