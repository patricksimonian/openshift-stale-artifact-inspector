const Octokit = require('@octokit/rest');
const octokit = new Octokit();
module.exports = {
  getPrs: (repo, owner) => octokit.pulls.list({ owner, repo }),
};
