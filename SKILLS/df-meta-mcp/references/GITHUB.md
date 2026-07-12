# GitHub (`github_mcp` — 44 tools)

Full param schemas: `github.generated.md`. Call pattern: `bash scripts/dfmcp call github_mcp__<suffix> --args '{...}' --output json`.

## Read / discover

| Task | Tool |
| --- | --- |
| Who am I | `github_mcp__get_me` |
| Find repos | `github_mcp__search_repositories` |
| Find users | `github_mcp__search_users` |
| Search code | `github_mcp__search_code` |
| Search issues | `github_mcp__search_issues` |
| Search PRs | `github_mcp__search_pull_requests` |
| Search commits | `github_mcp__search_commits` |
| List issues in repo | `github_mcp__list_issues` |
| Read one issue | `github_mcp__issue_read` |
| List PRs in repo | `github_mcp__list_pull_requests` |
| Read one PR | `github_mcp__pull_request_read` |
| File or dir at ref | `github_mcp__get_file_contents` |
| One commit | `github_mcp__get_commit` |
| List commits | `github_mcp__list_commits` |
| Branches / tags | `github_mcp__list_branches`, `github_mcp__list_tags`, `github_mcp__get_tag` |
| Releases | `github_mcp__list_releases`, `github_mcp__get_latest_release`, `github_mcp__get_release_by_tag` |
| Label | `github_mcp__get_label` |
| Collaborators | `github_mcp__list_repository_collaborators` |
| Org teams | `github_mcp__get_teams`, `github_mcp__get_team_members` |
| Issue fields/types (Projects) | `github_mcp__list_issue_fields`, `github_mcp__list_issue_types` |

## Write / mutate

| Task | Tool |
| --- | --- |
| Create repo | `github_mcp__create_repository` |
| Fork | `github_mcp__fork_repository` |
| New branch | `github_mcp__create_branch` |
| Open PR | `github_mcp__create_pull_request` |
| Update PR metadata | `github_mcp__update_pull_request` |
| Merge PR | `github_mcp__merge_pull_request` |
| Update PR branch from base | `github_mcp__update_pull_request_branch` |
| Create/update issue | `github_mcp__issue_write` |
| Sub-issue link | `github_mcp__sub_issue_write` |
| Issue/PR thread comment | `github_mcp__add_issue_comment` |
| PR review (create/submit/delete) | `github_mcp__pull_request_review_write` |
| Comment on pending review | `github_mcp__add_comment_to_pending_review` |
| Reply on review comment thread | `github_mcp__add_reply_to_pull_request_comment` |
| Request Copilot review on PR | `github_mcp__request_copilot_review` |
| One file commit | `github_mcp__create_or_update_file` (existing file needs `sha`) |
| Multi-file commit | `github_mcp__push_files` |
| Delete file | `github_mcp__delete_file` |
| Secret scanning | `github_mcp__run_secret_scanning` |

## Rules

- Known `owner/repo` → `list_*` / `*_read`; cross-repo or query syntax → `search_*`.
- `github_mcp__add_issue_comment` accepts PR number as `issue_number` for general conversation, not line-level review.
- No `assign_copilot_to_issue` / `create_pull_request_with_copilot` on this gateway — only `github_mcp__request_copilot_review`.
