[Deploy the Application Template to Twinit](./d2-deploy-twinit.md) < Back | **Next** > [Test the Template](./d4-test.md)

---

# Deploy Step 3: Build and Run the Web Client

The template web client is a React ipa-core application. If you are familiar with React applications and node, then the process of building and running the web client locally on your system will be very familiar to you. If you are not experienced in React and node and if you have not completed the Self-Led Developer React UI courses on Twinit Academy, it is highly recommended you do so as a familiarity with React, node, and ipa-core will be assumed in the following steps.

To run the template web client we will:

1. Install node
2. Install the web client dependencies
3. Update the web client configuration
4. Run the web client locally

## Install Node

If you do not yet have node installed you will need to install it for your system.

Node can be installed from [https://nodejs.org/en/download](https://nodejs.org/en/download)

Node version 18 has been tested and certified for this template. Using other versions is not supported and may introduce issues.

## Install the Web Client Dependencies

1. Open a terminal window in the directory to which you copied the template code
2. Run ```npm install```

If you experience authentication issues for @dtplatform or @invicara packages when installing dependencies please follow the steps in [this knowledgebase article](https://community.digitaltwin-factory.com/knowledgebase-5wzpkylt/post/authentication-errors-installing-twinit-npm-libraries-ySEzOpPtA3uKVfw) to ensure you have correctly configured your system environment variables to work with the template's .npmrc file.

## Update the Web Client Configuration

Once the web client dependencies have finished installing you'll need to update the web client configuration to specify your application id.

1. Open ```app/ipaCore/ipaConfig.js```
2. Add your application ID to the "applicationId" field
3. Save the file
4. Open ```app/public/config.js```
5. Add your application ID to the "applicationId" field
6. By default the configuration will be configured to use Twinit Sandbox, if you are using a different Twinit instance enter the API URL for that instance in all of the Twinit service fields
7. Save the file

> **Note**: The Twinit environment API URLS you enter in ```config.js``` must match the environment you used when deploying the template through VS Code in the previous deployment steps.

## Run the Web Client Locally

After updating your configurations, you can now run the client locally using a webpack dev server.

1. Open a terminal window in the directory in which you copied the template code
2. Run ```npm run watch```

Webpack will compile the web client and serve it at http://localhost:8083. A browser window will automatically open with the web client loaded after webpack has finished compiling it. In some cases you may need to refresh the browser window to finish loading the client after webpack has completed in he terminal.

If the client is functioning correctly, you will be automatically directed to sign in to Twinit. After signing in, you should see the Project Selection dialog with the "QMV Manager" project you created using VS Code already selected.

![project select maker dialog](../../img/project-select-maker.jpg)

## Next Steps

You have successfully compiled, configured, and run the template web client. In the next step, you will test the web client and template to make sure everything has been deployed correctly.

---
[Deploy the Application Template to Twinit](./d2-deploy-twinit.md) < Back | **Next** > [Test the Template](./d4-test.md)