import path from "node:path";

export interface RegistryConfig {
  port: number;
  dataDir: string;
  databasePath: string;
  baseUrl: string;
  defaultOwner: string;
  maxPackSize: number;
  authRequired: boolean;
  authSecret: string;
  googleClientId: string;
  googleClientSecret: string;
  deviceCodeTtl: number;
  devicePollInterval: number;
}

export function loadConfig(): RegistryConfig {
  const dataDir = process.env["DATA_DIR"] ?? "./.data";
  return {
    port: parseInt(process.env["PORT"] ?? "3002", 10),
    dataDir,
    databasePath:
      process.env["DATABASE_PATH"] ?? path.join(dataDir, "registry.db"),
    baseUrl: process.env["BASE_URL"] ?? "http://localhost:3002",
    defaultOwner: process.env["DEFAULT_OWNER"] ?? "local",
    maxPackSize: parseInt(
      process.env["MAX_PACK_SIZE"] ?? "104857600",
      10,
    ),
    authRequired: process.env["AUTH_REQUIRED"] === "true",
    authSecret: process.env["AUTH_SECRET"] ?? "dev-secret-change-me",
    googleClientId: process.env["GOOGLE_CLIENT_ID"] ?? "",
    googleClientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
    deviceCodeTtl: parseInt(
      process.env["DEVICE_CODE_TTL"] ?? "900",
      10,
    ),
    devicePollInterval: parseInt(
      process.env["DEVICE_POLL_INTERVAL"] ?? "5",
      10,
    ),
  };
}
