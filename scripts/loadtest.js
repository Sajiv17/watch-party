// Load test script for Watch Party
// Tests sync performance with multiple simulated clients

import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';
const NUM_CLIENTS = 10;
const TEST_ROOM_CODE = 'TEST' + Math.random().toString(36).substr(2, 2).toUpperCase();

// Store latency measurements
const latencies = [];

async function runLoadTest() {
  console.log('🧪 Starting Load Test');
  console.log(`📊 Clients: ${NUM_CLIENTS}`);
  console.log(`🏠 Room: ${TEST_ROOM_CODE}\n`);

  const clients = [];

  // Create host client
  const host = io(SERVER_URL);
  clients.push(host);

  await new Promise(resolve => host.on('connect', resolve));

  // Host creates room
  host.emit('create_room', {
    userId: 'host',
    userName: 'Host'
  });

  await new Promise(resolve => {
    host.once('room_state', (room) => {
      console.log(`✓ Room created: ${room.code}\n`);
      resolve();
    });
  });

  // Create other clients
  for (let i = 1; i < NUM_CLIENTS; i++) {
    const client = io(SERVER_URL);
    clients.push(client);

    await new Promise(resolve => client.on('connect', resolve));

    client.emit('join_room', {
      code: TEST_ROOM_CODE,
      userId: `user${i}`,
      userName: `User${i}`
    });

    await new Promise(resolve => client.once('room_state', resolve));
  }

  console.log(`✓ All ${NUM_CLIENTS} clients connected\n`);

  // Measure play/pause propagation
  console.log('📡 Measuring play/pause latency...\n');

  for (let test = 0; test < 10; test++) {
    const sendTime = Date.now();

    // Listen on all clients
    const promises = clients.slice(1).map(client =>
      new Promise(resolve => {
        client.once('video_update', () => {
          const latency = Date.now() - sendTime;
          latencies.push(latency);
          resolve();
        });
      })
    );

    // Host sends play command
    host.emit('play', {
      code: TEST_ROOM_CODE,
      userId: 'host',
      version: test
    });

    await Promise.all(promises);

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Calculate statistics
  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95Index = Math.floor(latencies.length * 0.95);
  const p95 = latencies[p95Index];
  const max = latencies[latencies.length - 1];
  const min = latencies[0];

  console.log('📊 RESULTS:');
  console.log('─'.repeat(40));
  console.log(`Average latency:    ${avg.toFixed(2)}ms`);
  console.log(`Min latency:        ${min}ms`);
  console.log(`Max latency:        ${max}ms`);
  console.log(`P95 latency:        ${p95}ms`);
  console.log(`Total measurements: ${latencies.length}`);
  console.log('─'.repeat(40));

  if (p95 <= 250) {
    console.log('✅ PASS: P95 latency <= 250ms\n');
  } else {
    console.log('❌ FAIL: P95 latency > 250ms\n');
  }

  // Cleanup
  clients.forEach(c => c.close());
  console.log('✓ Test complete');
  process.exit(0);
}

runLoadTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
