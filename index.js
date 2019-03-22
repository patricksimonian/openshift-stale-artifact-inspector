#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ProgressBar = require('progress');
const oc = require('./lib/oc');
const github = require('./lib/github');
const { cleanNamespaces } = require('./lib/clean');
const argv = require('minimist')(process.argv.slice(2));

require('dotenv').config();

const checkArgs = () => {
  const defaults = {
    app: true,
    dev: true,
    test: true,
    prod: true,
    repo: true,
    owner: true,
    dryrun: false,
  }
  // if there is a file argument we don't check other args
  if(!argv.file) {
    Object.keys(defaults).forEach(flag => {
      if(!Object.prototype.hasOwnProperty.call(argv, flag)) {
        throw new Error(`flag: ${flag} is missing, run program with -h for instructions`);
      }
    });
  }
}

const getPrNumFromDeployConfig = (configs, app) => configs.filter(item => {
  try {
    const deployment = (item.metadata.labels['app']);
    return deployment.indexOf(app) > -1
  } catch(e) {
    return false;
  }
}).map(item => item.metadata.labels['env-id'].replace('pr-', '') / 1);

const getArgs = (cmdArgs, file) => {
  const envOptions = {
    token: process.env.OC_TOKEN,
  }
  return { ...envOptions, ...cmdArgs, ...file};
};

/**
 * logs out the results of the process
 * @param {Array} prsCleaned 
 * @param {Array} prsFailed 
 */
const results = (prsCleaned, prsFailed) => console.log(chalk`
========== RESULTS ==========
{green.bold # PRs Cleaned:} {bold ${prsCleaned.length}}
{red.bold # PRs Failed:} {bold ${prsFailed.length}}

{red.bold PRs Failed:}
${prsFailed.join()}
`);

const instructions = () => {
  const text = chalk`
    {bold options:}
    {green --app=[app]} {grey this should be the value as found from your openshift deployconfig
                it should be found within config.metadata.labels.app}
    {green --dev=[dev name space]} {grey the name of your development openshift namespace}
    {green --test=[test name space]} {grey the name of your test openshift namespace}
    {green --prod=[prod name space]} {grey the name of your prod openshift namespace}
    {green --repo=[github repo]} {grey the repo that is tied to your openshift ocp pipeline}
    {green --owner=[github owner]} {grey the owner of the repo}
    {green --token=[oc auth token]} {grey the openshift cli authentication token}
    {green --dryrun} {grey displays what prs would have been cleaned}

    {cyan example usage:}

    {yellow oc-stale-artifacts --app=foo --dev=foo-dev --test=foo-test --prod=foo-prod --repo=bar --owner=baz --token=mysecret}

    {white alternatively you may have your configuration as a json file and reference it with } {green --file=path-to-file}
  `;
  console.log(text);
}

const getFile = async filepath => {
  const resolvedPath = path.resolve(__dirname, filepath);
  return await new Promise((resolve, reject) => {
    fs.readFile(resolvedPath, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    });
  });
};

const transposeFile = async fileData => JSON.parse(await fileData);

const main = async () => {
  try {

    if(argv.h) {
      instructions();
    } else {
      let file = {};
      if(argv.file) {
        file = await transposeFile(getFile(argv.file));
      } else {
        checkArgs();
      }
      const prsFailed = [];
      const prsCleaned = [];
      const options = getArgs(argv, file);
      //get deployment configs
      const deploys = await oc.getDeploys(options.token, options.dev);
      const prodDeploys = await oc.getDeploys(options.token, options.prod);
      const testDeploys = await oc.getDeploys(options.token, options.test);
      
      // get namespaces joined for clean script
      const namespaces = [options.dev, options.test, options.prod].join();

      const {data} = deploys;
      // filter out all non devhub deployment configs
      const filtered = getPrNumFromDeployConfig(data.items, options.app);
      // exclude prod and test prs from being removed
      const excludesTest = getPrNumFromDeployConfig(testDeploys.data.items, options.app)
      const excludesProd = getPrNumFromDeployConfig(prodDeploys.data.items, options.app)
      // get open prs
      const openPrs = await github.getPrs(options.repo, options.owner);
      const openPrNums = openPrs.data.map(pr => pr.number).concat(excludesTest).concat(excludesProd);
      const afterGithubPR = filtered.filter(number => {
        return !openPrNums.includes(number);
      });

      if(afterGithubPR.length === 0) {
        console.log('no stale pull requests found. exiting!');
        process.exit(0);
      }

      const barOpts = {
         width: 20,
         total: afterGithubPR.length,
         clear: true
       };

       const bar = new ProgressBar('[:bar] :percent :etas', barOpts);
       const gen = cleanNamespaces(bar, namespaces, afterGithubPR, options.app, options.dryrun);

       while(!bar.complete) {
         let err;
         try {
           const value = gen.next().value
           const { stdout, stderr } = await value;
           if(!options.dryrun) {
             bar.interrupt(stdout);
             bar.interrupt(stderr);
           }
           prsCleaned.push(afterGithubPR[bar.curr]);
           bar.tick();
          } catch(e) {
            prsFailed.push(afterGithubPR[bar.curr]);
            bar.interrupt(e.message);
            bar.tick();
          }
        } 
        console.log();
        results(prsCleaned, prsFailed);
      }
      process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1)
  }
}

main();