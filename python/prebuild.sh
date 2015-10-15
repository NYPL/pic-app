#!/bin/bash

echo "pushing to $GH_REPO [via travis]"

REPO_URL="https://$GH_TOKEN@github.com/$GH_REPO.git"

git remote add origin $REPO_URL

git clone $REPO_URL

git pull $REPO_URL csv -m ":rocket: merge new csvs"

python ./python/index_builder.py

echo "STATUS"
git status

git commit -am ":rocket: new deploy from travis-ci"

git push $REPO_URL gh-pages
