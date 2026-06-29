import { useState, useEffect } from "react";
import { BookOpen, FilePlus, Search, Edit3, Trash2 } from "lucide-react";
import { kbAPI } from "../api/services";
import { SkeletonTableRow } from "../components/SkeletonCard";

export default function KnowledgeBase() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isWriting, setIsWriting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [searchQuery, setSearchQuery] = useState("");

  const loadArticles = () => {
    setLoading(true);
    kbAPI.list()
      .then(res => setArticles(res.data.documents || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadArticles();
  }, []);

  const handlePublish = async () => {
    if (!newTitle || !newContent) return alert("Title and Content required!");
    try {
      if (editingId) {
        await kbAPI.update(editingId, { title: newTitle, category: newCategory, content: newContent });
        alert("Article successfully updated in the Vector Database!");
      } else {
        await kbAPI.add(newTitle, newCategory, newContent);
        alert("Article successfully published to Vector Database!");
      }
      setIsWriting(false);
      setEditingId(null);
      setNewTitle("");
      setNewContent("");
      setNewCategory("General");
      loadArticles();
    } catch (err) {
      alert(`Failed to ${editingId ? 'update' : 'publish'}: ` + err);
    }
  };

  const handleEdit = (article) => {
    setEditingId(article.id);
    setNewTitle(article.title);
    setNewContent(article.content || "");
    setNewCategory(article.category || "General");
    setIsWriting(true);
  };

  const handleCancel = () => {
    setIsWriting(false);
    setEditingId(null);
    setNewTitle("");
    setNewContent("");
    setNewCategory("General");
  };

  const handleDelete = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      await kbAPI.delete(docId);
      loadArticles();
    } catch (err) {
      alert("Failed to delete: " + err);
    }
  };

  const filtered = articles.filter(a => 
    !searchQuery || 
    a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
            {editingId ? "Edit Article" : "Draft New Article"}
          </h3>
          
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div className="cd-field" style={{ flex: 2 }}>
              <label>Article Title</label>
              <input 
                value={newTitle} 
                onChange={e => setNewTitle(e.target.value)} 
                placeholder="e.g. How to use the API..." 
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '15px' }}
              />
            </div>
            <div className="cd-field" style={{ flex: 1 }}>
              <label>Category</label>
              <select 
                value={newCategory} 
                onChange={e => setNewCategory(e.target.value)} 
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '15px', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                <option value="technical">Technical</option>
                <option value="account">Account</option>
                <option value="billing">Billing</option>
                <option value="authentication">Authentication</option>
                <option value="general">General</option>
                <option value="policies">Company Policies</option>
                <option value="product">Product Features</option>
                <option value="other">Other</option>
              </select>
            </div>
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
            <button className="cd-btn cd-btn--primary" onClick={handlePublish}>
              {editingId ? "Update Vector DB" : "Publish to Vector DB"}
            </button>
            <button className="cd-btn cd-btn--ghost" onClick={handleCancel}>Cancel</button>
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
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
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
                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Last Updated</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <SkeletonTableRow key={i} cols={4} />
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>No articles found.</td>
                </tr>
              ) : filtered.map(a => (
                <tr key={a.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '16px 24px', fontWeight: '500', color: '#0F172A' }}>{a.title}</td>
                  <td style={{ padding: '16px 24px', color: '#64748B', fontSize: '14px' }}>{a.category}</td>
                  <td style={{ padding: '16px 24px', color: '#64748B', fontSize: '14px' }}>
                    {new Date(a.updated_at || a.created_at || Date.now()).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <button onClick={() => handleEdit(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', marginRight: '8px' }}><Edit3 size={18} /></button>
                    <button onClick={() => handleDelete(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={18} /></button>
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
