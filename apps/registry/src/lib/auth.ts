import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins/bearer";
import { deviceAuthorization } from "better-auth/plugins/device-authorization";
import type { RegistryConfig } from "../config.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Auth = any;

export function createAuth(
  sqliteDatabase: import("better-sqlite3").Database,
  config: RegistryConfig,
): Auth {
  const socialProviders: Record<string, unknown> = {};
  if (config.googleClientId && config.googleClientSecret) {
    socialProviders.google = {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
    };
  }

  return betterAuth({
    database: sqliteDatabase,
    baseURL: config.baseUrl,
    basePath: "/api/auth",
    secret: config.authSecret,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders,
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
    },
    plugins: [
      bearer(),
      deviceAuthorization({
        expiresIn: `${config.deviceCodeTtl}s` as `${number}s`,
        interval: `${config.devicePollInterval ?? 5}s` as `${number}s`,
        verificationUri: `${config.baseUrl}/device`,
      }),
    ],
  });
}
