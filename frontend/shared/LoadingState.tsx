import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { colors } from './theme';

type LoadingStateProps = {
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof FontAwesome6>['name'];
};

export default function LoadingState({ title, subtitle, icon = 'heart-pulse' }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <FontAwesome6 name={icon} size={22} color={colors.primary} />
      </View>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  title: {
    marginTop: 12,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    color: colors.placeholder,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
