const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(jsonServer.bodyParser);

// ============================================================================
// HELPERS PARA RESPUESTA ESTÁNDAR
// ============================================================================
const sendSuccess = (res, data = {}, message = 'Operation successful') => {
  res.json({
    success: true,
    message: message,
    data: data
  });
};

const sendError = (res, message = 'An error occurred', statusCode = 400, data = {}) => {
  res.status(statusCode).json({
    success: false,
    message: message,
    data: data
  });
};

// ============================================================================
// MIDDLEWARE DE AUTENTICACIÓN
// ============================================================================
server.use((req, res, next) => {
  const publicPaths = [
    '/consultant-service/v1/health',
    '/consultant-service/v1/auth/login'
  ];

  if (publicPaths.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Missing or invalid Authorization header', 401);
  }

  // Token dummy validation (simplemente que exista algo después de Bearer)
  const token = authHeader.split(' ')[1];
  if (!token) {
    return sendError(res, 'Invalid token format', 401);
  }

  next();
});

// ============================================================================
// ENDPOINT: HEALTH CHECK
// ============================================================================
server.get('/consultant-service/v1/health', (req, res) => {
  sendSuccess(res, { status: 'UP', timestamp: new Date().toISOString() }, 'Service is healthy');
});

// ============================================================================
// ENDPOINT: AUTH LOGIN
// ============================================================================
server.post('/consultant-service/v1/auth/login', (req, res) => {
  // Mock login - acepta cualquier credencial por ahora
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mockToken123456';
  const expiresIn = 86400; // 24 horas

  sendSuccess(res, { accessToken: token, expiresIn }, 'Authentication successful');
});

// ============================================================================
// ENDPOINT: LIST CALES
// ============================================================================
server.get('/consultant-service/v1/cales', (req, res) => {
  const db = router.db;
  const cales = db.get('cales').value();
  sendSuccess(res, cales, 'CALE list retrieved successfully');
});

// ============================================================================
// ENDPOINT: GET APPOINTMENTS BY CALE ID
// ============================================================================
server.get('/consultant-service/v1/appointment/:caleId', (req, res) => {
  const { caleId } = req.params;
  const db = router.db;

  // Verificar si el CALE existe (opcional, pero buena práctica)
  const caleExists = db.get('cales').find({ caleId }).value();
  if (!caleExists) {
    return sendError(res, `CALE with ID ${caleId} not found`, 404);
  }

  // Obtener citas filtradas por caleId
  // Nota: En un sistema real esto filtraría por fecha actual también.
  // Aquí devolvemos todas las del mock para facilitar pruebas.
  const appointments = db.get('appointments')
    .filter({ caleId: caleId })
    .value();

  sendSuccess(res, appointments, `Appointments for CALE ${caleId} retrieved successfully`);
});

// ============================================================================
// ENDPOINT: RESOURCE SYNC STATUS
// ============================================================================
server.get('/consultant-service/v1/resource-sync/status', (req, res) => {
  const db = router.db;
  const status = db.get('sync_status').value();
  sendSuccess(res, status || {}, 'Sync status retrieved');
});

// ============================================================================
// ENDPOINT: SUBMIT TEST RESULT (WEBHOOK)
// ============================================================================
server.post('/consultant-service/v1/appointment/test-result', (req, res) => {
  const { appointmentId, testType, result, userId, notes } = req.body;
  const db = router.db;

  // Validaciones básicas
  if (!appointmentId || !testType || !result || !userId) {
    return sendError(res, 'Missing required fields: appointmentId, testType, result, userId', 400);
  }

  // Verificar que la cita existe
  const appointment = db.get('appointments').find({ appointmentId }).value();
  if (!appointment) {
    return sendError(res, `Appointment ${appointmentId} not found`, 404);
  }

  // Verificar que corresponda al usuario
  if (appointment.userId !== userId) {
    return sendError(res, 'User ID does not match appointment record', 400);
  }

  // Verificar duplicados (opcional)
  const existingResult = db.get('test_results')
    .find({ appointmentId, testType })
    .value();

  if (existingResult) {
    return sendError(res, 'Test result already exists for this appointment and test type', 409);
  }

  // Crear registro
  const newResult = {
    testResultId: `TST-${Date.now()}`,
    appointmentId,
    userId,
    testType,
    result,
    notes: notes || '',
    status: 'completed',
    createdAt: new Date().toISOString()
  };

  db.get('test_results').push(newResult).write();

  sendSuccess(res, newResult, 'Test result submitted successfully');
});

// ============================================================================
// MANEJO DE RUTAS NO ENCONTRADAS (404)
// ============================================================================
server.use((req, res) => {
  sendError(res, `Route ${req.method} ${req.path} not found`, 404);
});

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 API Mock running on port ${PORT}`);
  console.log(`   Swagger definition v3.0.0 implemented`);
  console.log(`   Base URL: http://localhost:${PORT}/consultant-service/v1`);
});
