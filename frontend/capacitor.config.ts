import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.digitxbd.hishab",
  appName: "Hishab",
  webDir: "dist",
  android: { path: "../mobile/android" },
  server: { hostname: "localhost", androidScheme: "https" },
  loggingBehavior: "none",
};
export default config;
