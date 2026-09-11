"""Read-only UI change gate; baseline has no automatic update command."""
from pathlib import Path
import subprocess
import sys
root = Path(__file__).resolve().parent.parent
result = subprocess.run(['node', str(root / 'tools/check_ui_contract.cjs'), str(root)], capture_output=True, text=True, timeout=120)
sys.stdout.write(result.stdout)
sys.stderr.write(result.stderr)
raise SystemExit(result.returncode)
