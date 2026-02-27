const BASE_URL = 'http://localhost:3000/consultant-service/v1';

async function runTests() {
  try {
    console.log('1. Testing Login...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test', password: 'password' })
    });
    
    if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
    const loginData = await loginRes.json();
    console.log('Login Success:', loginData.success);
    const token = loginData.data.accessToken;
    console.log('Token received:', token ? 'YES' : 'NO');
    
    const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    console.log('\n2. Testing GET /cales...');
    const calesRes = await fetch(`${BASE_URL}/cales`, { headers });
    if (!calesRes.ok) throw new Error(`Get Cales failed: ${calesRes.status}`);
    const calesData = await calesRes.json();
    console.log('Cales Success:', calesData.success);
    console.log('Cales Data Structure:', JSON.stringify(calesData.data, null, 2));

    console.log('\n3. Testing GET /appointment/CALE-BOG-001...');
    const apptRes = await fetch(`${BASE_URL}/appointment/CALE-BOG-001`, { headers });
    if (!apptRes.ok) throw new Error(`Get Appointments failed: ${apptRes.status}`);
    const apptData = await apptRes.json();
    console.log('Appointments Success:', apptData.success);
    console.log('Appointments Data Structure:', JSON.stringify(apptData.data, null, 2));

    console.log('\n4. Testing POST /appointment/test-result...');
    const testResultPayload = {
      userId: 'USR-001',
      appointmentId: 'APT-2024-001',
      testType: 'TEORICO',
      startPcMac: 'A1B2C3D4E5F6',
      endPcMac: 'A1B2C3D4E5F6',
      result: {
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        modules: [
          { moduleName: 'Actitudinal', totalQuestions: 12, scorePercentage: 100, minimumPassingScore: 80, passed: true },
          { moduleName: 'Movilidad', totalQuestions: 10, scorePercentage: 90, minimumPassingScore: 80, passed: true },
          { moduleName: 'Normas de tránsito', totalQuestions: 6, scorePercentage: 100, minimumPassingScore: 80, passed: true },
          { moduleName: 'Señalización', totalQuestions: 6, scorePercentage: 100, minimumPassingScore: 80, passed: true },
          { moduleName: 'Vehículo', totalQuestions: 6, scorePercentage: 100, minimumPassingScore: 80, passed: true }
        ],
        overallPassed: true,
        evidenceImagePaths: ['./USR-001/APT-2024-001/evidence/img-001.jpg'],
        auditLog: {
          auditLogPath: './USR-001/APT-2024-001/evidence/audit-log.json',
          fraudInvalidated: false
        }
      }
    };
    
    const postRes = await fetch(`${BASE_URL}/appointment/test-result`, {
        method: 'POST',
        headers,
        body: JSON.stringify(testResultPayload)
    });

    if (postRes.status === 409) {
        console.log('Submit Result: Conflict (409) - Expected if record exists.');
    } else if (postRes.ok) {
        const postData = await postRes.json();
        console.log('Submit Result Success:', postData.success);
    } else {
        const errText = await postRes.text();
        console.error('Submit Result Error:', postRes.status, errText);
    }

  } catch (error) {
    console.error('Test Failed:', error.message);
  }
}

runTests();
