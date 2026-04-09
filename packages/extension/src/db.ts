import type { StoredClip, StoredDocument, StoredEdge, StoredActivity } from './types'

const DB_NAME = 'cliproot'
const DB_VERSION = 4

let dbInstance: IDBDatabase | null = null

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result
      const oldVersion = event.oldVersion

      if (oldVersion < 3) {
        // Delete old stores from v1/v2 if they exist
        if (db.objectStoreNames.contains('clips')) {
          db.deleteObjectStore('clips')
        }
        if (db.objectStoreNames.contains('pastes')) {
          db.deleteObjectStore('pastes')
        }

        // Create new CRP-aligned stores
        const documents = db.createObjectStore('documents', { keyPath: 'id' })
        documents.createIndex('uri', 'uri', { unique: false })

        const clips = db.createObjectStore('clips', { keyPath: 'clipHash' })
        clips.createIndex('textHash', 'textHash', { unique: false })
        clips.createIndex('documentId', 'documentId', { unique: false })

        const activities = db.createObjectStore('activities', { keyPath: 'id' })
        activities.createIndex('createdAt', 'createdAt', { unique: false })
      }

      if (oldVersion < 4) {
        if (db.objectStoreNames.contains('derivationEdges')) {
          db.deleteObjectStore('derivationEdges')
        }
        if (!db.objectStoreNames.contains('edges')) {
          const edges = db.createObjectStore('edges', { keyPath: 'id' })
          edges.createIndex('objectRef', 'objectRef', { unique: false })
          edges.createIndex('subjectRef', 'subjectRef', { unique: false })
        }
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getDb(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance

  const db = await openDb()
  db.onclose = () => {
    dbInstance = null
  }
  dbInstance = db
  return db
}

export async function storeDocument(doc: StoredDocument): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readwrite')
    const store = tx.objectStore('documents')
    const request = store.put(doc)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function storeClip(clip: StoredClip): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('clips', 'readwrite')
    const store = tx.objectStore('clips')
    const request = store.put(clip)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function storeEdge(edge: StoredEdge): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('edges', 'readwrite')
    const store = tx.objectStore('edges')
    const request = store.put(edge)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function storeActivity(activity: StoredActivity): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('activities', 'readwrite')
    const store = tx.objectStore('activities')
    const request = store.put(activity)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function findClipsByTextHash(textHash: string): Promise<StoredClip[]> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('clips', 'readonly')
    const store = tx.objectStore('clips')
    const index = store.index('textHash')
    const request = index.getAll(textHash)
    request.onsuccess = () => resolve(request.result as StoredClip[])
    request.onerror = () => reject(request.error)
  })
}

export async function getClipByHash(clipHash: string): Promise<StoredClip | undefined> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('clips', 'readonly')
    const store = tx.objectStore('clips')
    const request = store.get(clipHash)
    request.onsuccess = () => resolve(request.result as StoredClip | undefined)
    request.onerror = () => reject(request.error)
  })
}

export async function findEdgesByObjectRef(objectRef: string): Promise<StoredEdge[]> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('edges', 'readonly')
    const store = tx.objectStore('edges')
    const index = store.index('objectRef')
    const request = index.getAll(objectRef)
    request.onsuccess = () => resolve(request.result as StoredEdge[])
    request.onerror = () => reject(request.error)
  })
}

export async function findEdgesBySubjectRef(subjectRef: string): Promise<StoredEdge[]> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('edges', 'readonly')
    const store = tx.objectStore('edges')
    const index = store.index('subjectRef')
    const request = index.getAll(subjectRef)
    request.onsuccess = () => resolve(request.result as StoredEdge[])
    request.onerror = () => reject(request.error)
  })
}

export async function searchClips(query: string): Promise<StoredClip[]> {
  const db = await getDb()
  const lowerQuery = query.toLowerCase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('clips', 'readonly')
    const store = tx.objectStore('clips')
    const request = store.openCursor()
    const results: StoredClip[] = []

    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve(results)
        return
      }
      const clip = cursor.value as StoredClip
      if (clip.content.toLowerCase().includes(lowerQuery)) {
        results.push(clip)
      }
      cursor.continue()
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getDocumentById(id: string): Promise<StoredDocument | undefined> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readonly')
    const store = tx.objectStore('documents')
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result as StoredDocument | undefined)
    request.onerror = () => reject(request.error)
  })
}

export async function findDocumentsByUri(uri: string): Promise<StoredDocument[]> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readonly')
    const store = tx.objectStore('documents')
    const index = store.index('uri')
    const request = index.getAll(uri)
    request.onsuccess = () => resolve(request.result as StoredDocument[])
    request.onerror = () => reject(request.error)
  })
}

export async function findClipsByDocumentId(documentId: string): Promise<StoredClip[]> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('clips', 'readonly')
    const store = tx.objectStore('clips')
    const index = store.index('documentId')
    const request = index.getAll(documentId)
    request.onsuccess = () => resolve(request.result as StoredClip[])
    request.onerror = () => reject(request.error)
  })
}
