# Senior Git Flow & Contribution Guide

## Branching Strategy

We follow a professional **Git Flow** model to ensure code stability and structured releases.

### Perpetual Branches
- **`main`**: The source of truth for production. Always stable.
- **`develop`**: The integration branch for new features and bug fixes.

### Supporting Branches
- **`feature/repo-name-<desc>`**: For new features. Branched from `develop`.
- **`fix/repo-name-<desc>`**: For bug fixes. Branched from `develop`.
- **`hotfix/repo-name-<desc>`**: Critical production fixes. Branched from `main`.

## Commit Message Convention

We strictly follow [Conventional Commits](https://www.conventionalcommits.org/).

### Format
`<type>(<scope>): <short description>`

### Types
- `feat`: A new feature
- `fix`: A bug fix
- `chore`: Technical tasks, dependencies, configuration
- `refactor`: Code restructuring without behavior changes
- `docs`: Documentation updates
- `test`: Adding or correcting tests

### Example
`feat(auth): add google oauth2 provider`

## Pull Request Process

1. **Branch**: Create a new branch from `develop`.
2. **Review**: Ensure your code passes linting and type checks (`yarn lint`, `yarn check-types`).
3. **PR**: Open a PR targeting the `develop` branch.
4. **Approval**: Require at least one senior review before merging.
5. **Merge**: Squash and merge into `develop`.
