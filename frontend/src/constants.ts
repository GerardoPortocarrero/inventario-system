// src/constants.ts

export const UI_TEXTS = {
  // Generic
  LOADING: 'Cargando...',
  NO_RECORDS_FOUND: 'No se encontraron registros.',
  ERROR_GENERIC_LOAD: 'Error al cargar los datos. Verifique los permisos de Firestore.',
  ERROR_GENERIC_CREATE: 'Error al crear. Verifique los permisos de Firestore.',
  TODO_USER_CREATION_NOTE: 'Nota: Esta creación del lado del cliente automáticamente inicia sesión al usuario recién creado. Para un panel de administración, generalmente se prefiere una Cloud Function (Firebase Admin SDK) para crear usuarios sin iniciar sesión y asignar claims personalizados (roles/sedeId).',
  USER_CREATED_SUCCESS: 'Usuario creado exitosamente.',

  // Form Labels
  FULL_NAME: 'Nombre Completo',
  EMAIL: 'Correo Electrónico',
  PASSWORD: 'Contraseña',
  ROLE: 'Rol',
  SEDE: 'Sede',
  SEDE_NAME: 'Nombre de la Sede',

  // Placeholders
  PLACEHOLDER_FULL_NAME: 'Ej. Juan Pérez',
  PLACEHOLDER_EMAIL: 'Ej. juan.perez@email.com',
  PLACEHOLDER_PASSWORD: 'Mínimo 6 caracteres',
  PLACEHOLDER_SEARCH_USERS: 'Buscar por nombre o email o sede...',
  PLACEHOLDER_SEARCH_SEDES: 'Buscar por nombre de sede...',
  PLACEHOLDER_SEDE_NAME: 'Ej. Sede Principal',

  // Buttons
  CREATE_USER: 'Crear Usuario',
  CREATE_SEDE: 'Crear Sede',
  CREATE_ROLE: 'Crear Rol', // Nuevo
  CLOSE: 'Cerrar', // Nuevo

  // Alerts / Validation
  REQUIRED_FIELDS: 'Todos los campos son obligatorios.',
  PASSWORD_MIN_LENGTH: 'La contraseña debe tener al menos 6 caracteres.',
  EMAIL_ALREADY_IN_USE: 'El correo electrónico ya está en uso.',
  SEDE_NAME_EMPTY: 'El nombre de la sede no puede estar vacío.',

  // Table Headers
  TABLE_HEADER_NAME: 'Nombre',
  TABLE_HEADER_EMAIL: 'Email',
  TABLE_HEADER_ROLE: 'Rol',
  TABLE_HEADER_SEDE: 'Sede',
  TABLE_HEADER_ACTIONS: 'Acciones',
  TABLE_HEADER_CREATED_AT: 'Fecha de Creación', // Not used for sedes anymore, but kept for completeness
};

export const SPINNER_VARIANTS = {
  OVERLAY: 'overlay',
  IN_PAGE: 'in-page',
} as const;
