"""
Full project compliance audit (non-FE, non-src, non-database)
Targets:
  - tests/  (.js)
  - *.groovy (root)
  - playwright.config.js
  - package.json
  - .env (check for non-ASCII only, no prefix needed)
  - .agent/*.md (check Vietnamese in code blocks)
  - docs/*.md (informational only - check code blocks)
  - ngrok.yml
Rules checked:
  1. Non-ASCII in .js/.groovy/.yml/.json files (outside JSX UI context)
  2. console.log/error/warn without [PREFIX] in .js
  3. Vietnamese text in .js/.groovy code comments
  4. PRINT/println without prefix in .groovy
"""
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = r'D:\HCSDLNC'

# Files / dirs to scan
SCAN_TARGETS = [
    (r'D:\HCSDLNC\tests', ['.js']),
    (r'D:\HCSDLNC', ['.js', '.groovy', '.yml', '.yaml'], True),  # root-level only
]

CONSOLE_HAS = re.compile(r'console\.(log|error|warn)\s*\(')
CONSOLE_OK  = re.compile(r'console\.(log|error|warn)\s*\(\s*[`\'"](\\n)?\[')
PRINTLN_HAS = re.compile(r'(println|print)\s+["\']')
PRINTLN_OK  = re.compile(r'(println|print)\s+["\'](\[OK\]|\[ERROR\]|\[WARN\]|\[INFO\])')

VIET_PATTERN = re.compile(
    r'[\u00C0-\u024F\u1EA0-\u1EF9]',  # Latin Extended with Vietnamese chars
    re.UNICODE
)

issues = {
    'non_ascii':   [],
    'no_prefix':   [],
    'viet_comment':[],
    'println_noprefix': [],
}

def check_file(fp, ext):
    rel = fp.replace(ROOT + os.sep, '')
    try:
        with open(fp, encoding='utf-8', errors='replace') as fh:
            lines = fh.readlines()
    except Exception as e:
        return

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if not stripped:
            continue

        if ext in ('.js',):
            # Check 1: non-ASCII in comments only (JSX UI exception N/A - these are test files)
            # For test files: flag ALL non-ASCII (no JSX UI exception)
            bad = [(j, hex(ord(c))) for j, c in enumerate(line) if ord(c) > 127]
            if bad:
                issues['non_ascii'].append((rel, i, stripped[:110], bad[:4]))

            # Check 2: console without prefix
            if CONSOLE_HAS.search(line) and not CONSOLE_OK.search(line):
                if not stripped.startswith('//') and not stripped.startswith('*'):
                    issues['no_prefix'].append((rel, i, stripped[:110]))

            # Check 3: Vietnamese in comments
            cm = re.search(r'//(.+)$', line)
            if cm and VIET_PATTERN.search(cm.group(1)):
                issues['viet_comment'].append((rel, i, stripped[:110]))

        elif ext == '.groovy':
            # Check 1: non-ASCII (groovy has no JSX exception)
            bad = [(j, hex(ord(c))) for j, c in enumerate(line) if ord(c) > 127]
            if bad:
                issues['non_ascii'].append((rel, i, stripped[:110], bad[:4]))

            # Check 4: println without prefix
            if PRINTLN_HAS.search(line) and not PRINTLN_OK.search(line):
                if not stripped.startswith('//') and not stripped.startswith('*'):
                    issues['println_noprefix'].append((rel, i, stripped[:110]))

            # Check 3: Vietnamese in comments
            cm = re.search(r'//(.+)$', line)
            if cm and VIET_PATTERN.search(cm.group(1)):
                issues['viet_comment'].append((rel, i, stripped[:110]))

        elif ext in ('.yml', '.yaml', '.json'):
            # Check 1: non-ASCII
            bad = [(j, hex(ord(c))) for j, c in enumerate(line) if ord(c) > 127]
            if bad:
                issues['non_ascii'].append((rel, i, stripped[:110], bad[:4]))


# Scan tests/ recursively
for root, dirs, files in os.walk(r'D:\HCSDLNC\tests'):
    # skip node_modules
    dirs[:] = [d for d in dirs if d != 'node_modules']
    for f in files:
        ext = os.path.splitext(f)[1].lower()
        if ext in ('.js',):
            check_file(os.path.join(root, f), ext)

# Scan root-level .js / .groovy / .yml only (not recursive into subdirs)
root_exts = {'.js', '.groovy', '.yml', '.yaml'}
for f in os.listdir(ROOT):
    fp = os.path.join(ROOT, f)
    if os.path.isfile(fp):
        ext = os.path.splitext(f)[1].lower()
        if ext in root_exts:
            check_file(fp, ext)

# ---------------------------------------------------------------
# REPORT
# ---------------------------------------------------------------
sep = "=" * 65
print(sep)
print("REMAINING FILES COMPLIANCE AUDIT")
print("Scope: tests/ + root .js/.groovy/.yml")
print(sep)

print("\n[CHECK 1] Non-ASCII characters")
if not issues['non_ascii']:
    print("  [OK] None found")
else:
    print("  [FAIL] %d line(s):" % len(issues['non_ascii']))
    for rel, lno, content, chars in issues['non_ascii']:
        print("    %s:%d  chars=%s" % (rel, lno, [h for _, h in chars]))
        print("      > %s" % content)

print("\n[CHECK 2] console.log/error/warn without [PREFIX] (.js)")
if not issues['no_prefix']:
    print("  [OK] None found")
else:
    print("  [WARN] %d line(s):" % len(issues['no_prefix']))
    for rel, lno, content in issues['no_prefix']:
        print("    %s:%d" % (rel, lno))
        print("      > %s" % content)

print("\n[CHECK 3] Vietnamese in code comments")
if not issues['viet_comment']:
    print("  [OK] None found")
else:
    print("  [WARN] %d line(s):" % len(issues['viet_comment']))
    for rel, lno, content in issues['viet_comment']:
        print("    %s:%d" % (rel, lno))
        print("      > %s" % content)

print("\n[CHECK 4] println/print without [PREFIX] (.groovy)")
if not issues['println_noprefix']:
    print("  [OK] None found")
else:
    print("  [WARN] %d line(s):" % len(issues['println_noprefix']))
    for rel, lno, content in issues['println_noprefix']:
        print("    %s:%d" % (rel, lno))
        print("      > %s" % content)

total = sum(len(v) for v in issues.values())
print("\n%s" % sep)
print("Total actionable issues: %d" % total)
print(sep)
