#!/usr/bin/env node
const fs = require('fs');
const figlet = require('figlet');
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
  };
  // if there is a file argument we don't check other args
  if (!argv.file) {
    Object.keys(defaults).forEach(flag => {
      if (!Object.prototype.hasOwnProperty.call(argv, flag)) {
        throw new Error(
          `flag: ${flag} is missing, run program with -h for instructions`
        );
      }
    });
  }
};

/**
 * gets the pr list from a cmd line arg
 * @param {String} prs '123,124,125'
 * @returns {Array} prs as numbers
 */
const getPrsFromArg = prs => {
  // cast pr to string, minimist autocasts things like --pr=481 to a number, this is to normalize
  // --pr=481,482 being cast to a string
  prs = prs + '';

  const rawPrs = prs.split(',');
  // assert rawPrs are numbers by casting to a number
  prsAsNums = rawPrs.map(pr => pr / 1);
  if (prsAsNums.includes(NaN)) {
    throw new Error(
      `-pr= argument must be a comma seperated list, received ${prs}`
    );
  }

  return prsAsNums;
};

const getPrNumFromDeployConfig = (configs, app) =>
  configs
    .filter(item => {
      try {
        const deployment = item.metadata.labels['app'];
        return deployment.indexOf(app) > -1;
      } catch (e) {
        return false;
      }
    })
    .map(item => item.metadata.labels['env-id'].replace('pr-', '') / 1);

const getArgs = (cmdArgs, file) => {
  const envOptions = {
    token: process.env.OC_TOKEN,
  };
  const defaults = {
    dryrun: false,
  };

  return { ...defaults, ...envOptions, ...cmdArgs, ...file };
};

/**
 * finds all stale prs for a oc project by comparing deploy configs
 * against prs in github repo
 * @param {Object} options
 * @param {String} options.dev the openshift dev project namespace
 * @param {String} options.test the openshift test project namespace
 * @param {String} options.prod the openshift prod project namespace
 * @param {String} options.token the openshift access token
 * @param {String} options.app the openshift app label (specific to OCP-CD pipeline)
 * @returns {Array} list of prs
 */
const getStalePrs = async options => {
  //get deployment configs
  const deploys = await oc.getDeploys(options.token, options.dev);
  const prodDeploys = await oc.getDeploys(options.token, options.prod);
  const testDeploys = await oc.getDeploys(options.token, options.test);

  const { data } = deploys;
  // filter out all non devhub deployment configs
  const filtered = getPrNumFromDeployConfig(data.items, options.app);
  // exclude prod and test prs from being removed
  const excludesTest = getPrNumFromDeployConfig(
    testDeploys.data.items,
    options.app
  );
  const excludesProd = getPrNumFromDeployConfig(
    prodDeploys.data.items,
    options.app
  );
  // get open prs
  const openPrs = await github.getPrs(options.repo, options.owner);
  const openPrNums = openPrs.data
    .map(pr => pr.number)
    .concat(excludesTest)
    .concat(excludesProd);
  const prsToClean = filtered.filter(number => {
    return !openPrNums.includes(number);
  });

  if (prsToClean.length === 0) {
    console.log('no stale pull requests found. exiting!');
    process.exit(0);
  }

  return prsToClean;
};

/**
 * logs out the results of the process
 * @param {Array} prsCleaned
 * @param {Array} prsFailed
 */
const results = (prsCleaned, prsFailed) =>
  console.log(chalk`
========== RESULTS ==========
{green.bold # PRs Cleaned:} {bold ${prsCleaned.length}}
{red.bold # PRs Failed:} {bold ${prsFailed.length}}

{red.bold PRs Failed:}
${prsFailed.join()}
`);

const instructions = () => {
  const text = chalk`
    {bold options:}
    {green --app=[app]} {blue this should be the value as found from your openshift deployconfig
                it should be found within config.metadata.labels.app}
    {green --dev=[dev name space]} {blue the name of your development openshift namespace}
    {green --test=[test name space]} {blue the name of your test openshift namespace}
    {green --prod=[prod name space]} {blue the name of your prod openshift namespace}
    {green --repo=[github repo]} {blue the repo that is tied to your openshift ocp pipeline}
    {green --owner=[github owner]} {blue the owner of the repo}
    {green --token=[oc auth token]} {blue the openshift cli authentication token}
    {green --dryrun} {blue displays what prs would have been cleaned}
    OR
    {green --prs=[comma seperated list of prs]} {blue manually clean prs instead of looking for stale ones --prs=481,392,123}

    {cyan example usage:}

    {yellow oc-clean-stale-artifacts --app=foo --dev=foo-dev --test=foo-test --prod=foo-prod --repo=bar --owner=baz --token=mysecret}

    {white alternatively you may have your configuration as a json file and reference it with } {green --file=path-to-file}
  `;
  console.log(text);
};

const getFile = async filepath => {
  const resolvedPath = path.resolve(process.cwd(), filepath);
  return await new Promise((resolve, reject) => {
    fs.readFile(resolvedPath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
};

const transposeFile = async fileData => JSON.parse(await fileData);

const main = async () => {
  try {
    if (argv.h) {
      instructions();
    } else {
      let file = {};
      if (argv.file) {
        file = await transposeFile(getFile(argv.file));
      } else {
        checkArgs();
      }

      figlet.text(
        'Government of British Columbia',
        {
          font: 'Ghost',
          horizontalLayout: 'default',
          verticalLayout: 'default',
        },
        function(err, data) {
          if (err) {
            return;
          }
          console.log(data);
          console.log('Authored by Patrick Simonian');
        }
      );

      const prsFailed = [];
      const prsCleaned = [];
      const options = getArgs(argv, file);
      // get namespaces joined for clean script
      const namespaces = [options.dev, options.test, options.prod].join();
      let prsToClean = [];

      if (options.prs) {
        prsToClean = getPrsFromArg(options.prs);
      } else {
        prsToClean = await getStalePrs(options);
      }

      const barOpts = {
        width: 20,
        total: prsToClean.length,
        clear: true,
      };

      const bar = new ProgressBar('[:bar] :percent :etas', barOpts);
      const gen = cleanNamespaces(
        bar,
        namespaces,
        prsToClean,
        options.app,
        options.dryrun
      );
      console.log();
      while (!bar.complete) {
        let err;
        try {
          const value = gen.next().value;
          const { stdout, stderr } = await value;
          if (!options.dryrun) {
            bar.interrupt(stdout);
            bar.interrupt(stderr);
          }
          prsCleaned.push(prsToClean[bar.curr]);
          bar.tick();
        } catch (e) {
          prsFailed.push(prsToClean[bar.curr]);
          bar.interrupt(e.message);
          bar.tick();
        }
      }
      console.log();
      results(prsCleaned, prsFailed);
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

main();
