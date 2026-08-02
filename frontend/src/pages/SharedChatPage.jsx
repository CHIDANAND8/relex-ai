import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getSharedChat } from "../services/api";
import MessageBubble from "../components/MessageBubble";

export default function SharedChatPage() {
  const { uuid } = useParams();
  const [chat, setChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getSharedChat(uuid)
      .then(data => {
        if (data && data.detail) {
          setError(true);
        } else {
          setChat(data);
        }
      })
      .catch((e) => {
        console.error(e);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [uuid]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-dark text-light">
        <div className="spinner-border text-info" role="status"></div>
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center vh-100 bg-dark text-light">
        <h3>This shared chat link is invalid or has expired.</h3>
        <Link to="/" className="btn btn-outline-info mt-3">Return to Home</Link>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column vh-100" style={{ backgroundColor: "#1e1e2d" }}>
      <div className="p-3 border-bottom border-light border-opacity-10 d-flex justify-content-between align-items-center" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div>
          <h5 className="mb-0 text-light fw-bold">Shared Chat: {chat.title}</h5>
          <small className="text-muted">Shared from RELEX AI Platform</small>
        </div>
        <Link to="/" className="btn btn-primary fw-bold px-4 rounded-pill">Try RELEX AI</Link>
      </div>
      
      <div className="flex-grow-1 overflow-auto p-4 custom-scrollbar">
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          {chat.messages.map(msg => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
