# LLMDSHPlugin

A collection of DSH (DeepSeek Harness) plugins. Each plugin lives in its own directory under `plugins/` and is an independent npm package.

## Plugins

- [`plugins/token-usage`](plugins/token-usage/README.md): sidebar token usage statistics with an all-time total and a 365-day calendar heatmap.

## Install

Install one plugin from this repository:

```powershell
dsh plugin --profile desktop add D:\WORK\ai-v5\LLMDSHPlugin\plugins\token-usage
```

When installing from GitHub, clone the repository first and install the plugin subdirectory:

```powershell
git clone https://github.com/ai-v5/LLMDSHPlugin.git
dsh plugin --profile desktop add .\LLMDSHPlugin\plugins\token-usage
```

## Development

Run the tests from the plugin directory:

```powershell
cd plugins/token-usage
node --test tests/stats.test.mjs
```

Add future plugins as independent directories under `plugins/`; do not mix their files with an existing plugin.
