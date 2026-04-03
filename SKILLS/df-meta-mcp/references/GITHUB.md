---

# GITHUB

Use this family for **repository operations, issues, pull requests, reviews, releases, branches, tags, code search, repo/user discovery, and GitHub Copilot delegation**.

## Fast selection rules

- **Already know the repo?** Prefer repo-local `list_*`, `issue_read`, or `pull_request_read`.
- **Searching across GitHub?** Use `search_repositories`, `search_users`, `search_code`, `search_issues`, or `search_pull_requests`.
- **Need a normal issue/PR conversation comment?** Use `add_issue_comment`.
- **Need PR review actions?** Use `pull_request_review_write`.
- **Need to reply inside an existing PR review thread?** Use `add_reply_to_pull_request_comment`.
- **Need to add a comment to the latest pending review?** Use `add_comment_to_pending_review`.
- **Need to update one file?** Use `create_or_update_file`.
- **Need to push several files in one commit?** Use `push_files`.
- **Need background implementation by Copilot?** Use `create_pull_request_with_copilot` or `assign_copilot_to_issue`, then poll `get_copilot_job_status`.

## Important gotchas

- `create_or_update_file` needs the file SHA for existing-file updates.
- `list_pull_requests` is for repo-local PR listing; if the user specifically wants author- or query-based PR search, use `search_pull_requests`.
- Keep comments/reviews straight; there are separate tools for issue comments, review comments, and review-thread replies.

## Use the generated inventory when you need exact tool names / parameters

Open `references/github.generated.md`.