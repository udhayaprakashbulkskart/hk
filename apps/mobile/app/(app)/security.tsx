import { useEffect, useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { api } from "@hkfinhub/api-client";
import { Badge, Button, Card, ErrorBox, Heading, Loading, Muted, Row, Screen, Title } from "@/components/ui";
import { biometricState, unlockWithBiometrics, type BiometricState } from "@/lib/biometric";
import { enablePushNotifications } from "@/lib/push";
import { lockEnabled, setLockEnabled } from "@/lib/prefs";
import { useAsync } from "@/lib/useAsync";
import { useTheme } from "@/theme/theme";

export default function SecurityScreen() {
  const { colors } = useTheme();
  const devices = useAsync(() => api.listDevices());
  const [bio, setBio] = useState<BiometricState | null>(null);
  const [lock, setLock] = useState(false);
  const [pushNote, setPushNote] = useState<string | null>(null);

  useEffect(() => {
    biometricState().then(setBio);
    lockEnabled().then(setLock);
  }, []);

  async function toggleLock(on: boolean) {
    if (on) {
      const ok = await unlockWithBiometrics("Confirm to turn on app lock");
      if (!ok) return;
    }
    setLock(on);
    await setLockEnabled(on);
  }

  async function togglePush() {
    const r = await enablePushNotifications();
    if (r.status === "granted") setPushNote("Push notifications are on for this device.");
    else if (r.status === "denied") setPushNote("Notifications are blocked. Allow them in your device settings.");
    else setPushNote(r.message);
  }

  return (
    <Screen>
      <Title eyebrow="Account protection" title="Security" description="Two-factor authentication, app lock and the devices that can access your account." />
      <Card>
        <Heading>Two-factor authentication</Heading>
        <Row label="Authenticator app" value="On" tone="up" />
        <Row label="Recovery codes" value="8 of 10 unused" />
        <Muted>Required before any money moves.</Muted>
      </Card>
      <Card>
        <Heading>App lock</Heading>
        {bio === null ? <Loading /> : (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <Text style={{ color: colors.foreground, flexShrink: 1 }}>Unlock with {bio.supported && bio.kind === "face" ? "Face ID" : bio.supported ? "fingerprint" : "device passcode"} on launch</Text>
              <Switch value={lock} onValueChange={toggleLock} disabled={!bio.supported} accessibilityLabel="App lock" />
            </View>
            {!bio.supported ? <Muted>{bio.reason}</Muted> : null}
          </>
        )}
      </Card>
      <Card>
        <Heading>Notifications</Heading>
        <Muted>Security alerts are always sent. Push also needs an EAS project, added when the app is linked to Expo.</Muted>
        <Button variant="outline" onPress={togglePush}>Enable push notifications</Button>
        {pushNote ? <Text accessibilityRole="alert" style={{ color: colors.mutedForeground }}>{pushNote}</Text> : null}
      </Card>
      <Heading>Devices and sessions</Heading>
      {devices.loading ? <Loading /> : devices.error ? <ErrorBox message={devices.error} onRetry={devices.reload} /> : devices.data?.map((d) => (
        <Card key={d.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <Text style={{ color: colors.foreground, fontWeight: "600", flexShrink: 1 }}>{d.name}</Text>
            {d.current ? <Badge tone="gold">This device</Badge> : null}
          </View>
          <Muted>{d.location} · {d.lastActive}</Muted>
          {!d.current ? <Button variant="outline" disabled>Sign out device</Button> : null}
        </Card>
      ))}
      <Muted>Device sign-out is available once live sessions are connected.</Muted>
    </Screen>
  );
}
