# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| `main` (unreleased) | ✅ |
| Latest released tag | ✅ |
| Older tags | ❌ |

The project follows trunk-based development on `main`; only the most recent
release tag receives backports. Older versions are not patched.

## Reporting a Vulnerability

Please **do not** open a public GitHub Issue for suspected vulnerabilities.

Report privately via one of the following channels:

- **GitHub Security Advisories** (preferred): use the "Security" tab on this
  repository to file a private advisory. Maintainers are notified immediately
  and can discuss the issue, agreed fix timeline, and coordinated disclosure
  in private.
- **Email**: `pis1@qq.com` (PGP key on request). Use the GitHub channel if you
  cannot reach me by email.

You should receive an acknowledgement within **72 hours**. A maintainer will
work with you to confirm the issue, decide on severity and impact, and agree
on a coordinated disclosure window (typically 90 days for non-trivial bugs).

## Scope

This policy covers:

- Source code under `app/`, `components/`, `lib/`, `db/`.
- Build-time configuration under the repository root.
- GitHub Actions workflows under `.github/workflows/`.

Out of scope (third-party supply chain):

- Dependencies published on npm; please report upstream and file an issue
  here so we can pin or replace the affected version.
- The hosted Vercel deployment infrastructure; report via Vercel support.

## Recognition

Reporters are credited in the release notes unless they prefer to remain
anonymous. Hall of fame is not maintained yet; if you want a public credit
list, open an issue.
