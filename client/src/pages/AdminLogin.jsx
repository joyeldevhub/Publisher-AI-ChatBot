import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminLogin } from '../services/api';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await adminLogin(password);
      localStorage.setItem('admin_token', token);
      navigate('/admin');
    } catch {
      toast.error('Invalid password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #2D47A0 0%, #4C6EF5 100%)' }}>

      {/* Decorative blobs — soft, calm */}
      <div className="absolute top-[-80px] right-[-80px] w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: '#A5B4FC' }} />
      <div className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: '#6EE7B7' }} />

      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-sm relative z-10">

        {/* Logo + title */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg p-2.5 bg-white">
            <img src="/logo.png" alt="DocFlow" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">DocFlow Admin</h1>
          <p className="text-slate-500 text-sm mt-1">Publishing support management</p>

          <div className="flex gap-1.5 mt-3">
            <span className="w-2 h-2 rounded-full" style={{ background: '#93C5FD' }} />
            <span className="w-2 h-2 rounded-full" style={{ background: '#6EE7B7' }} />
            <span className="w-2 h-2 rounded-full" style={{ background: '#A5B4FC' }} />
            <span className="w-2 h-2 rounded-full" style={{ background: '#86EFAC' }} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Lock size={13} className="text-brand-500" /> Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-white font-semibold rounded-xl transition hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
            style={{ background: 'linear-gradient(160deg, #3B5BDB 0%, #4C6EF5 100%)' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing in…
              </>
            ) : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Not a developer?{' '}
          <a href="/" className="text-brand-500 hover:underline font-medium">Go to chat</a>
        </p>
      </div>
    </div>
  );
}
