#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const oc = require('./oc');
const github = require('./github');
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

const instructions = () => {
  const text = `
    options:
    app: --app=[app] this should be the value as found from your openshift deployconfig
         it should be found within config.metadata.labels.app
    dev: --dev=[dev name space] the name of your development openshift namespace
    test: --test=[test name space] the name of your test openshift namespace
    prod: --prod=[prod name space] the name of your prod openshift namespace
    repo: --repo=[github repo] the repo that is tied to your openshift ocp pipeline
    owner: --owner=[github owner] the owner of the repo
    token: --token=[oc auth token] the openshift cli authentication token
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
  if(argv.h) {
    instructions();
  } else {
    let file = {};
    if(argv.file) {
      file = await transposeFile(getFile(argv.file));
    } else {
      checkArgs();
    }

    const options = getArgs(argv, file);
    //get deployment configs
    const deploys = await oc.getDeploys(options.token, options.dev);
    const prodDeploys = await oc.getDeploys(options.token, options.prod);
    const testDeploys = await oc.getDeploys(options.token, options.test);
  
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
    console.log(afterGithubPR.join('\n'));
  }
}

main();