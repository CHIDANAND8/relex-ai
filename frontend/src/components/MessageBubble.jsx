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
      <code className="bg-light px-1 rounded">
        {children}
      </code>
    );
  };

  // =========================
  // IMAGE RENDERER
  // =========================
  const ImageBlock = (props) => {
    const [expanded, setExpanded] = useState(false);
    return (
      <>
        <img 
          {...props} 
          className="shadow-sm"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
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
        className={`p-3 rounded ${
          isUser
            ? "bg-primary text-white"
            : "bg-white shadow-sm"
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
