# Contributing to Parchment-Assist

Thank you for your interest in contributing to Parchment-Assist! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

This project follows standard open source community guidelines. We expect all contributors to:

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on what is best for the community
- Show empathy towards other community members
- Accept constructive criticism gracefully

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- A Chromium-based browser (Chrome, Edge, Brave, etc.)
- (Optional) Ollama installed locally for testing AI features

### Development Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/PlytonRexus/parchment-assist.git
   cd parchment-assist
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Run Tests**

   ```bash
   npm test
   ```

4. **Load Extension in Chrome**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the project directory

## Development Workflow

### Project Structure

```
parchment-assist/
├── src/                  # Source code
│   ├── background/       # Service worker
│   ├── content/          # Content scripts
│   ├── helpers/          # Utility functions
│   ├── lib/              # Core libraries
│   ├── ui/               # UI components
│   └── assets/           # Icons and images
├── tests/                # Test files
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── feature/          # Feature tests
├── docs/                 # Documentation
└── .github/              # GitHub templates and workflows
```

### Making Changes

1. **Create a Branch**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-number-description
   ```

2. **Make Your Changes**
   - Write clean, readable code
   - Follow existing code style
   - Add tests for new features
   - Update documentation as needed

3. **Run Quality Checks**

   ```bash
   # Run all checks
   npm run validate

   # Or run individually:
   npm run lint          # Check code style
   npm run format:check  # Check formatting
   npm test              # Run tests
   ```

4. **Fix Issues**
   ```bash
   npm run lint:fix      # Auto-fix linting issues
   npm run format        # Auto-format code
   ```

## Coding Standards

### JavaScript Style

- Use ES6+ features (classes, arrow functions, async/await)
- Use `const` by default, `let` only when reassignment is needed
- Never use `var`
- Use strict equality (`===`) instead of loose equality (`==`)
- Always use curly braces for control structures
- Prefer single quotes for strings
- Use meaningful variable and function names

### Code Organization

- Keep functions small and focused (Single Responsibility Principle)
- Group related functionality into classes or modules
- Use dependency injection where appropriate
- Avoid global state when possible

### Comments

- Write self-documenting code (clear names, simple logic)
- Add comments for complex algorithms or business logic
- Use JSDoc comments for public APIs
- Explain "why", not "what"

```javascript
// Bad
const x = arr.filter((i) => i > 5); // Filter array

// Good
// Remove invalid player scores (minimum valid score is 5)
const validScores = playerScores.filter((score) => score > 5);
```

## Testing Guidelines

### Writing Tests

- Write tests for all new features
- Maintain or improve test coverage
- Use descriptive test names that explain the behavior
- Follow the Arrange-Act-Assert pattern

```javascript
test('should return empty array when no objects are present', () => {
  // Arrange
  const gameText = 'You are in an empty room.';

  // Act
  const state = AdvancedGameStateExtractor.parse(gameText);

  // Assert
  expect(state.objects).toEqual([]);
});
```

### Test Types

- **Unit Tests** (`tests/unit/`): Test individual functions/classes in isolation
- **Integration Tests** (`tests/integration/`): Test multiple components working together
- **Feature Tests** (`tests/feature/`): Test complete user-facing features

### Running Tests

```bash
npm test                  # Run all tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Generate coverage report
```

## Pull Request Process

### Before Submitting

1. ✅ All tests pass (`npm test`)
2. ✅ Code is linted (`npm run lint`)
3. ✅ Code is formatted (`npm run format`)
4. ✅ No console errors in extension
5. ✅ Documentation is updated
6. ✅ CHANGELOG.md is updated (if applicable)

### Submitting a PR

1. **Push your branch**

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request**
   - Use a clear, descriptive title
   - Reference any related issues (#123)
   - Fill out the PR template completely
   - Add screenshots for UI changes
   - Request review from maintainers

3. **PR Title Format**
   - `feat: Add support for custom LLM providers`
   - `fix: Resolve crash when AI returns invalid JSON`
   - `docs: Update installation instructions`
   - `test: Add tests for MapManager edge cases`
   - `chore: Update dependencies`

### Review Process

- Maintainers will review your PR within 3-5 business days
- Address feedback by pushing new commits to your branch
- Once approved, a maintainer will merge your PR
- Delete your branch after merge

## Reporting Bugs

### Before Reporting

1. Check if the bug has already been reported
2. Test with the latest version
3. Verify it's not a configuration issue

### Creating a Bug Report

Use the bug report template and include:

- **Extension version**: Found in `manifest.json`
- **Browser version**: Chrome/Edge version
- **Operating System**: macOS/Windows/Linux
- **Steps to reproduce**: Clear, numbered steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Console errors**: From DevTools console
- **Screenshots**: If applicable

## Feature Requests

We welcome feature requests! Please:

1. Check if the feature has already been requested
2. Use the feature request template
3. Explain the use case (why you need it)
4. Describe the proposed solution
5. Consider alternative approaches

## Questions?

- **Documentation**: Check the [docs/](docs/) directory
- **Architecture**: See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Security**: See [SECURITY.md](SECURITY.md)
- **Issues**: Open a question issue with the `question` label

## License

By contributing, you agree that your contributions will be licensed under the same [MIT License](LICENSE) that covers the project.

## Recognition

All contributors will be recognized in the project's README.md. Thank you for helping make Parchment-Assist better!
