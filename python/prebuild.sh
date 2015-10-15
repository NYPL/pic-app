#!/bin/bash

echo ""
echo "### Pushing to $GH_REPO [via travis]"

REPO_URL="https://$GH_TOKEN@github.com/$GH_REPO.git"

git config user.name "travis-bot"
git config user.email "travis"

# echo ""
# echo "Moving to csv"

# git checkout csv

python ./python/index_builder.py

echo ""
echo "### STATUS"

git status

git add csv

git commit -m ":rocket: new deploy from travis-ci"

echo ""
echo "Pulling latest gh-pages..."

git pull origin gh-pages -m ":rocket: merge from travis-ci"

echo ""
echo "Pushing..."

git push $REPO_URL gh-pages

echo ""
echo "### DEPLOY COMPLETE"