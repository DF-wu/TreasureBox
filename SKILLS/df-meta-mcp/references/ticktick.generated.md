# TickTick live inventory

- Family key: `ticktick`
- Tool count: **47**

> Generated from the live MetaMCP endpoint. Keep manual guidance in the non-generated family docs; use this file for exact tool names and parameter hints.

## `ticktick__add_comment`

- **What it does:** Add a comment to a task. Comment content is plain text, max 1024 characters.
- **Required params:** `project_id`, `task_id`, `title`
- **Important notes:**
  - Add a comment to a task. Comment content is plain text, max 1024 characters.

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

## `ticktick__create_column`

- **What it does:** Create a new column in a project.
- **Required params:** `project_id`, `column`

## `ticktick__create_focus`

- **What it does:** Create a focus record. Required: startTime, endTime, type (0=pomodoro, 1=timing). Optional: taskId, habitId, note.
- **Required params:** `start_time`, `end_time`, `type`
- **Optional params (first 3):** `task_id`, `habit_id`, `note`

## `ticktick__create_habit`

- **What it does:** Create a new habit in TickTick.
- **Required params:** `habit`

## `ticktick__create_project`

- **What it does:** Create a new project (list) in TickTick.
- **Required params:** `name`
- **Optional params (first 5):** `color`, `view_mode`, `kind`, `sort_order`, `group_id`

## `ticktick__create_project_group`

- **What it does:** Create a new project group.
- **Required params:** `project_group`

## `ticktick__create_tag`

- **What it does:** Create a new tag.
- **Required params:** `tag`

## `ticktick__create_task`

- **What it does:** Create a new task in TickTick.
- **Required params:** `task`

## `ticktick__delete_comment`

- **What it does:** Delete a comment from a task by comment id.
- **Required params:** `project_id`, `task_id`, `id`

## `ticktick__delete_focus`

- **What it does:** Delete a focus record by focusId and type.
- **Required params:** `focus_id`, `type`

## `ticktick__delete_project_group`

- **What it does:** Delete a project group by projectGroupId.
- **Required params:** `project_group_id`

## `ticktick__delete_task`

- **What it does:** Delete a task by projectId and taskId.
- **Required params:** `project_id`, `task_id`

## `ticktick__fetch`

- **What it does:** Fetch the full contents of a task by its ID.
- **Required params:** `id`

## `ticktick__filter_tasks`

- **What it does:** Filter tasks by various criteria including date range, project IDs, priority, tag, kind and status.
- **Required params:** `filter`

## `ticktick__get_comment`

- **What it does:** Get comments for a task by projectId and taskId.
- **Required params:** `project_id`, `task_id`

## `ticktick__get_focus`

- **What it does:** Get a single focus record by focusId and type.
- **Required params:** `focus_id`, `type`

## `ticktick__get_focuses_by_time`

- **What it does:** Get focus records by time range and type. The time range must not exceed one month.
- **Required params:** `from_time`, `to_time`, `type`
- **Important notes:**
  - Get focus records by time range and type. The time range must not exceed one month.

## `ticktick__get_habit`

- **What it does:** Get habit details by habitId.
- **Required params:** `habit_id`

## `ticktick__get_habit_checkins`

- **What it does:** Get habit check-ins by habitIds and date stamp range. `from_stamp` and `to_stamp` must be int date stamps in `yyyyMMdd` format (for example, `20260401` and `20260430`).
- **Required params:** `habit_ids`, `from_stamp`, `to_stamp`
- **Important notes:**
  - Get habit check-ins by habitIds and date stamp range. `from_stamp` and `to_stamp` must be int date stamps in `yyyyMMdd` format (for example, `20260401` and `20260430`).

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

## `ticktick__list_columns`

- **What it does:** List all columns in a project by projectId.
- **Required params:** `project_id`

## `ticktick__list_completed_tasks_by_date`

- **What it does:** Get completed tasks based on specified search criteria including project IDs and date range.
- **Required params:** `search`

## `ticktick__list_countdowns`

- **What it does:** List all countdowns of the current user.
- **Required params:** (none)

## `ticktick__list_habit_sections`

- **What it does:** List all habit sections of the current user.
- **Required params:** (none)

## `ticktick__list_habits`

- **What it does:** List all habits of the current user.
- **Required params:** (none)

## `ticktick__list_project_groups`

- **What it does:** List all project groups of the current user.
- **Required params:** (none)

## `ticktick__list_projects`

- **What it does:** List projects of the current user. Use offset to skip projects and limit to cap the number returned for pagination. When both offset and limit are omitted, the result also includes the virtual "inbox" project for tasks without a project; paginated results only include projects returned by the API.
- **Required params:** (none)
- **Optional params (first 2):** `offset`, `limit`

## `ticktick__list_tags`

- **What it does:** List all tags of the current user.
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

## `ticktick__update_column`

- **What it does:** Update an existing column in a project by columnId.
- **Required params:** `project_id`, `column_id`, `column`

## `ticktick__update_habit`

- **What it does:** Update an existing habit by habitId.
- **Required params:** `habit_id`, `habit`

## `ticktick__update_project`

- **What it does:** Update an existing project by projectId.
- **Required params:** `project_id`
- **Optional params (first 7):** `name`, `color`, `view_mode`, `kind`, `sort_order`, `closed`, `group_id`

## `ticktick__update_project_group`

- **What it does:** Update an existing project group by projectGroupId.
- **Required params:** `project_group_id`, `project_group`

## `ticktick__update_task`

- **What it does:** Update an existing task by projectId and taskId. To remove a parent-child relationship, set parentId to an empty string. To clear dueDate or startDate, set it to "1970-01-01T00:00:00.000+0000".
- **Required params:** `task_id`, `task`

## `ticktick__upsert_habit_checkins`

- **What it does:** Create or update check-ins for a habit by habitId.
- **Required params:** `habit_id`, `checkin_data`
