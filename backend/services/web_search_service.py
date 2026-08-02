from duckduckgo_search import DDGS

def perform_web_search(query: str, max_results: int = 5) -> str:
    """
    Searches the live internet using DuckDuckGo and returns a formatted markdown string of results.
    """
    try:
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append(f"**[{r['title']}]({r['href']})**\n{r['body']}")
                
        if not results:
            return f"No recent web search results found for: {query}"
            
        formatted = "\n\n".join(results)
        return f"### Live Web Search Results for '{query}'\n\n{formatted}"
        
    except Exception as e:
        print("Web search error:", e)
        return f"Failed to perform web search: {e}"
