
/**
 * SkeletonCard - Renders a shimmer block representing a dashboard/ticket card
 */
export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-shimmer skeleton-title" style={{ width: "40%", height: "20px" }} />
      <div className="skeleton-shimmer skeleton-text" style={{ width: "90%", height: "14px" }} />
      <div className="skeleton-shimmer skeleton-text" style={{ width: "75%", height: "14px" }} />
      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        <div className="skeleton-shimmer skeleton-block" style={{ width: "60px", height: "20px", borderRadius: "4px" }} />
        <div className="skeleton-shimmer skeleton-block" style={{ width: "40px", height: "20px", borderRadius: "4px" }} />
      </div>
    </div>
  );
}

/**
 * SkeletonTableRow - Renders a shimmer row inside tables
 */
export function SkeletonTableRow({ cols = 5 }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "16px 20px" }}>
          <div 
            className="skeleton-shimmer skeleton-block" 
            style={{ 
              width: i === 0 ? "50%" : i === 1 ? "75%" : i === 2 ? "40%" : "60%", 
              height: "14px",
              borderRadius: "4px"
            }} 
          />
        </td>
      ))}
    </tr>
  );
}

/**
 * SkeletonChatBubble - Renders shimmer bubble shapes inside chat screens
 */
export function SkeletonChatBubble({ isSelf = false }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "row",
      gap: "12px",
      alignItems: "flex-start",
      width: "100%",
      justifyContent: isSelf ? "flex-end" : "flex-start",
      margin: "16px 0"
    }}>
      {!isSelf && <div className="skeleton-shimmer skeleton-avatar" />}
      <div style={{
        maxWidth: "70%",
        width: "280px",
        padding: "14px 16px",
        borderRadius: "16px",
        background: isSelf ? "var(--color-open-bg, #EEEDFF)" : "#ffffff",
        border: "1px solid var(--color-border, #E2E8F0)",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}>
        <div className="skeleton-shimmer skeleton-text" style={{ width: "85%", height: "12px" }} />
        <div className="skeleton-shimmer skeleton-text" style={{ width: "65%", height: "12px" }} />
      </div>
      {isSelf && <div className="skeleton-shimmer skeleton-avatar" />}
    </div>
  );
}

/**
 * SkeletonText - Renders multi-line block shimmer text for descriptions
 */
export function SkeletonText({ lines = 3 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer skeleton-text"
          style={{ 
            width: i === lines - 1 ? "50%" : "100%", 
            height: "14px",
            borderRadius: "4px"
          }}
        />
      ))}
    </div>
  );
}
