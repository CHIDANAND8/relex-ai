import fitz
import os
import re

# PyMuPDF built-in font name reference:
#   "helv"  = Helvetica
#   "hebo"  = Helvetica-Bold
#   "heit"  = Helvetica-Oblique
#   "cour"  = Courier
#   "tiro"  = Times-Roman
#   "tibo"  = Times-Bold

def generate_pdf_report(title: str, content: str, file_path: str):
    """
    Generates a beautifully formatted multi-page PDF document using PyMuPDF.
    Includes text auto-wrapping, margin boundaries, and structured headings.
    """
    doc = fitz.open()
    page = doc.new_page()
    
    x = 55
    y = 60
    
    # Document Decorative Element & Header Title
    page.insert_text((x, y), title, fontsize=18, fontname="hebo", color=(0.12, 0.45, 0.69))
    y += 25
    
    # Render line divider
    shape = page.new_shape()
    shape.draw_line(fitz.Point(x, y), fitz.Point(545, y))
    shape.finish(color=(0.85, 0.85, 0.85), width=1.5)
    shape.commit()
    y += 30
    
    lines = content.split("\n")
    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            y += 14  # Paragraph spacing
            continue
            
        # Format inline subheadings (e.g. lines starting with # or ## or ** )
        fontsize = 11
        fontname = "helv"
        
        if line_clean.startswith("#"):
            line_clean = line_clean.replace("#", "").strip()
            fontsize = 14
            fontname = "hebo"
            y += 10
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
                y += 18
                curr_line = word
            else:
                curr_line = test_line
                
        if curr_line:
            if y > 740:
                page = doc.new_page()
                y = 60
            page.insert_text((x, y), curr_line, fontsize=fontsize, fontname=fontname, color=(0.2, 0.2, 0.2))
            y += 18
            
    doc.save(file_path)
    doc.close()
