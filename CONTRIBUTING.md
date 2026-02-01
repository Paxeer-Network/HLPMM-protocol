# Contributing to HLPMM Protocol

Thank you for your interest in contributing to the HLPMM Protocol. This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Security](#security)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to infopaxeer@paxeer.app.

### Our Standards

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Set up the development environment
4. Create a feature branch
5. Make your changes
6. Submit a pull request

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Foundry (for Forge tests)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/paxeer-network/hlpmm-protocol.git
cd hlpmm-protocol

# Install dependencies
pnpm install

# Copy environment file
cp .example.env .env

# Compile contracts
pnpm compile

# Run tests
pnpm test
```

### Environment Variables

Create a `.env` file with the following:

```bash
PRIVATE_KEY=your_private_key_here
PAXSCAN_API_KEY=your_api_key_here
```

## Pull Request Process

### Before Submitting

1. Ensure all tests pass: `pnpm test`
2. Run linting: `pnpm lint`
3. Format code: `pnpm format`
4. Update documentation if needed
5. Add tests for new functionality

### PR Requirements

- Clear description of changes
- Reference any related issues
- All CI checks must pass
- At least one maintainer approval required
- No decrease in test coverage

### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(pool): add dynamic fee calculation based on volatility
fix(router): handle edge case in multi-hop swap
docs(readme): update deployment instructions
test(factory): add market creation edge cases
```

## Coding Standards

### Solidity

- Solidity version: ^0.8.20
- Follow Solidity style guide
- Use NatSpec comments for public functions
- Maximum line length: 120 characters
- Use custom errors instead of require strings

```solidity
// Good
error InsufficientBalance(uint256 available, uint256 required);

function withdraw(uint256 amount) external {
    if (balances[msg.sender] < amount) {
        revert InsufficientBalance(balances[msg.sender], amount);
    }
    // ...
}

// Avoid
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount, "Insufficient balance");
    // ...
}
```

### JavaScript/TypeScript

- Use ESLint configuration provided
- Use Prettier for formatting
- Prefer `const` over `let`
- Use async/await over promises

### File Organization

```
contracts/
  core/           # Core protocol logic
  tokens/         # Token implementations
  periphery/      # User-facing contracts
  libraries/      # Shared libraries
  interfaces/     # Contract interfaces
  test/           # Test helper contracts

test/
  core/           # Core contract tests
  tokens/         # Token contract tests
  periphery/      # Periphery contract tests
  libraries/      # Library tests
  integration/    # Integration tests
  helpers/        # Test utilities

scripts/
  deploy.js       # Deployment scripts
  verify.js       # Verification scripts
```

## Testing Requirements

### Coverage Requirements

- Minimum 90% line coverage
- Minimum 85% branch coverage
- All public functions must have tests

### Test Structure

```javascript
describe("ContractName", function () {
    describe("functionName", function () {
        it("Should handle normal case", async function () {
            // Test implementation
        });

        it("Should revert on invalid input", async function () {
            // Test implementation
        });

        it("Should emit correct events", async function () {
            // Test implementation
        });
    });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run with gas reporting
pnpm test:gas

# Run coverage
pnpm coverage

# Run Foundry tests
pnpm test:forge
```

## Security

### Reporting Vulnerabilities

Do NOT open public issues for security vulnerabilities. Instead:

1. Email security concerns to infopaxeer@paxeer.app
2. Include detailed description of the vulnerability
3. Provide steps to reproduce if possible
4. Allow reasonable time for response before disclosure

See [SECURITY.md](SECURITY.md) for full security policy.

### Security Considerations

When contributing, consider:

- Reentrancy attacks
- Integer overflow/underflow (though Solidity 0.8+ has built-in checks)
- Access control
- Front-running vulnerabilities
- Oracle manipulation
- Flash loan attacks

## Questions

For questions or discussions:

- Open a GitHub Discussion
- Join our community channels
- Email: infopaxeer@paxeer.app

## License

By contributing to HLPMM Protocol, you agree that your contributions will be licensed under the GPL-3.0 license.
