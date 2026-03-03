# Contributing to wakatime-idlebypasser

Thank you for your interest in contributing! All improvements are welcome — bug fixes, new features, better documentation, or a new language implementation.

---

## Getting Started

1. **Fork** this repository and clone your fork:

   ```bash
   git clone https://github.com/<your-username>/wakatime-idlebypasser.git
   cd wakatime-idlebypasser
   ```

2. Create a new branch for your change:

   ```bash
   git checkout -b feature/my-improvement
   ```

3. Make your changes, then commit them with a clear message:

   ```bash
   git commit -m "feat: add Ruby generator"
   ```

4. Push to your fork and open a **Pull Request** against the `main` branch of this repository.

---

## What to Contribute

Here are some ideas for contributions:

- **New language implementations** — add a generator for Ruby, Go, Rust, etc. following the structure of the existing `javascript/` or `python/` directories.
- **Bug fixes** — if you find a case where the generator crashes or fails to keep WakaTime active, please open an issue or submit a fix.
- **Performance improvements** — better timing, smarter refresh strategies, lower CPU usage.
- **Documentation** — clearer explanations, usage examples, or translations.

---

## Adding a New Language Generator

To add a generator for a new language, create a sub-directory named after the language and include:

| File | Purpose |
|------|---------|
| `<language>/random-<language>-generator.<ext>` | Core generator script |
| `<language>/run-generator.sh` | Supervisor shell wrapper that restarts the script on exit |

Your generator should:

1. Pick a random topic from a list (e.g. `math`, `string`, `network`).
2. Create a file and write **2 lines of syntactically valid code** for that language every ~1.5 seconds.
3. Delete the file after it reaches **200 lines** and immediately start a new cycle.
4. Support a `TARGET_FILE` environment variable (and an optional first CLI argument) to override the default output path.
5. Handle `SIGINT`/`SIGTERM` gracefully: clean up the current file before exiting.

---

## Code Style

- Follow the conventions already used in the existing JavaScript and Python scripts.
- Keep generated code syntactically valid for the target language.
- Use clear variable names and add inline comments where the logic is non-obvious.

---

## Reporting Issues

If you encounter a bug or have a feature request, please [open an issue](../../issues) and include:

- Your operating system and version.
- The language implementation you are using (JavaScript / Python).
- Steps to reproduce the problem.
- Any relevant error output from the terminal.

---

## Code of Conduct

Please be respectful and constructive in all interactions. Harassment or abusive behavior will not be tolerated.
