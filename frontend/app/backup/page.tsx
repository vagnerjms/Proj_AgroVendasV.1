'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { apiGet, apiPost, authFetch, getApiUrl } from '../../lib/api';

type BackupInfo = {
  filename: string;
  createdAt: string;
  sizeBytes: number;
  collectionsCount: number;
  totalRecords: number;
};

export default function BackupPage() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const data = await apiGet<BackupInfo[]>('/backup/list');
      setBackups(data);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao carregar lista de backups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const created = await apiPost<BackupInfo>('/backup/create', {});
      toast.success(`Backup ${created.filename} gerado com sucesso! (${created.totalRecords} registros)`);
      void loadBackups();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar backup.');
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    const confirm = window.confirm(
      `ATENÇÃO: Deseja realmente restaurar o banco de dados a partir do arquivo "${filename}"?\n\nIsso substituirá os dados atuais pelos dados do backup.`
    );
    if (!confirm) return;

    setRestoring(filename);
    try {
      const res = await apiPost<{ success: boolean; restoredCollections: number; totalRestoredRecords: number }>(
        `/backup/restore/${filename}`,
        {}
      );
      toast.success(
        `Restauração concluída com sucesso! ${res.restoredCollections} coleções e ${res.totalRestoredRecords} registros restaurados.`
      );
      void loadBackups();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao restaurar banco de dados.');
    } finally {
      setRestoring(null);
    }
  };

  const handleUploadRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirm = window.confirm(
      `ATENÇÃO: Deseja restaurar o banco de dados enviando o arquivo "${file.name}"?\n\nOs dados atuais serão sobrescritos.`
    );
    if (!confirm) return;

    setRestoring(file.name);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await authFetch('/backup/upload-restore', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Falha no upload do arquivo de restauração.');
      }

      const res = await response.json();
      toast.success(
        `Restauração via upload concluída! ${res.restoredCollections} coleções e ${res.totalRestoredRecords} registros restaurados.`
      );
      void loadBackups();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao restaurar banco via arquivo.');
    } finally {
      setRestoring(null);
      event.target.value = '';
    }
  };

  const handleDownloadBackup = (filename: string) => {
    const apiUrl = getApiUrl();
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    window.open(`${apiUrl}/backup/download/${filename}?token=${token}`, '_blank');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleString('pt-BR');
  };

  return (
    <main className="shell report-shell" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      <section className="header compact" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <p><Link href="/">Inicio</Link> / Painel Admin</p>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>💾 Backup & Restauração do Banco de Dados</h1>
        </div>
        <button
          type="button"
          className="primary-action"
          onClick={handleCreateBackup}
          disabled={creating}
          style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff', fontWeight: 600, padding: '10px 18px' }}
        >
          {creating ? '⏳ Gerando Backup...' : '📦 Gerar Novo Backup Agora'}
        </button>
      </section>

      {/* Box de Instrução e Restauração Externa */}
      <section className="panel" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
          📤 Restaurar a partir de um Arquivo de Backup Externo (.json)
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
          Se você possui um arquivo de backup salvo no seu computador, pode enviá-lo para restaurar o sistema.
        </p>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', color: '#334155' }}>
          📁 Enviar Arquivo JSON e Restaurar Banco
          <input
            type="file"
            accept=".json"
            onChange={handleUploadRestore}
            style={{ display: 'none' }}
          />
        </label>
      </section>

      {/* Tabela de Backups Salvos */}
      <section className="panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
            📜 Histórico de Backups Salvos no Servidor
          </h2>
          <button type="button" className="btn-calendar-nav" onClick={loadBackups}>
            🔄 Atualizar Lista
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Carregando lista de backups...</div>
        ) : backups.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
            Nenhum backup gerado ainda. Clique no botão <strong>"Gerar Novo Backup Agora"</strong> acima para criar a primeira cópia de segurança.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '10px' }}>Data / Hora</th>
                  <th style={{ padding: '10px' }}>Nome do Arquivo</th>
                  <th style={{ padding: '10px' }}>Tamanho</th>
                  <th style={{ padding: '10px' }}>Registros</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.filename} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{formatDate(b.createdAt)}</td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '13px', color: '#334155' }}>{b.filename}</td>
                    <td style={{ padding: '10px' }}>{formatSize(b.sizeBytes)}</td>
                    <td style={{ padding: '10px' }}>
                      <span className="status-pill open" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                        {b.totalRecords} registros
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn-calendar-nav"
                          onClick={() => handleDownloadBackup(b.filename)}
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                        >
                          📥 Baixar
                        </button>
                        <button
                          type="button"
                          className="primary-action"
                          onClick={() => handleRestoreBackup(b.filename)}
                          disabled={restoring === b.filename}
                          style={{ fontSize: '12px', padding: '4px 10px', background: '#0284c7', borderColor: '#0284c7' }}
                        >
                          {restoring === b.filename ? '⏳ Restaurando...' : '♻️ Restaurar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
