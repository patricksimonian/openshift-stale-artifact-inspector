const Octokit = require('@octokit/rest');
module.exports = ghToken => {
  let octokit = new Octokit();
  // if auth token is available use it
  if (ghToken) octokit = new Octokit({ auth: `token ${ghToken}` });

  return {
    getPrs: (repo, owner) => octokit.pulls.list({ owner, repo }),
  };
};
