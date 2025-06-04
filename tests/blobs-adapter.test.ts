import "dotenv/config"
import {runStorageAdapterTests} from "./storage-adapter-tests.ts"
import NetlifyBlobsAdapter from "../source/adapter.ts"

function createStorageAdapterTest() {
	return async function () {
		const adapter = new NetlifyBlobsAdapter({
			siteID: process.env.NETLIFY_SITE_ID,
			token: process.env.NETLIFY_TOKEN,
			name: process.env.NETLIFY_NAME,
		})
		return {adapter, async teardown() {}}
	}
}

runStorageAdapterTests(createStorageAdapterTest())
