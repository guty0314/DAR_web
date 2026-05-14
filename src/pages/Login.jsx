import { useState } from 'react';
import { login } from '../services/api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Completá usuario y contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await login(username, password);
      localStorage.setItem('token', data.access_token);
      onLogin(data.access_token);
    } catch (e) {
      setError('Usuario o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoContainer}>
          <div style={styles.logo}>
            <span style={styles.logoDA}>DA</span>
            <span style={styles.logoR}>R</span>
          </div>
          <p style={styles.logoSubtitle}>Dispositivo de Acción Rápida</p>
          <p style={styles.logoDesc}>Panel de Monitoreo - 911</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Usuario</label>
            <div style={styles.inputWrapper}>
              <span style={styles.inputIcon}>👤</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresá tu usuario"
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Contraseña</label>
            <div style={styles.inputWrapper}>
              <span style={styles.inputIcon}>🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresá tu contraseña"
                style={styles.input}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div style={styles.error}>
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p style={styles.footer}>
          Solo para personal autorizado
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0A0F1E',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  card: {
    backgroundColor: '#0D1B2A',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '40px 32px',
    width: '100%',
    maxWidth: '400px',
  },
  logoContainer: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  logo: {
    fontSize: '56px',
    fontWeight: 'bold',
    letterSpacing: '4px',
    marginBottom: '8px',
  },
  logoDA: {
    color: '#ffffff',
  },
  logoR: {
    color: '#E53935',
  },
  logoSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
    margin: '0 0 6px 0',
  },
  logoDesc: {
    color: '#2196F3',
    fontSize: '12px',
    fontWeight: 'bold',
    margin: 0,
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '12px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '0 12px',
  },
  inputIcon: {
    fontSize: '16px',
    marginRight: '8px',
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ffffff',
    fontSize: '14px',
    padding: '14px 0',
  },
  eyeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
  },
  error: {
    backgroundColor: 'rgba(229,57,53,0.15)',
    border: '1px solid rgba(229,57,53,0.4)',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#E53935',
    fontSize: '13px',
  },
  button: {
    backgroundColor: '#2196F3',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    padding: '14px',
    fontSize: '15px',
    fontWeight: 'bold',
    marginTop: '8px',
    transition: 'opacity 0.2s',
  },
  footer: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontSize: '11px',
    marginTop: '24px',
    marginBottom: 0,
  },
};