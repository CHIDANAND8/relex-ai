export default function ContextPanel({ contextData }) {

  if (!contextData) {
    return (
      <div className="p-3 text-light">
        <h6 className="text-info">AI Context</h6>
        <div className="text-muted small">
          Ask a question to see AI context.
        </div>
      </div>
    );
  }

  const admin = contextData.admin || "";
  const document = contextData.document || "";
  const memory = contextData.memory || "";

  return (
    <div className="p-3 text-light">

      <h6 className="text-info mb-3">AI Context</h6>

      {/* Admin Feed */}
      {admin && (
        <div className="mb-3">
          <strong className="text-warning">Admin Feed</strong>
          <div className="small mt-1">
            {admin}
          </div>
        </div>
      )}

      {/* Document Source */}
      {document && (
        <div className="mb-3">
          <strong className="text-primary">Document Source</strong>
          <div className="small mt-1">
            {document}
          </div>
        </div>
      )}

      {/* Conversation Memory */}
      {memory && (
        <div className="mb-3">
          <strong className="text-success">Conversation Memory</strong>
          <div className="small mt-1">
            {memory}
          </div>
        </div>
      )}

      {/* If all contexts empty */}
      {!admin && !document && !memory && (
        <div className="text-muted small">
          No context retrieved for this response.
        </div>
      )}

    </div>
  );
}