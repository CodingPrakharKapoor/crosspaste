// CrossPaste Phase 1 - phone app
// Connects to the laptop's relay over WebSocket and writes incoming text
// to the Android clipboard via expo-clipboard.

import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, Button, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';

export default function App() {
  const [ip, setIp] = useState('');
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([
    '[hint] Enter your laptop IP (printed by the relay) and tap Connect.'
  ]);
  const wsRef = useRef<WebSocket | null>(null);

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 30));
  };

  const connect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setConnected(false);
    }
    const host = ip.trim();
    if (!host) {
      addLog('Please enter the laptop IP first.');
      return;
    }
    const url = `ws://${host}:8080`;
    addLog(`Connecting to ${url}...`);
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        addLog('Connected. Ready to receive.');
      };
      ws.onmessage = async (ev) => {
        try {
          const data = JSON.parse(ev.data as string);
          if (data.type === 'clipboard' && typeof data.text === 'string') {
            await Clipboard.setStringAsync(data.text);
            const preview = data.text.length > 40 ? data.text.slice(0, 40) + '...' : data.text;
            addLog(`Pasted ${data.text.length} chars: "${preview}"`);
          } else if (data.type === 'hello') {
            addLog(`Relay: ${data.msg}`);
          }
        } catch (e) {
          addLog(`Error: ${e}`);
        }
      };
      ws.onerror = () => addLog('WebSocket error (check IP / Wi-Fi / firewall)');
      ws.onclose = () => {
        setConnected(false);
        addLog('Disconnected from relay');
      };
    } catch (e) {
      addLog(`Failed to open WebSocket: ${e}`);
    }
  };

  const testClipboard = async () => {
    await Clipboard.setStringAsync('hello from crosspaste');
    addLog('Test: wrote "hello from crosspaste" to clipboard. Try pasting anywhere.');
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="auto" />
      <Text style={styles.title}>CrossPaste</Text>
      <Text style={styles.subtitle}>Phase 1 test app</Text>

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={ip}
          onChangeText={setIp}
          placeholder="laptop IP, e.g. 192.168.1.10"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numeric"
        />
        <View style={styles.connectBtn}>
          <Button
            title={connected ? 'Connected' : 'Connect'}
            onPress={connect}
            color={connected ? '#16a34a' : '#2563eb'}
          />
        </View>
      </View>

      <View style={styles.spacer} />
      <Button
        title="Test clipboard (write 'hello')"
        onPress={testClipboard}
        color="#6b7280"
      />
      <View style={styles.spacer} />

      <Text style={styles.logTitle}>Log:</Text>
      <ScrollView style={styles.log}>
        {log.map((line, i) => (
          <Text key={i} style={styles.logLine}>{line}</Text>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginTop: 40 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 4,
    fontSize: 14,
  },
  connectBtn: { justifyContent: 'center' },
  spacer: { height: 16 },
  logTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 4, color: '#333' },
  log: { flex: 1, backgroundColor: '#f5f5f5', padding: 10, borderRadius: 4 },
  logLine: { fontSize: 12, fontFamily: 'monospace', marginBottom: 2, color: '#222' },
});
