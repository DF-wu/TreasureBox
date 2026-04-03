---

# TICKTICK

Use this family for **TickTick tasks, projects, search, filtering, batch operations, completion, and time-scoped task views**.

## Fast selection rules

- **One task by exact id** → `get_task_by_id` or `get_task_in_project`
- **Need the full content/body of a task** → `fetch`
- **Keyword lookup** → `search_task` or `search`
- **Structured filtering** → `filter_tasks`
- **Today / tomorrow / next 7 days style query** → `list_undone_tasks_by_time_query`
- **Explicit date range** → `list_undone_tasks_by_date` or `list_completed_tasks_by_date`
- **Create / edit / move / complete one task** → `create_task`, `update_task`, `move_task`, `complete_task`
- **Operate on many tasks at once** → `batch_add_tasks`, `batch_update_tasks`, `complete_tasks_in_project`
- **Project operations** → `list_projects`, `create_project`, `get_project_by_id`, `update_project`, `get_project_with_undone_tasks`

## Important gotchas

- `list_undone_tasks_by_date` is capped to a **14-day range**.
- `complete_tasks_in_project` has a **maximum 20 tasks per request**.
- Use `get_user_preference` when timezone or user-preference context matters.

## Use the generated inventory when you need exact tool names / parameters

Open `references/ticktick.generated.md`.