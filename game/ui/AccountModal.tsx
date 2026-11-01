// Sign in / create account / forgot password (ports of the web's login.js,
// register.js and forgot-password.js, trimmed to what the game needs).
// After sign-in the GameStore attaches this phone's hotel to the account
// (adopted if it's a new guest game, otherwise the account's server hotel wins).
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiError, authAPI, PRIVACY_URL, TERMS_URL } from '../platform/api';
import { track } from '../../services/analytics';
import { Button, C, s, usd } from './kit';

type Mode = 'login' | 'register' | 'forgot';

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...input } = props;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={st.label}>{label}</Text>
      <TextInput placeholderTextColor={C.faint} autoCorrect={false} style={st.input} {...input} />
    </View>
  );
}

type HotelSummary = { hotelName: string; day: number; money: number };

const confirmReplace = (mine: HotelSummary, theirs: HotelSummary) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      'Replace this phone’s hotel?',
      `Your account already has a hotel:\n${theirs.hotelName} · day ${theirs.day} · ${usd(theirs.money)}\n\nSigning in replaces the guest hotel on this phone:\n${mine.hotelName} · day ${mine.day} · ${usd(mine.money)}\n\nTip: cancel and choose "Save my hotel" to keep this one under a new account instead.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Use account hotel', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    )
  );

export default function AccountModal({
  open,
  initialMode = 'register',
  reason,
  hotelName,
  guestHotel,
  onClose,
  onSignedIn,
}: {
  open: boolean;
  initialMode?: Mode;
  reason?: string;
  hotelName?: string;
  /** This phone's guest hotel, if the player is a guest (to warn before it's replaced). */
  guestHotel?: HotelSummary | null;
  onClose: () => void;
  onSignedIn: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email.');
    if (mode !== 'forgot' && password.length < 6) return setError('Password must be at least 6 characters.');
    if (mode === 'register' && username && (username.trim().length < 3 || username.trim().length > 30)) return setError('Username must be 3–30 characters.');
    setBusy(true);
    try {
      if (mode === 'forgot') {
        await authAPI.forgotPassword(email);
        setInfo('If that email has an account, a reset link is on its way. Set a new password, then sign in here.');
        track('password_reset_requested');
        return;
      }
      if (mode === 'login') {
        const login = await authAPI.checkLogin(email, password);
        // The account's server hotel replaces this phone's guest hotel: ask first if the guest one has real progress.
        const theirs = guestHotel && guestHotel.day > 3 ? await authAPI.accountHotel(login.token) : null;
        if (theirs && !(await confirmReplace(guestHotel!, theirs))) return;
        authAPI.finishLogin(login);
      } else await authAPI.register({ email: email.trim(), password, username: username.trim() || undefined, hotelName, inviteCode: inviteCode.trim() || undefined });
      track(mode === 'login' ? 'login' : 'sign_up', { method: 'email' });
      setPassword('');
      onSignedIn();
    } catch (err: any) {
      // Imported players without a password get a reset email from the server.
      setError(apiError(err, mode === 'login' ? 'Could not sign in.' : 'Could not create the account.'));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'login' ? 'Sign in' : mode === 'register' ? 'Save your hotel' : 'Reset password';
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.backdrop}>
        <View style={st.sheet}>
          <View style={st.head}>
            <View style={s.between}>
              <Text style={st.title}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
            <Text style={st.sub}>
              {mode === 'register'
                ? reason || 'A free account keeps your hotel in the cloud, puts it in the ranking and gives you 10,000 coins.'
                : mode === 'login'
                ? "Continue your hotel from the website or another phone. If your account already has a hotel, it replaces this phone's guest hotel."
                : "We'll email you a link to set a new password."}
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
            <Field label="EMAIL" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
            {mode !== 'forgot' && (
              <Field
                label="PASSWORD"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={mode === 'login' ? 'password' : 'new-password'}
                textContentType={mode === 'login' ? 'password' : 'newPassword'}
              />
            )}
            {mode === 'register' && (
              <>
                <Field label="USERNAME (OPTIONAL)" value={username} onChangeText={setUsername} autoCapitalize="none" maxLength={30} placeholder="From your email if empty" />
                <Field label="INVITE CODE (OPTIONAL)" value={inviteCode} onChangeText={setInviteCode} autoCapitalize="characters" maxLength={32} />
              </>
            )}
            {error ? <Text style={st.error}>{error}</Text> : null}
            {info ? <Text style={st.info}>{info}</Text> : null}
            <Button big onPress={submit} busy={busy}>
              {mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create free account' : 'Send reset link'}
            </Button>
            {mode === 'register' && (
              <Text style={[s.tiny, { textAlign: 'center', marginTop: 8 }]}>
                By creating an account you agree to the{' '}
                <Text style={st.inlineLink} onPress={() => Linking.openURL(TERMS_URL)}>
                  Terms
                </Text>{' '}
                and the{' '}
                <Text style={st.inlineLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
                  Privacy Policy
                </Text>
                .
              </Text>
            )}
            <View style={{ marginTop: 14, gap: 10, alignItems: 'center' }}>
              {mode !== 'login' && (
                <Pressable onPress={() => switchTo('login')}>
                  <Text style={st.link}>I already have an account — sign in</Text>
                </Pressable>
              )}
              {mode !== 'register' && (
                <Pressable onPress={() => switchTo('register')}>
                  <Text style={st.link}>New here? Create a free account</Text>
                </Pressable>
              )}
              {mode === 'login' && (
                <Pressable onPress={() => switchTo('forgot')}>
                  <Text style={[st.link, { color: C.sub }]}>Forgot password?</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', maxHeight: '92%' },
  head: { backgroundColor: C.dark, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  sub: { color: '#cbd5e1', fontSize: 13, marginTop: 4 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.sub, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: C.text },
  error: { color: '#be123c', backgroundColor: C.redSoft, borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 12 },
  info: { color: '#065f46', backgroundColor: C.greenSoft, borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 12 },
  link: { fontSize: 13, fontWeight: '600', color: C.indigo },
  inlineLink: { color: C.indigo, fontWeight: '600', textDecorationLine: 'underline' },
});

/**
 * Account screen for signed-in players: sign out, or delete the account
 * (Google Play requires in-app deletion for apps that create accounts).
 */
export function ManageAccountModal({ open, username, onClose, onSignOut, onDeleted }: { open: boolean; username?: string; onClose: () => void; onSignOut: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setDeleting(false);
    setPassword('');
    setError(null);
    onClose();
  };
  const remove = async () => {
    setError(null);
    setBusy(true);
    try {
      await authAPI.deleteAccount(password);
      track('account_deleted');
      setDeleting(false);
      setPassword('');
      onDeleted();
    } catch (err) {
      setError(apiError(err, 'Could not delete the account.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.backdrop}>
        <View style={st.sheet}>
          <View style={st.head}>
            <View style={s.between}>
              <Text style={st.title}>👤 {username || 'Your account'}</Text>
              <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close">
                <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
            <Text style={st.sub}>Your hotel is saved to this account and syncs across devices.</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 18, gap: 10 }} keyboardShouldPersistTaps="handled">
            {!deleting ? (
              <>
                <Button big variant="ghost" onPress={onSignOut}>
                  Sign out
                </Button>
                <Button big variant="danger" onPress={() => setDeleting(true)}>
                  Delete account…
                </Button>
                <View style={[s.row, { justifyContent: 'center', gap: 16, marginTop: 6 }]}>
                  <Text style={st.link} onPress={() => Linking.openURL(PRIVACY_URL)}>
                    Privacy Policy
                  </Text>
                  <Text style={st.link} onPress={() => Linking.openURL(TERMS_URL)}>
                    Terms
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 13, color: '#9f1239', backgroundColor: C.redSoft, borderRadius: 10, padding: 10 }}>
                  This permanently deletes your account: your hotel, cloud saves, ranking, invites and coins. It can't be undone. Purchases (like Remove ads) stay with your Google account.
                </Text>
                <Field label="PASSWORD" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" textContentType="password" />
                {error ? <Text style={st.error}>{error}</Text> : null}
                <Button big variant="danger" busy={busy} disabled={!password} onPress={remove}>
                  Delete my account permanently
                </Button>
                <Button big variant="ghost" onPress={() => setDeleting(false)}>
                  Keep my account
                </Button>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
