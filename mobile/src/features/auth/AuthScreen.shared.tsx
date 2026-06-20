import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { isSupabaseConfigured, supabase } from '../../shared/supabase/client';
import { createOAuthSignInUrl } from './services/oauth';

export interface AuthPlatformConfig {
  keyboardAvoidingBehavior: 'padding' | 'height' | undefined;
  secureTextEntry: boolean;
  textContentType: 'password' | 'none';
  cardGap: number;
  cardPadding: number;
  contentGap: number;
  formGap: number;
  inputMinHeight: number;
  googleButtonMinHeight: number;
  modeTabMinHeight: number;
  primaryButtonMinHeight: number;
  scrollContentPaddingVertical: number;
  socialButtonMinHeight: number;
}

// design.md palette (Subnota / Claude warm system) — shared with the Windows app.
const COLORS = {
  canvas: '#FAF9F5',
  card: '#FFFFFF',
  trackBg: '#EFE9DE',
  ink: '#141413',
  body: '#3D3D3A',
  muted: '#6C6A64',
  hairline: '#E6DFD8',
  primary: '#CC785C',
  primaryActive: '#A9583E',
  onPrimary: '#FFFFFF',
  disabledText: '#A89E90',
  placeholder: '#A89E90',
  google: '#4285F4',
} as const;

// Subnota brand glyph (the four-lobe network mark used on the landing page).
const BrandGlyph = () => (
  <View style={brandStyles.brandMark}>
    <Svg viewBox="0 0 24 24" width={26} height={26}>
      <Path
        d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4 4 4 0 0 1-4-4V6a4 4 0 0 1 4-4zm0 20a4 4 0 0 1-4-4v-2a4 4 0 0 1 4-4 4 4 0 0 1 4 4v2a4 4 0 0 1-4 4zm-8-8a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4 4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zm16 0a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4 4 4 0 0 1 4-4h2a4 4 0 0 1 4 4z"
        fill={COLORS.onPrimary}
      />
    </Svg>
  </View>
);

const brandStyles = StyleSheet.create({
  brandMark: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    width: 52,
  },
});

