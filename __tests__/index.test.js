const core = require('@actions/core');
const github = require('@actions/github');
const { run } = require('../src/index');

jest.mock('@actions/core');
jest.mock('@actions/github');

describe('list-repos action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists repos for an org', async () => {
    const mockRepos = [{ name: 'repo-a' }, { name: 'repo-b' }];

    core.getInput.mockImplementation((name) => {
      if (name === 'token') return 'fake-token';
      if (name === 'org') return 'my-org';
      return '';
    });

    const mockPaginate = jest.fn().mockResolvedValue(mockRepos);
    github.getOctokit.mockReturnValue({
      paginate: mockPaginate,
      rest: { repos: { listForOrg: 'listForOrg' } },
    });

    await run();

    expect(github.getOctokit).toHaveBeenCalledWith('fake-token');
    expect(mockPaginate).toHaveBeenCalledWith('listForOrg', {
      org: 'my-org',
      per_page: 100,
    });
    expect(core.setOutput).toHaveBeenCalledWith(
      'repos',
      JSON.stringify(['repo-a', 'repo-b'])
    );
  });

  it('lists repos for a user', async () => {
    const mockRepos = [{ name: 'user-repo' }];

    core.getInput.mockImplementation((name) => {
      if (name === 'token') return 'fake-token';
      if (name === 'user') return 'some-user';
      return '';
    });

    const mockPaginate = jest.fn().mockResolvedValue(mockRepos);
    github.getOctokit.mockReturnValue({
      paginate: mockPaginate,
      rest: { repos: { listForUser: 'listForUser' } },
    });

    await run();

    expect(mockPaginate).toHaveBeenCalledWith('listForUser', {
      username: 'some-user',
      per_page: 100,
    });
    expect(core.setOutput).toHaveBeenCalledWith(
      'repos',
      JSON.stringify(['user-repo'])
    );
  });

  it('fails when neither org nor user is provided', async () => {
    core.getInput.mockImplementation((name) => {
      if (name === 'token') return 'fake-token';
      return '';
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      'Either "org" or "user" input must be provided'
    );
  });
});
