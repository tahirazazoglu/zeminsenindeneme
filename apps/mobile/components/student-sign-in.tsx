import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { useRef, useState, type ComponentRef } from 'react'
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { color, displayFont } from './theme'

const pitch = require('../assets/football-court.webp')
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const codeLength = 6

type Props = {
  busy: boolean
  error: string
  authenticate: (email: string, token?: string) => Promise<boolean>
}

export function StudentSignIn({ busy, error, authenticate }: Props) {
  const [email, setEmail] = useState('')
  const [recipient, setRecipient] = useState<string>()
  const [code, setCode] = useState('')
  const [visibleError, setVisibleError] = useState(false)
  const [resent, setResent] = useState(false)
  const [operation, setOperation] = useState<'send' | 'verify' | null>(null)
  const input = useRef<ComponentRef<typeof TextInput>>(null)
  const address = email.trim().toLowerCase()
  const verifying = recipient !== undefined
  const ready = verifying ? code.length === codeLength : validEmail.test(address)

  async function requestCode(resend = false) {
    const to = resend ? recipient : address
    if (busy || !to || !validEmail.test(to)) return
    setVisibleError(true)
    setResent(false)
    setOperation('send')
    try {
      if (await authenticate(to)) {
        setRecipient(to)
        setCode('')
        setResent(resend)
        if (resend) input.current?.focus()
      }
    } finally {
      setOperation(null)
    }
  }

  async function submit() {
    if (busy || !ready) return
    if (!recipient) {
      await requestCode()
      return
    }
    setVisibleError(true)
    setResent(false)
    setOperation('verify')
    try {
      if (await authenticate(recipient, code)) Keyboard.dismiss()
    } finally {
      setOperation(null)
    }
  }

  function editEmail() {
    setRecipient(undefined)
    setCode('')
    setVisibleError(false)
    setResent(false)
  }

  return <SafeAreaView style={styles.screen}>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          {!verifying && <View style={styles.photo}>
            <Image source={pitch} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
            <Text style={styles.photoLabel}>Temsili görsel</Text>
          </View>}
          <View style={styles.brandCopy}>
            <View style={styles.brandIcon} accessibilityElementsHidden importantForAccessibility="no">
              <Feather name="activity" color={color.accent} size={22} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.wordmark}>Zemin Senin</Text>
              {!verifying && <Text style={styles.brandMeta}>Tesis rezervasyonu ve Kampüs Ağı</Text>}
            </View>
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.intro}>
            <Text accessibilityRole="header" style={styles.title}>{verifying ? 'Kodunu doğrula' : 'Giriş yap'}</Text>
            <Text style={styles.body}>{verifying ? 'E-posta adresine gönderilen 6 haneli kodu gir.' : 'Davet aldığın e-posta adresine giriş kodu gönderelim.'}</Text>
          </View>

          {verifying ? <>
            <View style={styles.recipient}>
              <Text style={styles.recipientAddress} selectable>{recipient}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="E-postayı değiştir" disabled={busy}
                accessibilityState={{ disabled: busy }} onPress={editEmail} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
                <Text style={styles.linkText}>Değiştir</Text>
              </Pressable>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Giriş kodu</Text>
              <TextInput key="code" ref={input} accessibilityLabel="Giriş kodu" inputMode="numeric" autoComplete="one-time-code"
                autoFocus value={code} editable={!busy} placeholder="000000" placeholderTextColor={color.muted}
                onChangeText={value => { setCode(value.replace(/[^0-9]/g, '').slice(0, codeLength)); setVisibleError(false) }}
                returnKeyType="go" onSubmitEditing={() => void submit()} style={[styles.input, styles.code]} />
            </View>
          </> : <View style={styles.field}>
            <Text style={styles.label}>E-posta</Text>
            <TextInput key="email" ref={input} accessibilityLabel="E-posta" inputMode="email" autoComplete="email"
              autoFocus={email.length > 0} autoCapitalize="none" autoCorrect={false} spellCheck={false} value={email} editable={!busy}
              onChangeText={value => { setEmail(value); setVisibleError(false) }} returnKeyType="go"
              onSubmitEditing={() => void submit()} style={styles.input} />
          </View>}

          {visibleError && error !== '' && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {resent && error === '' && <Text accessibilityLiveRegion="polite" style={styles.body}>Yeni kod gönderildi.</Text>}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready || busy, busy }}
            disabled={!ready || busy} onPress={() => void submit()}
            style={({ pressed }) => [styles.primary, (!ready || busy) && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>
              {verifying ? operation === 'verify' ? 'Kontrol ediliyor…' : 'Giriş yap' : operation === 'send' ? 'Gönderiliyor…' : 'Kod gönder'}
            </Text>
          </Pressable>
          {verifying && <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }}
            disabled={busy} onPress={() => void requestCode(true)} style={({ pressed }) => [styles.resend, pressed && styles.pressed]}>
            <Text style={styles.linkText}>{operation === 'send' ? 'Gönderiliyor…' : 'Yeni kod iste'}</Text>
          </Pressable>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 14, gap: 21 },
  brand: { backgroundColor: color.forest, borderRadius: 16, overflow: 'hidden' },
  photo: { height: 148, alignItems: 'flex-end', padding: 10 },
  photoLabel: { color: color.surface, backgroundColor: color.forest, fontSize: 10, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 4 },
  brandCopy: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 10 },
  brandIcon: { width: 38, height: 38, borderRadius: 9, borderWidth: 1, borderColor: '#55735c', alignItems: 'center', justifyContent: 'center' },
  wordmark: { color: color.surface, fontFamily: displayFont, fontSize: 33 },
  brandMeta: { color: color.onDark, fontSize: 13 },
  form: { gap: 12 },
  intro: { gap: 4 },
  title: { color: color.ink, fontFamily: displayFont, fontSize: 37 },
  body: { color: color.body, fontSize: 15, lineHeight: 22 },
  recipient: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, borderBottomWidth: 1, borderColor: color.line },
  recipientAddress: { flexGrow: 1, flexShrink: 1, color: color.ink, fontSize: 15, fontWeight: '700' },
  link: { minHeight: 48, paddingHorizontal: 4, justifyContent: 'center' },
  linkText: { color: color.action, fontSize: 14, fontWeight: '800' },
  field: { gap: 6 },
  label: { color: color.ink, fontSize: 14, fontWeight: '700' },
  input: { minHeight: 51, backgroundColor: color.surface, color: color.ink, borderColor: '#a3b5a6', borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16 },
  code: { fontSize: 23, letterSpacing: 5, fontVariant: ['tabular-nums'] },
  error: { color: color.danger, backgroundColor: color.dangerTint, padding: 10, borderRadius: 8, fontSize: 14 },
  primary: { backgroundColor: color.action, borderRadius: 9, minHeight: 51, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  primaryText: { color: color.surface, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  resend: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
})
