const CURRENT_MAKER_VERSION = '2.1.0'
const MIGRATE_PROJECT_VERSIONS = ['2.0.0']

const _enableGis = async (stepNum, project, scriptTemplates, libraries, callback) => {

	const { IafProj, IafPassSvc, IafDataSource, IafPermission } = libraries.PlatformApi
	const { IafScriptEngine } = libraries

	// create or recrate a secrets encrypted collection to store sensitive data
	let secretsCollection = await IafScriptEngine.createOrRecreateCollection({
			_name: `Secrets Collection`,
			_shortName: "secrets_coll",
			_description: "Named User Collection to store secrets data",
			_namespaces: project._namespaces,
			_userType: "secrets",
			_encryptionEnabled: true
		}
	)

	console.log(`STEP ${stepNum}: Created Secrets Collection`, secretsCollection)
	if (callback) callback(`STEP ${stepNum++}: Created Secrets Collection`)

	// add the Mapbox authorization key script that will be run by the
	// Mapbox authorization instant orchestrator. It will use the encrypted
	// mapbox key stored in the above collection to fetch a temporary
	// mapbox access key for the viewer in the user interface.
	let mapboxTemplateScript = scriptTemplates.find(st => st._name === "mapboxTemplate")
	console.log(mapboxTemplateScript)
	let newMapboxScript = await IafProj.addScript(project, {
		_name: 'mapbox',
		_shortName: 'mapbox',
		_userType: 'mapbox',
		_version: {
			_userData: mapboxTemplateScript._versions[0]._userData
		}
	})
	console.log(`STEP ${stepNum}: mapbox script`, newMapboxScript)
	if (callback) callback(`STEP ${stepNum++}: Created Mapbox Script`)

	// create the permission profile for the Mapbox authorization instant orchestrator
	// so that it can access the secrets collection
	let permProfileResp = await IafPassSvc.createPermissionProfiles(
		[
			{
				_name: "Secrets orchestrator perms",
				_userType: "secrets_perm",
				_namespaces: [project._namespaces[0]],
				_permissions: [
					{
						_actions: ["READ", "SHARE"],
						_namespace: project._namespaces[0],
						_resourceDesc: {
							_irn: `passportsvc:workspace:${project._id}`,
						},
					},
					{
						_actions: ["READ"],
						_namespace: project._namespaces[0],
						_resourceDesc: {
							_irn: secretsCollection._irn,
						}
					},
					{
						_actions: ["READ"],
						_namespace: project._namespaces[0],
						_resourceDesc: {
							_irn: newMapboxScript._irn,
						}
					}
				]
			}
		]
	)

	let permProfile = permProfileResp._list[0]

	console.log(`STEP ${stepNum}: secrets perm profile`, permProfile)
	if (callback) callback(`STEP ${stepNum++}: Created Secrets Perm Profile`)

	// create the Mapbox authorization instant orchestrator
	// assigning the permission profile from above to it
	const mapboxOrchResp = await IafDataSource.createOrchestrator({
		_name: "Request MapBox Token",
		_description: "Requests a MapBox token for a user",
		_namespaces: project._namespaces,
		_userType: "mapbox_temp_token",
		_schemaversion: "2.0",
		_instant: true,
		_permissionprofileid: permProfile._id,
		_params: {
			tasks: [
				{
					name: "default_script_target",
					_actualparams: {
						userType: "mapbox",
						_scriptName: "fetchMapboxToken"
					},
					_sequenceno: 1,
				}
			]
		}
   })

	console.log(`STEP ${stepNum}: mapbox token orchestrator`, mapboxOrchResp)
	if (callback) callback(`STEP ${stepNum++}: Created Mapbox token orchestrator`)

	// Admins already have full permission to the project and can run the orchestrator
	// but Viewers do not (they only have read only to everything), so we need to add
	// a permission to the Viewers user group to allow them to run the mapbox orchestrator
	// to generate tokens for the viewer
	let userGroups = await IafProj.getUserGroups(project)
	let viewersGroup = userGroups.find(ug => ug._name === 'Viewers')

	const viewerPermResp = await IafPermission.createDatasourcePermissions([{
		_actions: [ IafPermission.PermConst.Action.Run ],
		_namespace: project._namespaces[0],
		_resourceDesc: {
			_irn: `${IafPermission.Resources.Orchestrator.Irn}${mapboxOrchResp.id}`
		},
		_user: {
			_id: viewersGroup._id,
			_type: IafPermission.PermConst.UserType.UserGroup
		}
	}])

	console.log(`STEP ${stepNum}: Viewers permission added for mapbox orchestrator`, viewerPermResp)
	if (callback) callback(`STEP ${stepNum++}: Viewers permission added for mapbox orchestrator`)

	return stepNum

}

