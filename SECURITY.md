# Security Policy

## Supported Versions

We release security updates for the following versions of Parchment-Assist:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Parchment-Assist seriously. If you discover a security vulnerability, please follow these steps:

### 1. **Do Not** Open a Public Issue

Please do not report security vulnerabilities through public GitHub issues. This could put users at risk before a fix is available.

### 2. Report Privately

Send your report to the project maintainers via one of these methods:

- **GitHub Security Advisories**: Use the [private vulnerability reporting](https://github.com/PlytonRexus/parchment-assist/security/advisories/new) feature (recommended)
- **Email**: If available, contact the maintainers directly via the email listed in the GitHub profile

### 3. Include Detailed Information

Please include as much of the following information as possible:

- Type of vulnerability (e.g., XSS, command injection, data exposure)
- Full paths of affected source files
- Location of the affected code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability and potential attack scenarios
- Suggested fix (if you have one)

### 4. Response Timeline

- **Initial Response**: We aim to acknowledge your report within 48 hours
- **Status Updates**: We'll provide updates on our progress at least every 7 days
- **Resolution**: We target fixing critical vulnerabilities within 30 days
- **Disclosure**: We'll coordinate with you on the disclosure timeline

## Security Best Practices for Users

### API Key Protection

1. **Never share your API keys**: Keep your Gemini API keys private
2. **Use environment-specific keys**: Don't use production API keys for testing
3. **Rotate keys regularly**: Periodically generate new API keys
4. **Revoke compromised keys**: Immediately revoke any API keys that may have been exposed

### Local vs. Cloud Processing

- **Privacy-conscious users**: Use the local Ollama backend to keep all data on your machine
- **Cloud users**: Understand that Gemini API sends data to Google's servers
- **Review permissions**: Only grant the extension necessary permissions

### Extension Updates

1. **Keep updated**: Install updates promptly to receive security fixes
2. **Review changelogs**: Check CHANGELOG.md for security-related updates
3. **Monitor advisories**: Watch the repository for security announcements

### Secure Development

If you're contributing to Parchment-Assist:

1. **Run security checks**: Use `npm audit` to check for vulnerable dependencies
2. **Follow secure coding practices**: Avoid common vulnerabilities (XSS, injection, etc.)
3. **Test thoroughly**: Include security test cases in your PRs
4. **Review dependencies**: Be cautious when adding new dependencies

## Known Security Considerations

### Data Processing

- **Game text**: The extension processes game text from Parchment player pages
- **AI prompts**: Context and commands are sent to the selected AI backend
- **Storage**: API keys are stored in Chrome's sync storage (encrypted by Chrome)

### Permissions

The extension requires these permissions:

- `storage`: To save settings and API keys
- `activeTab`: To access the Parchment game page
- `scripting`: To inject content scripts
- Host permissions for `https://pr-if.org/*` and AI API endpoints

These permissions are necessary for core functionality and follow the principle of least privilege.

## Security Vulnerability Disclosure Policy

When we receive a security vulnerability report:

1. **Confirmation**: We confirm the vulnerability and assess its severity
2. **Fix Development**: We develop and test a fix
3. **Security Advisory**: We prepare a security advisory
4. **Release**: We release a patched version
5. **Public Disclosure**: We publicly disclose the vulnerability after users have had time to update (typically 7-14 days)
6. **Credit**: We credit the reporter (unless they wish to remain anonymous)

## Scope

This security policy applies to:

- The Parchment-Assist browser extension code
- Official documentation and examples
- The CI/CD infrastructure

Out of scope:

- Third-party services (Ollama, Google Gemini APIs)
- Browser vulnerabilities
- Operating system vulnerabilities

## Security Updates

We publish security updates through:

- GitHub Security Advisories
- CHANGELOG.md with `[SECURITY]` tags
- GitHub Releases with security notes
- Chrome Web Store update notes

## Questions?

If you have questions about this security policy, please open a discussion in the GitHub repository or contact the maintainers.

---

**Thank you for helping keep Parchment-Assist and its users safe!**
