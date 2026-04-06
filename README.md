# list-repos

A GitHub Action to search and list repositories in a GitHub organization with flexible pattern matching, automatic pagination, and configurable output format.

## Features

- Search repos by regex, glob-like wildcards, or list all
- Automatic pagination — fetches all repos (even 500+)
- Output as JSON array or plain text (one per line)
- Optionally write results to a file
- Built on Node.js 24

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `token` | Yes | — | GitHub token with repo read access |
| `org` | Yes | — | GitHub organization name |
| `search` | No | `*` | Search pattern: `*`/`all` for all, regex (e.g. `^api-`), or wildcard (e.g. `*-service`) |
| `output-format` | No | `json` | `json` (array of `owner/repo`) or `text` (one `owner/repo` per line) |
| `output-file` | No | — | File path to write the output to |

## Outputs

| Output | Description |
|--------|-------------|
| `repos` | Matched repositories in the chosen format |
| `count` | Number of matched repositories |

## Usage

```yaml
- name: List all repos
  id: list
  uses: snsinahub/list-repos@v1.0.0
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    org: my-org

- name: List API repos (regex)
  uses: snsinahub/list-repos@v1.0.0
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    org: my-org
    search: '^api-'
    output-format: text

- name: List service repos (wildcard) to file
  uses: snsinahub/list-repos@v1.0.0
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    org: my-org
    search: '*-service'
    output-file: repos.json
```

### Full workflow example

```yaml
name: List Organization Repos

on:
  workflow_dispatch:
    inputs:
      org:
        description: 'GitHub organization name'
        required: true
        type: string

jobs:
  list-repos:
    runs-on: ubuntu-latest
    steps:
      - name: List repos
        id: list
        uses: snsinahub/list-repos@v1.0.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          org: ${{ inputs.org }}
          search: '*'
          output-format: json

      - name: Print results
        run: |
          echo "Found ${{ steps.list.outputs.count }} repositories"
          echo "${{ steps.list.outputs.repos }}"
```

## Development

```bash
npm install
npm test        # Run tests (vitest)
npm run build   # Bundle to dist/index.js
```

## License

MIT