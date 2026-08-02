import re
import requests
from bs4 import BeautifulSoup
from youtube_transcript_api import YouTubeTranscriptApi
import yt_dlp

def extract_youtube_video_id(url: str) -> str:
    """Extract the video ID from a YouTube URL."""
    # Match both standard and youtu.be URLs
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", url)
    return match.group(1) if match else None

def get_youtube_transcript(url: str) -> str:
    """Fetch transcript using youtube-transcript-api and fallback to yt-dlp for video metadata."""
    video_id = extract_youtube_video_id(url)
    if not video_id:
        return ""

    transcript_text = ""
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        transcript_text = " ".join([entry['text'] for entry in transcript])
    except Exception as e:
        print(f"youtube-transcript-api failed for {url}: {e}")

    # Optionally get title using yt-dlp to enrich context
    title = ""
    try:
        ydl_opts = {'quiet': True, 'simulate': True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            title = info.get('title', '')
    except Exception as e:
        print(f"yt-dlp failed for {url}: {e}")

    content = ""
    if title:
        content += f"**Video Title:** {title}\n\n"
    if transcript_text:
        content += f"**Transcript:**\n{transcript_text[:10000]}" # Limit to safe context length
    
    return content

def get_webpage_text(url: str) -> str:
    """Extract visible text from standard webpage."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return ""

        soup = BeautifulSoup(response.content, "html.parser")
        
        # Remove scripts, styles, and other hidden elements
        for script in soup(["script", "style", "noscript", "header", "footer"]):
            script.decompose()

        text = soup.get_text(separator=' ', strip=True)
        return f"**Webpage Content:**\n{text[:10000]}" # Limit length
    except Exception as e:
        print(f"Failed to scrape {url}: {e}")
        return ""

def scrape_url_context(url: str) -> str:
    """Main router for scraping URLs inside logic."""
    if "youtube.com" in url or "youtu.be" in url:
        return get_youtube_transcript(url)
    else:
        return get_webpage_text(url)
