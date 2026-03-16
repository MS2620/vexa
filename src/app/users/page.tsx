"use client";
import { useState, useEffect } from "react";
import {
  Loader2,
  UserPlus,
  Trash2,
  KeyRound,
  ShieldCheck,
  User,
} from "lucide-react";

type User = {
  id: number;
  username: string;
  role: string;
  notify_email?: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "user",
    notify_email: "",
  });
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [error, setError] = useState("");

  const fetchUsers = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  };

  useEffect(() => {
    const loadUsers = async () => {
      await fetchUsers();
    };
    loadUsers();
  }, []);

  const handleCreate = async () => {
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setNewUser({ username: "", password: "", role: "user", notify_email: "" });
    setShowAddForm(false);
    fetchUsers();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    fetchUsers();
  };

  const handleResetPassword = async (id: number) => {
    if (!resetPassword) return;
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPassword }),
    });
    setResetId(null);
    setResetPassword("");
  };

  const handleRoleToggle = async (id: number, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    fetchUsers();
  };

  return (
    <div className="pt-6 animate-in fade-in max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-indigo-400">Users</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-[#161824] border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">New User</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Username
              </label>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) =>
                  setNewUser({ ...newUser, username: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Password
              </label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Role</label>
              <select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser({ ...newUser, role: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Notification Email (optional)
              </label>
              <input
                type="email"
                value={newUser.notify_email}
                onChange={(e) =>
                  setNewUser({ ...newUser, notify_email: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleCreate}
              className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Create
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-[#161824] border border-gray-800 rounded-xl p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <span className="text-indigo-400 font-bold text-sm">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white">{user.username}</p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                      user.role === "admin"
                        ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                        : "bg-gray-700/50 text-gray-400 border-gray-600/30"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                {user.notify_email && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {user.notify_email}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Reset Password */}
                {resetId === user.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      placeholder="New password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="bg-[#0f111a] border border-gray-700 rounded p-1.5 text-xs w-32 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => handleResetPassword(user.id)}
                      className="text-xs bg-indigo-600 px-2 py-1.5 rounded"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setResetId(null)}
                      className="text-xs bg-gray-800 px-2 py-1.5 rounded"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setResetId(user.id);
                        setResetPassword("");
                      }}
                      className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                      title="Reset Password"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRoleToggle(user.id, user.role)}
                      className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                      title="Toggle Role"
                    >
                      {user.role === "admin" ? (
                        <ShieldCheck className="w-4 h-4 text-yellow-400" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="p-2 hover:bg-red-900/30 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete User"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
