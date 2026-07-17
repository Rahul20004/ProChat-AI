import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IoChevronBack, IoPersonOutline, IoMailOutline, IoLockClosedOutline } from 'react-icons/io5';
import Toast from '../components/Toast';

const Profile = () => {
  const { user, updateProfile, error, setError } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('');
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setError(null);
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
      setAvatar(user.avatar || '');
    }
  }, [user, setError]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoadingLocal(true);

    const updateData = { username, email, avatar };
    if (password) {
      updateData.password = password;
    }

    const result = await updateProfile(updateData);
    setLoadingLocal(false);

    if (result.success) {
      showToast('Profile updated successfully!');
      setPassword(''); // clear password field
    } else {
      showToast(result.message || 'Failed to update profile', 'error');
    }
  };

  const generateNewAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    const newAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${randomSeed}`;
    setAvatar(newAvatarUrl);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-chatBg text-chatText font-sans items-center justify-center p-4 relative overflow-hidden bg-chat-pattern bg-repeat">
      {/* Back glow */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-chatAccent/10 blur-[100px] pointer-events-none"></div>
      
      <div className="z-10 w-full max-w-lg rounded-2xl glass-card shadow-2xl p-6 md:p-8 flex flex-col">
        {/* Header Navigation */}
        <div className="flex items-center gap-3 border-b border-chatBorder pb-4 mb-6">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-chatActive text-chatMuted hover:text-white rounded-full transition-colors"
          >
            <IoChevronBack className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Profile Settings</h1>
            <p className="text-xs text-chatMuted">Manage your personal information</p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-5 flex-1">
          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-400">
              {error}
            </div>
          )}

          {/* Avatar Settings */}
          <div className="flex flex-col items-center gap-3 bg-chatSidebar/40 p-4 rounded-xl border border-chatBorder">
            <img
              src={avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`}
              alt="avatar"
              className="h-24 w-24 rounded-full border-2 border-chatAccent shadow-md bg-chatPanel"
            />
            <button
              type="button"
              onClick={generateNewAvatar}
              className="text-xs text-chatAccent font-semibold hover:underline bg-chatActive/50 px-3 py-1.5 rounded-lg border border-chatBorder"
            >
              Generate Random Avatar
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-chatMuted uppercase tracking-wider mb-2">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-chatMuted">
                <IoPersonOutline className="h-5 w-5" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-chatBorder bg-chatPanel/50 py-3 pl-10 pr-4 text-white placeholder-chatMuted focus:border-chatAccent focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-chatMuted uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-chatMuted">
                <IoMailOutline className="h-5 w-5" />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-chatBorder bg-chatPanel/50 py-3 pl-10 pr-4 text-white placeholder-chatMuted focus:border-chatAccent focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-chatMuted uppercase tracking-wider mb-2">
              New Password (Leave blank to keep current)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-chatMuted">
                <IoLockClosedOutline className="h-5 w-5" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-chatBorder bg-chatPanel/50 py-3 pl-10 pr-4 text-white placeholder-chatMuted focus:border-chatAccent focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 rounded-xl border border-chatBorder py-3 text-sm font-semibold hover:bg-chatActive active:scale-95 transition-all text-chatMuted hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loadingLocal}
              className="flex-1 rounded-xl bg-chatAccent py-3 text-sm font-semibold text-white hover:bg-opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {loadingLocal ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Profile;
