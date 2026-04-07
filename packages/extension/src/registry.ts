import { RegistryClient, ChromeStorageTokenStore } from '@cliproot/registry-client'

let client: RegistryClient | null = null

export function getRegistryClient(): RegistryClient {
  if (!client) {
    client = new RegistryClient({ tokenStore: new ChromeStorageTokenStore() })
  }
  return client
}
