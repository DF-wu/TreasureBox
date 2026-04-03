---

# DOCS_AND_RESEARCH

This family combines **Context7**, **DeepWiki**, and **Tavily**.

## Which one to use

- **Context7** → use for external libraries/frameworks/packages, current API docs, and code examples.
- **DeepWiki** → use for knowledge about a specific GitHub repository: wiki structure, wiki contents, or repo-aware Q&A.
- **Tavily** → use for broader live web research, search, extraction, and discovery when the task is not limited to a package docsite or one GitHub repo.

## Context7 rules

- Normally call `context7__resolve-library-id` first.
- Then call `context7__query-docs` with the resolved library id.
- If the user already gives an explicit Context7 library id in `/org/project` or `/org/project/version` form, you can skip the resolve step.

## DeepWiki rules

- `read_wiki_structure` is the lightest way to see what topics exist.
- `read_wiki_contents` is for actual wiki/topic content.
- `ask_question` is the best tool when the user wants an answer synthesized from repo knowledge rather than raw pages.

## Use the generated inventories when you need exact tool names / parameters

- `references/context7.generated.md`
- `references/deepwiki.generated.md`
- `references/tavily-hikari.generated.md`
