#!/bin/bash

echo "\n\n### Pushing to $GH_REPO [via travis]"

REPO_URL="https://$GH_TOKEN@github.com/$GH_REPO.git"

git clone $REPO_URL

cd pic

git config user.name "travis-bot"
git config user.email "travis"

git checkout csv

git pull origin csv -m ":rocket: merge from travis-ci"

python ./python/index_builder.py

echo "\n\n### STATUS"

git status

git add csv

git commit -m ":rocket: new deploy from travis-ci"

git push origin gh-pages

echo "\n\n### DEPLOY COMPLETE"