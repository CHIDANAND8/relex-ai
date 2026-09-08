import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useState } from "react";

export default function MessageBubble({ role, text, isStreaming }) {

  const isUser = role === "user";

  // Prevent crashes during streaming or empty messages
  // Append solid block cursor to simulate ChatGPT active generation
  const safeText = (text || "") + (isStreaming ? " █" : "");

  // =========================
  // CODE BLOCK RENDERER
  // =========================
  const CodeBlock = ({ inline, className, children }) => {

    const match = /language-(\w+)/.exec(className || "");
    const [copied, setCopied] = useState(false);

    const codeString = String(children).replace(/\n$/, "");
    const language = match ? match[1] : "";

    const copyCode = () => {
      navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    };

    // Block code with syntax highlighting
    if (!inline && match) {
      // Dynamic Data Visualization Chart support
      if (language === "json") {
        try {
          const parsed = JSON.parse(codeString);
          if (parsed.chartType && parsed.data && Array.isArray(parsed.data)) {
            const maxValue = Math.max(...parsed.data.map(d => d.value || 0), 1);
            return (
              <div className="card text-white mb-3 shadow-lg" style={{ background: "rgba(18, 16, 32, 0.95)", border: "1px solid rgba(0, 210, 255, 0.2)", borderRadius: "14px" }}>
                <div className="card-header border-bottom border-light border-opacity-10 py-2 bg-transparent d-flex justify-content-between align-items-center">
                  <span className="fw-bold small" style={{ color: "#00d2ff" }}>📊 Data Visualization ({parsed.chartType.toUpperCase()})</span>
                  <span className="badge bg-dark border border-light border-opacity-10 text-light-50">{parsed.data.length} data points</span>
                </div>
                <div className="card-body px-4 py-4">
                  {parsed.data.map((item, idx) => (
                    <div key={idx} className="mb-2 d-flex align-items-center">
                      <div style={{ width: "120px", fontSize: "0.80rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} className="me-2 text-end text-light-50 fw-bold" title={item.name}>
                        {item.name}
                      </div>
                      <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "6px", height: "20px", position: "relative", overflow: "hidden" }}>
                        <div style={{
                          width: `${(item.value / maxValue) * 100}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #00d2ff 0%, #3b82f6 50%, #8b5cf6 100%)",
                          borderRadius: "4px",
                          transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
                        }} />
                      </div>
                      <div className="ms-2 fw-bold" style={{ width: "45px", fontSize: "0.78rem", color: "#38bdf8" }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
        } catch (e) {
          // Fallback to normal code display if JSON is not chart schema
        }
      }

      return (
        <div className="my-3 rounded-3 overflow-hidden shadow-sm" style={{ border: "1px solid rgba(255, 255, 255, 0.1)", background: "#0d0c18" }}>
          {/* Code Window Header Bar */}
          <div className="d-flex justify-content-between align-items-center px-3 py-2" style={{ background: "rgba(255, 255, 255, 0.04)", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div className="d-flex align-items-center gap-2">
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444", display: "inline-block" }}></span>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b", display: "inline-block" }}></span>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
              <span className="ms-2 text-uppercase fw-bold text-light-50" style={{ fontSize: "0.72rem", letterSpacing: "0.5px" }}>
                {language || "code"}
              </span>
            </div>
            <button
              onClick={copyCode}
              className="btn btn-sm"
              style={{
                fontSize: "0.75rem",
                padding: "3px 10px",
                background: copied ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.08)",
                border: copied ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255, 255, 255, 0.12)",
                color: copied ? "#10b981" : "#e2e8f0"
              }}
            >
              {copied ? "✓ Copied" : "📋 Copy"}
            </button>
          </div>

          <SyntaxHighlighter
            style={oneDark}
            language={language}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: "16px",
              background: "#090812",
              fontSize: "0.88rem",
              lineHeight: 1.6,
              fontFamily: "'JetBrains Mono', monospace"
            }}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    }

    // Inline code
    return (
      <code 
        style={{
          background: isUser ? "rgba(0, 0, 0, 0.25)" : "rgba(255, 255, 255, 0.08)",
          color: isUser ? "#ffffff" : "#00d2ff",
          padding: "2px 6px",
          borderRadius: "6px",
          fontSize: "0.88rem",
          fontFamily: "'JetBrains Mono', monospace",
          border: isUser ? "none" : "1px solid rgba(0, 210, 255, 0.2)"
        }}
      >
        {children}
      </code>
    );
  };

  // =========================
  // IMAGE RENDERER
  // =========================
  const ImageBlock = ({ node, ...props }) => {
    const [expanded, setExpanded] = useState(false);
    const [hasError, setHasError] = useState(false);

    if (hasError) {
      return (
        <div className="alert alert-danger p-2 small mt-2 d-inline-block">
          Failed to load image thumbnail.
        </div>
      );
    }

    return (
      <>
        <img 
          {...props} 
          className="shadow-sm rounded-3 my-2"
          onError={() => setHasError(true)}
          style={{ 
            maxWidth: "340px", 
            maxHeight: "260px", 
            objectFit: "cover", 
            cursor: "zoom-in",
            border: "1px solid rgba(255, 255, 255, 0.15)"
          }}
          onClick={() => setExpanded(true)}
          alt={props.alt || "Vision Context"}
        />
        {expanded && (
          <div 
            onClick={() => setExpanded(false)}
            style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.88)",
              backdropFilter: "blur(10px)",
              zIndex: 9999,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              cursor: "zoom-out",
              padding: "20px"
            }}
          >
            <div style={{ position: "absolute", top: 20, right: 30, color: "white", fontSize: "32px", fontWeight: "bold" }}>&times;</div>
            <img 
              src={props.src} 
              style={{ 
                maxWidth: "90vw", 
                maxHeight: "90vh", 
                objectFit: "contain", 
                borderRadius: "12px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.8)" 
              }} 
              alt="Expanded Preview"
            />
          </div>
        )}
      </>
    );
  };

  return (
    <div
      className={`d-flex mb-3 ${
        isUser ? "justify-content-end" : "justify-content-start"
      }`}
    >
      <div
        className={`message-bubble ${
          isUser
            ? "message-bubble-user"
            : "message-bubble-ai"
        }`}
        style={{ maxWidth: "80%", wordBreak: "break-word" }}
      >
        {isUser ? (
          safeText
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{ 
              code: CodeBlock,
              img: ImageBlock
            }}
          >
            {safeText}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
