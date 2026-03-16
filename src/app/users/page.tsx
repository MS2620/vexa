"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
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
    toast(
      (t) => (
        <div className="flex flex-col gap-3">
          <span>Are you sure you want to delete this user?</span>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                await fetch(`/api/users/${id}`, { method: "DELETE" });
                fetchUsers();
                toast.success("User deleted");
              }}
              className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-sm transition-colors border border-red-500/20"
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: Infinity },
    );
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
    <div className="pt-4 pb-12 px-6 md:px-12 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Users</h1>
          <p className="text-gray-400 text-sm">
            Manage dashboard access and permissions
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-[#161824] border border-white/10 hover:border-indigo-500/50 hover:bg-[#1f2233] hover:text-white px-4 py-2 rounded-xl text-sm font-medium text-gray-300 transition-all shadow-lg shadow-black/20"
        >
          <UserPlus className="w-4 h-4 text-indigo-400" />{" "}
          <span className="hidden sm:inline">Add User</span>
        </button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-[#161824] border border-white/10 rounded-xl p-6 mb-8 shadow-lg shadow-black/20">
          <h2 className="font-semibold text-white mb-4">New User</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) =>
                  setNewUser({ ...newUser, username: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                Role
              </label>
              <select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser({ ...newUser, role: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              >
                <option value="user" className="bg-[#161824]">
                  User
                </option>
                <option value="admin" className="bg-[#161824]">
                  Admin
                </option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                Notification Email{" "}
                <span className="text-gray-600 normal-case font-normal">
                  (optional)
                </span>
              </label>
              <input
                type="email"
                value={newUser.notify_email}
                onChange={(e) =>
                  setNewUser({ ...newUser, notify_email: e.target.value })
                }
                className="w-full bg-[#0B0f19]/50 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-[#0B0f19] transition-colors"
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          <div className="flex gap-3 mt-6 pt-6 border-t border-white/5">
            <button
              onClick={handleCreate}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/25"
            >
              Create User
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="bg-transparent border border-white/10 hover:border-white/20 text-gray-300 hover:text-white px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-[#161824] border border-white/5 hover:border-white/10 rounded-xl p-4 flex items-center gap-4 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <span className="text-indigo-400 font-bold text-lg">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-white truncate">
                    {user.username}
                  </p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold tracking-wider uppercase border hidden sm:inline-block ${
                      user.role === "admin"
                        ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                        : "bg-gray-800 text-gray-400 border-white/5"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                {user.notify_email ? (
                  <p className="text-xs text-gray-400 truncate">
                    {user.notify_email}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 italic">
                    No email defined
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {/* Reset Password */}
                {resetId === user.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      placeholder="New password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="bg-[#0B0f19] border border-white/10 rounded-lg p-2 text-xs w-28 sm:w-40 text-white focus:outline-none focus:border-indigo-500/50"
                    />
                    <button
                      onClick={() => handleResetPassword(user.id)}
                      className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setResetId(null)}
                      className="text-xs bg-transparent border border-white/10 hover:bg-[#1f2233] text-gray-300 hover:text-white px-3 py-2 rounded-lg transition-colors"
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
                      className="p-2.5 hover:bg-[#1f2233] rounded-lg text-gray-400 hover:text-white transition-colors group relative"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                        Reset Password
                      </span>
                    </button>
                    <button
                      onClick={() => handleRoleToggle(user.id, user.role)}
                      className="p-2.5 hover:bg-[#1f2233] rounded-lg text-gray-400 hover:text-white transition-colors group relative"
                    >
                      {user.role === "admin" ? (
                        <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                        Toggle Role
                      </span>
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="p-2.5 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors group relative"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="absolute -top-8 right-0 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                        Delete User
                      </span>
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
