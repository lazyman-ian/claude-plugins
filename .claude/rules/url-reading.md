# URL Reading Strategy

When user shares a URL to read:

| URL Pattern | Method |
|-------------|--------|
| `notion.so/*`, `notion.site/*` | Notion MCP tools |
| `figma.com/*` | Figma MCP / figma-to-code skill |
| `github.com/*` | `gh` CLI or WebFetch directly |
| `linear.app/*` | Linear MCP tools |
| `x.com/*/status/*` | `WebFetch https://r.jina.ai/<url>` (X 需要 JS 渲染) |
| `localhost`, `192.168.*`, etc. | WebFetch directly (never route through external proxy) |
| Other public URLs | Try WebFetch directly first, fallback to `r.jina.ai/` prefix if content is empty/JS-only |

Jina Reader (`r.jina.ai`) renders JavaScript and returns clean Markdown. Use it for JS-heavy sites, not for URLs with dedicated MCP tools.
