# CP Lab

A small, local competitive programming project for macOS: import a problem from your browser, solve it in VS Code, run checks, then submit using your logged-in judge tab.

**Start with [START-HERE-MAC.md](START-HERE-MAC.md).** No paid API, hosted backend, separate server process, or Node installation is needed to use it. The VS Code extension runs the local bridge. Chrome, Brave, or Edge is required; this version does not support Safari or Firefox.

## What you get

- A browser popup with **Open in VS Code** and C++, Python, Java selection.
- Imported starter source, a text copy of the problem statement, and editable sample cases.
- Local compilation and sample runs for Codeforces and AtCoder.
- LeetCode starter classes and example runs through LeetCode's own function harness.
- Pre-submit checks bound to the exact saved code, language, and test cases.
- A VS Code confirmation before sending a solution to the online judge.
- Submission status, verdict, execution time, and memory when the platform exposes them. Missing metrics show “Unavailable” / “—”.
- A VS Code results view with expected/actual output for local samples.

## Supported adapters

| Platform | Problem import | Tests | Submission | Verdict & metrics |
| --- | --- | --- | --- | --- |
| Codeforces | Contest, gym, problemset URLs | Local stdin/stdout samples | Native browser form | Own submissions table |
| AtCoder | Contest task URLs; English/Japanese samples | Local stdin/stdout samples | Native browser form | My Submissions table |
| LeetCode.com | Problem text and selected starter class | LeetCode Run Code | Logged-in web endpoint | Judge check endpoint |

Other sites need a new adapter. LeetCode.cn, interactive problems, output-only tasks, SQL/shell languages, custom checkers, and contest-specific LeetCode URLs are outside this mini project. Private/gated problems require your account to have access.

## Project layout

```text
browser/                 Chrome Manifest V3 extension; load this folder unpacked
vscode/                  VS Code extension and local bridge source
  extension.js           Commands, files, pre-submit checks, results view
  lib/bridge.js          Token-protected HTTP API, job queue and results
  lib/runner.js          Compile/run, timeouts and bounded output
  lib/model.js           Validation, templates and check fingerprints
tests/                   Node tests and Chromium fixture integration test
scripts/package.py       Build the VSIX without npm dependencies
cp-lab-1.0.0.vsix         Ready-to-install VS Code extension
INSTALL-MAC.command      Optional VS Code installer helper
START-HERE-MAC.md         Setup and daily workflow
LAB-NOTES.md              Architecture, viva notes and limitations
TEST-REPORT.md            What was tested and what needs a live check
```

Browser → authenticated `127.0.0.1:27182` → VS Code. VS Code submits a job; the browser reads it and uses your existing judge login. The pairing token stays in VS Code SecretStorage and extension-local browser storage. Passwords and session cookies are not copied into the local bridge. Requests to the judge use the browser's own session and the platform's CSRF handling.

## Development

The extensions use plain JavaScript and built-in platform APIs; there are no npm runtime dependencies.

```bash
# Node 22+ is needed only for development tests.
npm test
# Optional browser fixture test; set CHROMIUM to your browser executable.
npm run test:browser
# Rebuild the installable VS Code extension.
python3 scripts/package.py
```

The browser integration test uses real Chromium DOM, navigation and intercepted judge responses, with Chrome API stubs. It sends no live submissions. The VS Code integration test uses a VS Code API stub and the real local bridge/runner. Install/live-account validation remains necessary on your Mac; see TEST-REPORT.md.

License: MIT.
