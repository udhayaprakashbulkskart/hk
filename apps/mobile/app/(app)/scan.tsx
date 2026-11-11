import { useState } from "react";
import { router } from "expo-router";
import { Platform, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Button, Muted, Screen } from "@/components/ui";
import { useTheme } from "@/theme/theme";

/** Accepts our own payment links: hkfinhub://pay/REF and the https pay page. */
export function parsePaymentRef(data: string): string | null {
  const m = data.match(/(?:hkfinhub:\/\/pay\/|\/r\/)(REQ-[A-Z0-9]{4,12})/);
  return m ? m[1]! : null;
}

export default function ScanScreen() {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (Platform.OS === "web") {
    return <Screen><Muted>QR scanning uses the camera in the mobile app.</Muted></Screen>;
  }
  if (!permission) return <Screen><Muted>Checking camera permission…</Muted></Screen>;
  if (!permission.granted) {
    return (
      <Screen>
        <Text style={{ color: colors.foreground, fontSize: 16 }}>HK FinHub needs the camera to scan payment QR codes.</Text>
        <Button onPress={requestPermission}>Allow camera</Button>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={done ? undefined : ({ data }) => {
          const ref = parsePaymentRef(data);
          if (!ref) { setNote("That QR code is not an HK FinHub payment request."); return; }
          setDone(true);
          router.replace(`/pay/${ref}`);
        }}
      />
      <View style={{ position: "absolute", bottom: 40, left: 16, right: 16, gap: 10 }}>
        <Text accessibilityRole="alert" style={{ color: "#fff", textAlign: "center", backgroundColor: "rgba(0,0,0,0.6)", padding: 10, borderRadius: 10 }}>
          {note ?? "Point the camera at a payment QR code."}
        </Text>
      </View>
    </View>
  );
}