const _updatePermissions = async (stepNum, project, libraries, callback) => {
	// we need to update the permissions for the Viewers user group, as orginally the group
	// was given full read permissions to all the services on Twinit. However, we do not want
	// Viewers to have access to the secrets NamedUserCollection. SO instead we need to remove
	// Viewers permission to read everything and create finer grained permssions instead.

	const { IafProj, IafPassSvc, IafPermission } = libraries.PlatformApi

	// get the viewers user group
	let allUserGroups = await IafProj.getUserGroups(project)
	let viewerGroup = allUserGroups.find(ug => ug._name === 'Viewers')

	// get the permissions assigned to the Viewers user group
	let viewerPerms = await IafPassSvc.getUsergroupPermissions(viewerGroup._id)
	console.log(`STEP ${stepNum}: Viewers permission before update`, viewerPerms._list)

	// this is the original permission gving Viewers read to a Twinit services
	// we will delete this permission
	let allReadPerms = viewerPerms._list.find(p => p._resourceDesc._irn === "*:*:*")
	
	// we will update the existing RUN permission for the Mapbox orchestrator to
	// include READ so that the Viewers can see the orchestrator
	let datasourcesPerm = viewerPerms._list.find(p => p._actions.includes('RUN'))
	datasourcesPerm._actions.push('READ')

	// this is the base permission objec to asign a READ permission to the Viewers
	// user group in this project. We will use to create fine grain permissions to
	// replace the broad read all permission
	const basePerm = {
		_namespace: project._namespaces[0],
		_user: {
			_id: viewerGroup._id,
			_type: "usergroup"
		},
		_actions: [ IafPermission.PermConst.Action.Read ]
	}

	// give Viewers READ to everything in the file service
	let fileReadPerms = Object.assign({}, basePerm, {
		_resourceDesc: {
			_irn: `${IafPermission.Resources.File.Irn}*`
		}
	})

	// give Viewers READ to model composite items
	let compositeItemReadPerms = Object.assign({}, basePerm, {
		_resourceDesc: {
			_irn: `${IafPermission.Resources.NamedUserItem.Irn}*`,
			_criteria: {
				_userType: 'bim_model_version'
			}
		}
	})

	// give Viewers READ to model element collections
	let elementItemReadPerms = Object.assign({}, basePerm, {
		_resourceDesc: {
			_irn: `${IafPermission.Resources.NamedUserItem.Irn}*`,
			_criteria: {
				_userType: 'rvt_elements'
			}
		}
	})

	// give Viewers READ to model element property collections
	let elementPropsItemReadPerms = Object.assign({}, basePerm, {
		_resourceDesc: {
			_irn: `${IafPermission.Resources.NamedUserItem.Irn}*`,
			_criteria: {
				_userType: 'rvt_element_props'
			}
		}
	})

	// give Viewers READ to model element type property collections
	let elementTypesItemReadPerms = Object.assign({}, basePerm, {
		_resourceDesc: {
			_irn: `${IafPermission.Resources.NamedUserItem.Irn}*`,
			_criteria: {
				_userType: 'rvt_type_elements'
			}
		}
	})

	// give Viewers READ to model geometry view collections
	let geomViewsItemReadPerms = Object.assign({}, basePerm, {
		_resourceDesc: {
			_irn: `${IafPermission.Resources.NamedUserItem.Irn}*`,
			_criteria: {
				_userType: 'bim_model_geomviews'
			}
		}
	})

	// give Viewers READ to model geometry resources collections
	let geomResourcesItemReadPerms = Object.assign({}, basePerm, {
		_resourceDesc: {
			_irn: `${IafPermission.Resources.NamedUserItem.Irn}*`,
			_criteria: {
				_userType: 'bim_model_geomresources'
			}
		}
	})

	// give Viewers READ to model data cache collections
	let dataCacheItemReadPerms = Object.assign({}, basePerm, {
		_resourceDesc: {
			_irn: `${IafPermission.Resources.NamedUserItem.Irn}*`,
			_criteria: {
				_userType: 'data_cache'
			}
		}
	})

	let sharedContainerReadPerms = Object.assign({}, basePerm, {
		_resourceDesc: {
			_irn: `${IafPermission.Resources.NamedUserItem.Irn}*`,
			_criteria: {
				_userType: 'file_container'
			}
		}
	})

	// give Viewers READ to workspaces that they belong to
	let WorkspacePerm = Object.assign({}, basePerm, {
		_resourceDesc: {
			_irn: `${IafPermission.Resources.Workspace.Irn}*`,
		}
	})

	// udpate and create new permissions
	await IafPermission.updateDatasourcePermissions([datasourcesPerm])

	await IafPermission.createFilePermissions([fileReadPerms])

	await IafPermission.createItemPermissions([
		compositeItemReadPerms,
		elementItemReadPerms,
		elementPropsItemReadPerms,
		elementTypesItemReadPerms,
		geomViewsItemReadPerms,
		geomResourcesItemReadPerms,
		dataCacheItemReadPerms,
		sharedContainerReadPerms,
	])

	await IafPermission.createPassPermissions([WorkspacePerm])

	// delete the old READ all permission
	if (allReadPerms) await IafPassSvc.deletePermission(allReadPerms._id)

	let updatedViewerPerms = await IafPassSvc.getUsergroupPermissions(viewerGroup._id)
	console.log(`STEP ${stepNum}: Viewers permission after update`, updatedViewerPerms._list)
	if (callback) callback(`STEP ${stepNum++}: Updated Viewer Permissions`)

	return stepNum

}

