import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Auth } from 'aws-amplify';
import api from '../config/api';
import toast from 'react-hot-toast';

export default function Signup() {
  const [step, setStep]           = useState('signup'); // 'signup' | 'confirm'
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [name, setName]           = useState('');
  const [code, setCode]           = useState('');
  const [loading, setLoading]     = useState(false);
  const navigate                  = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password !== confirm) return toast.error('Passwords do not match');
    if (password.length < 8)  return toast.error('Password must be at least 8 characters');
    setLoading(true);
    try {
      await Auth.signUp({
        username: email,
        password,
        attributes: { email, name },
      });
      toast.success('Check your email for a confirmation code');
      setStep('confirm');
    } catch (err) {
      toast.error(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await Auth.confirmSignUp(email, code);
      // Auto sign-in to get token for register-profile
      await Auth.signIn(email, password);
      const session = await Auth.currentSession();
      const token = session.getAccessToken().getJwtToken();
      // Register user profile in DynamoDB
      await api.post('/api/auth/register-profile', { name }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await Auth.signOut(); // sign out so they go through login normally
      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.message || 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Mini-Jira</h1>
          <p className="text-gray-500 mt-1">{step === 'signup' ? 'Create your account' : 'Confirm your email'}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 'signup' ? (
            <form onSubmit={handleSignup} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Sara Ahmed" required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com" required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors">
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
                We sent a 6-digit code to <strong>{email}</strong>. Check your inbox.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmation code</label>
                <input type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="123456" maxLength={6} required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors">
                {loading ? 'Confirming...' : 'Confirm & continue'}
              </button>
              <button type="button" onClick={() => setStep('signup')}
                className="w-full text-gray-500 text-sm hover:text-gray-700">
                ← Back to signup
              </button>
            </form>
          )}
          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}