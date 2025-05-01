import React, { useContext, useState } from "react"

import { IafFileSvc, IafProj } from "@dtplatform/platform-api"

import { ModelContext } from "../../../contexts/ModelContext"

import { getModelFolder } from "../modelDocUtils"
import { ChooseFiles } from "../../ChooseFiles/ChooseFiles"

const ModelDocUpload = ({ onFilesUploaded }) => {

   const { selectedModelComposite } = useContext(ModelContext)

   const [ busy, setBusy ] = useState(false)
   const [ totalFileCount, setTotalFileCount ] = useState(0)
   const [ currentFileCount, setCurrentFileCount ] = useState()
   const [ currentProgress, setCurrentProgress ] = useState()

   const uploadFilesToModelFolder = async (project, folder, files) => {

      let fileUploadResults = []

      // we will provide an onComplete callback to the upload function so that we can resolve
		// our deferred Promises once the upload completes
		// we'll have this print to the console and the scripts callback
		// you will see the scripts callback content in the script results when the script
		// has completed running
		// the callback you provide for onComplete will be passed to the created file record in the file service
		function onUploadComplete(deferredResolve, file) {
			let message = file._name + ' COMPLETE'
			console.log(message)
			fileUploadResults.push(file)
         setCurrentProgress('100')
			deferredResolve()
		}

		// we will provide an onProgress callback as well to the upload function
		// we'll have this print to the console and the scripts callback
		// you will see the scripts callback content in the script results when the script
		// has completed running
		// the callback you provide for onProgress will be passed the bytes uploaded so far the total bytes
		function onUploadProgress(bytesUploaded, bytesTotal, file) {
			let percentComplete = (bytesUploaded/bytesTotal * 100).toFixed(1)
			let message = file.name + ': ' + percentComplete
			setCurrentProgress(percentComplete)
		}

		// we will provide an onError callback as well to the upload function
		// we'll have this print to the console and the scripts callback
		// you will see the scripts callback content in the script results when the script
		// has completed running
		function onUploadError(deferredReject, error, file) {
			let message = file.name + ': ERROR' + error
			console.log(message)
			deferredReject(error)
		}

		// upload each file
		for (let i = 0; i < files.length; i++) {

         setCurrentFileCount(i+1)
         let file = files[i]

			// since the file will be uploaded async we create a Promise and only resolve it once the file
			// has been 100% uploaded, making sure that the script does not complete before that.
			// We will pass the deferred resolve method to the onUploadComplete callback
			let deferredResolve, deferredReject
			let uploadPromise =new Promise((resolve, reject) => {
				deferredResolve = resolve
				deferredReject = reject
			})

			try {

				// upload the file using resumable upload which can handle interrupts in network and which
				// will allow partial file uploads that can be completed at a later point in time
				//
				// Params:
				// 1. the file Stream, Buffer, or File to upload
				// 2. the project _namespaces to which to upload the files
				// 3. the parent folders for the file, if none are provided the root folder for the project will be used
				// 4. the tags to apply to the file
				// 5. the user's ctx uploading the files
				// 6. an options object containing
				// 	the filename for the file if not provided on the file
				//		onProgress, onComplete, and onError options callbacks
				//
				// We will upload one file at a time, but you can do parallel uploads by removing await
				// and throttling the number of uploads you allow at one time

				await IafFileSvc.addFileResumable(file, project._namespaces, [folder._id], [], null, {
						filename: encodeURI(file.name),
						onProgress: (bytesUploaded, bytesTotal) => onUploadProgress(bytesUploaded, bytesTotal, file),
						onComplete: (upfile) => onUploadComplete(deferredResolve, upfile), // onComplete will be passed the file record in the file service
						onError: (error) => onUploadError(deferredReject, error, file)
					}
				)

            await Promise.all(uploadPromise)
			} catch(e) {
				console.log(e)
				deferredReject(e)
			}

		}

		// wait for the onUploadSuccess callbacks to resolve all our deferred Promises then return from the script
      return fileUploadResults

   }

   const uploadFiles = async (files) => {

      if (files.length) {

         setTotalFileCount(files.length)
         setCurrentFileCount(0)
         setCurrentProgress('0')
         setBusy(true)

         let currentProject = await IafProj.getCurrent()

         getModelFolder(currentProject, selectedModelComposite).then((folder) => {

            uploadFilesToModelFolder(currentProject, folder, files).then((uploadedFiles) => {

               setBusy(false)
               if (onFilesUploaded) onFilesUploaded(uploadedFiles)

            })

         })

      }
      




   }

   return <ChooseFiles onAddFiles={uploadFiles} busy={busy} busyMsg={`Uploading ${currentFileCount} of ${totalFileCount} (${currentProgress}%)`}/>

}

export default ModelDocUpload