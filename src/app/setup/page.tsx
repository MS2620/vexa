"use client";
import { useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Film, CheckCircle } from "lucide-react";

export default function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    tmdb_key: "",
    rd_token: "",
    plex_url: "",
    plex_token: "",
    plex_lib_id: "",
    plex_tv_lib_id: "",
  });

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await fetch("/api/setup/check", { cache: "no-store" });
        const { isConfigured } = await res.json();

        if (isConfigured) {
          router.replace("/");
          return;
        }
      } catch {
      } finally {
        setCheckingSetup(false);
      }
    };

    checkSetup();
  }, [router]);

  const handleFinish = async () => {
    await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    router.push("/login");
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 text-white">
        <div className="text-gray-300 text-sm">Checking setup...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 text-white">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-xl w-full max-w-xl shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Film className="w-10 h-10 text-blue-500" />
          <h1 className="text-2xl font-bold">First Time Setup</h1>
        </div>

        {step === 1 && (
          <div className="space-y-4 animate-in fade-in">
            <h2 className="text-xl font-semibold mb-4 border-b border-gray-800 pb-2">
              1. Create Admin Account
            </h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Admin Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Admin Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
              />
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!formData.username || !formData.password}
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg mt-4 disabled:opacity-50"
            >
              Next Step
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in">
            <h2 className="text-xl font-semibold mb-4 border-b border-gray-800 pb-2">
              2. API Connections
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  TMDB Key
                </label>
                <input
                  type="password"
                  value={formData.tmdb_key}
                  onChange={(e) =>
                    setFormData({ ...formData, tmdb_key: e.target.value })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Real-Debrid Token
                </label>
                <input
                  type="password"
                  value={formData.rd_token}
                  onChange={(e) =>
                    setFormData({ ...formData, rd_token: e.target.value })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Plex URL
                </label>
                <input
                  type="text"
                  value={formData.plex_url}
                  onChange={(e) =>
                    setFormData({ ...formData, plex_url: e.target.value })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Plex Token
                </label>
                <input
                  type="password"
                  value={formData.plex_token}
                  onChange={(e) =>
                    setFormData({ ...formData, plex_token: e.target.value })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Plex Movie Library ID
              </label>
              <input
                type="text"
                value={formData.plex_lib_id}
                onChange={(e) =>
                  setFormData({ ...formData, plex_lib_id: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Plex TV Library ID
              </label>
              <input
                type="text"
                value={formData.plex_tv_lib_id}
                onChange={(e) =>
                  setFormData({ ...formData, plex_tv_lib_id: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2"
              />
            </div>
            <div className="flex gap-4 mt-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 py-3 rounded-lg"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 bg-green-600 hover:bg-green-700 py-3 rounded-lg flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" /> Complete Setup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
