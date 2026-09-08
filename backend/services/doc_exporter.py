import fitz
import os
import re
import csv
import io
import pandas as pd
from docx import Document
from docx.shared import Pt, Inches, RGBColor

def generate_pdf_report(title: str, content: str, file_path: str):
    """Generates a formatted multi-page PDF document using PyMuPDF."""
    doc = fitz.open()
    page = doc.new_page()
    
    x = 55
    y = 60
    
    # Header Title
    page.insert_text((x, y), title, fontsize=18, fontname="hebo", color=(0.12, 0.45, 0.69))
    y += 25
    
    # Line divider
    shape = page.new_shape()
    shape.draw_line(fitz.Point(x, y), fitz.Point(545, y))
    shape.finish(color=(0.85, 0.85, 0.85), width=1.5)
    shape.commit()
    y += 30
    
    lines = content.split("\n")
    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            y += 14
            continue
            
        fontsize = 10.5
        fontname = "helv"
        
        if line_clean.startswith("#"):
            line_clean = line_clean.replace("#", "").strip()
            fontsize = 13.5
            fontname = "hebo"
            y += 8
        elif line_clean.startswith("**") and line_clean.endswith("**"):
            line_clean = line_clean.replace("**", "").strip()
            fontname = "hebo"
        elif line_clean.startswith("USER:") or line_clean.startswith("RELEX AI ASSISTANT:"):
            fontname = "hebo"
        
        words = line_clean.split(" ")
        curr_line = ""
        
        for word in words:
            test_line = curr_line + (" " if curr_line else "") + word
            text_width = fitz.get_text_length(test_line, fontname=fontname, fontsize=fontsize)
            
            if x + text_width > 540:
                if y > 740:
                    page = doc.new_page()
                    y = 60
                page.insert_text((x, y), curr_line, fontsize=fontsize, fontname=fontname, color=(0.2, 0.2, 0.2))
                y += 17
                curr_line = word
            else:
                curr_line = test_line
                
        if curr_line:
            if y > 740:
                page = doc.new_page()
                y = 60
            page.insert_text((x, y), curr_line, fontsize=fontsize, fontname=fontname, color=(0.2, 0.2, 0.2))
            y += 17
            
    doc.save(file_path)
    doc.close()

def generate_docx_report(title: str, content: str, file_path: str):
    """Generates a Microsoft Word (.docx) document."""
    doc = Document()
    
    # Title
    heading = doc.add_heading(title, level=1)
    heading.style.font.color.rgb = RGBColor(30, 115, 190)
    
    lines = content.split("\n")
    for line in lines:
        line_s = line.strip()
        if not line_s:
            continue
        if line_s.startswith("### "):
            doc.add_heading(line_s.replace("### ", ""), level=3)
        elif line_s.startswith("## "):
            doc.add_heading(line_s.replace("## ", ""), level=2)
        elif line_s.startswith("# "):
            doc.add_heading(line_s.replace("# ", ""), level=1)
        elif line_s.startswith("- ") or line_s.startswith("* "):
            doc.add_paragraph(line_s[2:], style='List Bullet')
        elif re.match(r"^\d+\.\s", line_s):
            clean_item = re.sub(r"^\d+\.\s", "", line_s)
            doc.add_paragraph(clean_item, style='List Number')
        else:
            p = doc.add_paragraph(line_s)
            p.style.font.size = Pt(11)
            
    doc.save(file_path)

def generate_excel_report(title: str, content: str, file_path: str):
    """Parses tabular/CSV/structured text into a styled Excel workbook (.xlsx)."""
    # 1. Check if content has Markdown table or CSV lines
    table_lines = []
    lines = content.split("\n")
    
    for l in lines:
        l_s = l.strip()
        if "|" in l_s and not re.match(r"^[\|\-\:\s]+$", l_s):
            # Markdown table row
            cells = [c.strip() for c in l_s.split("|") if c.strip() or l_s.startswith("|")]
            # Clean leading/trailing empty cells from splitting |col1|col2|
            cells = [c.strip() for c in l_s.strip("|").split("|")]
            if cells and any(cells):
                table_lines.append(cells)
        elif "," in l_s and not l_s.startswith("#"):
            # CSV row
            try:
                row = next(csv.reader([l_s]))
                if row and any(row):
                    table_lines.append(row)
            except:
                pass

    if table_lines:
        # Standardize column count
        max_cols = max(len(r) for r in table_lines)
        padded = [r + [""] * (max_cols - len(r)) for r in table_lines]
        headers = padded[0]
        data_rows = padded[1:] if len(padded) > 1 else []
        df = pd.DataFrame(data_rows, columns=headers)
    else:
        # Fallback: treat each line as a row with Line / Content columns
        data = [{"Item #": i + 1, "Content": line.strip()} for i, line in enumerate(lines) if line.strip()]
        df = pd.DataFrame(data)

    df.to_excel(file_path, index=False, engine='openpyxl')

def generate_csv_report(content: str, file_path: str):
    """Generates a standard CSV file."""
    # If content already has markdown code block, clean it
    clean = content.replace("```csv", "").replace("```", "").strip()
    with open(file_path, "w", encoding="utf-8", newline="") as f:
        f.write(clean)

def generate_text_report(title: str, content: str, file_path: str):
    """Generates a structured plain text document."""
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(f"{title}\n{'=' * len(title)}\n\n{content}")
