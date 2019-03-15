## PR CLEANER

> Disclaimer: use at your own risk! This is very hardcoded and roughly done.

This project was made so that I could quickly interface with openshift cli and github to clean up open shift artifacts that were generated from the OCP-CD/CI Pipeline. There are many situations
in which the development namespace gets littered with artifacts that eat resources. 

> AGAIN DISCLAIMER THIS IS ONLY FOR THE DEVHUB-DEV OPENSHIFT PROJECT

How to get started
> requires node js 10
1. install packages `npm install`
2. fill in your environment variables `cp .env-example .env`
3. for app instructions run `npm start -- -h`
4. To run app `npm start -- --app=[app-name] --dev=[dev namespace] --test=[test namespace] --prod=[prod namespace] --repo=[repo name] --owner=[owner name]

Alternatively you may store these credentials in a `json` file and call
`npm start -- --file=[path to json file]`

```json
// config.json
{
  "app": "devhub-dev",
  "dev": "devhub-dev",
  "test": "devhub-test",
  "prod": "devhub-prod",
  "repo": "devhub-app-web",
  "owner": "bcgov"  
}
```

`npm start -- --file=./config.json`

## I just got a list of numbers so what?

This list of numbers are all PR Numbers that are stale within your Openshift __Dev__ and __Tools__ namespaces.

With this you can pipe the results into other functions for automated cleanups. A great way to do this is by using xargs.

`npm start -- --file=./config.json | xargs -I {} mycleanupscript pr={}`