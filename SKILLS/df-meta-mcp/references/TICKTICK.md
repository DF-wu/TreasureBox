---

# TICKTICK

Use this family for **TickTick tasks, projects, habits, focus/pomodoro, tags, columns, project groups, comments, search, filtering, batch operations, and calendar-style queries**.

## Fast selection rules

### Tasks and projects

- **One task by id** → `get_task_by_id`, `get_task_in_project`, or `fetch` (full body)
- **Keyword lookup** → `search_task` or `search`
- **Structured filtering** → `filter_tasks`
- **Today / tomorrow / rolling windows** → `list_undone_tasks_by_time_query`
- **Explicit date range** → `list_undone_tasks_by_date` or `list_completed_tasks_by_date`
- **CRUD / move / complete** → `create_task`, `update_task`, `move_task`, `complete_task`, `delete_task`
- **Batch** → `batch_add_tasks`, `batch_update_tasks`, `complete_tasks_in_project`
- **Projects** → `list_projects`, `create_project`, `get_project_by_id`, `update_project`, `get_project_with_undone_tasks`
- **Project groups** → `list_project_groups`, `create_project_group`, `update_project_group`, `delete_project_group`
- **Kanban columns** → `list_columns`, `create_column`, `update_column`
- **Tags** → `list_tags`, `create_tag`
- **Task comments** → `add_comment`, `get_comment`, `delete_comment`

### Habits and focus (separate from ordinary tasks)

- **Habits** → `list_habits`, `get_habit`, `create_habit`, `update_habit`, `list_habit_sections`, `get_habit_checkins`, `upsert_habit_checkins`
- **Focus / pomodoro** → `create_focus`, `get_focus`, `delete_focus`, `get_focuses_by_time` (`type`: 0=pomodoro, 1=timing)

### Account context

- **Timezone / preferences** → `get_user_preference` before interpreting date queries
- **Countdowns** → `list_countdowns`

## Important gotchas

- `list_undone_tasks_by_date` is capped to a **14-day range**.
- `complete_tasks_in_project` allows at most **20** task IDs per request.
- Habit and focus APIs use different payloads than `create_task`.
- Task comment body uses param `title` (plain text, max **1024** chars).

## Use the generated inventory when you need exact tool names / parameters

Open `references/ticktick.generated.md`.