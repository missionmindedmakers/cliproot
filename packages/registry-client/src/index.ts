export { RegistryClient } from "./client.js";
export type { RegistryClientOptions } from "./client.js";

export type {
  PublishPackResult,
  PublishClipsResult,
  ProjectSummary,
  ProjectDetail,
  ClipDetail,
  LineageClip,
  LineageResponse,
  SearchResult,
  RegistryIndexConfig,
  PublishClipsRequest,
  SearchParams,
  ListProjectsParams,
  SessionUser,
  SessionInfo,
} from "./types.js";

export {
  RegistryError,
  RegistryAuthError,
  RegistryNotFoundError,
} from "./errors.js";

export type { TokenStorage } from "./token-storage.js";
export {
  LocalStorageTokenStore,
  ChromeStorageTokenStore,
  MemoryTokenStore,
} from "./token-storage.js";

export { getAuthUrl, getSignUpUrl, checkSession } from "./auth.js";
