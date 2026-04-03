# GitHub live inventory

- Family key: `github_mcp`
- Tool count: **44**

> Generated from the live MetaMCP endpoint. Keep manual guidance in the non-generated family docs; use this file for exact tool names and parameter hints.

## `github_mcp__add_comment_to_pending_review`

- **What it does:** Add review comment to the requester's latest pending pull request review. A pending review needs to already exist to call this (check with the user if not sure).
- **Required params:** `owner`, `repo`, `pullNumber`, `path`, `body`, `subjectType`
- **Optional params (first 4):** `line`, `side`, `startLine`, `startSide`

## `github_mcp__add_issue_comment`

- **What it does:** Add a comment to a specific issue in a GitHub repository. Use this tool to add comments to pull requests as well (in this case pass pull request number as issue_number), but only if user is not asking specifically to add review comments.
- **Required params:** `owner`, `repo`, `issue_number`, `body`

## `github_mcp__add_reply_to_pull_request_comment`

- **What it does:** Add a reply to an existing pull request comment. This creates a new comment that is linked as a reply to the specified comment.
- **Required params:** `owner`, `repo`, `pullNumber`, `commentId`, `body`

## `github_mcp__assign_copilot_to_issue`

- **What it does:** Assign Copilot to a specific issue in a GitHub repository.
- **Required params:** `owner`, `repo`, `issue_number`
- **Optional params (first 2):** `base_ref`, `custom_instructions`

## `github_mcp__create_branch`

- **What it does:** Create a new branch in a GitHub repository
- **Required params:** `owner`, `repo`, `branch`
- **Optional params (first 1):** `from_branch`

## `github_mcp__create_or_update_file`

- **What it does:** Create or update a single file in a GitHub repository.
- **Required params:** `owner`, `repo`, `path`, `content`, `message`, `branch`
- **Optional params (first 1):** `sha`
- **Important notes:**
  - If updating, you should provide the SHA of the file you want to update. Use this tool to create or update a file in a GitHub repository remotely; do not use it for local file operations.
  - SHA MUST be provided for existing file updates.

## `github_mcp__create_pull_request`

- **What it does:** Create a new pull request in a GitHub repository.
- **Required params:** `owner`, `repo`, `title`, `head`, `base`
- **Optional params (first 3):** `body`, `draft`, `maintainer_can_modify`

## `github_mcp__create_pull_request_with_copilot`

- **What it does:** Delegate a task to GitHub Copilot coding agent to perform in the background. The agent will create a pull request with the implementation. You should use this tool if the user asks to create a pull request to perform a specific task, or if the user asks Copilot to do something.
- **Required params:** `owner`, `repo`, `problem_statement`, `title`
- **Optional params (first 1):** `base_ref`

## `github_mcp__create_repository`

- **What it does:** Create a new GitHub repository in your account or specified organization
- **Required params:** `name`
- **Optional params (first 4):** `autoInit`, `description`, `organization`, `private`

## `github_mcp__delete_file`

- **What it does:** Delete a file from a GitHub repository
- **Required params:** `owner`, `repo`, `path`, `message`, `branch`

## `github_mcp__fork_repository`

- **What it does:** Fork a GitHub repository to your account or specified organization
- **Required params:** `owner`, `repo`
- **Optional params (first 1):** `organization`

## `github_mcp__get_commit`

- **What it does:** Get details for a commit from a GitHub repository
- **Required params:** `owner`, `repo`, `sha`
- **Optional params (first 3):** `include_diff`, `page`, `perPage`

## `github_mcp__get_copilot_job_status`

- **What it does:** Get the status of a GitHub Copilot coding agent job. Use this to check if a previously submitted task has completed and to get the pull request URL once it's created. Provide the job ID (from create_pull_request_with_copilot) or pull request number (from assign_copilot_to_issue), or any pull request you want agent sessions for.
- **Required params:** `owner`, `repo`, `id`

## `github_mcp__get_file_contents`

- **What it does:** Get the contents of a file or directory from a GitHub repository
- **Required params:** `owner`, `repo`
- **Optional params (first 3):** `path`, `ref`, `sha`

## `github_mcp__get_label`

- **What it does:** Get a specific label from a repository.
- **Required params:** `owner`, `repo`, `name`

## `github_mcp__get_latest_release`

- **What it does:** Get the latest release in a GitHub repository
- **Required params:** `owner`, `repo`

## `github_mcp__get_me`

- **What it does:** Get details of the authenticated GitHub user. Use this when a request is about the user's own profile for GitHub. Or when information is missing to build other tool calls.
- **Required params:** (none)

## `github_mcp__get_release_by_tag`

- **What it does:** Get a specific release by its tag name in a GitHub repository
- **Required params:** `owner`, `repo`, `tag`

## `github_mcp__get_tag`

- **What it does:** Get details about a specific git tag in a GitHub repository
- **Required params:** `owner`, `repo`, `tag`

## `github_mcp__get_team_members`

- **What it does:** Get member usernames of a specific team in an organization. Limited to organizations accessible with current credentials
- **Required params:** `org`, `team_slug`

## `github_mcp__get_teams`

- **What it does:** Get details of the teams the user is a member of. Limited to organizations accessible with current credentials
- **Required params:** (none)
- **Optional params (first 1):** `user`

## `github_mcp__issue_read`

- **What it does:** Get information about a specific issue in a GitHub repository.
- **Required params:** `method`, `owner`, `repo`, `issue_number`
- **Optional params (first 2):** `page`, `perPage`

## `github_mcp__issue_write`

- **What it does:** Create a new or update an existing issue in a GitHub repository.
- **Required params:** `method`, `owner`, `repo`
- **Optional params (first 8):** `assignees`, `body`, `duplicate_of`, `issue_number`, `labels`, `milestone`, `state`, `state_reason`

