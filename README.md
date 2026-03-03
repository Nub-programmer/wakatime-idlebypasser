# wakatime-idlebypasser

A tool that keeps your [WakaTime](https://wakatime.com/) coding tracker active by continuously generating and modifying code files, bypassing the idle-detection timeout.

---

## How It Works

WakaTime monitors file changes in your editor to record coding activity. When no file changes are detected for a set period (the "idle timeout"), it stops recording. **wakatime-idlebypasser** defeats this by running a background script that:

1. Picks a random programming topic (e.g. `math`, `string`, `network`).
2. Creates a code file and appends **2 lines of random, syntactically valid code every 1.5 seconds**.
3. Continuously refreshes the file's timestamp and content so WakaTime detects ongoing activity.
4. Deletes the file after it reaches **200 lines**, then immediately starts a new cycle with a fresh topic.

This cycle repeats indefinitely, keeping your WakaTime status green without you writing a single line of code manually.

Two implementations are provided — **JavaScript** (Node.js) and **Python 3** — so you can use whichever runtime is already installed.

---

## Prerequisites

| Language    | Requirement |
|-------------|-------------|
| JavaScript  | [Node.js](https://nodejs.org/) v14 or later |
| Python      | [Python](https://www.python.org/) 3.6 or later |

WakaTime must be installed and configured in at least one editor on your machine so it can pick up the file changes.

---

## Usage

### JavaScript (Node.js)

```bash
cd javascript
bash run-generator.sh
```

Or run the script directly:

```bash
node javascript/random-js-generator.js
```

To write to a custom target file instead of the default `src/generator/activity-log.js`:

```bash
TARGET_FILE=my/custom/path.js node javascript/random-js-generator.js
# or
node javascript/random-js-generator.js my/custom/path.js
```

### Python

```bash
cd python
bash run-generator.sh
```

Or run the script directly:

```bash
python3 python/random-python-generator.py
```

To write to a custom target file instead of the default `src/generator/activity-log.py`:

```bash
TARGET_FILE=my/custom/path.py python3 python/random-python-generator.py
# or
python3 python/random-python-generator.py my/custom/path.py
```

---

## How to Stop

Press **Ctrl + C** in the terminal where the script is running. The script will clean up (delete the current generated file) before exiting.

---

## Project Structure

```
wakatime-idlebypasser/
├── javascript/
│   ├── random-js-generator.js   # Core JS generator script
│   └── run-generator.sh         # Shell wrapper with auto-restart
├── python/
│   ├── random-python-generator.py  # Core Python generator script
│   └── run-generator.sh            # Shell wrapper with auto-restart
└── README.md
```

---

## Disclaimer

This tool is intended for personal use. Please review [WakaTime's terms of service](https://wakatime.com/legal/terms) before using it. The authors are not responsible for any account actions that may result from its use.