const AuthScreen = ({ platformConfig }: { platformConfig: AuthPlatformConfig }) => {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | 'confirm' | null>(null);

  const normalizedEmail = email.trim();
  const isSignUp = mode === 'signUp';
  const hasRequiredFields =
    normalizedEmail.length > 0 &&
    password.length >= 6 &&
    (!isSignUp || passwordConfirmation.length >= 6);

  const startGoogleSignIn = async () => {
    if (!isSupabaseConfigured()) {
      Alert.alert(
        'Supabase 설정 필요',
        '앱을 시작하려면 SUPABASE_URL과 SUPABASE_ANON_KEY가 필요합니다.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const url = await createOAuthSignInUrl('google');
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        'Google 로그인 실패',
        error instanceof Error ? error.message : 'Google 로그인 URL을 열지 못했습니다.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const submit = async () => {
    if (!isSupabaseConfigured()) {
      Alert.alert(
        'Supabase 설정 필요',
        '앱을 시작하려면 SUPABASE_URL과 SUPABASE_ANON_KEY가 필요합니다.',
      );
      return;
    }

    if (!hasRequiredFields) {
      Alert.alert('입력 확인', '이메일과 6자 이상 비밀번호를 입력해 주세요.');
      return;
    }

    if (isSignUp && password !== passwordConfirmation) {
      Alert.alert('입력 확인', '비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsSubmitting(true);
    const { error, data } = await (isSignUp
      ? supabase.auth.signUp({
          email: normalizedEmail,
          password,
        })
      : supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })
    ).finally(() => setIsSubmitting(false));

    if (error) {
      Alert.alert(
        isSignUp ? '계정 생성 실패' : '로그인 실패',
        error.message,
      );
      return;
    }

    if (isSignUp && !data.session) {
      Alert.alert(
        '확인 메일을 보냈습니다',
        '메일 인증이 켜져 있다면 이메일 확인 후 다시 로그인해 주세요.',
      );
    }
  };

  const styles = createStyles(platformConfig);

  return (
    <KeyboardAvoidingView
      behavior={platformConfig.keyboardAvoidingBehavior}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.brandBlock}>
            <BrandGlyph />
            <Text style={styles.brand}>Subnota</Text>
            <Text style={styles.title}>
              {isSignUp ? 'Subnota 시작하기' : '다시 만나서 반가워요'}
            </Text>
            <Text style={styles.subtitle}>정리하지 말고, 작성만 하세요.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.modeTabs}>
              <Pressable
                disabled={isSubmitting}
                onPress={() => setMode('signIn')}
                style={[styles.modeTab, !isSignUp && styles.activeModeTab]}
              >
                <Text style={[styles.modeText, !isSignUp && styles.activeModeText]}>
                  로그인
                </Text>
              </Pressable>
              <Pressable
                disabled={isSubmitting}
                onPress={() => setMode('signUp')}
                style={[styles.modeTab, isSignUp && styles.activeModeTab]}
              >
                <Text style={[styles.modeText, isSignUp && styles.activeModeText]}>
                  회원가입
                </Text>
              </Pressable>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>이메일</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isSubmitting}
                  // @ts-ignore
                  enableFocusRing={false}
                  inputMode="email"
                  keyboardType="email-address"
                  onBlur={() => setFocusedField(null)}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField('email')}
                  placeholder="name@example.com"
                  placeholderTextColor={COLORS.placeholder}
                  style={[styles.input, focusedField === 'email' && styles.inputFocused]}
                  textContentType="emailAddress"
                  value={email}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>비밀번호</Text>
                <TextInput
                  autoComplete={isSignUp ? 'new-password' : 'password'}
                  editable={!isSubmitting}
                  // @ts-ignore
                  enableFocusRing={false}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField('password')}
                  placeholder="6자 이상 입력"
                  placeholderTextColor={COLORS.placeholder}
                  secureTextEntry={platformConfig.secureTextEntry}
                  style={[styles.input, focusedField === 'password' && styles.inputFocused]}
                  textContentType={platformConfig.textContentType}
                  value={password}
                />
              </View>

              {isSignUp && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>비밀번호 확인</Text>
                  <TextInput
                    autoComplete="new-password"
                    editable={!isSubmitting}
                    // @ts-ignore
                    enableFocusRing={false}
                    onBlur={() => setFocusedField(null)}
                    onChangeText={setPasswordConfirmation}
                    onFocus={() => setFocusedField('confirm')}
                    placeholder="비밀번호를 한 번 더 입력"
                    placeholderTextColor={COLORS.placeholder}
                    secureTextEntry={platformConfig.secureTextEntry}
                    style={[styles.input, focusedField === 'confirm' && styles.inputFocused]}
                    textContentType={platformConfig.textContentType}
                    value={passwordConfirmation}
                  />
                </View>
              )}

              <Pressable
                disabled={!hasRequiredFields || isSubmitting}
                onPress={submit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  !hasRequiredFields && styles.primaryDisabled,
                  pressed && hasRequiredFields && styles.primaryPressed,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.onPrimary} />
                ) : (
                  <>
                    <Text
                      style={[
                        styles.primaryButtonText,
                        !hasRequiredFields && styles.primaryDisabledText,
                      ]}
                    >
                      {isSignUp ? '무료로 시작하기' : '로그인'}
                    </Text>
                    <ChevronRight
                      color={hasRequiredFields ? COLORS.onPrimary : COLORS.disabledText}
                      size={18}
                    />
                  </>
                )}
              </Pressable>
            </View>

            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>또는</Text>
              <View style={styles.separatorLine} />
            </View>

            <View style={styles.socialButtons}>
              <Pressable
                disabled={isSubmitting}
                onPress={startGoogleSignIn}
                style={({ pressed }) => [
                  styles.googleButton,
                  isSubmitting && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>Google로 계속하기</Text>
              </Pressable>
              <View style={styles.socialButton}>
                <Text style={styles.kakaoIcon}>K</Text>
                <Text style={styles.socialButtonText}>Kakao 준비 중</Text>
              </View>
            </View>

            <Pressable
              disabled={isSubmitting}
              onPress={() => setMode(isSignUp ? 'signIn' : 'signUp')}
              style={styles.switchButton}
            >
              <Text style={styles.switchText}>
                {isSignUp ? '이미 계정이 있으신가요? ' : '처음 오셨나요? '}
                <Text style={styles.switchLink}>
                  {isSignUp ? '로그인' : '회원가입'}
                </Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (config: AuthPlatformConfig) =>
  StyleSheet.create({
    activeModeTab: {
      backgroundColor: COLORS.card,
      shadowColor: COLORS.ink,
      shadowOffset: { height: 1.5, width: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    activeModeText: {
      color: COLORS.ink,
    },
    brand: {
      color: COLORS.ink,
      fontSize: 26,
      fontWeight: '600',
      letterSpacing: -0.4,
      textAlign: 'center',
    },
    brandBlock: {
      alignItems: 'center',
      gap: 8,
    },
    card: {
      backgroundColor: COLORS.card,
      borderColor: COLORS.hairline,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      gap: config.cardGap,
      maxWidth: 400,
      padding: config.cardPadding,
      shadowColor: COLORS.ink,
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 24,
      width: '100%',
    },
    container: {
      backgroundColor: COLORS.canvas,
      flex: 1,
    },
    content: {
      alignItems: 'center',
      gap: config.contentGap,
      justifyContent: 'center',
      width: '100%',
    },
    disabledButton: {
      opacity: 0.45,
    },
    form: {
      gap: config.formGap,
    },
    googleButton: {
      alignItems: 'center',
      backgroundColor: COLORS.canvas,
      borderColor: COLORS.hairline,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: config.googleButtonMinHeight,
    },
    googleButtonText: {
      color: COLORS.ink,
      fontSize: 13,
      fontWeight: '700',
    },
    googleIcon: {
      color: COLORS.google,
      fontSize: 15,
      fontWeight: '900',
    },
    input: {
      backgroundColor: COLORS.canvas,
      borderColor: COLORS.hairline,
      borderRadius: 10,
      borderWidth: 1,
      color: COLORS.ink,
      fontSize: 15,
      fontWeight: '500',
      minHeight: config.inputMinHeight,
      paddingHorizontal: 14,
    },
    inputFocused: {
      backgroundColor: COLORS.card,
      borderColor: COLORS.primary,
    },
    inputGroup: {
      gap: 6,
    },
    kakaoIcon: {
      color: COLORS.muted,
      fontSize: 15,
      fontWeight: '900',
    },
    label: {
      color: COLORS.muted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.2,
      paddingLeft: 2,
    },
    modeTab: {
      alignItems: 'center',
      borderRadius: 8,
      flex: 1,
      justifyContent: 'center',
      minHeight: config.modeTabMinHeight,
    },
    modeTabs: {
      backgroundColor: COLORS.trackBg,
      borderRadius: 10,
      flexDirection: 'row',
      padding: 3,
    },
    modeText: {
      color: COLORS.muted,
      fontSize: 13,
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.82,
      transform: [{ scale: 0.99 }],
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: COLORS.primary,
      borderRadius: 10,
      flexDirection: 'row',
      gap: 4,
      justifyContent: 'center',
      minHeight: config.primaryButtonMinHeight,
      shadowColor: COLORS.primary,
      shadowOffset: { height: 4, width: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
    },
    primaryButtonText: {
      color: COLORS.onPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    primaryDisabled: {
      backgroundColor: COLORS.hairline,
      shadowOpacity: 0,
    },
    primaryDisabledText: {
      color: COLORS.disabledText,
    },
    primaryPressed: {
      backgroundColor: COLORS.primaryActive,
      transform: [{ scale: 0.99 }],
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: config.scrollContentPaddingVertical,
    },
    separator: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      marginVertical: 4,
    },
    separatorLine: {
      backgroundColor: COLORS.hairline,
      flex: 1,
      height: StyleSheet.hairlineWidth,
    },
    separatorText: {
      color: COLORS.muted,
      fontSize: 12,
      fontWeight: '700',
    },
    socialButton: {
      alignItems: 'center',
      backgroundColor: COLORS.canvas,
      borderColor: COLORS.hairline,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      flex: 1,
      flexDirection: 'row',
      gap: 7,
      justifyContent: 'center',
      minHeight: config.socialButtonMinHeight,
      opacity: 0.65,
    },
    socialButtonText: {
      color: COLORS.muted,
      fontSize: 13,
      fontWeight: '700',
    },
    socialButtons: {
      flexDirection: 'row',
      gap: 10,
    },
    subtitle: {
      color: COLORS.muted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    switchButton: {
      alignItems: 'center',
      marginTop: 4,
    },
    switchLink: {
      color: COLORS.primary,
      fontWeight: '800',
    },
    switchText: {
      color: COLORS.muted,
      fontSize: 13,
      fontWeight: '600',
    },
    title: {
      color: COLORS.body,
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 24,
      textAlign: 'center',
    },
  });

export default AuthScreen;
