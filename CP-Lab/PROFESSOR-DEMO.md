# Five-minute professor demonstration on your Mac

Install the project first using START-HERE-MAC.md. This ZIP was built in a remote development workspace; download/extract it onto your Mac before following installation steps. It is not automatically in your Mac's Documents folder.

Use a personal Chrome browser, one local VS Code window with CP Lab enabled, Python 3, an internet connection, and a Codeforces account. Log in before the demonstration. Test the complete live flow at least once before your presentation.

## Short introduction

“CP Lab connects a competitive programming website to VS Code. It imports the statement and sample tests, runs my solution, blocks submission when checks fail or my code changes, and displays the judge result when available.”

## Demonstration

1. Open `https://codeforces.com/problemset/problem/4/A` in Chrome. This is Watermelon: determine whether a weight can be split into two positive even weights.
2. Click CP Lab, choose Python, and click Open in VS Code. Show `main.py`, `statement.md`, and `problem.json` in the generated problem folder.
3. In the imported `main.py`, enter `print("NO")`. Save, click CP: Run, and show that sample 8 expects YES but produces NO.
4. Click CP: Submit. Show that the pre-submit check blocks submission after a failed test.
5. Replace `main.py` with the correct solution below and save it. Add the tests from `demo/watermelon-tests.json` to the `samples` field in the imported `problem.json`. Return to the `main.py` tab.
6. Click CP: Run and show the passing cases.
7. Add a comment to `main.py` and save it, then try CP: Submit. Show that the extension requires another run because the source changed.
8. Run checks again. Click CP: Submit, confirm once, and keep the Codeforces tab open. Show the submission status and final verdict, time and memory if Codeforces exposes them. Check the judge directly if the result is delayed; avoid duplicate submissions.

Correct Python solution:

```python
w = int(input())
print("YES" if w > 2 and w % 2 == 0 else "NO")
```

The same solution in C++ and Java is included in `demo/`. To use another language, import the problem again with that language selected and copy the corresponding demo code into the newly opened source file. Keep Java's filename as Main.java.

## Explain what the checks mean

Sample tests do not prove correctness on hidden tests. Watermelon has an important edge case: weight 2 is even but cannot be split into two positive even weights. The included custom tests cover it. Judge time and memory are platform measurements; local sample timing is separate.

## Explain the architecture

“Chrome reads the problem page. The VS Code companion creates files and runs the compiler/interpreter. They communicate through an authenticated loopback connection. Submissions use my browser login, and passwords are not sent to the companion.”

## Before the presentation

Install and pair both extensions, verify Python with `python3 --version`, and rehearse a live practice submission on your Mac. Keep a screen recording of your own successful rehearsal as a backup if the lab internet or judge is unavailable. The bundled fixture screenshot shows test data and should not be presented as live acceptance evidence.
