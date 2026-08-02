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

    const copyCode = () => {
      navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };

    // block code
    if (!inline && match) {
      if (match[1] === "json") {
        try {
          const parsed = JSON.parse(codeString);
          if (parsed.chartType && parsed.data && Array.isArray(parsed.data)) {
            const maxValue = Math.max(...parsed.data.map(d => d.value || 0), 1);
            return (
              <div className="card text-white mb-3 shadow" style={{ background: "rgba(30, 41, 59, 1)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="card-header border-bottom border-light border-opacity-10 py-2 bg-transparent text-center fw-bold">
                  📊 Data Visualization ({parsed.chartType.toUpperCase()})
                </div>
                <div className="card-body px-4 py-4">
                  {parsed.data.map((item, idx) => (
                    <div key={idx} className="mb-2 d-flex align-items-center">
                      <div style={{ width: "120px", fontSize: "0.80rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} className="me-2 text-end text-light-50 fw-bold" title={item.name}>
                        {item.name}
                      </div>
                      <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "6px", height: "18px", position: "relative" }}>
                        <div style={{
                          width: `${(item.value / maxValue) * 100}%`,
                          height: "100%",
                          backgroundColor: "#3b82f6",
                          backgroundImage: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)",
                          borderRadius: "4px",
                          transition: "width 0.5s ease-in-out"
                        }} />
                      </div>
                      <div className="ms-2" style={{ width: "40px", fontSize: "0.75rem", color: "#94a3b8" }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
        } catch (e) {
          // ignore parsing error, just render as JSON code
        }
      }

      return (
        <div style={{ position: "relative" }}>
          <button
            onClick={copyCode}
            className="btn btn-sm btn-light"
            style={{
              position: "absolute",
              right: 10,
              top: 10,
              zIndex: 1,
              fontSize: "12px"
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>

          <SyntaxHighlighter
            style={oneDark}
            language={match[1]}
            PreTag="div"
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    }

    // inline code
    return (
      <code className="bg-light px-1 rounded text-dark text-break">
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
          Failed to load image. It may be blocked by your network or ad-blocker.
        </div>
      );
    }

    return (
      <>
        <img 
          {...props} 
          className="shadow-sm"
          onError={() => { 
            console.error('Image load failed:', props.src); 
            setHasError(true);
          }}
          style={
             (props.alt === "Generated Art") 
              ? { 
                  width: "100%", 
                  maxWidth: "512px", 
                  borderRadius: "8px", 
                  display: "block", 
                  marginBottom: "15px",
                  cursor: "zoom-in"
                }
              : { 
                  width: "100px", 
                  height: "200px", 
                  objectFit: "cover", 
                  borderRadius: "8px", 
                  display: "block", 
                  marginBottom: "15px",
                  outline: "1px solid #dee2e6",
                  cursor: "zoom-in"
                }
          }
          onClick={() => setExpanded(true)}
          alt={props.alt || "Vision Context"}
        />
        {expanded && (
          <div 
            onClick={() => setExpanded(false)}
            style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.85)",
              zIndex: 9999,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              cursor: "zoom-out"
            }}
          >
            <div style={{ position: "absolute", top: 20, right: 30, color: "white", fontSize: "36px", fontWeight: "bold" }}>&times;</div>
            <img 
              src={props.src} 
              style={{ 
                width: "600px", 
                height: "800px", 
                objectFit: "contain", 
                borderRadius: "8px" 
              }} 
              alt="Expanded Vision Context"
            />
          </div>
        )}
      </>
    );
  };

  return (
    <div
      className={`d-flex mb-3 ${
        isUser ? "justify-content-end" : ""
      }`}
    >
      <div
        className={`p-3 rounded message-bubble ${
          isUser
            ? "message-bubble-user text-white"
            : "message-bubble-ai"
        }`}
        style={{ maxWidth: "75%", whiteSpace: "pre-wrap" }}
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
