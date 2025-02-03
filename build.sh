# !/bin/bash

PRODUCTION_CONFIG='const endPointConfig={itemServiceOrigin:"https://api.invicara.com",passportServiceOrigin:"https://api.invicara.com",fileServiceOrigin:"https://api.invicara.com",datasourceServiceOrigin:"https://api.invicara.com",baseRoot:`${window.location.protocol}//${window.location.host}${window.location.pathname}`,applicationId:"11c2d48a-63a5-44c6-9c31-9312c06818d5"};'
SANDBOX_CONFIG='const endPointConfig={itemServiceOrigin:"https://sandbox-api.invicara.com",passportServiceOrigin:"https://sandbox-api.invicara.com",fileServiceOrigin:"https://sandbox-api.invicara.com",datasourceServiceOrigin:"https://sandbox-api.invicara.com",baseRoot:`${window.location.protocol}//${window.location.host}${window.location.pathname}`,applicationId:"11c2d48a-63a5-44c6-9c31-9312c06818d5"};'
LOCAL_CONFIG='const endPointConfig={itemServiceOrigin:"https://sandbox-api.invicara.com",passportServiceOrigin:"https://sandbox-api.invicara.com",fileServiceOrigin:"https://sandbox-api.invicara.com",datasourceServiceOrigin:"https://sandbox-api.invicara.com",baseRoot: "http://lcoalhost:8084/",applicationId:"11c2d48a-63a5-44c6-9c31-9312c06818d5"};'

npm run build
rm ./build/config.js
rm ./build/version.js

echo "Writing version.js"
CURRENT_VERSION=$(node -p "require('./package.json').version")
VERSION_CONTENT='const version={version:"'$CURRENT_VERSION'",branch:"'$CF_PAGES_BRANCH'",git:"'$CF_PAGES_COMMIT_SHA'"};'
echo $VERSION_CONTENT
echo $VERSION_CONTENT > ./build/version.js

echo "Writing config.js for $CF_PAGES_BRANCH"

if [ "$CF_PAGES_BRANCH" == "PRODUCTION" ]; then
  # Write production config file
   echo $SANDBOX_CONFIG
   echo -e $SANDBOX_CONFIG > ./build/config.js

elif [ "$CF_PAGES_BRANCH" == "NEXT-RELEASE" ]; then
  # Write next release config file
   echo $SANDBOX_CONFIG
   echo -e $SANDBOX_CONFIG > ./build/config.js

else
  # test
  echo $LOCAL_CONFIG
  echo -e $LOCAL_CONFIG > ./build/config.js
fi