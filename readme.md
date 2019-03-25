## PR CLEANER

> Disclaimer: use at your own risk! This is very hardcoded and roughly done.

This project was made so that I could quickly interface with openshift cli and github to clean up open shift artifacts that were generated from the OCP-CD/CI Pipeline. There are many situations
in which the development namespace gets littered with artifacts that eat resources. 

## How to get started

### Prerequisites

- NodeJS 10
- jq v1.5 `brew install jq` in mac osx `sudo apt-get update sudo apt-get install jq` in linux
- oc cli v3.9 (open shift cli)

### As a CLI
1. `npm install -g git+https://git@github.com/patricksimonian/openshift-stale-artifact-inspector.git`
2.  run with cmd `oc-clean-stale-artifacts -h`
3.  you can run the tool with inline arguments or a json configuration file
```json
// config.json
{
  "app": "devhub-dev",
  "dev": "devhub-dev",
  "test": "devhub-test",
  "prod": "devhub-prod",
  "repo": "devhub-app-web",
  "owner": "bcgov",
  "token": "your oc token" 
}
```
> ENSURE TO NOT ADD YOUR CONFIG FILE AS APART OF THE REPO HISTORY IF YOU ARE INCLUDING THE TOKEN

`oc-clean-stale-artifacts --file=./config.json`

#### Dry runs

Want to see what PRS would have been cleaned without cleaning them?

`oc-clean-stale-artifacts [...your config] --dryrun`

#### Manual PR Cleaning

Want to clean PRS manually? Pass in a `comma-seperated-list` of prs.

`oc-clean-stale-artifacts [...your config] --prs=123,124,125`