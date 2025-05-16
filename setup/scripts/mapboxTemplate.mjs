// Mapbox backend integration scripts
// Mapbox token API docs: https://docs.mapbox.com/api/accounts/tokens/

// Mapbox scopes for the temporary Mapbox token
const TOKEN_SCOPES = ['styles:read', "styles:tiles", "fonts:read", "datasets:read", "vision:read"]

// temporary token xpires in 1 hours (Mapbox allowed Max)
const TOKEN_EXPIRY = 3600

// Mapbox token url
const TOKEN_BASE_URL = "https://api.mapbox.com/tokens/v2/"

// fetches a temporary token from Mapbox using a secret key and user name stored in the Secrets collection
async function fetchMapboxToken(input, libraries, ctx) {

	const { IafItemSvc } = libraries.PlatformApi

	let result = {
		success: true,
		message: '',
		warning: '',
		token: ''
	}

	let secretsCollectionResp = await IafItemSvc.getNamedUserItems({query:{ _userType: 'secrets'}}, ctx)
	if (secretsCollectionResp._total < 1) {
		result.success = false
		result.message = 'ERROR: Secrets collection not found!'
	}

	let secretCollection = secretsCollectionResp._list[0]
	if (secretsCollectionResp._total > 1) {
		result.warning = 'WARNING: Multiple Secrets collections found - using first returned'
	}

	let secretResp = await IafItemSvc.getRelatedItems(secretCollection._userItemId, {query: {type: 'mapbox-secret'}}, ctx)
	if (secretResp._total < 1) {
		result.success = false
		result.message = 'ERROR: Mapbox secret key not found!'
	}

	let secretKey = secretResp._list[0]
	if (secretResp._total > 1) {
		result.warning = 'WARNING: Multiple mapbox secret keys found - using first returned'
	}

	if (result.success) {

		// create an ISO date tring for the token expiration = 1 hour
		let expires = new Date(new Date().getTime() + TOKEN_EXPIRY * 1000).toISOString()

		// add the user name to the Mapbox token url
		// and encode the url
		let tokenUrl = encodeURI(`${TOKEN_BASE_URL}${secretKey.username}`)

		try {
			
			let tempRequest = await fetch(tokenUrl, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${secretKey['.secret']}`, // uss secret key fetched from Secrets collection
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					expires,						// temp token expiration
					scopes: TOKEN_SCOPES		// temp token Mapbox scopes
				})
			})

			// this handles running this script in an orchestrator or in vscode
			// in an orchestrator fetch returns the json directly, in vscode or browser you need to extract it from the response
			let tempRequestJson = await (typeof tempRequest['json'] === 'function' ? tempRequest.json() : tempRequest)

			if (tempRequestJson.token) {

				result.token = tempRequestJson.token
				result.expires = expires
			} else {

				result.success = false
				result.message = tempRequestJson
				result.other = tempRequest
			}

		} catch (error) {
			result.success = false
			result.message = `ERROR: Fetching temporary token from Mapbox - ${error.toString()}`
		}

	}

	return result
}

function getRunnableScripts() {
	return [
		{name: 'Fetch Mapbox Token', script: 'fetchMapboxToken'}
	]
}
