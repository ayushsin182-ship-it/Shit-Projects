# CP Lab for VS Code

Local competitive programming with Codeforces, AtCoder and LeetCode. Install the accompanying unpacked CP Lab browser extension from this project's `browser` folder, then pair it with this companion.

1. Run **CP Lab: Copy Browser Pairing Token** from the Command Palette and paste it into the browser popup.
2. On a supported problem page, choose C++, Python or Java and click **Open in VS Code**.
3. Save your solution and use **CP: Run** in the status bar.
4. After the samples pass, use **CP: Submit** and confirm the judge submission.
5. Keep the judge tab open; see results in **CP: Results**.

The companion creates `statement.md`, `problem.json` and a source file under `~/Documents/CP-Lab`. Existing source and edited tests are preserved on re-import. Edit cases with **CP Lab: Edit Test Cases** and return to the source tab before running.

Codeforces and AtCoder samples use your installed local compiler/interpreter. LeetCode uses its logged-in Run Code service because it requires a function harness. Select compiler executables in VS Code Settings → CP Lab if the GUI PATH differs from Terminal. C++ defaults to C++17; Java uses Main.java for stdin/stdout tasks.

A random pairing token protects the loopback bridge on `127.0.0.1:27182`. Use one CP Lab VS Code window. Browser login cookies stay in the browser. Code runs locally with your user permissions, so run your own solutions only. Passing examples does not establish correctness on hidden tests. Time/memory from the judge appear only when available.

The full project includes `START-HERE-MAC.md`, source, tests and lab notes. This mini project supports regular Codeforces/AtCoder/LeetCode.com problem pages; other sites and special-checker or interactive tasks need further adapters. Judge web interfaces can change.
