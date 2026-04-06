const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const token = core.getInput('token', { required: true });
    const org = core.getInput('org');
    const user = core.getInput('user');

    if (!org && !user) {
      throw new Error('Either "org" or "user" input must be provided');
    }

    const octokit = github.getOctokit(token);

    let repos;
    if (org) {
      repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
        org,
        per_page: 100,
      });
    } else {
      repos = await octokit.paginate(octokit.rest.repos.listForUser, {
        username: user,
        per_page: 100,
      });
    }

    const repoNames = repos.map((repo) => repo.name);
    core.setOutput('repos', JSON.stringify(repoNames));
    core.info(`Found ${repoNames.length} repositories`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = { run };

run();
