# Product Forge — Build & Install

## Build & Install Plugins

```powershell
# PowerShell — build and install all 3 plugins (forge-shared, forge, forge-gpt)
.\build-all.ps1 -Install
```

```bash
# Bash — build and install all 3 plugins (forge-shared, forge, forge-gpt)
./build-all.sh --install
```

### Individual Plugin Scripts

```powershell
.\build-plugin.ps1 -Install          # forge only
.\build-forge-gpt-plugin.ps1 -Install # forge-gpt only
```

```bash
./build-plugin.sh --install          # forge only
./build-forge-gpt-plugin.sh --install # forge-gpt only
```

### Build Only (no install)

Omit the `-Install` / `--install` flag to build without installing:

```powershell
.\build-all.ps1
```

```bash
./build-all.sh
```

Build outputs go to `dist-shared/`, `dist/`, and `dist-forge-gpt/`.
