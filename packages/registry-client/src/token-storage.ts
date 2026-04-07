export interface TokenStorage {
  getToken(): Promise<string | null>;
  setToken(token: string | null): Promise<void>;
  getRegistryUrl(): Promise<string | null>;
  setRegistryUrl(url: string | null): Promise<void>;
}

/** Token storage backed by `window.localStorage`. */
export class LocalStorageTokenStore implements TokenStorage {
  private readonly prefix: string;

  constructor(prefix = "cliproot:") {
    this.prefix = prefix;
  }

  async getToken(): Promise<string | null> {
    return localStorage.getItem(`${this.prefix}registryToken`);
  }

  async setToken(token: string | null): Promise<void> {
    if (token === null) {
      localStorage.removeItem(`${this.prefix}registryToken`);
    } else {
      localStorage.setItem(`${this.prefix}registryToken`, token);
    }
  }

  async getRegistryUrl(): Promise<string | null> {
    return localStorage.getItem(`${this.prefix}registryUrl`);
  }

  async setRegistryUrl(url: string | null): Promise<void> {
    if (url === null) {
      localStorage.removeItem(`${this.prefix}registryUrl`);
    } else {
      localStorage.setItem(`${this.prefix}registryUrl`, url);
    }
  }
}

/** Token storage backed by `chrome.storage.local`. */
export class ChromeStorageTokenStore implements TokenStorage {
  async getToken(): Promise<string | null> {
    const result = await chrome.storage.local.get("registryToken");
    return (result["registryToken"] as string) ?? null;
  }

  async setToken(token: string | null): Promise<void> {
    if (token === null) {
      await chrome.storage.local.remove("registryToken");
    } else {
      await chrome.storage.local.set({ registryToken: token });
    }
  }

  async getRegistryUrl(): Promise<string | null> {
    const result = await chrome.storage.local.get("registryUrl");
    return (result["registryUrl"] as string) ?? null;
  }

  async setRegistryUrl(url: string | null): Promise<void> {
    if (url === null) {
      await chrome.storage.local.remove("registryUrl");
    } else {
      await chrome.storage.local.set({ registryUrl: url });
    }
  }
}

/** In-memory token storage for tests. */
export class MemoryTokenStore implements TokenStorage {
  private token: string | null = null;
  private url: string | null = null;

  async getToken(): Promise<string | null> {
    return this.token;
  }

  async setToken(token: string | null): Promise<void> {
    this.token = token;
  }

  async getRegistryUrl(): Promise<string | null> {
    return this.url;
  }

  async setRegistryUrl(url: string | null): Promise<void> {
    this.url = url;
  }
}
