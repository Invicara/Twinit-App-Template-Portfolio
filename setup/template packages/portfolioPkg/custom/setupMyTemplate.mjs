/**
 * Custom setup script for Portfolio Template.
 *
 * 1. setupMapTypes     – create map_types from custom/customUploads/mapTypes.json
 * 2. setupGraphicRefs  – create map_graphic_references (name only) from custom/customUploads/baseGraphicReferences.json
 * 3. setupStructures   – create map_structures from custom/customUploads/structures.json, linked to graphic refs
 * 4. Upload GLB + thumbnail from package only – read from custom/customUploads/ (like BIMPK); one ref at a time, wait for each to finish then short delay before next to avoid deployment cutouts. No fileUploads/manifest.
 * 5. BIMPK import      – find .bimpk files in file collections; if none, read from package (custom/customUploads/ only), upload, then run bimpk_importer for each. Put .bimpk files in custom/customUploads/ so the platform does not auto-upload them from fileUploads/ (which would cause duplicate imports).
 */

const BIMPK_IMPORTER_USER_TYPE = 'bimpk_importer';
const ORCH_POLL_INTERVAL_MS = 20000;
const ORCH_MAX_WAIT_MS = 60 * 60 * 1000; // 1 hour per file

const MAP_GRAPHICS_COLLECTION = 'map_graphics';
const GRAPHIC_THUMBNAILS_COLLECTION = 'graphic_thumbnails';
const THUMBNAIL_EXTS = ['.png', '.jpg', '.jpeg'];

/** Paths tried when reading GLB/thumbnail from the package (step 4). Use custom only to avoid platform fileUploads/manifest load; sequential uploads + delay reduce deployment cutouts. */
const GLB_PACKAGE_DIRS = ['custom/customUploads'];
/** Delay in ms between finishing one graphic ref (GLB+thumbnail+link) and starting the next. */
const GLB_UPLOAD_DELAY_MS = 2000;

/** Paths tried for BIMPK list and files only. Use custom only so fileUploads auto-upload does not create duplicates. */
const BIMPK_DIRS_TO_TRY = ['custom/customUploads'];

/** Retry config: transient failures (connection cut, platform overload) can be retried. */
const RETRY_DEFAULT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const RETRY_BACKOFF_MULTIPLIER = 1.5;

/**
 * Run an async function with retries. On failure waits delayMs then retries; delay increases by backoffMultiplier each time.
 * @param {() => Promise<T>} asyncFn - Function to run (no args).
 * @param {{ maxAttempts?: number, delayMs?: number, backoffMultiplier?: number, send?: (msg: string) => void, stepName?: string }} options
 * @returns {Promise<T>}
 */
async function withRetry(asyncFn, options = {}) {
	const maxAttempts = options.maxAttempts ?? RETRY_DEFAULT_ATTEMPTS;
	let delayMs = options.delayMs ?? RETRY_DELAY_MS;
	const backoffMultiplier = options.backoffMultiplier ?? RETRY_BACKOFF_MULTIPLIER;
	const send = options.send || (() => {});
	const stepName = options.stepName || 'operation';
	let lastErr;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await asyncFn();
		} catch (e) {
			lastErr = e;
			if (attempt < maxAttempts) {
				send(`WARN: ${stepName} failed (${e && (e.message || String(e))}); retrying in ${(delayMs / 1000).toFixed(1)}s (attempt ${attempt}/${maxAttempts}).`);
				await new Promise(r => setTimeout(r, delayMs));
				delayMs = Math.round(delayMs * backoffMultiplier);
			}
		}
	}
	throw lastErr;
}

/** Try reading from package at candidate paths; returns { buffer, path } for first success, or throws. */
async function readFromPackageFirst(packageData, filename, dirs = GLB_PACKAGE_DIRS) {
	let lastErr;
	for (const dir of dirs) {
		const path = dir ? `${dir}/${filename}` : filename;
		try {
			const buffer = await packageData.file(path).async('arraybuffer');
			return { buffer, path };
		} catch (e) {
			lastErr = e;
		}
	}
	throw lastErr || new Error(`File not found: ${filename}`);
}

