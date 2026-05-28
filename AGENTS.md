# pi-emote

Animated pixel-art emote widget for pi TUI. Displays a reactive avatar that changes expression based on agent activity (thinking, talking, reading, writing, tool use, etc.).

## Configuration

pi-emote uses layered configuration with deep merge. Higher-priority layers override lower ones field-by-field.

### Priority (lowest → highest)

| Layer | Path | Purpose |
|-------|------|---------|
| Extension defaults | `<ext-dir>/config.json` | Shipped defaults |
| User global | `~/.pi/agent/extensions/pi-emote/config.json` | Personal preferences |
| Project local | `.pi/extensions/pi-emote/config.json` | Project-specific overrides |

### Config Fields

```json
{
  "enabled": true,
  "debug": false,
  "size": 8,
  "readingSpeed": 4,
  "hideBelow": 80,
  "holdDuration": {
    "hi": 2000,
    "success": 1200,
    "failure": 1200
  },
  "blinkInterval": [3000, 6000],
  "talkTickMs": 120,
  "cycleMs": 500,
  "emotes": [
    { "model": "*", "emote-set": "default" }
  ],
  "terminals": [
    { "match": "zellij", "render": "ascii" },
    { "match": "tmux", "render": "auto" },
    { "match": "screen", "render": "ascii" },
    { "match": "wezterm", "render": "iterm2" },
    { "match": "ghostty", "render": "kitty" },
    { "match": "windows", "render": "sixel" },
    { "match": "powershell", "render": "sixel" }
  ]
}
```

- **enabled** — Toggle the widget on/off.
- **debug** — Enable debug logging to `debug.log` in the extension directory.
- **size** — Avatar width in terminal cells.
- **readingSpeed** — Words per second used to pace talk animation duration.
- **hideBelow** — Hide widget when terminal is narrower than this (columns).
- **holdDuration** — How long (ms) to display hi/success/failure before transitioning.
- **blinkInterval** — Random range `[min, max]` (ms) between idle blinks and think swaps.
- **talkTickMs** — Interval (ms) between mouth frame changes during talk.
- **cycleMs** — Frame cycle interval (ms) for read/write/tool animations.
- **emotes** — Model-to-emote-set mapping (see below).
- **terminals** — Terminal-to-renderer mapping (see below).

You only need to include fields you want to override. Unspecified fields inherit from lower-priority layers.

### Minimal Override Example

```json
{
  "size": 12,
  "holdDuration": { "hi": 3000 }
}
```

This changes only `size` and `holdDuration.hi`; all other settings keep their defaults.

## Emote Sets

Emote sets are directories containing frame images organized by state.

### Model-Based Selection

The `emotes` array maps model IDs to emote sets using glob patterns:

```json
{
  "emotes": [
    { "model": "*", "emote-set": "default" },
    { "model": "*opus*", "emote-set": "serious-avatar" },
    { "model": "*flash*", "emote-set": "speedy" }
  ]
}
```

- Patterns use glob syntax (`*` = any characters, `?` = single character).
- Matching is case-insensitive against the model `id` (e.g. `claude-opus-4.6`).
- **Last match wins** — order matters.
- If multiple non-catch-all patterns match, a warning is logged.
- The `emotes` array uses **append** semantics: entries from all config layers are concatenated (extension → user → project). Since last match wins, higher-priority layers naturally override lower ones. An empty array `[]` is treated as "not set" and skipped.

## Terminal Renderer Overrides

The `terminals` array maps detected terminal/multiplexer names to specific image renderers. This patches cases where pi-tui's auto-detection is incorrect.

### How It Works

1. **Multiplexer detection** (checked first): env vars like `ZELLIJ`, `TMUX`, `TERM=screen*` identify multiplexers.
2. **Terminal detection**: `TERM_PROGRAM`, `KITTY_WINDOW_ID`, `WEZTERM_PANE`, etc. identify the terminal emulator.
3. **Whitelist lookup**: the detected name is matched against the `terminals` array — first match wins.
4. **Fallback**: if no match, pi-tui's `getCapabilities().images` is used.

### Detected Names

| Name | Detected via |
|------|-------------|
| `zellij` | `$ZELLIJ_SESSION_NAME` or `$ZELLIJ` |
| `tmux` | `$TMUX` or `$TERM` starts with `tmux` |
| `screen` | `$TERM` starts with `screen` |
| `kitty` | `$KITTY_WINDOW_ID` or `$TERM_PROGRAM=kitty` |
| `ghostty` | `$GHOSTTY_RESOURCES_DIR` or `$TERM_PROGRAM=ghostty` |
| `wezterm` | `$WEZTERM_PANE` or `$TERM_PROGRAM=WezTerm` |
| `iterm2` | `$ITERM_SESSION_ID` or `$TERM_PROGRAM=iTerm.app` |
| `vscode` | `$TERM_PROGRAM=vscode` |
| `alacritty` | `$TERM_PROGRAM=alacritty` |
| `windows` | `$WT_SESSION` or `$TERM_PROGRAM=WindowsTerminal` |
| `powershell` | `$SHELL` ends with `pwsh`/`powershell`, or `$PSModulePath` contains `PowerShell` |
| `unknown` | Nothing matched |

### Render Values

- `"kitty"` — Kitty graphics protocol (direct passthrough, experimental in tmux)
- `"kitty-unicode"` — Kitty Unicode placeholders (pane-safe, experimental in tmux)
- `"iterm2"` — iTerm2 inline image protocol (experimental in tmux)
- `"sixel"` — SIXEL protocol (Windows Terminal, PowerShell, mlterm, etc.)
- `"ascii"` — Text-only fallback
- `"auto"` — Auto-detect: checks passthrough support and detects outer terminal

### Shipped Defaults

