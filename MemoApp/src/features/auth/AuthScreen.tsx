import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { isSupabaseConfigured, supabase } from '../../services/supabase/client';
import { createOAuthSignInUrl } from '../../services/supabase/oauth';

const AuthScreen = () => {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.brandBlock}>
            <Text style={styles.brand}>Subnota</Text>
            <Text style={styles.title}>
              {isSignUp ? '계정을 만들고 기록을 이어가세요' : '로그인하고 기록을 이어가세요'}
            </Text>
            <Text style={styles.subtitle}>
              메모, 수집함, 브리핑을 안전하게 동기화합니다.
            </Text>
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
                  inputMode="email"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor="#9B9BA3"
                  style={styles.input}
                  textContentType="emailAddress"
                  value={email}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>비밀번호</Text>
                <TextInput
                  autoComplete={isSignUp ? 'new-password' : 'password'}
                  editable={!isSubmitting}
                  onChangeText={setPassword}
                  placeholder="6자 이상 입력"
                  placeholderTextColor="#9B9BA3"
                  secureTextEntry={Platform.OS !== 'macos'}
                  style={styles.input}
                  textContentType={Platform.OS === 'macos' ? 'none' : 'password'}
                  value={password}
                />
              </View>

              {isSignUp && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>비밀번호 확인</Text>
                  <TextInput
                    autoComplete="new-password"
                    editable={!isSubmitting}
                    onChangeText={setPasswordConfirmation}
                    placeholder="비밀번호를 한 번 더 입력"
                    placeholderTextColor="#9B9BA3"
                    secureTextEntry={Platform.OS !== 'macos'}
                    style={styles.input}
                    textContentType={Platform.OS === 'macos' ? 'none' : 'password'}
                    value={passwordConfirmation}
                  />
                </View>
              )}

              <Pressable
                disabled={!hasRequiredFields || isSubmitting}
                onPress={submit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (!hasRequiredFields || isSubmitting) && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>
                      {isSignUp ? '이메일로 가입' : '로그인'}
                    </Text>
                    <ChevronRight color="#FFFFFF" size={18} />
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

const styles = StyleSheet.create({
  activeModeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#111217',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  activeModeText: {
    color: '#111217',
  },
  brand: {
    color: '#111217',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  brandBlock: {
    alignItems: 'center',
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E4EA',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 22,
    maxWidth: 440,
    padding: 24,
    shadowColor: '#111217',
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    width: '100%',
  },
  container: {
    backgroundColor: '#FAFAFB',
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: 30,
    justifyContent: 'center',
    width: '100%',
  },
  disabledButton: {
    opacity: 0.45,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE0E7',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#111217',
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  inputGroup: {
    gap: 8,
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE0E7',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
    justifyContent: 'center',
  },
  googleButtonText: {
    color: '#262832',
    fontSize: 13,
    fontWeight: '800',
  },
  googleIcon: {
    color: '#4285F4',
    fontSize: 15,
    fontWeight: '900',
  },
  kakaoIcon: {
    color: '#111217',
    fontSize: 15,
    fontWeight: '900',
  },
  label: {
    color: '#262832',
    fontSize: 14,
    fontWeight: '800',
  },
  modeTab: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  modeTabs: {
    backgroundColor: '#F0F1F4',
    borderRadius: 12,
    flexDirection: 'row',
    padding: 4,
  },
  modeText: {
    color: '#6E7280',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#111217',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 54,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  separator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  separatorLine: {
    backgroundColor: '#E4E6EC',
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  separatorText: {
    color: '#9B9BA3',
    fontSize: 13,
    fontWeight: '700',
  },
  socialButton: {
    alignItems: 'center',
    backgroundColor: '#F8F9FB',
    borderColor: '#E2E4EA',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 46,
    justifyContent: 'center',
    opacity: 0.58,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButtonText: {
    color: '#60616A',
    fontSize: 13,
    fontWeight: '800',
  },
  subtitle: {
    color: '#686B76',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  switchButton: {
    alignItems: 'center',
  },
  switchLink: {
    color: '#2563EB',
    fontWeight: '900',
  },
  switchText: {
    color: '#858895',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: '#111217',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 32,
    textAlign: 'center',
  },
});

export default AuthScreen;