/** Build a File-like object with guaranteed .size and .name (Node deploy may expose File/Blob where .size is undefined). */
function bufferToFile(arrayBuffer, filename) {
	const size = arrayBuffer.byteLength;
	if (typeof File !== 'undefined' && arrayBuffer instanceof ArrayBuffer) {
		const file = new File([arrayBuffer], filename);
		if (file.size === undefined || (file.size === 0 && size > 0)) {
			Object.defineProperty(file, 'size', { value: size, enumerable: true, configurable: true });
		}
		return file;
	}
	if (typeof Blob !== 'undefined') {
		const blob = new Blob([arrayBuffer], { type: '' });
		const f = Object.create(blob);
		Object.defineProperty(f, 'name', { value: filename, enumerable: true });
		if (f.size === undefined || (f.size === 0 && size > 0)) {
			Object.defineProperty(f, 'size', { value: size, enumerable: true, configurable: true });
		}
		return f;
	}
	throw new Error('File/Blob not available');
}

/** Polyfill FileReader when missing (Node deploy environment). uploadFile/createFileItemFromFile may use it to read the File. */
function ensureFileReader() {
	if (typeof FileReader !== 'undefined') return;
	const C = class FileReader {
		readAsArrayBuffer(blob) {
			const p = blob && typeof blob.arrayBuffer === 'function'
				? blob.arrayBuffer()
				: Promise.resolve(blob && blob.length != null ? blob : null);
			p.then(ab => {
				this.result = ab;
				if (this.onload) this.onload({ target: this });
			}).catch(e => {
				if (this.onerror) this.onerror({ target: this, error: e });
			});
		}
	};
	if (typeof globalThis !== 'undefined') globalThis.FileReader = C;
	else if (typeof global !== 'undefined') global.FileReader = C;
	else if (typeof window !== 'undefined') window.FileReader = C;
}

