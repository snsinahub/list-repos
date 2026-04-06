const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');

function buildRegex(search) {
  if (!search || search === '*' || search.toLowerCase() === 'all') {
    return null;
  }

  let pattern = search;

  // Detect simple wildcard patterns (no regex anchors, just alphanumeric + wildcards)
  const isSimpleWildcard =
    /^[a-zA-Z0-9_\-.*]+$/.test(search) &&
    !search.startsWith('^') &&
    !search.endsWith('$') &&
    search.includes('*') &&
    !search.includes('.*');

  if (isSimpleWildcard) {
    pattern = '^' + search.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
  }

  try {
    return new RegExp(pattern);
  } catch (err) {
    throw new Error(`Invalid search pattern "${search}": ${err.message}`);
  }
}

async function run(deps = {}) {
  const _core = deps.core || core;
  const _github = deps.github || github;
  const _fs = deps.fs || fs;

  try {
    const token = _core.getInput('token', { required: true });
    _core.setSecret(token);

    const org = _core.getInput('org', { required: true });
    const search = _core.getInput('search') || '*';
    const outputFormat = _core.getInput('output-format') || 'json';
    const outputFile = _core.getInput('output-file') || '';

    const regex = buildRegex(search);
    const octokit = _github.getOctokit(token);

    _core.info(`Fetching all repositories for org "${org}"...`);

    const allRepos = await octokit.paginate(octokit.rest.repos.listForOrg, {
      org,
      per_page: 100,
    });

    _core.info(`Fetched ${allRepos.length} total repositories`);

    const matched = regex
      ? allRepos.filter((repo) => regex.test(repo.name))
      : allRepos;

    const repoNames = matched.map((repo) => repo.full_name);

    _core.info(`Matched ${repoNames.length} repositories (pattern: "${search}")`);

    let output;
    if (outputFormat === 'text') {
      output = repoNames.join('\n');
    } else {
      output = JSON.stringify(repoNames);
    }

    _core.setOutput('repos', output);
    _core.setOutput('count', repoNames.length.toString());

    if (outputFile) {
      const resolvedPath = path.resolve(
        process.env.GITHUB_WORKSPACE || process.cwd(),
        outputFile
      );
      _fs.writeFileSync(resolvedPath, output, 'utf8');
      _core.info(`Output written to ${resolvedPath}`);
    }
  } catch (error) {
    _core.setFailed(error.message);
  }
}

module.exports = { run, buildRegex };
