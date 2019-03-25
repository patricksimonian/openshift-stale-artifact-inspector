const chalk = require('chalk');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
/**
 * deletes artifacts
 * @param {Array} namespaces array of namespaces
 * @param {Number} pr the pr number
 * @param {String} app the app label
 */
const cleanNamespacesByPr = (namespaces, pr, app) => {
  if(!namespaces || !pr) {
    return undefined;
  }
  const cleanPath = path.resolve(__dirname, './clean.sh');
  
  return exec(`${cleanPath} --namespaces=${namespaces} --app=${app} --pr=${pr}`);
}

/**
 * generator to run through shell script
 * @param {ProgressBar} bar the progress bar instance
 * @param {String} namespaces 
 * @param {Array} prs 
 * @param {String} app 
 * @param {Boolean} isDryrun 
 */
function* cleanNamespaces(bar, namespaces, prs, app, isDryrun = false) {
  let counter = 0;
  while(counter !== prs.length) {
    bar.interrupt(chalk`{bold Cleaning} {green PR ${prs[counter]}} for {green app ${app}}`)
    console.log(isDryrun);
    if(isDryrun) {
      yield Promise.resolve({stdout: '', stderr: ''});
    } else {
      yield cleanNamespacesByPr(namespaces, prs[counter], app);
    }
    counter++;
  }
  return 'Process Complete';
}

module.exports = {
  cleanNamespacesByPr,
  cleanNamespaces,
}