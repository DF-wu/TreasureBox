# Sequential Thinking live inventory

- Family key: `mcp-sequentialthinking-tools`
- Tool count: **1**

> Generated from the live MetaMCP endpoint. Keep manual guidance in the non-generated family docs; use this file for exact tool names and parameter hints.

## `mcp-sequentialthinking-tools__sequentialthinking_tools`

- **What it does:** A detailed tool for dynamic and reflective problem-solving through thoughts.
- **Required params:** `available_mcp_tools`, `thought`, `next_thought_needed`, `thought_number`, `total_thoughts`
- **Optional params (first 8):** `is_revision`, `revises_thought`, `branch_from_thought`, `branch_id`, `needs_more_thoughts`, `current_step`, `previous_steps`, `remaining_steps`
- **Important notes:**
  - IMPORTANT: This server facilitates sequential thinking with MCP tool coordination. The LLM analyzes available tools and their descriptions to make intelligent recommendations, which are then tracked and organized by this server.
