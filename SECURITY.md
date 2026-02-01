# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | Yes                |
| < 1.0   | No                 |

## Reporting a Vulnerability

The HLPMM Protocol team takes security vulnerabilities seriously. We appreciate your efforts to responsibly disclose your findings.

### Do NOT

- Open public GitHub issues for security vulnerabilities
- Disclose vulnerabilities publicly before they are fixed
- Exploit vulnerabilities beyond what is necessary to demonstrate them

### How to Report

1. **Email**: Send details to **infopaxeer@paxeer.app**
2. **Subject**: Use format `[SECURITY] Brief description`
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Any suggested fixes (optional)

### What to Expect

| Timeframe | Action |
|-----------|--------|
| 24 hours | Acknowledgment of report |
| 72 hours | Initial assessment |
| 7 days | Detailed response with remediation plan |
| 30-90 days | Fix deployed (depending on severity) |

### Severity Levels

**Critical**
- Direct loss of funds
- Protocol-wide exploits
- Unauthorized minting of tokens

**High**
- Significant financial impact
- Privilege escalation
- Denial of service affecting core functions

**Medium**
- Limited financial impact
- Partial denial of service
- Information disclosure

**Low**
- Minimal impact
- Best practice violations
- Minor information leaks

## Bug Bounty Program

We maintain a bug bounty program for responsible disclosure of security vulnerabilities.

### Rewards

| Severity | Reward Range |
|----------|--------------|
| Critical | $10,000 - $50,000 |
| High | $5,000 - $10,000 |
| Medium | $1,000 - $5,000 |
| Low | $100 - $1,000 |

### Eligibility

- First reporter of a unique vulnerability
- Report includes clear reproduction steps
- Vulnerability is within scope (see below)
- No violation of responsible disclosure guidelines

### In Scope

- Smart contracts in `contracts/` directory
- Protocol logic and access control
- Token handling and transfers
- Fee calculation and distribution
- AMM mechanics

### Out of Scope

- Frontend applications
- Third-party dependencies (report upstream)
- Already known issues
- Theoretical vulnerabilities without proof of concept

## Security Measures

### Smart Contract Security

- **Compiler**: Solidity 0.8.20+ with overflow checks
- **Access Control**: Role-based permissions
- **Reentrancy**: Mutex locks on state-changing functions
- **Slippage**: User-defined minimums on all swaps
- **Deadlines**: Transaction expiry protection

### Audit Status

| Auditor | Date | Report |
|---------|------|--------|
| TBD | TBD | Pending |

### Known Limitations

1. **Centralized Minting**: USID can only be minted by the factory
2. **Immutable Contracts**: No upgrade mechanism by design
3. **Oracle-Free**: No external price feeds, uses internal AMM pricing

## Security Best Practices for Users

### Before Trading

- Verify contract addresses on [Paxscan](https://paxscan.paxeer.app)
- Use appropriate slippage settings
- Check price impact before large trades

### Wallet Security

- Use hardware wallets for significant holdings
- Never share private keys
- Verify transaction details before signing

### Contract Interaction

- Use official UI at [paxeer.app](https://paxeer.app)
- Double-check recipient addresses
- Start with small test transactions

## Contact

- **Security Email**: infopaxeer@paxeer.app
- **General Inquiries**: https://paxeer.app
- **Documentation**: https://docs.hyperpaxeer.com