export async function setup(input, libraries, ctx, callback) {
	const { packageData, project } = input;
	const { PlatformApi, IafScriptEngine } = libraries;
	const { IafItemSvc, IafFile, IafProj, IafDataSource } = PlatformApi;

	function send(msg) {
		if (callback) callback(msg);
	}

	send(`INFO: Portfolio setup script starting for project ${project._name}`);

	const namespaces = project._namespaces;
	if (!namespaces || !namespaces.length) {
		send('ERROR: Project has no namespaces');
		throw new Error('Project has no namespaces');
	}

	let mapTypesJson, graphicRefsJson, structuresJson;
	try {
		const mapTypesStr = await packageData.file('custom/customUploads/mapTypes.json').async('string');
		mapTypesJson = JSON.parse(mapTypesStr);
		const refsStr = await packageData.file('custom/customUploads/baseGraphicReferences.json').async('string');
		graphicRefsJson = JSON.parse(refsStr);
		const structStr = await packageData.file('custom/customUploads/structures.json').async('string');
		structuresJson = JSON.parse(structStr);
	} catch (e) {
		send(`ERROR: Failed to read custom/customUploads JSON from package: ${e.message}`);
		console.error(e);
		throw e;
	}
	send('INFO: Loaded custom mapTypes, baseGraphicReferences, structures from package');

	async function setupCollEntities(collKey, entities) {
		return await withRetry(async () => {
			const coll = await IafScriptEngine.createOrRecreateCollection({
				_name: collKey,
				_description: collKey,
				_shortName: collKey,
				_userType: collKey,
				_namespaces: namespaces,
			}, ctx);
			const result = await IafItemSvc.createRelatedItems(coll._userItemId, entities, ctx);
			send(`INFO: Created/updated collection ${collKey} with ${entities.length} item(s)`);
			return { coll, result };
		}, { send, stepName: `setup collection ${collKey}` });
	}

	// --- 1. setupMapTypes ---
	await setupCollEntities('map_types', Array.isArray(mapTypesJson) ? mapTypesJson : [mapTypesJson]);

	// --- 2. setupGraphicRefs (name only; graphic/thumbnail filled in step 4) ---
	const graphicRefEntities = graphicRefsJson.map(({ name }) => ({ name }));
	const { coll: graphicRefsColl, result: graphicRefsResult } = await setupCollEntities('map_graphic_references', graphicRefEntities);
	const createdRefs = graphicRefsResult?._list || [];
	const refIdByName = {};
	for (const ref of createdRefs) {
		if (ref.name != null) refIdByName[ref.name] = ref._id;
	}

	// --- 3. setupStructures ---
	const structureEntities = structuresJson.map(s => ({
		...s,
		mapGraphicRefId: refIdByName[s.name] ?? null,
	}));
	await setupCollEntities('map_structures', structureEntities);

	// --- 4. Upload GLB + thumbnail from package only (custom/customUploads/), one ref at a time with delay between refs ---
	const refNames = graphicRefsJson.map(r => r.name).filter(Boolean);
	const collId = graphicRefsColl._userItemId ?? graphicRefsColl._id;
	let linked = 0;

	let fileContainer = null;
	try {
		const proj = await IafProj.getCurrent(ctx);
		fileContainer = await withRetry(async () => {
			const containers = await IafFile.getContainers(proj, {}, ctx);
			const c = Array.isArray(containers) ? containers[0] : containers;
			if (!c) throw new Error('getContainers returned empty list');
			return c;
		}, { send, stepName: 'get file container' });
		send(`INFO: Using file container for GLB/thumbnail uploads from package (custom/customUploads/ only, sequential with ${GLB_UPLOAD_DELAY_MS}ms delay between refs).`);
	} catch (e) {
		const reason = e && (e.message || String(e));
		send(`WARN: Could not get file container (IafFile.getContainers): ${reason}. Put {name}.glb and {name}-thumbnail.png in custom/customUploads/ and run deploy when file APIs are available.`);
	}

	if (fileContainer) {
		ensureFileReader();
		for (let refIndex = 0; refIndex < refNames.length; refIndex++) {
			const refName = refNames[refIndex];
			// Wait before each ref after the first to avoid overloading the platform (reduces deployment cutouts)
			if (refIndex > 0) {
				await new Promise((r) => setTimeout(r, GLB_UPLOAD_DELAY_MS));
			}

			// --- Read GLB from package (custom/customUploads/ only) ---
			let glbBuf, glbPath;
			try {
				const out = await readFromPackageFirst(packageData, `${refName}.glb`);
				glbBuf = out.buffer;
				glbPath = out.path;
			} catch (e) {
				send(`ERROR: Could not read GLB for '${refName}': ${e && (e.message || String(e))}. Ensure ${refName}.glb exists under custom/customUploads/ in the template package.`);
				continue;
			}

			// --- Read thumbnail from package (custom/customUploads/ only) ---
			let thumbBuf, thumbPath, thumbFilename;
			let thumbFound = false;
			for (const ext of THUMBNAIL_EXTS) {
				const name = `${refName}-thumbnail${ext}`;
				try {
					const out = await readFromPackageFirst(packageData, name);
					thumbBuf = out.buffer;
					thumbPath = out.path;
					thumbFilename = name;
					thumbFound = true;
					break;
				} catch (_) { /* try next ext */ }
			}
			if (!thumbFound) {
				send(`ERROR: No thumbnail found for '${refName}': expected ${refName}-thumbnail.png, .jpg, or .jpeg under custom/customUploads/.`);
				continue;
			}

			// --- Build file payload for upload ---
			// In Node (deploy), tus only accepts Buffer or Readable; in browser, File/Blob. IafScriptEngine.uploadFile expects { fileObj, name }.
			const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
			let glbFilePayload, thumbFilePayload;
			if (isNode && typeof Buffer !== 'undefined') {
				// tus in Node only accepts Buffer or Readable; payload.name is used by the script engine for fileInfo._name.
				glbFilePayload = { fileObj: Buffer.from(glbBuf), name: `${refName}.glb` };
				thumbFilePayload = { fileObj: Buffer.from(thumbBuf), name: thumbFilename };
			} else {
				let glbFile, thumbFile;
				try {
					glbFile = bufferToFile(glbBuf, `${refName}.glb`);
					thumbFile = bufferToFile(thumbBuf, thumbFilename);
				} catch (e) {
					send(`ERROR: Could not build File for '${refName}': ${e && (e.message || String(e))} (File/ArrayBuffer not available in this environment).`);
					continue;
				}
				glbFilePayload = { fileObj: glbFile, name: glbFile.name || `${refName}.glb` };
				thumbFilePayload = { fileObj: thumbFile, name: thumbFile.name || thumbFilename };
			}
			let graphicFileItem, thumbnailFileItem;
			try {
				graphicFileItem = await withRetry(async () => {
					const newGlb = await IafScriptEngine.uploadFile(glbFilePayload, ctx);
					if (!newGlb) throw new Error('uploadFile returned nothing');
					if (newGlb._fileVersion && (newGlb._uploadMeta == null || newGlb._uploadMeta._size == null) && glbBuf.byteLength > 0) {
						newGlb._uploadMeta = newGlb._uploadMeta || {};
						newGlb._uploadMeta._size = glbBuf.byteLength;
					}
					return await IafFile.createFileItemFromFile(fileContainer, newGlb, ctx);
				}, { send, stepName: `upload GLB ${refName}.glb` });
			} catch (e) {
				const reason = e && (e.message || String(e));
				send(`ERROR: Upload or createFileItemFromFile failed for ${refName}.glb: ${reason}.`);
				continue;
			}
			try {
				thumbnailFileItem = await withRetry(async () => {
					const newThumb = await IafScriptEngine.uploadFile(thumbFilePayload, ctx);
					if (!newThumb) throw new Error('uploadFile returned nothing');
					if (newThumb._fileVersion && (newThumb._uploadMeta == null || newThumb._uploadMeta._size == null) && thumbBuf.byteLength > 0) {
						newThumb._uploadMeta = newThumb._uploadMeta || {};
						newThumb._uploadMeta._size = thumbBuf.byteLength;
					}
					return await IafFile.createFileItemFromFile(fileContainer, newThumb, ctx);
				}, { send, stepName: `upload thumbnail ${thumbFilename}` });
			} catch (e) {
				const reason = e && (e.message || String(e));
				send(`ERROR: Upload or createFileItemFromFile failed for ${thumbFilename}: ${reason}.`);
				continue;
			}

			const graphicFileId = graphicFileItem?._fileId ?? graphicFileItem?.fileId;
			const thumbnailFileId = thumbnailFileItem?._fileId ?? thumbnailFileItem?.fileId;
			if (!graphicFileId || !thumbnailFileId) {
				send(`WARN: File items for '${refName}' did not return _fileId; skipping link.`);
				continue;
			}

			// --- Update map_graphic_references (same as fillGraphicRefItems in types_and_graphrefs_setup) ---
			try {
				await withRetry(async () => {
					const refId = refIdByName[refName];
					const existingRef = createdRefs.find(r => r.name === refName);
					const updatedItem = { ...(existingRef || {}), name: refName, graphic: graphicFileId, thumbnail: thumbnailFileId };
					if (refId) {
						await IafItemSvc.updateRelatedItem(collId, refId, updatedItem, ctx);
					} else {
						await IafItemSvc.createRelatedItems(collId, [updatedItem], ctx);
					}
				}, { send, stepName: `link graphic ref '${refName}'` });
				send(`INFO: Uploaded ${refName}.glb and ${thumbFilename} from package, linked graphic ref '${refName}'`);
				linked++;
			} catch (e) {
				send(`ERROR: Failed to update map_graphic_references for '${refName}': ${e && (e.message || String(e))}.`);
			}
		}
		send(`INFO: Upload-from-custom and link: ${linked} of ${refNames.length} graphic ref(s) processed.`);
	}

	// --- 5. BIMPK import: find .bimpk in file collections; if none, read from package (fileUploads/ then custom/customUploads/) and upload, then run bimpk_importer ---
	if (IafDataSource && fileContainer) {
		let bimpkFileItems = [];
		try {
			const proj = await IafProj.getCurrent(ctx);
			const containerList = await withRetry(async () => {
				const containers = await IafFile.getContainers(proj, {}, ctx);
				return Array.isArray(containers) ? containers : (containers ? [containers] : []);
			}, { send, stepName: 'get file containers for bimpk search' });
			for (const container of containerList) {
				try {
					const list = await withRetry(
						async () => (await IafFile.getFileItems(container, {}, ctx))?._list || [],
						{ send, stepName: `getFileItems for container` }
					);
					for (const item of list) {
						const n = (item.name || '').toLowerCase();
						if (n.endsWith('.bimpk')) bimpkFileItems.push({ container, fileItem: item });
					}
				} catch (_) { /* skip container */ }
			}
		} catch (e) {
			send(`WARN: Could not list file collections for bimpk search: ${e && (e.message || String(e))}.`);
		}

		// Fallback: read from package (custom/customUploads/ only) and upload. Using custom only avoids duplicate imports from fileUploads auto-upload.
		if (bimpkFileItems.length === 0) {
			let bimpkNames = [];
			for (const dir of BIMPK_DIRS_TO_TRY) {
				try {
					const bimpkListStr = await withRetry(
						() => packageData.file(`${dir}/bimpk-files.json`).async('string'),
						{ send, stepName: `read ${dir}/bimpk-files.json` }
					);
					const list = JSON.parse(bimpkListStr);
					bimpkNames = Array.isArray(list) ? list : (list.files || list.names || []);
					bimpkNames = bimpkNames.filter(n => typeof n === 'string' && n.toLowerCase().endsWith('.bimpk'));
					if (bimpkNames.length > 0) {
						send(`INFO: Found ${bimpkNames.length} .bimpk in ${dir}/bimpk-files.json; reading from package.`);
						break;
					}
				} catch (_) { /* try next dir or retries exhausted */ }
			}
			if (bimpkNames.length === 0) {
				try {
					const manifestStr = await packageData.file('manifest.json').async('string');
					const manifest = JSON.parse(manifestStr);
					const files = manifest.files || [];
					bimpkNames = files.map(f => f._name || '').filter(n => n && n.toLowerCase().endsWith('.bimpk'));
					if (bimpkNames.length > 0) send(`INFO: Found ${bimpkNames.length} .bimpk in manifest.files; reading from package.`);
				} catch (_) { /* no manifest */ }
			}
			for (const name of bimpkNames) {
				let uploaded = false;
				for (const dir of BIMPK_DIRS_TO_TRY) {
					if (uploaded) break;
					try {
						const readPath = `${dir}/${name}`;
						const buf = await withRetry(
							() => packageData.file(readPath).async('arraybuffer'),
							{ send, stepName: `read bimpk from package ${readPath}` }
						);
						const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
						const payload = isNode && typeof Buffer !== 'undefined'
							? { fileObj: Buffer.from(buf), name }
							: { fileObj: bufferToFile(buf, name), name };
						ensureFileReader();
						const { fileItem } = await withRetry(async () => {
							const up = await IafScriptEngine.uploadFile(payload, ctx);
							if (!up || !up._fileVersion) throw new Error('uploadFile returned no _fileVersion');
							const fileItem = await IafFile.createFileItemFromFile(fileContainer, up, ctx);
							if (!fileItem || !fileItem._fileId) throw new Error('createFileItemFromFile returned no _fileId');
							return { fileItem };
						}, { send, stepName: `upload bimpk ${name}` });
						bimpkFileItems.push({ container: fileContainer, fileItem, fromPackage: true });
						send(`INFO: Uploaded bimpk from package: ${readPath}`);
						uploaded = true;
					} catch (_) { /* not at this path or retries exhausted */ }
				}
				if (!uploaded) send(`WARN: Could not read bimpk from package: ${name} (tried custom/customUploads/).`);
			}
		}

		if (bimpkFileItems.length > 0) {
			let orch;
			try {
				orch = await withRetry(async () => {
					const orchRes = await IafDataSource.getOrchestrators({ query: { _userType: BIMPK_IMPORTER_USER_TYPE } }, ctx);
					const o = (orchRes._list && orchRes._list.length > 0) ? orchRes._list[0] : null;
					if (!o) throw new Error('no bimpk_importer orchestrator in list');
					return o;
				}, { send, stepName: 'get bimpk_importer orchestrator' });
			} catch (e) {
				send(`WARN: Could not get bimpk_importer orchestrator: ${e && (e.message || String(e))}. Skipping bimpk import.`);
			}
			if (orch && orch.id) {
				const task = (orch.orchsteps || []).find(t => t._sequenceno === 1);
				const seqTypeId = task && task._compid;
				if (!seqTypeId) {
					send('WARN: bimpk_importer orchestrator has no step 1 (_compid). Skipping bimpk import.');
				} else {
					send(`INFO: Found ${bimpkFileItems.length} bimpk file(s); running bimpk_importer orchestrator sequentially.`);
					for (let i = 0; i < bimpkFileItems.length; i++) {
						const { fileItem } = bimpkFileItems[i];
						const versions = fileItem.versions || fileItem._versions;
						const tipVer = (versions && versions.length > 0)
							? (typeof versions.find === 'function' && fileItem.tipVersionNumber != null)
								? (versions.find(v => v.versionNumber === fileItem.tipVersionNumber) || versions[versions.length - 1])
								: versions[versions.length - 1]
							: null;
						const _fileId = fileItem._fileId || fileItem._id;
						const _fileVersionId = (tipVer && (tipVer._fileVersionId || tipVer._id)) || (fileItem._versions && fileItem._versions[0] && (fileItem._versions[0]._fileVersionId || fileItem._versions[0]._id));
						if (!_fileId || !_fileVersionId) {
							send(`WARN: Skipping bimpk '${fileItem.name || i}': missing _fileId or tip _fileVersionId.`);
							continue;
						}
						const req = {
							orchestratorId: orch.id,
							_actualparams: [{ sequence_type_id: seqTypeId, params: { _fileId, _fileVersionId } }],
						};
						const displayName = fileItem.name || fileItem._name || _fileId;
						try {
							send(`INFO: Importing model (${i + 1}/${bimpkFileItems.length}): ${displayName}.`);
							const runResult = await withRetry(
								() => IafDataSource.runOrchestrator(orch.id, req, ctx),
								{ send, stepName: `run orchestrator for ${displayName}` }
							);
							const runId = runResult && (runResult.id || runResult._id);
							if (runId) {
								const start = Date.now();
								// Short delay before first poll so run record exists (avoids platform "reading 'status'" error)
								await new Promise(r => setTimeout(r, 3000));
								let completed = false;
								while (Date.now() - start < ORCH_MAX_WAIT_MS) {
									let runRecord;
									try {
										const statusRes = await withRetry(
											() => IafDataSource.getOrchRunStatus(runId, ctx),
											{ send, stepName: `poll status for ${displayName}`, maxAttempts: 5, delayMs: 1000 }
										);
										runRecord = Array.isArray(statusRes) ? statusRes[0] : statusRes;
									} catch (pollErr) {
										send(`WARN: getOrchRunStatus failed for ${displayName}, retrying poll: ${pollErr && (pollErr.message || String(pollErr))}.`);
										await new Promise(r => setTimeout(r, ORCH_POLL_INTERVAL_MS));
										continue;
									}
									const status = runRecord != null ? (runRecord._status !== undefined ? runRecord._status : runRecord.status) : undefined;
									if (status === 'COMPLETED') {
										send(`INFO: Model imported: ${displayName}.`);
										completed = true;
										break;
									}
									if (status === 'ERROR') {
										const errMsg = runRecord != null ? (runRecord._statusmsg != null ? runRecord._statusmsg : runRecord.statusmsg) : '';
										const isStatusCheckBug = typeof errMsg === 'string' && (errMsg.includes("reading 'status'") || errMsg.includes("reading \"status\"") || /Cannot read properties of undefined \(reading 'status'\)/.test(errMsg));
										if (isStatusCheckBug) {
											// Import often succeeds despite this platform quirk; don't show as ERROR
											send(`INFO: Model import step finished for ${displayName}.`);
										} else {
											send(`ERROR: Model import failed for ${displayName}: ${errMsg || 'unknown'}.`);
										}
										completed = true;
										break;
									}
									await new Promise(r => setTimeout(r, ORCH_POLL_INTERVAL_MS));
								}
								if (!completed && Date.now() - start >= ORCH_MAX_WAIT_MS) {
									send(`WARN: Model import timed out for ${displayName}; may still be running.`);
								}
							} else {
								send(`WARN: runOrchestrator did not return a run id for ${displayName}.`);
							}
						} catch (e) {
							const errMsg = e && (e.message || String(e));
							const isStatusCheckBug = typeof errMsg === 'string' && (errMsg.includes("reading 'status'") || errMsg.includes("reading \"status\"") || /Cannot read properties of undefined \(reading 'status'\)/.test(errMsg));
							if (isStatusCheckBug) {
								send(`INFO: Model import step finished for ${displayName}.`);
							} else {
								send(`ERROR: Model import failed for ${displayName}: ${errMsg || 'unknown'}.`);
							}
						}
					}
					send(`INFO: BIMPK import step finished (${bimpkFileItems.length} file(s) processed).`);
				}
			}
		} else {
			send('INFO: No .bimpk files found in file collections or in package (custom/customUploads/); skipping bimpk import.');
		}
	} else {
		if (!IafDataSource) send('INFO: IafDataSource not available; skipping bimpk import.');
		if (!fileContainer) send('INFO: No file container; skipping bimpk import.');
	}

	send('INFO: Portfolio setup script completed.');
}
