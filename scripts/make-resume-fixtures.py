# Generates the sample resume fixtures (fictional person) used by the resume parser tests.
# Usage: python3 scripts/make-resume-fixtures.py
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import docx

LINES = [
    ("h", "Priya Raman"),
    ("p", "Bengaluru, India | priya.raman@example.com | +91 98765 43210"),
    ("p", "linkedin.com/in/priya-raman-example | github.com/priya-example | priya.example.dev"),
    ("h", "Summary"),
    ("p", "Full-stack engineer with 6 years of experience building TypeScript and Node.js products."),
    ("h", "Experience"),
    ("p", "Senior Software Engineer, Flipside Commerce"),
    ("p", "Jan 2022 - Present"),
    ("p", "Led the checkout rewrite in React and TypeScript, cutting page load time by 35%."),
    ("p", "Software Engineer, Kite Analytics"),
    ("p", "Jul 2019 - Dec 2021"),
    ("p", "Built Node.js APIs and PostgreSQL data pipelines."),
    ("h", "Education"),
    ("p", "B.Tech, Computer Science, National Institute of Technology Trichy"),
    ("p", "2015 - 2019"),
    ("h", "Skills"),
    ("p", "TypeScript, JavaScript, React, Node.js, PostgreSQL, AWS, Docker"),
]

c = canvas.Canvas("tests/fixtures/resume/sample-resume.pdf", pagesize=A4)
y = 800
for kind, text in LINES:
    c.setFont("Helvetica-Bold" if kind == "h" else "Helvetica", 13 if kind == "h" else 10)
    c.drawString(50, y, text)
    y -= 22 if kind == "h" else 15
c.save()

d = docx.Document()
for kind, text in LINES:
    if kind == "h":
        d.add_heading(text, level=1)
    else:
        d.add_paragraph(text)
d.save("tests/fixtures/resume/sample-resume.docx")
print("ok")
