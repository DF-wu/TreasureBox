# TickTick (`ticktick` — 47 tools)

Full params: `ticktick.generated.md`.

## Tasks

| Task | Tool |
| --- | --- |
| List projects | `ticktick__list_projects` |
| Project detail | `ticktick__get_project_by_id`, `ticktick__get_project_with_undone_tasks` |
| Create/update project | `ticktick__create_project`, `ticktick__update_project` |
| Project groups | `ticktick__list_project_groups`, `ticktick__create_project_group`, `ticktick__update_project_group`, `ticktick__delete_project_group` |
| Columns | `ticktick__list_columns`, `ticktick__create_column`, `ticktick__update_column` |
| Tags | `ticktick__list_tags`, `ticktick__create_tag` |
| Get task | `ticktick__get_task_by_id`, `ticktick__get_task_in_project`, `ticktick__fetch` (body) |
| Search | `ticktick__search`, `ticktick__search_task`, `ticktick__filter_tasks` |
| By date / time | `ticktick__list_undone_tasks_by_date` (≤14 days), `ticktick__list_undone_tasks_by_time_query`, `ticktick__list_completed_tasks_by_date` |
| CRUD task | `ticktick__create_task`, `ticktick__update_task`, `ticktick__move_task`, `ticktick__complete_task`, `ticktick__delete_task` |
| Batch | `ticktick__batch_add_tasks`, `ticktick__batch_update_tasks`, `ticktick__complete_tasks_in_project` (max 20 ids) |
| Comments | `ticktick__add_comment`, `ticktick__get_comment`, `ticktick__delete_comment` |
| Prefs / countdowns | `ticktick__get_user_preference`, `ticktick__list_countdowns` |

## Habits

`ticktick__list_habits`, `ticktick__get_habit`, `ticktick__create_habit`, `ticktick__update_habit`, `ticktick__list_habit_sections`, `ticktick__get_habit_checkins`, `ticktick__upsert_habit_checkins`

## Focus (pomodoro / timing)

`ticktick__create_focus`, `ticktick__get_focus`, `ticktick__delete_focus`, `ticktick__get_focuses_by_time` — `type`: 0=pomodoro, 1=timing
