from pathlib import Path

path = Path('src/components/UnifiedAdminDashboard.tsx')
text = path.read_text(encoding='utf-8')

old_state = "const [expandedAdminArea, setExpandedAdminArea] = useState<Tab | null>(initialTab);"
new_state = "const [expandedAdminArea, setExpandedAdminArea] = useState<Tab | null>(null);"
if old_state not in text:
    raise SystemExit('expandedAdminArea state pattern not found')
text = text.replace(old_state, new_state, 1)

old_button = 'onClick={() => setAdminMenuOpen(true)}'
new_button = 'onClick={() => { setExpandedAdminArea(null); setAdminMenuOpen(true); }}'
if old_button not in text:
    raise SystemExit('admin menu open button pattern not found')
text = text.replace(old_button, new_button, 1)

path.write_text(text, encoding='utf-8')
print('Admin menu now opens fully collapsed.')
