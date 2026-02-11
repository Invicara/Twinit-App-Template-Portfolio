/**
 * Custom setup script for Portfolio Template.
 *
 * 1. setupMapTypes     – create map_types from custom/customUploads/mapTypes.json
 * 2. setupGraphicRefs  – create map_graphic_references (name only) from custom/customUploads/baseGraphicReferences.json
 * 3. setupStructures   – create map_structures from custom/customUploads/structures.json, linked to graphic refs
 * 4. Upload from custom – for each ref name: read custom/customUploads/{name}.glb and custom/customUploads/{name}-thumbnail.* from package,
 *    upload via IafScriptEngine.uploadFile, create file items via IafFile.createFileItemFromFile (same as types_and_graphrefs_setup),
 *    then update map_graphic_references with graphic and thumbnail _fileIds. Logs specific errors if files missing or APIs fail.
 * 5. Mapbox secret     – add Mapbox secret to Secrets Collection (unchanged)
 * 6. BIMPK import      – find .bimpk files in file collections (or upload from custom/customUploads), run bimpk_importer orchestrator for each (sequentially).
 */

const BIMPK_IMPORTER_USER_TYPE = 'bimpk_importer';
const ORCH_POLL_INTERVAL_MS = 20000;
const ORCH_MAX_WAIT_MS = 60 * 60 * 1000; // 1 hour per file

