const http = require('http');

function request(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`Status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  try {
    console.log('Logging in...');
    const loginRes = await request('POST', '/auth/login', { email: 'admin@agrovenda.local', password: 'Admin123!' });
    const token = loginRes.accessToken;

    console.log('Fetching customers, producers, products...');
    const [customers, producers, products] = await Promise.all([
      request('GET', '/customers', null, token),
      request('GET', '/producers', null, token),
      request('GET', '/products', null, token)
    ]);

    if (!customers.length || !producers.length || !products.length) {
      console.log('Missing data to create sales.');
      process.exit(1);
    }

    const customerId = customers[0]._id;
    const producerId = producers[0]._id;
    const productId = products[0]._id;

    console.log(`Starting simulation of 500 sales...`);
    
    for (let i = 0; i < 50; i++) {
      const promises = [];
      for (let j = 0; j < 10; j++) {
        const index = i * 10 + j + 1;
        const payload = {
          date: new Date().toISOString(),
          customerId,
          producerId,
          destinationCity: 'So Paulo',
          destinationState: 'SP',
          saleType: 'particular',
          status: 'confirmed',
          paymentType: 'cash',
          dueDate: new Date().toISOString(),
          items: [{
            productId,
            quantityBags: Math.floor(Math.random() * 50) + 10,
            pricePerBag: Math.floor(Math.random() * 100) + 50,
            bagWeightKg: 25
          }]
        };
        promises.push(request('POST', '/sales-orders', payload, token).catch(e => console.error(`Failed ${index}:`, e.message)));
      }
      await Promise.all(promises);
      console.log(`Created ${i * 10 + 10}/500 sales...`);
    }

    console.log('Successfully created 500 sales!');
  } catch (error) {
    console.error('Simulation failed:', error);
  }
}

run();
