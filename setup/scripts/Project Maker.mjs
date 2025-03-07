const CURRENT_MAKER_VERSION = '2.0.0'

let scriptModule = {
	async getCurrentMakerVersion() {
		return CURRENT_MAKER_VERSION
	},
	// input { projName: <REQUIRED>, projDesc: <OPTIONAL> }
	async createNewQuickModelViewProject(input, libraries, ctx, callback) {

		const { IafProj, IafUserGroup, IafWorkspace, IafDataSource, IafPermission } = libraries.PlatformApi

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
		console.log('Step 1: userConfigTemplates', userConfigTemplates)
		console.log('Step 1: scriptTemplates', scriptTemplates)
		if (callback) callback(`Step 1: Retrieved New Project Templates`)

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
		console.log('Step 2: newProject', newProject)
		if (callback) callback(`Step 2: Created New Project: ${newProject._name} ${newProject._id}`)

		try {
			await IafProj.switchProject(newProject._id)
			if (callback) callback(`Step 3: Now working in ${newProject._name}`)

			// create admin user group
			let adminGroup = (await IafProj.addUserGroups(newProject, [{
				_name: 'Admin',
				_shortName: 'Admin',
				_description: 'Admin user group',
				permissions: {
					accessAll: true
				}
			}]))[0]
			console.log('Step 4: adminGroup', adminGroup)
			if (callback) callback(`Step 4: Created Admin User Group ${adminGroup._id}`)

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
			console.log('Step 5: adminUserConfig', adminUserConfig)
			if (callback) callback(`Step 5: Created Admin User Config ${adminUserConfig._id}`)

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
			console.log('Step 6: relateAdminConfigResult', relateAdminConfigResult)
			if (callback) callback(`Step 6: Related Admin User Config to Admin User Group`)

			// create viewers user group
			let viewerGroup = (await IafProj.addUserGroups(newProject, [{
				_name: 'Viewers',
				_shortName: 'Viewers',
				_description: 'Viewers user group'
			}]))[0]

			// create read only permissions for the viewer user group on across all of Twinit
			let readViewerPermCreate = await IafWorkspace.addAllAccess(newProject, viewerGroup, [ IafPermission.PermConst.Action.Read ])

			console.log('Step 7: viewerGroup', viewerGroup, readViewerPermCreate)
			console.log('Step 7: viewerGroup read permissons create', readViewerPermCreate)
			if (callback) callback(`Step 7: Created Viewers User Group ${viewerGroup._id}`)

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
			console.log('Step 8: vewerUserConfig', viewerUserConfig)
			if (callback) callback(`Step 8: Created Viewer User Config ${viewerUserConfig._id}`)
			
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
			console.log('Step 9: relateViewerConfigResult', relateViewerConfigResult)
			if (callback) callback(`Step 9: Related Viewer User Config to Viewer User Group`)

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
			console.log('Step 10: newImportScript', newImportScript)
			if (callback) callback(`Step 10: Created bimpk Import Script`)

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
			console.log('Step 11: importOrch', importOrch)
			if (callback) callback(`Step 11: Created Import Orchestrator`)

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

		const { IafProj, IafScripts, IafUserConfig } = libraries.PlatformApi
		const { 	project,	// REQUIRED: the project to migrate
					version 	// REQUIRED: the current version of the project to migrate
		} = input

		if (!project || !version) {
			throw("Project and Version are required!")
		}

		const migrate_1_3_0_to_2_0_0 = async (userConfigTemplates, scriptTemplates) => {

			callback(`Updating project ${project._name} version`)
			await IafProj.switchProject(project._id)
			let updateProject = await IafProj.getCurrent()

			let scripts = await IafProj.getScripts(updateProject)
			let importScript = scripts.find(s => s._userType === 'importHelper')
			let importScriptTemplate = scriptTemplates.find(s => s._name === "importHelperTemplate")
			
			let newVersion = importScript._versions[0]
			newVersion._userData = importScriptTemplate._versions[0]._userData

			let verResult = await IafScripts.createVersion(importScript._id, newVersion)
			console.log('STEP 1:', importScript, importScriptTemplate, verResult)
			callback('STEP 1: Updated bimpk Import Script')

			let userConfigs = await IafProj.getUserConfigs(updateProject)

			let adminConfig = userConfigs.find(uc => uc._name === 'QuickViewAdminConfig')
			let adminConfigVersion = adminConfig._versions[0]
			let adminTemplate = userConfigTemplates.find(uc => uc._name === 'QuickViewAdminConfigTemplate')._versions[0]
			adminConfigVersion._userData = adminTemplate._userData

			let adminUpdateResult = await IafUserConfig.createVersion(adminConfig._id, adminConfigVersion)
			console.log('STEP 2:', adminConfigVersion, adminUpdateResult)
			callback('STEP 2: Updated Admin User Config')

			let viewerConfig = userConfigs.find(uc => uc._name === 'QuickViewViewerConfig')
			let viewerConfigVersion = viewerConfig._versions[0]
			let viewerTemplate = userConfigTemplates.find(uc => uc._name === 'QuickViewViewerConfigTemplate')._versions[0]
			viewerConfigVersion._userData = viewerTemplate._userData

			let viewerUpdateResult = await IafUserConfig.createVersion(viewerConfig._id, viewerConfigVersion)
			console.log('STEP 3:', viewerConfigVersion, viewerUpdateResult)
			callback('STEP 3: Updated Viewer User Config')

			// project updates onyl allowed if _description is present
			if (!updateProject._description) {
				updateProject._description = updateProject._name
			}
			
			if (updateProject._userAttributes?.quickModelView) {
				updateProject._userAttributes.quickModelView.currentVersion = '2.0.0'
			} else if (updateProject._userAttributes?.projectMaker) {
				updateProject._userAttributes.quickModelView = Object.assign({}, updateProject._userAttributes.projectMaker)
				updateProject._userAttributes.quickModelView.currentVersion = '2.0.0'
			}
			let projUpdateResult = await IafProj.update(updateProject)
			console.log('STEP 4:', updateProject, projUpdateResult)
			callback('STEP 4: Updated Project Current Version -> 2.0.0')

		}

		const migrations = [
			{ from: '1.3.0', to: '2.0.0', migrateFunction: migrate_1_3_0_to_2_0_0 }
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
	}
}

export default scriptModule