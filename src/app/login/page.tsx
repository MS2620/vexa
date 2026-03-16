'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <Film className="w-12 h-12 text-blue-500 mb-4" />
          <h1 className="text-2xl font-bold text-white">Login to Media Server</h1>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3" required />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-2">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3" required />
          </div>
          
          {error && <p className="text-red-500 text-sm">{error}</p>}
          
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors mt-4">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
