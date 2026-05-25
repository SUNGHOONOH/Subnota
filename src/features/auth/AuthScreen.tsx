import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { isSupabaseConfigured, supabase } from '../../services/supabase/client';

const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedEmail = email.trim();
  const canSubmit = normalizedEmail.length > 0 && password.length >= 6;

  const submit = async (mode: 'signIn' | 'signUp') => {
    if (!isSupabaseConfigured()) {
      Alert.alert(
        'Supabase 설정 필요',
        '앱을 시작하려면 SUPABASE_URL과 SUPABASE_ANON_KEY가 필요합니다.',
      );
      return;
    }

    if (!canSubmit) {
      Alert.alert('입력 확인', '이메일과 6자 이상 비밀번호를 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    const { error, data } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          })
        : await supabase.auth.signUp({
            email: normalizedEmail,
            password,
          });
    setIsSubmitting(false);

    if (error) {
      Alert.alert(
        mode === 'signIn' ? '로그인 실패' : '계정 생성 실패',
        error.message,
      );
      return;
    }

    if (mode === 'signUp' && !data.session) {
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
      <View style={styles.content}>
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>memoria</Text>
          <Text style={styles.title}>적기만 하세요. 정리는 로그인 후 이어집니다.</Text>
          <Text style={styles.subtitle}>
            메모, 캘린더, 브리핑, 네트워크를 기기 간에 안전하게 이어 쓰기 위해
            로그인이 필요합니다.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            editable={!isSubmitting}
            inputMode="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="이메일"
            placeholderTextColor="#B8AEA1"
            style={styles.input}
            textContentType="emailAddress"
            value={email}
          />
          <TextInput
            editable={!isSubmitting}
            onChangeText={setPassword}
            placeholder="비밀번호"
            placeholderTextColor="#B8AEA1"
            secureTextEntry
            style={styles.input}
            textContentType="password"
            value={password}
          />

          <Pressable
            disabled={!canSubmit || isSubmitting}
            onPress={() => submit('signIn')}
            style={({ pressed }) => [
              styles.primaryButton,
              (!canSubmit || isSubmitting) && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>로그인</Text>
                <ChevronRight color="#FFFFFF" size={18} />
              </>
            )}
          </Pressable>

          <Pressable
            disabled={isSubmitting}
            onPress={() => submit('signUp')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>이메일로 계정 만들기</Text>
          </Pressable>
        </View>

        <View style={styles.socialBlock}>
          <Text style={styles.socialTitle}>소셜 로그인 준비 중</Text>
          <View style={styles.socialButtons}>
            <View style={styles.socialButton}>
              <Text style={styles.socialButtonText}>Google</Text>
            </View>
            <View style={styles.socialButton}>
              <Text style={styles.socialButtonText}>Kakao</Text>
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  brand: {
    color: '#1D1D1F',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 0,
  },
  brandBlock: {
    gap: 14,
  },
  container: {
    backgroundColor: '#FAF6F0',
    flex: 1,
  },
  content: {
    flex: 1,
    gap: 28,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  disabledButton: {
    opacity: 0.45,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: '#FFFDF8',
    borderColor: '#E7DED1',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#1D1D1F',
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  pressed: {
    opacity: 0.78,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#1D1D1F',
    borderRadius: 14,
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
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#D8CEC1',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 50,
  },
  secondaryButtonText: {
    color: '#1D1D1F',
    fontSize: 15,
    fontWeight: '700',
  },
  socialBlock: {
    gap: 10,
  },
  socialButton: {
    alignItems: 'center',
    backgroundColor: '#F1EBE2',
    borderRadius: 12,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    opacity: 0.58,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButtonText: {
    color: '#6E6256',
    fontSize: 14,
    fontWeight: '700',
  },
  socialTitle: {
    color: '#9A8F82',
    fontSize: 12,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6E6256',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: '#1D1D1F',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
  },
});

export default AuthScreen;
