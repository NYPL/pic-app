#!/bin/bash

echo "pushing to $GH_REPO [via travis]"

REPO_URL="https://$GH_TOKEN@github.com/$GH_REPO.git"

git clone $REPO_URL

cd pic

git checkout csv

git pull origin csv

python ./python/index_builder.py

echo "STATUS"

git status

git add csv

git commit -m ":rocket: new deploy from travis-ci"

git push origin gh-pages

echo "DEPLOY COMPLETE"