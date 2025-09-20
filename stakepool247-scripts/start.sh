#!/bin/sh
set -e

echo "Pulling latest script versions"
git pull

echo "Installing packages"
yarn install

# Configure environment
echo "Configuring environment"
. ../environment.sh
export SERVICE_ACCOUNT_PRIVATE_KEY_JSON="`cat ../firebase_service_account.json`"

# (Re)Start scripts
if (pm2 status | grep -q json-loader); then
	echo "Reloading the scripts"
	pm2 reload json-loader --update-env
	pm2 reload status-manager --update-env
else 
	echo "Starting the scripts"
	pm2 start
fi
pm2 save
