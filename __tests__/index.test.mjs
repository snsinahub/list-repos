import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

function createMocks(inputOverrides = {}) {
  const inputs = {
    token: 'fake-token',
    org: 'my-org',
    search: '*',
    'output-format': 'json',
    'output-file': '',
    ...inputOverrides,
  };

  const core = {
    getInput: vi.fn((name) => inputs[name] || ''),
    setOutput: vi.fn(),
    setFailed: vi.fn(),
    setSecret: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  const mockPaginate = vi.fn();
  const github = {
    getOctokit: vi.fn(() => ({
      paginate: mockPaginate,
      rest: { repos: { listForOrg: 'listForOrg' } },
    })),
  };

  return { core, github, mockPaginate };
}

function makeRepos(names, org = 'my-org') {
  return names.map((name) => ({ name, full_name: `${org}/${name}` }));
}

let run, buildRegex;

beforeEach(async () => {
  const mod = await import('../src/index.js');
  run = mod.run;
  buildRegex = mod.buildRegex;
});

describe('list-repos action', () => {
  it('fetches all repos when search is *', async () => {
    const repos = makeRepos(['api-gateway', 'frontend-app', 'docs']);
    const { core, github, mockPaginate } = createMocks({ search: '*' });
    mockPaginate.mockResolvedValue(repos);

    await run({ core, github });

    expect(core.setSecret).toHaveBeenCalledWith('fake-token');
    expect(core.setOutput).toHaveBeenCalledWith(
      'repos',
      JSON.stringify(['my-org/api-gateway', 'my-org/frontend-app', 'my-org/docs'])
    );
    expect(core.setOutput).toHaveBeenCalledWith('count', '3');
  });

  it('fetches all repos when search is "all"', async () => {
    const repos = makeRepos(['repo-a', 'repo-b']);
    const { core, github, mockPaginate } = createMocks({ search: 'all' });
    mockPaginate.mockResolvedValue(repos);

    await run({ core, github });

    expect(core.setOutput).toHaveBeenCalledWith('count', '2');
  });

  it('filters repos by regex pattern', async () => {
    const repos = makeRepos(['api-users', 'api-orders', 'frontend-app', 'docs']);
    const { core, github, mockPaginate } = createMocks({ search: '^api-' });
    mockPaginate.mockResolvedValue(repos);

    await run({ core, github });

    expect(core.setOutput).toHaveBeenCalledWith(
      'repos',
      JSON.stringify(['my-org/api-users', 'my-org/api-orders'])
    );
    expect(core.setOutput).toHaveBeenCalledWith('count', '2');
  });

  it('filters repos by glob-like wildcard pattern', async () => {
    const repos = makeRepos(['auth-service', 'user-service', 'api-gateway', 'docs']);
    const { core, github, mockPaginate } = createMocks({ search: '*-service' });
    mockPaginate.mockResolvedValue(repos);

    await run({ core, github });

    expect(core.setOutput).toHaveBeenCalledWith(
      'repos',
      JSON.stringify(['my-org/auth-service', 'my-org/user-service'])
    );
    expect(core.setOutput).toHaveBeenCalledWith('count', '2');
  });

  it('outputs JSON format correctly', async () => {
    const repos = makeRepos(['repo-a']);
    const { core, github, mockPaginate } = createMocks({ 'output-format': 'json' });
    mockPaginate.mockResolvedValue(repos);

    await run({ core, github });

    expect(core.setOutput).toHaveBeenCalledWith('repos', JSON.stringify(['my-org/repo-a']));
  });

  it('outputs text format correctly', async () => {
    const repos = makeRepos(['repo-a', 'repo-b']);
    const { core, github, mockPaginate } = createMocks({ 'output-format': 'text' });
    mockPaginate.mockResolvedValue(repos);

    await run({ core, github });

    expect(core.setOutput).toHaveBeenCalledWith('repos', 'my-org/repo-a\nmy-org/repo-b');
  });

  it('writes to output file when output-file is specified', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'list-repos-'));
    const outputPath = path.join(tmpDir, 'repos.json');

    const repos = makeRepos(['repo-a']);
    const { core, github, mockPaginate } = createMocks({ 'output-file': outputPath });
    mockPaginate.mockResolvedValue(repos);

    await run({ core, github });

    const written = fs.readFileSync(outputPath, 'utf8');
    expect(written).toBe(JSON.stringify(['my-org/repo-a']));

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('sets count output correctly', async () => {
    const repos = makeRepos(['a', 'b', 'c', 'd', 'e']);
    const { core, github, mockPaginate } = createMocks();
    mockPaginate.mockResolvedValue(repos);

    await run({ core, github });

    expect(core.setOutput).toHaveBeenCalledWith('count', '5');
  });

  it('calls core.setFailed on API error', async () => {
    const { core, github, mockPaginate } = createMocks();
    mockPaginate.mockRejectedValue(new Error('API error'));

    await run({ core, github });

    expect(core.setFailed).toHaveBeenCalledWith('API error');
  });

  it('calls core.setFailed on invalid regex', async () => {
    const { core, github, mockPaginate } = createMocks({ search: '[invalid' });
    mockPaginate.mockResolvedValue([]);

    await run({ core, github });

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Invalid search pattern')
    );
  });

  it('handles large pagination (500+ repos)', async () => {
    const names = Array.from({ length: 500 }, (_, i) => `repo-${i}`);
    const repos = makeRepos(names);
    const { core, github, mockPaginate } = createMocks();
    mockPaginate.mockResolvedValue(repos);

    await run({ core, github });

    expect(core.setOutput).toHaveBeenCalledWith('count', '500');
    const reposCall = core.setOutput.mock.calls.find((c) => c[0] === 'repos');
    const parsed = JSON.parse(reposCall[1]);
    expect(parsed).toHaveLength(500);
    expect(parsed[0]).toBe('my-org/repo-0');
    expect(parsed[499]).toBe('my-org/repo-499');
  });

  it('uses octokit.paginate for automatic pagination', async () => {
    const repos = makeRepos(['repo-a']);
    const { core, github, mockPaginate } = createMocks();
    mockPaginate.mockResolvedValue(repos);

    await run({ core, github });

    expect(mockPaginate).toHaveBeenCalledWith('listForOrg', {
      org: 'my-org',
      per_page: 100,
    });
  });
});

describe('buildRegex', () => {
  it('returns null for *', () => {
    expect(buildRegex('*')).toBeNull();
  });

  it('returns null for "all"', () => {
    expect(buildRegex('all')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(buildRegex('')).toBeNull();
  });

  it('creates regex from pattern', () => {
    const regex = buildRegex('^api-');
    expect(regex).toBeInstanceOf(RegExp);
    expect(regex.test('api-users')).toBe(true);
    expect(regex.test('frontend')).toBe(false);
  });

  it('converts simple wildcard to regex', () => {
    const regex = buildRegex('*-service');
    expect(regex.test('auth-service')).toBe(true);
    expect(regex.test('api-gateway')).toBe(false);
  });

  it('throws on invalid regex', () => {
    expect(() => buildRegex('[invalid')).toThrow('Invalid search pattern');
  });
});
