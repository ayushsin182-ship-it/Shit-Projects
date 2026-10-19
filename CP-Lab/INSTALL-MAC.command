#!/bin/bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
vscode_cli="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
if [[ ! -x "$vscode_cli" ]]; then
  vscode_cli="$HOME/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
fi
if [[ ! -x "$vscode_cli" ]]; then
  printf '%s\n' 'Install Visual Studio Code first, then use Extensions > … > Install from VSIX…' 'See START-HERE-MAC.md in this folder.'
  read -r -p 'Press Return to close. '
  exit 1
fi
"$vscode_cli" --install-extension "$project_dir/cp-lab-1.0.0.vsix"
open -a 'Visual Studio Code'
open "$project_dir/browser"
printf '%s\n' '' 'VS Code companion installed.' 'Next: open chrome://extensions, enable Developer mode, click Load unpacked, and choose the browser folder.' 'Then run CP Lab: Copy Browser Pairing Token in VS Code and pair in the browser popup.' 'Full instructions: START-HERE-MAC.md'
read -r -p 'Press Return to close. '
