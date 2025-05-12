// mapbox backend integration scripts

const TOKEN_SCOPES = ['styles:read', "styles:tiles", "fonts:read", "datasets:read", "vision:read"]
const TOKEN_EXPIRY = 3600
const TOKEN_BASE_URL = "https://api.mapbox.com/tokens/v2/"

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

		let expires = new Date(new Date().getTime() + TOKEN_EXPIRY).toISOString()
		let tokenUrl = encodeURI(`${TOKEN_BASE_URL}${secretKey.username}`)

		try {
			
			let tempRequest = await fetch(tokenUrl, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${secretKey['.secret']}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					expires,
					scopes: TOKEN_SCOPES
				})
			})

			if (tempRequest.ok) {
		
				let tempRequestJson = await tempRequest.json()
				result.token = tempRequestJson.token
			} else {

				result.success = false
				let tempRequestJson = await tempRequest.json()
				result.message = tempRequestJson
			}

		} catch (error) {
			result.success = false
			result.message = 'ERROR: Feching temporary token from Mapbox'
		}

	}

	return result
}

function getRunnableScripts() {
	return [
		{name: 'Fetch Mapbox Token', script: 'fetchMapboxToken'}
	]
}
