import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout, isStaff, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user) return null; // hide navbar on auth pages

  return (
    <nav className="navbar">
      <div className="navbar__brand">
        <Link to={isStaff ? "/dashboard" : "/my-tickets"}>
          AI Support
        </Link>
      </div>

      <div className="navbar__links">
        {isStaff ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/tickets">All Tickets</Link>
            <Link to="/escalations">Escalations</Link>
            {isAdmin && <Link to="/knowledge-base">Knowledge Base</Link>}
          </>
        ) : (
          <Link to="/my-tickets">My Tickets</Link>
        )}
      </div>

      <div className="navbar__user">
        <span className="user-name">{user.name}</span>
        <span className={`role-badge role-badge--${user.role}`}>{user.role}</span>
        <button onClick={handleLogout} className="btn btn-ghost btn-sm">
          Sign out
        </button>
      </div>
    </nav>
  );
}