const _alwaysPatchAdminPermExists = async(IafPermission, IafPassSvc, adminGroup, viewerGroup) => {

	// chck o se if th permission allowing Admins to manag the Viewer user group already exists
	let adminPerms = await IafPassSvc.getUsergroupPermissions(adminGroup._id)
	let adminViewerPerm = adminPerms._list.find(p => p._resourceDesc?._irn === `passportsvc:usergroup:${viewerGroup._id}`)
	console.log('existing', adminViewerPerm)

	// if the permision does not exist create it
	if (!adminViewerPerm) {

		let adminReportersAllPerm = await IafPermission.constructPermObjWithActions(
			[IafPermission.PermConst.Action.All],
			viewerGroup._namespaces[0],
			adminGroup._id,
			'passportsvc:usergroup:',
			viewerGroup._id,
			false,
			false
		)

		let passPermsResult = await IafPermission.createPassPermissions([adminReportersAllPerm])
		console.log('Created Admin Viewer Managemenet Permission', JSON.stringify(passPermsResult))
	}
}

let scriptModule = {
	async getCurrentMakerVersion() {
		return  { CURRENT_MAKER_VERSION, MIGRATE_PROJECT_VERSIONS }
	},
	// input { projName: <REQUIRED>, projDesc: <OPTIONAL> }
	async createNewQuickModelViewProject(input, libraries, ctx, callback) {

		const { IafProj, IafUserGroup, IafWorkspace, IafDataSource, IafPermission, IafPassSvc } = libraries.PlatformApi

		const {
			projName,	// REQUIRED: name of the new project to create
			projDesc 	// description of the new project to create
		} = input

		if (!projName || !projName.length) {
			throw("New Projects Require a Name!")
		}

		if (callback) callback(`Beginning creation of project: ${projName}. Detailed results in browser console.`)

		let projectMakerProject = await IafProj.getCurrent()

		// retrieve user config templates from this project (the project maker project)
		let userConfigTemplates = await IafProj.getUserConfigs(projectMakerProject, {_userType: 'quick-temp'})
		let scriptTemplates = await IafProj.getScripts(projectMakerProject, {query: {_userType: 'quick-temp'}})
		console.log('STEP 1: userConfigTemplates', userConfigTemplates)
		console.log('STEP 1: scriptTemplates', scriptTemplates)
		if (callback) callback(`STEP 1: Retrieved New Project Templates`)

		// create new project
		let newProject = (await IafProj.createProject({
			_name: projName,
			_description: !!projDesc && projDesc.length ? projDesc : projName,
			_shortName: projName.slice(0,6),
			_userAttributes: {
				nextScriptEngine: true,
				quickModelView: {
					originalVersion: CURRENT_MAKER_VERSION,
					currentVersion: CURRENT_MAKER_VERSION
				}
			}
		}))._list[0]
		console.log('STEP 2: newProject', newProject)
		if (callback) callback(`STEP 2: Created New Project: ${newProject._name} ${newProject._id}`)

		try {
			await IafProj.switchProject(newProject._id)
			if (callback) callback(`STEP 3: Now working in ${newProject._name}`)

			// create admin user group
			let adminGroup = (await IafProj.addUserGroups(newProject, [{
				_name: 'Admin',
				_shortName: 'Admin',
				_description: 'Admin user group',
				permissions: {
					accessAll: true
				}
			}]))[0]
			console.log('STEP 4: adminGroup', adminGroup)
			if (callback) callback(`STEP 4: Created Admin User Group ${adminGroup._id}`)

			// create admin user config
			let adminUCTemplate = userConfigTemplates.find(uct => uct._name === 'QuickViewAdminConfigTemplate')
			let adminUserConfig = await IafProj.addUserConfig(newProject, {
				_name: 'QuickViewAdminConfig',
				_shortName: 'QuickViewAdminConfig',
				_userType: 'quick-view',
				_version: {
					_userData: adminUCTemplate._versions[0]._userData
				}
			})
			console.log('STEP 5: adminUserConfig', adminUserConfig)
			if (callback) callback(`STEP 5: Created Admin User Config ${adminUserConfig._id}`)

			// relate admin config to admin user group
			// this cannot be done during user group create
			// must be done as a later edit to the user group
			const adminConfigInfo = { _id: adminUserConfig._id, _name: adminUserConfig._name }
			if (!adminGroup._userAttributes) {
				adminGroup._userAttributes = { userConfigs: [ adminConfigInfo ]}
			} else if (!adminGroup._userAttributes.userConfigs) {
				adminGroup._userAttributes.userConfigs = [ adminConfigInfo ]
			} else {
				adminGroup._userAttributes.userConfigs.push(adminConfigInfo)
			}
			let relateAdminConfigResult = await IafUserGroup.update(adminGroup)
			console.log('STEP 6: relateAdminConfigResult', relateAdminConfigResult)
			if (callback) callback(`STEP 6: Related Admin User Config to Admin User Group`)

			// create viewers user group
			let viewerGroup = (await IafProj.addUserGroups(newProject, [{
				_name: 'Viewers',
				_shortName: 'Viewers',
				_description: 'Viewers user group'
			}]))[0]

			// create read only permissions for the viewer user group on across all of Twinit
			let readViewerPermCreate = await IafWorkspace.addAllAccess(newProject, viewerGroup, [ IafPermission.PermConst.Action.Read ])

			await _alwaysPatchAdminPermExists(IafPermission, IafPassSvc, adminGroup, viewerGroup)
			console.log('STEP 7: viewerGroup', viewerGroup, readViewerPermCreate)
			console.log('STEP 7: viewerGroup read permissons create', readViewerPermCreate)
			if (callback) callback(`STEP 7: Created Viewers User Group ${viewerGroup._id}`)

			// create viewers user config
			let viewerUCTemplate = userConfigTemplates.find(uct => uct._name === 'QuickViewViewerConfigTemplate')
			let viewerUserConfig = await IafProj.addUserConfig(newProject, {
				_name: 'QuickViewViewerConfig',
				_shortName: 'QuickViewViewerConfig',
				_userType: 'quick-view',
				_version: {
					_userData: viewerUCTemplate._versions[0]._userData
				}
			})
			console.log('STEP 8: vewerUserConfig', viewerUserConfig)
			if (callback) callback(`STEP 8: Created Viewer User Config ${viewerUserConfig._id}`)
			
			// relate viewer config to viewer user group
			// this cannot be done during user group create
			// must be done as a later edit to the user group
			const viewerConfigInfo = { _id: viewerUserConfig._id, _name: viewerUserConfig._name }
			if (!viewerGroup._userAttributes) {
				viewerGroup._userAttributes = { userConfigs: [ viewerConfigInfo ]}
			} else if (!viewerGroup._userAttributes.userConfigs) {
				viewerGroup._userAttributes.userConfigs = [ viewerConfigInfo ]
			} else {
				viewerGroup._userAttributes.userConfigs.push(viewerConfigInfo)
			}
			let relateViewerConfigResult = await IafUserGroup.update(viewerGroup)
			console.log('STEP 9: relateViewerConfigResult', relateViewerConfigResult)
			if (callback) callback(`STEP 9: Related Viewer User Config to Viewer User Group`)

			// create import helper script
			let importHelperTemplateScript = scriptTemplates.find(st => st._name === "importHelperTemplate")
			console.log(importHelperTemplateScript)
			let newImportScript = await IafProj.addScript(newProject, {
				_name: '_orch Model Import Scripts',
				_shortName: 'importHelper',
				_userType: 'importHelper',
				_version: {
					_userData: importHelperTemplateScript._versions[0]._userData
				}
			})
			console.log('STEP 10: newImportScript', newImportScript)
			if (callback) callback(`STEP 10: Created bimpk Import Script`)

			// create import orchestrator
			let importOrch =  await IafDataSource.createOrchestrator({
				_name: 'Import BIMPK Models',
				_description: 'Orchestrator to import model from BIMPK file',
				_namespaces: newProject._namespaces,
				_userType: 'bimpk_importer', // _userType we will use to find the orchestrator when we want to run it
				_schemaversion: '2.0',
				_params: {
					tasks: [
						{
							// our import helper script that runs importModel from the script
							// uses the parameter passed to it at runtime
							_orchcomp: 'default_script_target',
							_name: 'Import Model from bimpk File',
							'_actualparams': {
								'userType': 'importHelper',
								'_scriptName': 'importModel'
							},
							_sequenceno: 1
						},
						{
							// our import helper script again, but this time running createModelDataCache
							_orchcomp: 'default_script_target',
							_name: 'Post Process Imported Model',
							'_actualparams': {
								'userType': 'importHelper',
								'_scriptName': 'createModelDataCache'
							},
							_sequenceno: 2
						}
					]
				}
			})
			console.log('STEP 11: importOrch', importOrch)
			if (callback) callback(`STEP 11: Created Import Orchestrator`)

			let stepNum = await _enableGis(12, newProject, scriptTemplates, libraries, callback)
			await _updatePermissions(stepNum, newProject, libraries, callback)

		} catch (error) {

			await IafProj.switchProject(projectMakerProject._id)	
			console.error('ERROR: New project creation failed!')
			console.error(error)
			if (callback) callback(`ERROR: New project creation failed! Please check browser console more details.`)
			throw(`ERROR: New project creation failed! Please check browser console more details.`)

		}

		await IafProj.switchProject(projectMakerProject._id)		
		return `New project creation complete!`

	},
	// input { project, version }
	async updateQuickModelViewProject(input, libraries, ctx, callback) {

		const { IafProj, IafScripts, IafUserConfig, IafPassSvc, IafPermission } = libraries.PlatformApi
		const { 	project,	// REQUIRED: the project to migrate
					version 	// REQUIRED: the current version of the project to migrate
		} = input

		if (!project || !version) {
			throw("Project and Version are required!")
		}

		const migrate_2_0_0_to_2_1_0 = async (userConfigTemplates, scriptTemplates) => {

			callback(`Updating project ${project._name}`)
			console.log(`STEP 0: Updating project`, project)
			await IafProj.switchProject(project._id)
			let updateProject = await IafProj.getCurrent()

			let userConfigs = await IafProj.getUserConfigs(updateProject)

			let adminConfig = userConfigs.find(uc => uc._name === 'QuickViewAdminConfig')
			let adminConfigVersion = adminConfig._versions[0]
			let adminTemplate = userConfigTemplates.find(uc => uc._name === 'QuickViewAdminConfigTemplate')._versions[0]
			adminConfigVersion._userData = adminTemplate._userData

			let adminUpdateResult = await IafUserConfig.createVersion(adminConfig._id, adminConfigVersion)
			console.log('STEP 1:', adminConfigVersion, adminUpdateResult)
			callback('STEP 1: Updated Admin User Config')

			let step = await _enableGis(2, updateProject, scriptTemplates, libraries, callback)
			step = await _updatePermissions(step, updateProject, libraries, callback)

			const allUserGroups = await IafProj.getUserGroups(updateProject, ctx)

			const viewerGroup = allUserGroups.find(ug => ug._name === 'Viewers')
			const adminGroup = allUserGroups.find(ug => ug._name === 'Admin')
			await _alwaysPatchAdminPermExists(IafPermission, IafPassSvc, adminGroup, viewerGroup)

			// project updates onyl allowed if _description is present
			if (!updateProject._description) {
				updateProject._description = updateProject._name
			}
			
			if (updateProject._userAttributes?.quickModelView) {
				updateProject._userAttributes.quickModelView.currentVersion = '2.1.0'
			} else if (updateProject._userAttributes?.projectMaker) {
				updateProject._userAttributes.quickModelView = Object.assign({}, updateProject._userAttributes.projectMaker)
				updateProject._userAttributes.quickModelView.currentVersion = '2.1.0'
			}
			let projUpdateResult = await IafProj.update(updateProject)
			console.log(`STEP ${step}:`, updateProject, projUpdateResult)
			callback(`STEP ${step++}: Updated Project Current Version -> 2.1.0`)

		}

		const migrations = [
			{ from: '2.0.0', to: '2.1.0', migrateFunction: migrate_2_0_0_to_2_1_0 }
		]

		const managerProject = await IafProj.getCurrent()

		let currentVer = version
		let nextMigration = migrations.find(m => m.from === currentVer)

		while (nextMigration) {
			callback(`Beginning ${nextMigration.from} -> ${nextMigration.to} migration`)
			try {
				// retrieve user config templates from this project (the project maker project)
				let userConfigTemplates = await IafProj.getUserConfigs(managerProject, {_userType: 'quick-temp'})
				let scriptTemplates = await IafProj.getScripts(managerProject, {query: {_userType: 'quick-temp'}})
				console.log('userConfigTemplates', userConfigTemplates)
				console.log('scriptTemplates', scriptTemplates)
				if (callback) callback(`Retrieved Project Templates`)

				await nextMigration.migrateFunction(userConfigTemplates, scriptTemplates)
				callback(`Completed ${nextMigration.from} -> ${nextMigration.to} migration`)
				currentVer = nextMigration.to
				nextMigration = migrations.find(m => m.from === currentVer)

			} catch (error) {

				console.error(error)
				callback(`ERROR during ${nextMigration.from} -> ${nextMigration.to} migration; check bowser console for more info!`)
				await IafProj.switchProject(managerProject._id)
				return 'ERROR during migration!'

			}
		}

		await IafProj.switchProject(managerProject._id)
		return 'All migrations complete'
	},

}

export default scriptModule