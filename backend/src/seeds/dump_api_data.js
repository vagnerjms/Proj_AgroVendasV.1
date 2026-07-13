const fs = require('fs');

async function run() {
  console.log('Fetching loja-pdf-data from NestJS server on port 3001...');
  try {
    const loginRes = await fetch('http://127.0.0.1:3001/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@agrovenda.local',
        password: 'Admin123!'
      })
    });
    
    if (!loginRes.ok) {
      throw new Error(`Failed to login: ${loginRes.status}`);
    }
    
    const loginData = await loginRes.json();
    const token = loginData.token;
    
    const res = await fetch('http://127.0.0.1:3001/dashboard/loja-pdf-data?start=2026-07-07&end=2026-07-07', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch report data: ${res.status}`);
    }
    
    const data = await res.json();
    const filePath = '/app/src/seeds/api_dump.json'; // save inside container directory
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log('JSON dumped successfully inside container.');
  } catch (err) {
    console.error('Error fetching API data:', err.message);
  }
}

run().catch(console.error);
