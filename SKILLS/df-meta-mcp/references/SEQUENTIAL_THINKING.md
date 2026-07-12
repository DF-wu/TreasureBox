# Sequential thinking (`mcp-sequentialthinking-tools` — 1 tool)

**Only** when the task is explicit multi-step planning with tool bookkeeping — not for normal GitHub/TickTick lookups.

| Tool | Required args (see `sequentialthinking.generated.md`) |
| --- | --- |
| `mcp-sequentialthinking-tools__sequentialthinking_tools` | `available_mcp_tools`, `thought`, `next_thought_needed`, `thought_number`, `total_thoughts` |

Pass a real list of gateway tool names (from `bash scripts/dfmcp list`) in `available_mcp_tools`.
