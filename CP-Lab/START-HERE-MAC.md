# Run CP Lab on your Mac

## 1. Install the basics

Install **Visual Studio Code** and **Google Chrome**, **Brave**, or **Microsoft Edge**.

For Codeforces/AtCoder local tests, install the tools for the language you plan to use:

| Language | Needed | Check in Terminal |
| --- | --- | --- |
| C++ | Apple Command Line Tools | `clang++ --version` |
| Python | Python 3 | `python3 --version` |
| Java | JDK 17 or newer | `javac -version` and `java -version` |

For C++: run `xcode-select --install` in Terminal if the command line tools are missing. macOS `g++` normally invokes Apple clang. The included starter uses standard headers, so it works with clang. GNU-only headers such as `bits/stdc++.h` require a Homebrew GCC install and setting **CP Lab: Cpp Compiler** to that executable, for example `g++-14` if that is the version you installed. Do not assume an installed GCC version.

Python 3 can be installed from python.org; Java from a JDK provider such as Eclipse Temurin. You only need the languages you intend to test locally. VS Code uses its own Node runtime; you do not need to install Node to use this project.

## 2. Install the VS Code companion

1. Extract the project ZIP and keep the extracted **CP-Lab** folder.
2. Open VS Code.
3. Open Extensions with **⇧⌘X**.
4. Click the **…** menu → **Install from VSIX…**.
5. Choose **cp-lab-1.0.0.vsix** from the project folder. Install it and reload VS Code if requested.
6. Use a trusted local VS Code window. Keep only one VS Code window running CP Lab, because the local bridge uses one fixed port.

Alternative: double-click **INSTALL-MAC.command** to install the VSIX using the VS Code application CLI. The manual menu method works if macOS blocks the downloaded script. This helper does not install compilers.

## 3. Load the browser extension

1. In Chrome, open `chrome://extensions`.
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the **browser** subfolder, which contains `manifest.json`.
4. Pin **CP Lab** using the browser's Extensions button.
5. Refresh any problem pages you had open before installing it.

Keep the project folder where it is after loading it; the browser reads the extension from that folder. A browser managed by your college may block unpacked extensions.

## 4. Pair once

1. In VS Code press **⇧⌘P**.
2. Run **CP Lab: Copy Browser Pairing Token**.
3. Open the CP Lab browser popup.
4. Expand **Connect your local workspace**, paste the token, and click **Pair**.
5. The badge should say **Connected**.

Treat this token as private. If VS Code is closed later, **Open in VS Code** can launch it through `vscode://cplab.cp-lab/open`; allow the browser's “Open Visual Studio Code” prompt. Opening VS Code manually is also fine. An open VS Code window is needed to run the bridge. If the browser popup closes during the application-launch prompt, reopen it and click the button again.

## 5. Solve and submit

1. Log in on Codeforces, AtCoder or LeetCode. Open a regular problem URL, such as:
   - `https://codeforces.com/problemset/problem/4/A`
   - `https://atcoder.jp/contests/abc086/tasks/abc086_a`
   - `https://leetcode.com/problems/two-sum/`
2. Open the popup, choose **C++**, **Python**, or **Java**, then click **Open in VS Code**.
3. Write your solution in the opened source file and save with **⌘S**.
4. Click **CP: Run** in VS Code's status bar, or run **CP Lab: Run Samples / Pre-submit Checks**.
5. Read the results. Fix errors until all imported/edited cases pass.
6. Click your solution tab again if you have opened `problem.json`. Click **CP: Submit** and confirm **Submit** in VS Code.
7. Keep the original judge tab open. It will submit using your current browser session. Codeforces/AtCoder may navigate to their submit/results pages.
8. View the final verdict, time and memory in **CP: Results** or the browser popup.

Editing code or test cases invalidates the previous check. Run the checks again before submitting. LeetCode uses its own Run Code harness; keep the class/function signature from its starter. It requires an internet connection and can be rate limited. Do not manually make another submission to the same problem while an extension submission is pending.

## Add or change tests

Run **CP Lab: Edit Test Cases**. In `problem.json`, edit the `samples` array for Codeforces/AtCoder:

```json
"samples": [
  { "input": "2 3\n", "output": "5\n" },
  { "input": "0 0\n", "output": "0\n" }
]
```

This example is for an addition problem; use inputs and outputs appropriate to your problem. Save the JSON, return to your solution, and run checks again. Existing tests and code are kept on re-import. Rename/delete the old problem folder if you need a completely fresh import.

LeetCode uses the `testInput` string instead, in LeetCode's format: one argument per line, followed by subsequent test cases. For Two Sum, an example is `"[2,7,11,15]\n9"`. LeetCode calculates expected results with its reference solution. Edit carefully; malformed input will be rejected by the platform.

The default problem directory is **~/Documents/CP-Lab/**. Each problem folder contains `statement.md`, `problem.json`, and your language file (`main.cpp`, `main.py`, or `Main.java`). You can open `statement.md` in VS Code to read the imported text. Math and images are not preserved as a full offline rendering; use the original problem page for those.

## If something goes wrong

| Symptom | Fix |
| --- | --- |
| Not connected | Start VS Code, enable/trust CP Lab, and pair again if needed. |
| Port already in use | Close other VS Code windows running CP Lab, then reload the intended window. |
| Compiler not found | Check the language tool in Terminal. Set the absolute executable path in VS Code Settings → CP Lab if the GUI PATH differs. On Apple Silicon Homebrew is usually under `/opt/homebrew/bin`; on Intel Macs `/usr/local/bin`. |
| Missing local samples | Add cases in `problem.json`; submit stays blocked until at least one case passes. |
| Python/Java won't select on the judge | The judge may have changed its language labels or may not offer that language for this task. Check the submit form. |
| Submit needs attention | Log in, register for the contest if needed, solve CAPTCHA/verification in the browser, and retry checks. Never keep retrying if the judge may already have received the submission. |
| Job queued too long | Keep the original problem tab open. Restore/focus it if the browser throttled a background tab. Jobs expire after four minutes. |
| Result not available | Open your judge's submissions page before retrying; a submission may already exist. |
| Bridge disconnected during submission | First check the judge. Reload the problem tab after restoring VS Code. The extension avoids automatically resending a submitted job. |
| LeetCode run fails | Refresh and log in, confirm the starter signature, check `testInput`, and respect rate limits. |
| Page/adapter stopped working | Judge HTML and web endpoints can change. The relevant code is in `browser/common.js`, `content.js`, and `background.js`. Reload the browser extension after changes. |

Local comparisons ignore whitespace and compare remaining tokens exactly. Floating point tolerances, alternative valid answers and custom checkers need manual inspection; this version does not implement them. Local wall time differs from judge execution time. Local memory usage is shown as unavailable.

## Remove it

Remove CP Lab on the browser's Extensions page and uninstall the companion from VS Code. Your solutions remain in `~/Documents/CP-Lab`. No background daemon or LaunchAgent is installed.
