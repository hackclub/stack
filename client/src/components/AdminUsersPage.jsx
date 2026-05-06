import { useEffect, useMemo, useState } from "react";
import "./AdminUsersPage.css";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function displayName(user) {
  return user.name || user.slug || user.email?.split("@")[0] || `User #${user.id}`;
}

export function AdminUsersPage({ userId = null }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("any");
  const [sort, setSort] = useState("created_desc");
  const [status, setStatus] = useState("Loading users...");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setStatus("Loading users...");
      setError("");
      try {
        const endpoint = userId ? `/api/admin/users/${userId}` : "/api/admin/users";
        const response = await fetch(endpoint, { credentials: "include" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load users.");
        if (isMounted) {
          if (userId) {
            setSelectedUser(data.user);
          } else {
            setUsers(data.users || []);
          }
          setStatus("");
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setStatus("");
        }
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = users.filter((user) => {
      const searchBlob = [user.email, user.name, user.slug, user.role, user.hackclubSub]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !normalizedQuery || searchBlob.includes(normalizedQuery);
      const matchesRole = roleFilter === "any" || user.role === roleFilter;
      return matchesQuery && matchesRole;
    });

    const [key, direction] = sort.split("_");
    const multiplier = direction === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      if (key === "name") {
        return multiplier * displayName(a).localeCompare(displayName(b));
      }
      if (key === "role") {
        return multiplier * String(a.role || "").localeCompare(String(b.role || ""));
      }
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return multiplier * (aTime - bTime);
    });
  }, [query, roleFilter, sort, users]);

  if (userId) {
    return (
      <main className="admin-users-page">
        <section className="admin-users-content">
          <a href="/admin/users" className="admin-users-back">
            ← All users
          </a>
          {status ? <p>{status}</p> : null}
          {error ? <p className="admin-users-error">{error}</p> : null}
          {selectedUser ? (
            <>
              <h1>{displayName(selectedUser)}</h1>
              <dl className="admin-user-details">
                <div>
                  <dt>Email</dt>
                  <dd>{selectedUser.email || "—"}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{selectedUser.role || "member"}</dd>
                </div>
                <div>
                  <dt>Password set</dt>
                  <dd>{selectedUser.passwordSetAt ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt>Joined</dt>
                  <dd>{formatDate(selectedUser.createdAt)}</dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>{formatDate(selectedUser.updatedAt)}</dd>
                </div>
                <div>
                  <dt>Legacy ID</dt>
                  <dd>{selectedUser.hackclubSub || "—"}</dd>
                </div>
              </dl>
            </>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-users-page">
      <section className="admin-users-content">
        <a href="/admin" className="admin-users-back">
          ← Admin home
        </a>
        <h1>Users</h1>
        <p className="admin-users-intro">
          Participant, role, login status, join date, and profile details from the Stack users table.
        </p>

        <div className="admin-users-filters">
          <label>
            Search
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Email, name, role..." />
          </label>
          <label>
            Role
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="any">Any role</option>
              <option value="member">Members</option>
              <option value="admin">Admins</option>
            </select>
          </label>
          <label>
            Sort by
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="created_desc">Newest first</option>
              <option value="created_asc">Oldest first</option>
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
              <option value="role_asc">Role A-Z</option>
              <option value="role_desc">Role Z-A</option>
            </select>
          </label>
        </div>

        {status ? <p>{status}</p> : null}
        {error ? <p className="admin-users-error">{error}</p> : null}

        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Role</th>
                <th>Password</th>
                <th>Joined</th>
                <th>Updated</th>
                <th>Profile</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan="6">No users found.</td>
                </tr>
              ) : (
                visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <a className="admin-users-profile-link" href={`/admin/users/${user.id}`}>
                        {displayName(user)}
                      </a>
                      <span>{user.email || "—"}</span>
                    </td>
                    <td>{user.role || "member"}</td>
                    <td>{user.passwordSetAt ? "Set" : "Not set"}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>{formatDate(user.updatedAt)}</td>
                    <td>
                      <a className="admin-users-inline-link" href={`/admin/users/${user.id}`}>
                        View
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