```json
{
  "terminals": [
    { "match": "zellij", "render": "ascii" },
    { "match": "tmux", "render": "auto" },
    { "match": "screen", "render": "ascii" },
    { "match": "wezterm", "render": "iterm2" },
    { "match": "ghostty", "render": "kitty" },
    { "match": "windows", "render": "sixel" },
    { "match": "powershell", "render": "sixel" }
  ]
}
```

tmux defaults to `"auto"` — auto-detects the outer terminal. Ghostty and kitty get `kitty-unicode` (pane-safe image rendering); other outer terminals fall back to ASCII with a helpful message. Other multiplexers (zellij, screen) default to `"ascii"`. WezTerm uses iTerm2 protocol (more reliable than Kitty on WezTerm). Windows Terminal and PowerShell default to `"sixel"` (native SIXEL support). Terminals not listed (e.g., kitty, iterm2) fall through to pi-tui auto-detection.

### tmux Requirements

For image rendering through tmux (experimental), users need these settings in `tmux.conf`:

```bash
# Required — allow image sequences to pass through to the outer terminal
set -g allow-passthrough on

# Required — detect outer terminal when attaching from a different terminal
set -ga update-environment TERM
set -ga update-environment TERM_PROGRAM

# Recommended — reduces flicker during animation
set -sg escape-time 0
```

After changes, tmux must be fully restarted (`tmux kill-server && tmux`).

The auto-detection flow for tmux (when render is `"auto"`):
1. Check `allow-passthrough` is `on` or `all` via `tmux show-options -g`
2. Detect outer terminal via `tmux show-environment TERM_PROGRAM` (session-level, falls back to global)
3. Map outer terminal to protocol: ghostty/kitty → kitty-unicode (pane-safe), iTerm.app/WezTerm → ascii (no pane-safe renderer available)
4. Use `TmuxKittyUnicodeRenderer` for Ghostty/kitty; all others fall back to ASCII

If the user explicitly configures a concrete render value (`"kitty"`, `"kitty-unicode"`, `"iterm2"`, `"sixel"`, `"ascii"`) for tmux, all auto-detection and warnings are skipped.

> **Note:** SIXEL does not support tmux passthrough. If you need image rendering through tmux on Windows/macOS, use kitty or iTerm2 protocols instead.

### Override Example

To force ASCII for tmux (disable image auto-detection):

```json
{
  "terminals": [
    { "match": "tmux", "render": "ascii" }
  ]
}
```

Or force a specific renderer:

```json
{
  "terminals": [
    { "match": "tmux", "render": "kitty-unicode" }
  ]
}
```

Setting a concrete value skips auto-detection and suppresses warnings.

The `terminals` array uses **merge-by-key** semantics: entries are merged by `match` key across all config layers (extension → user → project). Higher-priority layers replace entries with the same key, or append new ones. You only need to include the entries you want to override or add.

### Windows Terminal + PowerShell

Windows Terminal (1.19+) and PowerShell on Windows/macOS/Linux are supported via the **SIXEL** protocol. pi-emote auto-detects these shells and uses SixelRenderer by default — no configuration required.

**Requirements:**
- Windows Terminal 1.19+ (for Windows Terminal users)
- PowerShell 5.1+ or PowerShell Core 7+
- No tmux in between — SIXEL does not support tmux passthrough

If SIXEL rendering fails, pi-emote falls back to ASCII automatically.

### Emote Set Lookup

When resolving an emote set name, pi-emote searches these locations in order:

1. **Project:** `.pi/extensions/pi-emote/emotes/<set-name>/`
2. **User:** `~/.pi/agent/extensions/pi-emote/emotes/<set-name>/`
3. **Extension:** `<ext-dir>/emotes/<set-name>/`
4. **Fallback:** `<ext-dir>/emotes/default/`

### Directory Structure

Each emote set directory contains state subdirectories with PNG frames:

```
emotes/<set-name>/
├── emotes.json          # Frame configuration (optional)
├── hi/
│   └── *.png
├── idle/
│   ├── idle.png
│   └── idle_blink.png
├── think/
│   ├── think.png
│   └── think_hard.png
├── talk/
│   ├── close.png
│   ├── open_small.png
│   └── open_wide.png
├── read/
│   └── *.png
├── write/
│   └── *.png
├── tool/
│   └── *.png
├── success/
│   └── *.png
├── failure/
│   └── *.png
└── compact/
    └── *.png
```

### emotes.json (per set)

Optional file inside each emote set to configure frame behavior:

```json
{
  "idle": {
    "default": "idle.png",
    "blink": "idle_blink.png"
  },
  "think": {
    "default": "think.png",
    "hard": "think_hard.png"
  },
  "talk": {
    "weights": {
      "close.png": 1,
      "open_small.png": 3,
      "open_wide.png": 1
    }
  }
}
```

### Creating a Custom Emote Set

1. Create the directory in the appropriate location:
   ```bash
   mkdir -p ~/.pi/agent/extensions/pi-emote/emotes/my-avatar/{idle,think,talk,read,write,tool,hi,success,failure,compact}
   ```

2. Add PNG frames to each state directory. Not all states are required — missing states will have no animation for that action.

3. Optionally add `emotes.json` for frame configuration.

4. Map a model to your set in config:
   ```json
   {
     "emotes": [
       { "model": "*", "emote-set": "default" },
       { "model": "*opus*", "emote-set": "my-avatar" }
     ]
   }
   ```

### Project-Wide Override

To use a single custom emote for all models in a project:

`.pi/extensions/pi-emote/config.json`:
```json
{
  "emotes": [
    { "model": "*", "emote-set": "project-mascot" }
  ]
}
```

Place the frames in `.pi/extensions/pi-emote/emotes/project-mascot/`.
