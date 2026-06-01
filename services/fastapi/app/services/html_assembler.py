# services/fastapi/app/services/html_assembler.py
from pathlib import Path


def assemble_resume_html(
    template_path: Path,
    rank_data: dict,
    star_bullets: list[dict],
    personal_info: dict | None = None,
) -> str:
    """将 resume_rank 输出 + STAR bullet 组装为完整简历 HTML"""
    template = template_path.read_text(encoding="utf-8") if template_path.exists() else _default_template()

    if personal_info:
        template = template.replace("{{name}}", personal_info.get("name", "张三"))
        template = template.replace("{{email}}", personal_info.get("email", "example@email.com"))

    achievements = rank_data.get("achievements", [])
    bullets_html = ""
    for ach in achievements[:5]:
        resume_bullets = ach.get("resume_bullets", [ach.get("resume_safe_bullet_seed", "")])
        for b in resume_bullets:
            if isinstance(b, str) and b.strip():
                bullets_html += f'<li class="editable" data-section="exp-{ach.get("title", "")}">{b}</li>\n'

    template = template.replace("{{experience_bullets}}", bullets_html)

    star_html = ""
    for star in star_bullets[:4]:
        star_html += f"""
        <div class="star-item">
          <span class="star-label">S:</span> {star.get('situation', '')}<br/>
          <span class="star-label">T:</span> {star.get('task', '')}<br/>
          <span class="star-label">A:</span> {star.get('action', '')}<br/>
          <span class="star-label">R:</span> {star.get('result', '')}
        </div>
        """

    template = template.replace("{{star_highlights}}", star_html)
    return template


def _default_template() -> str:
    return """<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>{{name}} - 简历</title></head>
<body>
  <main class="page">
    <header><h1>{{name}}</h1><p>{{email}}</p></header>
    <section class="experience"><h2>项目经验</h2><ul>{{experience_bullets}}</ul></section>
    <section class="highlights"><h2>技术亮点</h2>{{star_highlights}}</section>
  </main>
</body>
</html>"""
