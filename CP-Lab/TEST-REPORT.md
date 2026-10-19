# Verification report

Verified on 19 October 2026 in the provided Linux development environment. These are automated fixture/integration results, not a claim of live online judge acceptance or macOS installation testing.

## Passed checks

- **8 Node core / VS Code integration tests, 0 failed, 0 skipped** in the final core run.
- C++17 compilation and execution: matching samples, wrong answer, compilation failure, missing samples.
- Python: matching samples, syntax failure, infinite-loop timeout and bounded excessive output.
- Java: Main.java compilation, matching samples and compiler failure, using the Java 21 compiler module. This environment has the compiler module but no `javac` launcher, so a test-only shim invoked `java com.sun.tools.javac.Main`. The delivered runner uses the user's installed `javac` normally; the shim is not included or needed on a Mac with a JDK.
- Validation of supported URLs, languages, and exact code/test fingerprints.
- Authenticated loopback HTTP bridge: missing token denied, hostile web origin denied, valid import, job claimed once, progress recorded, final result recorded, repeated completion rejected.
- VS Code command flow with a VS Code API stub: source import, existing source preserved, starter TODO blocked, successful run, changed source blocked, checked source queued, verdict displayed and HTML escaped.
- **1 Chromium integration scenario passed**, covering real browser DOM and navigation with Chrome extension API stubs:
  - Codeforces import, selected C++17 native form fields, new submission ID and time/memory.
  - AtCoder sample deduplication across English/Japanese statement sections, selected Java native form fields, new submission ID and metrics.
  - LeetCode starter import, Python language mapping, Run Code comparison and final submission result.
  - Browser popup markup/scripts with the real authenticated local bridge and a responsive screenshot.
- JavaScript syntax checks, installer shell syntax, and VSIX/ZIP structure checks.

## Verification limits

The managed Chromium here prohibits unpacked extension installation. The Chromium scenario therefore uses Chrome API stubs around the actual background/content/popup scripts. Judge requests are intercepted and answered with fixture pages/JSON. The VS Code API is also stubbed in its integration test; it is not a real Extension Host session.

No real account was used, no contest solution was sent, and the user's Mac was not accessed. A live macOS smoke test remains necessary: install VSIX, load unpacked browser extension, pair, import a practice problem, run samples, submit once, and confirm the result on the judge. The web endpoints/selectors can change or be gated by CAPTCHA/login/contest permissions.

`preview-fixture.png` is a UI screenshot with a simulated Accepted result. Its metrics are test data, not measurements from a live submission.
