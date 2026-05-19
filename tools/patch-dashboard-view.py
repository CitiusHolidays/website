from pathlib import Path

path = Path("src/components/portal/PortalWorkspace.js")
text = path.read_text(encoding="utf-8")
start = text.index("function DashboardView({")
end = text.index("function QueriesView", start)

replacement = Path(__file__).with_name("dashboard-view-snippet.js").read_text(encoding="utf-8")
path.write_text(text[:start] + replacement + text[end:], encoding="utf-8")
print("patched")
