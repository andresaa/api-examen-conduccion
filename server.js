const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

// Configurar CORS y middlewares
server.use(middlewares);
server.use(jsonServer.bodyParser);

// ============================================================================
// ENDPOINT 1: GET /consultant-service/v1/appointment/{resource_mac}
// ============================================================================
server.get('/consultant-service/v1/appointment/:resource_mac', (req, res) => {
  const { resource_mac } = req.params;
  const db = router.db; // Acceder a la base de datos

  // Buscar la cita por resource_mac
  const appointment = db.get('appointments')
    .find({ resource_mac: resource_mac })
    .value();

  if (!appointment) {
    return res.status(404).json({
      error_code: 'APPOINTMENT_NOT_FOUND',
      message: `No se encontró ninguna cita para el resource_mac: ${resource_mac}`,
      details: {
        resource_mac: resource_mac,
        suggestion: 'Verifique que el resource_mac sea correcto'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Validar formato de resource_mac (opcional pero recomendado)
  const macRegex = /^[A-Fa-f0-9]{12}$/;
  if (!macRegex.test(resource_mac)) {
    return res.status(400).json({
      error_code: 'INVALID_FORMAT',
      message: 'El formato de resource_mac es inválido. Se esperan 12 caracteres hexadecimales.',
      details: {
        field: 'resource_mac',
        provided_value: resource_mac,
        expected_format: '^[A-Fa-f0-9]{12}$',
        examples: ['A1B2C3D4E5F6', '001122334455']
      },
      timestamp: new Date().toISOString()
    });
  }

  // Retornar los usuarios asignados a este dispositivo para el día
  res.status(200).json({
    resource_mac: appointment.resource_mac,
    appointment_date: appointment.appointment_date,
    total_users: appointment.users.length,
    users: appointment.users
  });
});

// ============================================================================
// ENDPOINT 2: POST /consultant-service/v1/appointment/test-result
// ============================================================================
server.post('/consultant-service/v1/appointment/test-result', (req, res) => {
  const { user_id, test_type, result, appointment_id, notes, performed_at } = req.body;
  const db = router.db;

  // ====================================
  // VALIDACIONES OBLIGATORIAS
  // ====================================

  // 1. Validar campos requeridos
  const requiredFields = ['user_id', 'test_type', 'result', 'appointment_id'];
  const missingFields = requiredFields.filter(field => !req.body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      error_code: 'VALIDATION_ERROR',
      message: 'Faltan campos requeridos',
      details: {
        missing_fields: missingFields,
        required_fields: requiredFields
      },
      timestamp: new Date().toISOString()
    });
  }

  // 2. Validar test_type
  const validTestTypes = ['TEORICO', 'DESTREZA_INDIVIDUAL', 'VIA_PUBLICA'];
  if (!validTestTypes.includes(test_type)) {
    return res.status(400).json({
      error_code: 'INVALID_TEST_TYPE',
      message: 'El tipo de examen proporcionado no es válido',
      details: {
        provided_test_type: test_type,
        allowed_types: validTestTypes
      },
      timestamp: new Date().toISOString()
    });
  }

  // 3. Validar que result sea un objeto
  if (typeof result !== 'object' || result === null) {
    return res.status(400).json({
      error_code: 'INVALID_RESULT_FORMAT',
      message: 'El campo result debe ser un objeto',
      details: {
        provided_type: typeof result
      },
      timestamp: new Date().toISOString()
    });
  }

  // 4. Buscar si el appointment_id existe
  const appointmentExists = db.get('appointments')
    .flatMap('users')
    .find({ appointment_id: appointment_id })
    .value();

  if (!appointmentExists) {
    return res.status(404).json({
      error_code: 'APPOINTMENT_NOT_FOUND',
      message: 'La cita con el appointment_id proporcionado no existe',
      details: {
        appointment_id: appointment_id
      },
      timestamp: new Date().toISOString()
    });
  }

  // 5. Buscar si el user_id existe
  const userExists = db.get('appointments')
    .flatMap('users')
    .find({ user_id: user_id })
    .value();

  if (!userExists) {
    return res.status(404).json({
      error_code: 'USER_NOT_FOUND',
      message: 'El usuario con el user_id proporcionado no existe',
      details: {
        user_id: user_id
      },
      timestamp: new Date().toISOString()
    });
  }

  // 6. Verificar que el user_id corresponda al appointment_id
  if (userExists.appointment_id !== appointment_id) {
    return res.status(404).json({
      error_code: 'APPOINTMENT_USER_MISMATCH',
      message: 'La cita especificada no pertenece al usuario indicado',
      details: {
        user_id: user_id,
        appointment_id: appointment_id,
        appointment_owner: userExists.user_id
      },
      timestamp: new Date().toISOString()
    });
  }

  // 7. Verificar si ya existe un resultado para este appointment_id y test_type
  const existingResult = db.get('test_results')
    .find({ appointment_id: appointment_id, test_type: test_type })
    .value();

  if (existingResult) {
    return res.status(409).json({
      error_code: 'DUPLICATE_TEST_RESULT',
      message: 'Ya existe un resultado de examen para esta cita y tipo de examen',
      details: {
        appointment_id: appointment_id,
        test_type: test_type,
        existing_test_id: existingResult.test_result_id,
        created_at: existingResult.created_at
      },
      timestamp: new Date().toISOString()
    });
  }

  // ====================================
  // CREAR RESULTADO
  // ====================================

  const timestamp = new Date().toISOString();
  const testResultId = `TST-${new Date().getFullYear()}-${String(db.get('test_results').size().value() + 1).padStart(3, '0')}`;
  
  const newTestResult = {
    id: String(db.get('test_results').size().value() + 1),
    test_result_id: testResultId,
    user_id: user_id,
    appointment_id: appointment_id,
    test_type: test_type,
    result: result,
    status: 'completed',
    notes: notes || null,
    performed_at: performed_at || timestamp,
    created_at: timestamp,
    updated_at: timestamp
  };

  // Guardar en la base de datos
  db.get('test_results')
    .push(newTestResult)
    .write();

  // Respuesta exitosa
  res.status(200).json({
    test_result_id: newTestResult.test_result_id,
    user_id: newTestResult.user_id,
    appointment_id: newTestResult.appointment_id,
    test_type: newTestResult.test_type,
    result: newTestResult.result,
    status: newTestResult.status,
    notes: newTestResult.notes,
    performed_at: newTestResult.performed_at,
    created_at: newTestResult.created_at,
    updated_at: newTestResult.updated_at,
    message: 'Resultado de examen enviado exitosamente'
  });
});

// ============================================================================
// RUTAS ADICIONALES (OPCIONALES - Para consultas)
// ============================================================================

// Obtener todos los test_results (útil para consultas)
server.get('/consultant-service/v1/test-results', (req, res) => {
  const db = router.db;
  const { user_id, appointment_id, test_type, status } = req.query;
  
  let results = db.get('test_results').value();

  // Aplicar filtros si existen
  if (user_id) {
    results = results.filter(r => r.user_id === user_id);
  }
  if (appointment_id) {
    results = results.filter(r => r.appointment_id === appointment_id);
  }
  if (test_type) {
    results = results.filter(r => r.test_type === test_type);
  }
  if (status) {
    results = results.filter(r => r.status === status);
  }

  res.status(200).json({
    total: results.length,
    data: results
  });
});

// Obtener un test_result específico por ID
server.get('/consultant-service/v1/test-result/:id', (req, res) => {
  const db = router.db;
  const result = db.get('test_results')
    .find({ test_result_id: req.params.id })
    .value();

  if (!result) {
    return res.status(404).json({
      error_code: 'TEST_RESULT_NOT_FOUND',
      message: 'No se encontró el resultado del examen',
      timestamp: new Date().toISOString()
    });
  }

  res.status(200).json(result);
});

// ============================================================================
// USAR ROUTER POR DEFECTO PARA OTRAS RUTAS
// ============================================================================
server.use(router);

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 JSON Server corriendo en puerto ${PORT}`);
  console.log(`📍 Endpoints disponibles:`);
  console.log(`   GET  /consultant-service/v1/appointment/:resource_mac`);
  console.log(`   POST /consultant-service/v1/appointment/test-result`);
});