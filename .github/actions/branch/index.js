const core = require('@actions/core');
const github = require('@actions/github');

run();
// Creates a branch off a fork PR
async function run() {
  const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
  const context = github.context;
  try {
    // Get info of the fork PR
    const prNumber = context.issue.number;
    const {data} = await octokit.rest.pulls.get({
      ...context.repo,
      pull_number: prNumber
    });
    const branch = `${data.user.login}-${data.head.ref}`;
    const ref = `refs/heads/${branch}`;
    const sha = data.merge_commit_sha;

    let res;
    // Look up if branch for fork PR exists in base repo
    try {
      res = await octokit.rest.repos.getBranch({
        ...context.repo,
        branch
      });
    } catch (error) {
      if (!(error.name === 'HttpError' && error.status === 404)) {
        throw error;
      } else {
        // If branch doesn't exist for the forked PR, create one so we can get a
        // build for it and return
        await octokit.rest.git.createRef({
          ...context.repo,
          ref,
          sha
        });
        return;
      }
    }

    // If branch already exists update it to match fork PR state.
    if (res.status === 200) {
      await octokit.rest.git.updateRef({
        ...context.repo,
        sha,
        ref: `heads/${branch}`,
        force: true
      })
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}
