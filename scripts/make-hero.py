# Composes docs/screenshots/hero.png from the live Lever dry-run screenshots (page + side panel).
# Run after `npx playwright test tests/e2e/live.spec.ts`.
from PIL import Image

page = Image.open('docs/screenshots/live-lever.png')
panel = Image.open('docs/screenshots/live-lever-panel.png')
h = 1600
page = page.crop((0, 0, page.width, min(page.height, 1640)))
page = page.resize((int(page.width * h / page.height), h))
panel = panel.resize((int(panel.width * h / panel.height), h))
out = Image.new('RGB', (page.width + panel.width + 24, h), (229, 231, 235))
out.paste(page, (0, 0))
out.paste(panel, (page.width + 24, 0))
out.resize((out.width // 2, out.height // 2), Image.LANCZOS).save('docs/screenshots/hero.png', optimize=True)