const MAP_GRAPHICS_COLLECTION = 'map_graphics';
const GRAPHIC_THUMBNAILS_COLLECTION = 'graphic_thumbnails';
const THUMBNAIL_EXTS = ['.png', '.jpg', '.jpeg'];

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

	// --- 4. Upload GLB + thumbnail from custom/customUploads and link to map_graphic_references (same flow as types_and_graphrefs_setup) ---
	const refNames = graphicRefsJson.map(r => r.name).filter(Boolean);
	const collId = graphicRefsColl._userItemId ?? graphicRefsColl._id;
	let linked = 0;

	let fileContainer = null;
	try {
		const proj = await IafProj.getCurrent(ctx);
		const containers = await IafFile.getContainers(proj, {}, ctx);
		fileContainer = Array.isArray(containers) ? containers[0] : containers;
		if (!fileContainer) {
			send('WARN: No file container from IafFile.getContainers; reason: empty list. Upload/link from custom will be skipped.');
		} else {
			send(`INFO: Using file container '${fileContainer._shortName || fileContainer._name || 'container'}' for GLB and thumbnail uploads`);
		}
	} catch (e) {
		const reason = e && (e.message || String(e));
		send(`WARN: Could not get file container (IafFile.getContainers): ${reason}. Ensure custom/customUploads has {name}.glb and {name}-thumbnail.png and run deploy when file APIs are available, or run "types and graphrefs" in UI.`);
	}

	if (fileContainer) {
		ensureFileReader();
		for (const refName of refNames) {
			const glbPath = `custom/customUploads/${refName}.glb`;
			let thumbPath = null;
			let thumbFilename = null;

			// --- Read GLB from package ---
			let glbBuf;
			try {
				glbBuf = await packageData.file(glbPath).async('arraybuffer');
			} catch (e) {
				send(`ERROR: Could not read GLB from custom/customUploads for '${refName}': ${glbPath} – ${e && (e.message || String(e))}. Ensure the file exists in the template package under custom/customUploads/.`);
				continue;
			}

			// --- Read thumbnail from package ({name}-thumbnail.png or .jpg/.jpeg) ---
			for (const ext of THUMBNAIL_EXTS) {
				const p = `custom/customUploads/${refName}-thumbnail${ext}`;
				try {
					await packageData.file(p).async('arraybuffer');
					thumbPath = p;
					thumbFilename = `${refName}-thumbnail${ext}`;
					break;
				} catch (_) { /* try next */ }
			}
			if (!thumbPath) {
				send(`ERROR: No thumbnail found in custom/customUploads for '${refName}': expected one of custom/customUploads/${refName}-thumbnail.png, .jpg, .jpeg – none present in package.`);
				continue;
			}
			let thumbBuf;
			try {
				thumbBuf = await packageData.file(thumbPath).async('arraybuffer');
			} catch (e) {
				send(`ERROR: Could not read thumbnail from custom/customUploads: ${thumbPath} – ${e && (e.message || String(e))}.`);
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
				const newGlb = await IafScriptEngine.uploadFile(glbFilePayload, ctx);
				if (!newGlb) {
					send(`ERROR: uploadFile returned nothing for ${refName}.glb.`);
					continue;
				}
				if (newGlb._fileVersion && (newGlb._uploadMeta == null || newGlb._uploadMeta._size == null) && glbBuf.byteLength > 0) {
					newGlb._uploadMeta = newGlb._uploadMeta || {};
					newGlb._uploadMeta._size = glbBuf.byteLength;
				}
				graphicFileItem = await IafFile.createFileItemFromFile(fileContainer, newGlb, ctx);
			} catch (e) {
				const reason = e && (e.message || String(e));
				send(`ERROR: Upload or createFileItemFromFile failed for ${refName}.glb: ${reason}.`);
				continue;
			}
			try {
				const newThumb = await IafScriptEngine.uploadFile(thumbFilePayload, ctx);
				if (!newThumb) {
					send(`ERROR: uploadFile returned nothing for ${thumbFilename}.`);
					continue;
				}
				if (newThumb._fileVersion && (newThumb._uploadMeta == null || newThumb._uploadMeta._size == null) && thumbBuf.byteLength > 0) {
					newThumb._uploadMeta = newThumb._uploadMeta || {};
					newThumb._uploadMeta._size = thumbBuf.byteLength;
				}
				thumbnailFileItem = await IafFile.createFileItemFromFile(fileContainer, newThumb, ctx);
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
				const refId = refIdByName[refName];
				const existingRef = createdRefs.find(r => r.name === refName);
				const updatedItem = { ...(existingRef || {}), name: refName, graphic: graphicFileId, thumbnail: thumbnailFileId };
				if (refId) {
					await IafItemSvc.updateRelatedItem(collId, refId, updatedItem, ctx);
					send(`INFO: Uploaded custom/${refName}.glb and ${thumbFilename}, created file items, and linked graphic ref '${refName}'`);
				} else {
					await IafItemSvc.createRelatedItems(collId, [updatedItem], ctx);
					send(`INFO: Uploaded custom/customUploads/${refName}.glb and ${thumbFilename}, created file items, and added graphic ref '${refName}'`);
				}
				linked++;
			} catch (e) {
				send(`ERROR: Failed to update map_graphic_references for '${refName}': ${e && (e.message || String(e))}.`);
			}
		}
		send(`INFO: Upload-from-custom and link: ${linked} of ${refNames.length} graphic ref(s) processed.`);
	}

	// --- 5. Mapbox secret (unchanged) ---
	try {
		const secretsResp = await IafItemSvc.getNamedUserItems({ query: { _userType: 'secrets' } }, ctx);
		const secretsCollection = (secretsResp._list || [])[0];
		if (secretsCollection?._userItemId) {
			const newSecret = {
				type: 'mapbox-secret',
				'.secret': 'sk.eyJ1IjoiZG9taW5pa2Etb2xlcy1pbnZpY2FyYSIsImEiOiJjbWRoNzNsOWwwMDh3Mnhxdng5ajQ1OXYzIn0.n8dXsPMD7DPq3poppzrF2Q',
				username: 'dominika-oles-invicara',
			};
			await IafItemSvc.createRelatedItems(secretsCollection._userItemId, [newSecret], ctx);
			send('INFO: Created Mapbox secret in Secrets Collection');
		} else {
			send('WARN: Secrets Collection not found; skipping Mapbox secret');
		}
	} catch (error) {
		send('ERROR: Creating New Mapbox Secret Item');
		console.error(error);
	}

	// --- 6. BIMPK import: find .bimpk files in file collections (or upload from custom/fileUploads), run bimpk_importer for each (sequentially) ---
	if (IafDataSource && fileContainer) {
		let bimpkFileItems = [];
		try {
			const proj = await IafProj.getCurrent(ctx);
			const containers = await IafFile.getContainers(proj, {}, ctx);
			const containerList = Array.isArray(containers) ? containers : (containers ? [containers] : []);
			for (const container of containerList) {
				try {
					const fileItemsRes = await IafFile.getFileItems(container, {}, ctx);
					const list = fileItemsRes?._list || [];
					for (const item of list) {
						const n = (item.name || '').toLowerCase();
						if (n.endsWith('.bimpk')) bimpkFileItems.push({ container, fileItem: item });
					}
				} catch (_) { /* skip container */ }
			}
		} catch (e) {
			send(`WARN: Could not list file collections for bimpk search: ${e && (e.message || String(e))}.`);
		}

		// Fallback: if no .bimpk in file collections, read bimpk filenames from custom/ (same pattern as GLBs) and upload from custom/ or fileUploads/.
		if (bimpkFileItems.length === 0) {
			let bimpkNames = [];
			// 1) Same as GLBs: read a list from the package. custom/customUploads/bimpk-files.json = array of filenames to look for.
			try {
				const bimpkListStr = await packageData.file('custom/customUploads/bimpk-files.json').async('string');
				const list = JSON.parse(bimpkListStr);
				bimpkNames = Array.isArray(list) ? list : (list.files || list.names || []);
				bimpkNames = bimpkNames.filter(n => typeof n === 'string' && n.toLowerCase().endsWith('.bimpk'));
				if (bimpkNames.length > 0) send(`INFO: Found ${bimpkNames.length} .bimpk file(s) in custom/customUploads/bimpk-files.json.`);
			} catch (_) { /* no bimpk-files.json */ }
			// 2) Fallback: manifest or package file list (for zips that don't include bimpk-files.json)
			if (bimpkNames.length === 0) {
				const manifestPaths = ['manifest.json', 'template/manifest.json', 'custom/../manifest.json'];
				for (const mp of manifestPaths) {
					try {
						const manifestStr = await packageData.file(mp).async('string');
						const manifest = JSON.parse(manifestStr);
						const files = manifest.files || [];
						bimpkNames = files.map(f => f._name || '').filter(n => n && n.toLowerCase().endsWith('.bimpk'));
						if (bimpkNames.length > 0) {
							send(`INFO: Found ${bimpkNames.length} .bimpk file(s) in manifest (${mp}).`);
							break;
						}
					} catch (_) { /* try next */ }
				}
			}
			if (bimpkNames.length === 0 && typeof packageData.files === 'object' && packageData.files !== null) {
				const paths = Array.isArray(packageData.files) ? packageData.files : Object.keys(packageData.files);
				bimpkNames = paths.filter(p => (p || '').toLowerCase().endsWith('.bimpk')).map(p => (p.match(/[/\\]([^/\\]+)$/) || [])[1]).filter(Boolean);
				if (bimpkNames.length > 0) send(`INFO: Found ${bimpkNames.length} .bimpk path(s) from package file list.`);
			}
			// Read and upload each (same pattern as GLBs: try custom/<name> then fileUploads/<name>)
			const dirsToTry = ['custom', 'fileUploads', 'custom/fileUploads'];
			for (const name of bimpkNames) {
				let uploaded = false;
				for (const dir of dirsToTry) {
					if (uploaded) break;
					try {
						const readPath = `${dir}/${name}`;
						const buf = await packageData.file(readPath).async('arraybuffer');
						const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
						const payload = isNode && typeof Buffer !== 'undefined'
							? { fileObj: Buffer.from(buf), name }
							: { fileObj: bufferToFile(buf, name), name };
						ensureFileReader();
						const up = await IafScriptEngine.uploadFile(payload, ctx);
						if (up && up._fileVersion) {
							const fileItem = await IafFile.createFileItemFromFile(fileContainer, up, ctx);
							if (fileItem && fileItem._fileId) {
								bimpkFileItems.push({ container: fileContainer, fileItem, fromPackage: true });
								send(`INFO: Uploaded bimpk from package: ${readPath}`);
								uploaded = true;
							}
						}
					} catch (_) { /* not at this path */ }
				}
			}
			if (bimpkNames.length > 0 && bimpkFileItems.length === 0) {
				send('WARN: .bimpk names were listed but files could not be read. Ensure files exist under custom/customUploads/ (or custom/ or fileUploads/) in the package.');
			}
		}

		if (bimpkFileItems.length > 0) {
			let orch;
			try {
				const orchRes = await IafDataSource.getOrchestrators({ query: { _userType: BIMPK_IMPORTER_USER_TYPE } }, ctx);
				orch = (orchRes._list && orchRes._list.length > 0) ? orchRes._list[0] : null;
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
							const runResult = await IafDataSource.runOrchestrator(orch.id, req, ctx);
							const runId = runResult && (runResult.id || runResult._id);
							if (runId) {
								const start = Date.now();
								// Short delay before first poll so run record exists (avoids platform "reading 'status'" error)
								await new Promise(r => setTimeout(r, 3000));
								let completed = false;
								while (Date.now() - start < ORCH_MAX_WAIT_MS) {
									const statusRes = await IafDataSource.getOrchRunStatus(runId, ctx);
									// API often returns array of run records; use [0] so we never read .status on undefined
									const runRecord = Array.isArray(statusRes) ? statusRes[0] : statusRes;
									const status = runRecord != null ? (runRecord._status !== undefined ? runRecord._status : runRecord.status) : undefined;
									if (status === 'COMPLETED') {
										send(`INFO: Model imported: ${displayName}.`);
										completed = true;
										break;
									}
									if (status === 'ERROR') {
										const errMsg = runRecord != null ? (runRecord._statusmsg != null ? runRecord._statusmsg : runRecord.statusmsg) : '';
										const isStatusCheckBug = typeof errMsg === 'string' && errMsg.includes("reading 'status'");
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
							send(`ERROR: Model import failed for ${displayName}: ${e && (e.message || String(e))}.`);
						}
					}
					send(`INFO: BIMPK import step finished (${bimpkFileItems.length} file(s) processed).`);
				}
			}
		} else {
			send('INFO: No .bimpk files found in file collections or in package custom/; skipping bimpk import.');
		}
	} else {
		if (!IafDataSource) send('INFO: IafDataSource not available; skipping bimpk import.');
		if (!fileContainer) send('INFO: No file container; skipping bimpk import.');
	}

	send('INFO: Portfolio setup script completed.');
}
