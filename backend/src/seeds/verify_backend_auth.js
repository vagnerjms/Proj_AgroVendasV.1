const apiUrl = 'http://localhost:3001';

async function run() {
  console.log('Testing authentication with new JWT_SECRET...');
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@agrovenda.local', password: 'Admin123!' })
  });

  if (res.ok) {
    const data = await res.json();
    console.log('SUCCESS! JWT token issued securely:', data.accessToken ? 'OK' : 'MISSING');
  } else {
    console.error('FAILED to authenticate:', res.status, await res.text());
  }
}

run().catch(console.error);
