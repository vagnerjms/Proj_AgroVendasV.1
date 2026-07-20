'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [step2FA, setStep2FA] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(email, password, step2FA ? twoFactorCode : undefined);
      if (res.require2FA) {
        setStep2FA(true);
        setError('');
      } else if (res.accessToken) {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'E-mail, senha ou código 2FA inválidos. Verifique os dados digitados.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <p style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: '#16a34a', fontWeight: 600 }}>
            AgroVenda Broker
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '4px 0 0 0' }}>
            {step2FA ? 'Verificação 2FA (2 Etapas)' : 'Acesso ao Sistema'}
          </h1>
        </div>

        {!step2FA ? (
          <>
            <label>
              E-mail ou Usuário
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="Digite seu e-mail de acesso"
                required
                autoComplete="username"
              />
            </label>

            <label style={{ position: 'relative' }}>
              Senha
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  required
                  autoComplete="current-password"
                  style={{ width: '100%', paddingRight: '42px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Ocultar Senha' : 'Mostrar Senha'}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    color: '#64748b',
                    padding: '4px',
                  }}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </label>
          </>
        ) : (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', color: '#166534', margin: '0 0 12px 0', fontWeight: 600 }}>
              🔒 Digite o Código de Segurança (2FA de 6 dígitos)
            </p>
            <label style={{ margin: 0 }}>
              Código 2FA de 6 Dígitos
              <input
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value)}
                type="text"
                maxLength={6}
                placeholder="123456"
                required
                autoFocus
                style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '4px', fontWeight: 700 }}
              />
            </label>
          </div>
        )}

        <button className="primary-action full" type="submit" disabled={loading} style={{ marginTop: '16px' }}>
          {loading ? 'Verificando...' : step2FA ? 'Confirmar Código 2FA' : 'Entrar'}
        </button>

        {step2FA && (
          <button
            type="button"
            className="btn-calendar-nav"
            onClick={() => { setStep2FA(false); setTwoFactorCode(''); }}
            style={{ width: '100%', marginTop: '8px' }}
          >
            ← Voltar para E-mail e Senha
          </button>
        )}

        {error ? <p className="error-message" style={{ marginTop: '16px' }}>{error}</p> : null}
      </form>
    </main>
  );
}
