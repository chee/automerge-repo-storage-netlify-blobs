import {getStore, type GetStoreOptions, type Store} from "@netlify/blobs"
import type {
	Chunk,
	StorageAdapterInterface,
	StorageKey,
} from "@automerge/automerge-repo/slim"

export type NetlifyBlobAdapterOptions = GetStoreOptions

export default class NetlifyBlobAdapter implements StorageAdapterInterface {
	private store: Store
	private cache: Map<string, Uint8Array> = new Map()
	constructor(options: NetlifyBlobAdapterOptions = {}) {
		try {
			this.store = getStore(options)
		} catch (error) {
			console.error("Error initializing NetlifyBlobAdapter:", error)
			throw error
		}
	}

	async load(storageKey: StorageKey): Promise<Uint8Array | undefined> {
		const key = getKey(storageKey)
		if (this.cache.has(key)) return this.cache.get(key)
		const blob = await this.store.get(key, {type: "blob"})

		if (blob?.size) {
			const bytes = await blob.bytes()
			this.cache.set(key, bytes)
			return bytes
		} else {
			return undefined
		}
	}

	async save(storageKey: StorageKey, data: Uint8Array): Promise<void> {
		const key = getKey(storageKey)
		this.cache.set(key, data)
		await this.store.set(key, new Blob([data]))
	}

	async remove(storageKey: StorageKey): Promise<void> {
		const key = getKey(storageKey)
		this.cache.delete(key)
		await this.store.delete(key)
	}

	async loadRange(storageKeyPrefix: StorageKey): Promise<Chunk[]> {
		const keyfix = getKey(storageKeyPrefix)
		const listResult = this.store.list({prefix: keyfix})
		const chunks: Chunk[] = []
		const skip: string[] = []
		for (const [key, data] of this.cache.entries()) {
			if (key.startsWith(keyfix)) {
				skip.push(key)
				chunks.push({key: ungetKey(key), data})
			}
		}
		await listResult.then(list => {
			return list.blobs.map(async ({key}) => {
				if (skip.includes(key)) return
				const blob = await this.store.get(key, {type: "blob"})

				if (blob?.size) {
					const data = await blob.bytes()
					this.cache.set(key, data)
					chunks.push({key: ungetKey(key), data})
				}
			})
		})

		return chunks
	}

	async removeRange(storageKeyPrefix: StorageKey): Promise<void> {
		const keyfix = getKey(storageKeyPrefix)
		const listResult = this.store.list({prefix: keyfix})
		for (const key of this.cache.keys()) {
			if (key.startsWith(keyfix)) {
				this.cache.delete(key)
			}
		}

		await listResult.then(list => {
			return list.blobs.map(async ({key}) => {
				await this.store.delete(key)
			})
		})
	}
}

function getKey(storageKey: StorageKey): string {
	return storageKey.join("/")
}

function ungetKey(storageKey: string): StorageKey {
	return storageKey.split("/")
}
