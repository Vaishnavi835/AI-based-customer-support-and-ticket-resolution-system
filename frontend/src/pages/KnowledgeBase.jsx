import { useState } from "react";
import { BookOpen, FilePlus, Search, Edit3, Trash2 } from "lucide-react";

export default function KnowledgeBase() {
  const [articles, setArticles] = useState([
    { id: 1, title: "How to reset your password", category: "Account", status: "Published", date: "2026-06-12" },
    { id: 2, title: "Understanding Billing Cycles", category: "Billing", status: "Draft", date: "2026-06-15" },
    { id: 3, title: "API Rate Limits", category: "Technical", status: "Published", date: "2026-06-18" },
  ]);

  const [isWriting, setIsWriting] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const handlePublish = () => {
    if (!newTitle || !newContent) return alert("Title and Content required!");
    setArticles([...articles, {
      id: Date.now(),
      title: newTitle,
      category: "General",
      status: "Published",
      date: new Date().toISOString().split('T')[0]
    }]);
    setIsWriting(false);
    setNewTitle("");
    setNewContent("");
    alert("Article successfully published to Vector Database!");
  };

  return (
    <div className="cd-page" style={{ padding: '32px' }}>
      <div className="modern-hero" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', marginBottom: '24px' }}>
        <div className="modern-hero__content">
          <h2><BookOpen size={28} style={{ display: 'inline', verticalAlign: 'bottom', marginRight: '8px' }} /> Knowledge Base Management</h2>
          <p>Create and manage support articles to feed the AI resolving agent.</p>
        </div>
        <button className="cd-btn cd-btn--primary" style={{ background: '#fff', color: '#047857' }} onClick={() => setIsWriting(true)}>
          <FilePlus size={18} /> New Article
        </button>
      </div>

      {isWriting ? (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Draft New Article</h3>
          
          <div className="cd-field">
            <label>Article Title</label>
            <input 
              value={newTitle} 
              onChange={e => setNewTitle(e.target.value)} 
              placeholder="e.g. How to use the API..." 
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '15px' }}
            />
          </div>

          <div className="cd-field">
            <label>Article Content</label>
            <textarea 
              value={newContent} 
              onChange={e => setNewContent(e.target.value)} 
              placeholder="Write your guide here. This content will be vectorized for the AI agent."
              rows={8}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '15px', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button className="cd-btn cd-btn--primary" onClick={handlePublish}>Publish to Vector DB</button>
            <button className="cd-btn cd-btn--ghost" onClick={() => setIsWriting(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>Articles Database</h3>
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input 
                type="text" 
                placeholder="Search articles..." 
                style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '14px', outline: 'none' }}
              />
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', color: '#64748B', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Article Title</th>
                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Category</th>
                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Last Updated</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map(a => (
                <tr key={a.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '16px 24px', fontWeight: '500', color: '#0F172A' }}>{a.title}</td>
                  <td style={{ padding: '16px 24px', color: '#64748B', fontSize: '14px' }}>{a.category}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', background: a.status === 'Published' ? '#DCFCE7' : '#FEF3C7', color: a.status === 'Published' ? '#16A34A' : '#D97706' }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', color: '#64748B', fontSize: '14px' }}>{a.date}</td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', marginRight: '8px' }}><Edit3 size={18} /></button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
