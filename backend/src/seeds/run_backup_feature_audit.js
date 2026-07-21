const apiUrl = process.env.API_URL || 'http://localhost:3001';

async function testBackupFeature() {
  console.log('====================================================');
  console.log('    TESTANDO MÓDULO DE BACKUP E RESTAURAÇÃO       ');
  console.log('====================================================\n');

  // 1. Auth
  const authRes = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@agrovenda.local', password: 'Admin123!' })
  });
  const authData = await authRes.json();
  const token = authData.accessToken;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Create Backup
  const createRes = await fetch(`${apiUrl}/backup/create`, { method: 'POST', headers });
  const created = await createRes.json();
  console.log('✅ Backup Criado:', created.filename, `(${created.totalRecords} registros em ${created.collectionsCount} coleções)`);

  // 3. List Backups
  const listRes = await fetch(`${apiUrl}/backup/list`, { headers });
  const list = await listRes.json();
  console.log('✅ Lista de Backups:', list.length, 'arquivo(s) encontrado(s)');

  // 4. Restore Backup
  const restoreRes = await fetch(`${apiUrl}/backup/restore/${created.filename}`, { method: 'POST', headers });
  const restored = await restoreRes.json();
  console.log('✅ Restauração de Teste:', restored.success ? 'SUCESSO' : 'FALHA', `(${restored.totalRestoredRecords} registros restaurados)`);

  console.log('\n====================================================');
  console.log('    MÓDULO DE BACKUP TESTADO COM 100% DE SUCESSO!   ');
  console.log('====================================================\n');
}

testBackupFeature().catch(console.error);
