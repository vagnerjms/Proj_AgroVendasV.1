import fs from 'fs';

async function run() {
  console.log('Fetching loja-pdf-data from NestJS server using native fetch...');
  try {
    // Authenticate first
    const loginRes = await fetch('http://localhost:3000/auth/login', {
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
    
    const loginData = await loginRes.json() as any;
    const token = loginData.token;
    
    // Fetch data
    const res = await fetch('http://localhost:3000/dashboard/loja-pdf-data?start=2026-07-07&end=2026-07-07', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch report data: ${res.status}`);
    }
    
    const data = await res.json();
    const filePath = 'C:/Users/vagnermoraes/.gemini/antigravity/brain/75afcdd1-9d40-4571-be4f-f3bb95754bad/api_dump.json';
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log('JSON dumped successfully to:', filePath);
  } catch (err: any) {
    console.error('Error fetching API data:', err.message);
  }
}

run().catch(console.error);
