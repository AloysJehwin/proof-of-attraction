import { useState } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { colors, spacing, font, radius } from '../theme';

export type WorldIdResult = {
  responses: unknown[];
  session_id?: string;
  [key: string]: unknown;
};

export type WorldIdMode = 'uniqueness' | 'create-session' | 'prove-session';

type Props = {
  visible: boolean;
  verifyUrl: string;
  appId: string;
  action: string;
  signal: string;
  apiBase: string;
  mode?: WorldIdMode;
  sessionId?: string;
  onProof: (result: WorldIdResult) => void;
  onError: (error: string) => void;
  onCancel: () => void;
};

export function WorldIdModal({ visible, verifyUrl, appId, action, signal, apiBase, mode = 'uniqueness', sessionId = '', onProof, onError, onCancel }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const src = `${verifyUrl}?app_id=${encodeURIComponent(appId)}&action=${encodeURIComponent(action)}&signal=${encodeURIComponent(signal)}&api=${encodeURIComponent(apiBase)}&environment=sandbox&mode=${mode}&session_id=${encodeURIComponent(sessionId)}`;

  function retry() {
    setLoadError(null);
    setLoading(true);
    setAttempt((a) => a + 1);
  }

  function shouldStartLoad(req: { url: string }): boolean {
    const url = req.url;
    console.log('[WorldIdModal] nav ->', url);
    const isWorldConnect =
      url.startsWith('https://sandbox.world.org/verify') ||
      url.startsWith('https://world.org/verify') ||
      url.startsWith('https://worldcoin.org/verify') ||
      url.startsWith('worldapp');
    if (isWorldConnect) {
      Linking.openURL(url).catch(() => onError(`could not open the World App: ${url.slice(0, 60)}`));
      return false;
    }
    if (url.startsWith(verifyUrl) || url.startsWith('about:') || url.startsWith('data:')) {
      return true;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return true;
    }
    Linking.openURL(url).catch(() => onError(`could not open: ${url.slice(0, 60)}`));
    return false;
  }

  function handleMessage(e: WebViewMessageEvent) {
    let data: any;
    try {
      data = JSON.parse(e.nativeEvent.data);
    } catch {
      onError('invalid response from verifier');
      return;
    }
    if (data.type === 'cancel') {
      onCancel();
      return;
    }
    if (data.type === 'state' || data.type === 'poll_error' || data.type === 'poll_timeout') {
      console.log('[WorldIdModal] diag', JSON.stringify(data));
      return;
    }
    if (data.type === 'error') {
      onError(typeof data.error === 'string' ? data.error : 'verification failed');
      return;
    }
    if (data.type === 'result' && data.result && Array.isArray(data.result.responses)) {
      onProof(data.result as WorldIdResult);
      return;
    }
    onError('unexpected response from verifier');
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Verify with World ID</Text>
          <Pressable onPress={onCancel} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        {loadError ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Could not load the verifier</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
            <Pressable style={styles.retryBtn} onPress={retry}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
            <Pressable onPress={onCancel} hitSlop={12}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.webWrap}>
            <WebView
              key={attempt}
              source={{ uri: src }}
              onMessage={handleMessage}
              onLoadEnd={() => setLoading(false)}
              onShouldStartLoadWithRequest={shouldStartLoad}
              onError={(e) => {
                const desc = e.nativeEvent.description || '';
                if (desc.includes('ERR_UNKNOWN_URL_SCHEME')) return;
                setLoading(false);
                setLoadError(desc || 'network error reaching the verifier');
              }}
              onHttpError={(e) => {
                setLoading(false);
                setLoadError(`verifier returned ${e.nativeEvent.statusCode}`);
              }}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              style={styles.web}
            />
            {loading && (
              <View style={styles.center} pointerEvents="none">
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.loadingText}>Loading verifier...</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  headerTitle: { color: colors.text, fontSize: font.size.md, fontWeight: font.weight.bold },
  close: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  webWrap: { flex: 1 },
  web: { flex: 1, backgroundColor: colors.bg },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  loadingText: { color: colors.textMuted, fontSize: font.size.sm },
  errorTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: font.weight.bold },
  errorDetail: { color: colors.textMuted, fontSize: font.size.sm, textAlign: 'center' },
  retryBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  retryText: { color: colors.bg, fontSize: font.size.md, fontWeight: font.weight.bold },
  cancelText: { color: colors.textFaint, fontSize: font.size.sm },
});
