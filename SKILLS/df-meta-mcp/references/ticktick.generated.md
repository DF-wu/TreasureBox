# TickTick live inventory

- Family key: `ticktick`
- Tool count: **22**

> Generated from the live MetaMCP endpoint. Keep manual guidance in the non-generated family docs; use this file for exact tool names and parameter hints.

## `ticktick__batch_add_tasks`

- **What it does:** Batch add multiple tasks to TickTick. Each task should have required fields filled in.
- **Required params:** `tasks`

## `ticktick__batch_update_tasks`

- **What it does:** Batch update multiple existing tasks in TickTick. Use this when you need to modify several tasks at once with new values.
- **Required params:** `tasks`

## `ticktick__complete_task`

- **What it does:** Mark a task as completed by projectId and taskId.
- **Required params:** `project_id`, `task_id`

## `ticktick__complete_tasks_in_project`

- **What it does:** Complete multiple tasks in a project. Maximum 20 tasks per request.
- **Required params:** `project_id`, `task_ids`
- **Important notes:**
  - Complete multiple tasks in a project. Maximum 20 tasks per request.

## `ticktick__create_project`

- **What it does:** Create a new project (list) in TickTick.
- **Required params:** `name`
- **Optional params (first 4):** `color`, `view_mode`, `kind`, `sort_order`

## `ticktick__create_task`

- **What it does:** Create a new task in TickTick.
- **Required params:** `task`

## `ticktick__fetch`

- **What it does:** Fetch the full contents of a task by its ID.
- **Required params:** `id`

## `ticktick__filter_tasks`

- **What it does:** Filter tasks by various criteria including date range, project IDs, priority, tag, kind and status.
- **Required params:** `filter`

## `ticktick__get_project_by_id`

- **What it does:** Get project details by projectId.
- **Required params:** `project_id`

## `ticktick__get_project_with_undone_tasks`

- **What it does:** Get project details and all undone tasks in the project by projectId.
- **Required params:** `project_id`

## `ticktick__get_task_by_id`

- **What it does:** Get full task details by taskId.
- **Required params:** `task_id`

## `ticktick__get_task_in_project`

- **What it does:** Get a task by projectId and taskId.
- **Required params:** `project_id`, `task_id`

## `ticktick__get_user_preference`

- **What it does:** Get user preferences including timezone settings.
- **Required params:** (none)

## `ticktick__list_completed_tasks_by_date`

- **What it does:** Get completed tasks based on specified search criteria including project IDs and date range.
- **Required params:** `search`

## `ticktick__list_projects`

- **What it does:** List all projects of the current user.
- **Required params:** (none)

## `ticktick__list_undone_tasks_by_date`

- **What it does:** List undone tasks within a date range. The maximum range is 14 days between startDate and endDate.
- **Required params:** `search`
- **Important notes:**
  - List undone tasks within a date range. The maximum range is 14 days between startDate and endDate.

## `ticktick__list_undone_tasks_by_time_query`

- **What it does:** List undone tasks using a predefined time query. Supported values: today, last24hour, last7day, tomorrow, next24hour, next7day. Default is today.
- **Required params:** (none)
- **Optional params (first 1):** `query_command`

## `ticktick__move_task`

- **What it does:** Move tasks to different projects. Used for reorganizing tasks across projects.
- **Required params:** `moves`

## `ticktick__search`

- **What it does:** Search tasks in TickTick. Return a list of relevant result with IDS, title and URLs.
- **Required params:** `query`

## `ticktick__search_task`

- **What it does:** Search tasks by keyword. Returns a list of matching tasks with taskId, title, and url.
- **Required params:** `query`

## `ticktick__update_project`

- **What it does:** Update an existing project by projectId.
- **Required params:** `project_id`
- **Optional params (first 6):** `name`, `color`, `view_mode`, `kind`, `sort_order`, `closed`

## `ticktick__update_task`

- **What it does:** Update an existing task by projectId and taskId.
- **Required params:** `task_id`, `task`
