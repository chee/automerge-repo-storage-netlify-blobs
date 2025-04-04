import fs from "node:fs"
import os from "node:os"

import express from "express"
import {WebSocketServer} from "ws"
import {Repo, type PeerId} from "@automerge/automerge-repo"
import {NodeWSServerAdapter} from "@automerge/automerge-repo-network-websocket"
import BlobAdapter from "./storage.ts"

export class Server {
	#socket: WebSocketServer

	server: ReturnType<import("express").Express["listen"]>

	#readyResolvers = [] as ((...value: any) => void)[]

	#isReady = false

	#repo: Repo

	constructor() {
		const hostname = os.hostname()

		this.#socket = new WebSocketServer({noServer: true})

		const PORT =
			process.env.PORT !== undefined ? parseInt(process.env.PORT) : 3030
		const app = express()
		app.use(express.static("public"))

		this.#repo = new Repo({
			network: [new NodeWSServerAdapter(this.#socket)],
			storage: new BlobAdapter({
				siteID: process.env.NETLIFY_SITE_ID,
				token: process.env.NETLIFY_TOKEN,
				name: process.env.NETLIFY_NAME,
			}),
			peerId: `storage-server-${hostname}` as PeerId,
			async sharePolicy() {
				return false
			},
			enableRemoteHeadsGossiping: true,
		})

		app.get("/", (req, res) => {
			res.send(`🙊 blob server is running`)
		})

		this.server = app.listen(PORT, () => {
			console.info(`Listening on port ${PORT}`)
			this.#isReady = true
			this.#readyResolvers.forEach(resolve => resolve(true))
		})

		this.server.on("upgrade", (request, socket, head) => {
			this.#socket.handleUpgrade(request, socket, head, socket => {
				this.#socket.emit("connection", socket, request)
			})
		})
	}

	async ready() {
		if (this.#isReady) {
			return true
		}

		return new Promise(resolve => {
			this.#readyResolvers.push(resolve)
		})
	}

	close() {
		this.#socket.close()
		this.server.close()
	}
}

const server = new Server()