## `github_mcp__list_branches`

- **What it does:** List branches in a GitHub repository
- **Required params:** `owner`, `repo`
- **Optional params (first 2):** `page`, `perPage`

## `github_mcp__list_commits`

- **What it does:** Get list of commits of a branch in a GitHub repository. Returns at least 30 results per page by default, but can return more if specified using the perPage parameter (up to 100).
- **Required params:** `owner`, `repo`
- **Optional params (first 4):** `author`, `page`, `perPage`, `sha`

## `github_mcp__list_issue_types`

- **What it does:** List supported issue types for repository owner (organization).
- **Required params:** `owner`

## `github_mcp__list_issues`

- **What it does:** List issues in a GitHub repository. For pagination, use the 'endCursor' from the previous response's 'pageInfo' in the 'after' parameter.
- **Required params:** `owner`, `repo`
- **Optional params (first 7):** `after`, `direction`, `labels`, `orderBy`, `perPage`, `since`, `state`

## `github_mcp__list_pull_requests`

- **What it does:** List pull requests in a GitHub repository. If the user specifies an author, then DO NOT use this tool and use the search_pull_requests tool instead.
- **Required params:** `owner`, `repo`
- **Optional params (first 7):** `base`, `direction`, `head`, `page`, `perPage`, `sort`, `state`
- **Important notes:**
  - List pull requests in a GitHub repository. If the user specifies an author, then DO NOT use this tool and use the search_pull_requests tool instead.

## `github_mcp__list_releases`

- **What it does:** List releases in a GitHub repository
- **Required params:** `owner`, `repo`
- **Optional params (first 2):** `page`, `perPage`

## `github_mcp__list_tags`

- **What it does:** List git tags in a GitHub repository
- **Required params:** `owner`, `repo`
- **Optional params (first 2):** `page`, `perPage`

## `github_mcp__merge_pull_request`

- **What it does:** Merge a pull request in a GitHub repository.
- **Required params:** `owner`, `repo`, `pullNumber`
- **Optional params (first 3):** `commit_message`, `commit_title`, `merge_method`

## `github_mcp__pull_request_read`

- **What it does:** Get information on a specific pull request in GitHub repository.
- **Required params:** `method`, `owner`, `repo`, `pullNumber`
- **Optional params (first 2):** `page`, `perPage`

## `github_mcp__pull_request_review_write`

- **What it does:** Create and/or submit, delete review of a pull request.
- **Required params:** `method`, `owner`, `repo`, `pullNumber`
- **Optional params (first 3):** `body`, `commitID`, `event`

## `github_mcp__push_files`

- **What it does:** Push multiple files to a GitHub repository in a single commit
- **Required params:** `owner`, `repo`, `branch`, `files`, `message`

## `github_mcp__request_copilot_review`

- **What it does:** Request a GitHub Copilot code review for a pull request. Use this for automated feedback on pull requests, usually before requesting a human reviewer.
- **Required params:** `owner`, `repo`, `pullNumber`

## `github_mcp__run_secret_scanning`

- **What it does:** Scan files, content, or recent changes for secrets such as API keys, passwords, tokens, and credentials.
- **Required params:** `files`, `owner`, `repo`
- **Important notes:**
  - This tool is intended for targeted scans of specific files, snippets, or diffs provided directly as content. The files parameter accepts either a single string or an array of strings containing raw file contents or diff hunks, and returns detected secrets with their locations and related secret scanning metadata. Content must not be empty. For full repository scanning, other mechanisms are available.

## `github_mcp__search_code`

- **What it does:** Fast and precise code search across ALL GitHub repositories using GitHub's native search engine. Best for finding exact symbols, functions, classes, or specific code patterns.
- **Required params:** `query`
- **Optional params (first 4):** `order`, `page`, `perPage`, `sort`

## `github_mcp__search_issues`

- **What it does:** Search for issues in GitHub repositories using issues search syntax already scoped to is:issue
- **Required params:** `query`
- **Optional params (first 6):** `order`, `owner`, `page`, `perPage`, `repo`, `sort`

## `github_mcp__search_pull_requests`

- **What it does:** Search for pull requests in GitHub repositories using issues search syntax already scoped to is:pr
- **Required params:** `query`
- **Optional params (first 6):** `order`, `owner`, `page`, `perPage`, `repo`, `sort`

## `github_mcp__search_repositories`

- **What it does:** Find GitHub repositories by name, description, readme, topics, or other metadata. Perfect for discovering projects, finding examples, or locating specific repositories across GitHub.
- **Required params:** `query`
- **Optional params (first 5):** `minimal_output`, `order`, `page`, `perPage`, `sort`

## `github_mcp__search_users`

- **What it does:** Find GitHub users by username, real name, or other profile information. Useful for locating developers, contributors, or team members.
- **Required params:** `query`
- **Optional params (first 4):** `order`, `page`, `perPage`, `sort`

## `github_mcp__sub_issue_write`

- **What it does:** Add a sub-issue to a parent issue in a GitHub repository.
- **Required params:** `method`, `owner`, `repo`, `issue_number`, `sub_issue_id`
- **Optional params (first 3):** `after_id`, `before_id`, `replace_parent`

## `github_mcp__update_pull_request`

- **What it does:** Update an existing pull request in a GitHub repository.
- **Required params:** `owner`, `repo`, `pullNumber`
- **Optional params (first 7):** `base`, `body`, `draft`, `maintainer_can_modify`, `reviewers`, `state`, `title`

## `github_mcp__update_pull_request_branch`

- **What it does:** Update the branch of a pull request with the latest changes from the base branch.
- **Required params:** `owner`, `repo`, `pullNumber`
- **Optional params (first 1):** `expectedHeadSha`
