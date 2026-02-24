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
  BEVERAGE_TYPE_NAME: 'Tipo de Bebida',
  PRODUCT_NAME: 'Nombre del Producto',
  SAP: 'SAP',
  BASIS: 'Basis',
  COMERCIAL: 'Comercial',
  CONTAAYA: 'Contaaya',
  MILILITROS: 'Mililitros (ml)',
  UNIDADES: 'Unidades',
  PRICE: 'Precio',

  // Placeholders
  PLACEHOLDER_FULL_NAME: 'Ej. Juan Pérez',
  PLACEHOLDER_EMAIL: 'Ej. juan.perez@email.com',
  PLACEHOLDER_PASSWORD: 'Mínimo 6 caracteres',
  PLACEHOLDER_SEARCH_USERS: 'Buscar por nombre o email o sede...',
  PLACEHOLDER_SEARCH_SEDES: 'Buscar por nombre de sede...',
  PLACEHOLDER_SEARCH_BEVERAGE_TYPES: 'Buscar por tipo de bebida...',
  PLACEHOLDER_SEDE_NAME: 'Ej. Sede Principal',
  PLACEHOLDER_BEVERAGE_TYPE_NAME: 'Ej. Gaseosas',
  PLACEHOLDER_PRODUCT_NAME: 'Ej. Coca Cola 3L',
  PLACEHOLDER_SAP: 'Ej. 102030',
  PLACEHOLDER_SEARCH_PRODUCTS: 'Buscar por nombre, SAP o sede...',

  // Buttons
  CREATE_USER: 'Crear Usuario',
  CREATE_SEDE: 'Crear Sede',
  CREATE_ROLE: 'Crear Rol',
  CREATE_BEVERAGE_TYPE: 'Crear Tipo de Bebida',
  CREATE_PRODUCT: 'Crear Producto',
  EDIT_ROLE: 'Editar Rol',
  CLOSE: 'Cerrar',
  UPDATE_ROLE: 'Guardar Cambios',
  EDIT_BEVERAGE_TYPE: 'Editar Tipo de Bebida',
  UPDATE_BEVERAGE_TYPE: 'Guardar Cambios',
  EDIT_SEDE: 'Editar Sede',
  UPDATE_SEDE: 'Guardar Cambios',
  EDIT_USER: 'Editar Usuario',
  UPDATE_USER: 'Guardar Cambios',
  UPDATE_PRODUCT: 'Guardar Cambios',
  CONFIRM_DELETE: 'Confirmar Eliminación',
  DELETE: 'Eliminar',

  // Alerts / Validation
  REQUIRED_FIELDS: 'Todos los campos son obligatorios.',
  PASSWORD_MIN_LENGTH: 'La contraseña debe tener al menos 6 caracteres.',
  EMAIL_ALREADY_IN_USE: 'El correo electrónico ya está en uso.',
  SEDE_NAME_EMPTY: 'El nombre de la sede no puede estar vacío.',
  BEVERAGE_TYPE_NAME_EMPTY: 'El nombre del tipo de bebida no puede estar vacío.',

  // Table Headers
  TABLE_HEADER_NAME: 'Nombre',
  TABLE_HEADER_EMAIL: 'Email',
  TABLE_HEADER_ROLE: 'Rol',
  TABLE_HEADER_SEDE: 'Sede',
  TABLE_HEADER_ACTIONS: 'Acciones',
  TABLE_HEADER_CREATED_AT: 'Fecha de Creación', // Not used for sedes anymore, but kept for completeness
  TABLE_HEADER_ALMACEN: 'Almacén',
  TABLE_HEADER_CONSIGNACION: 'Consignación',
  TABLE_HEADER_RECHAZO: 'Rechazo',
  TABLE_HEADER_STOCK: 'Stock Disponible',

  // Inventory
  INVENTORY_CONTROL: 'Control de Inventario',
  SAVE_INVENTORY: 'Sincronizar Inventario',
  INVENTORY_UPDATED_SUCCESS: 'Inventario actualizado correctamente.',
  ERROR_INVENTORY_UPDATE: 'Error al actualizar el inventario.',
  LAST_UPDATE: 'Última actualización',

  // Profile
  MY_PROFILE: 'Mi Perfil',
  PERSONAL_DATA: 'Datos Personales',
  ACCOUNT_SETTINGS: 'Configuración de Cuenta',
  CHANGE_PASSWORD: 'Cambiar Contraseña',
  NEW_PASSWORD: 'Nueva Contraseña',
  CONFIRM_PASSWORD: 'Confirmar Nueva Contraseña',
  UPDATE_PASSWORD: 'Actualizar Contraseña',
  PASSWORD_UPDATED_SUCCESS: 'Contraseña actualizada exitosamente.',
};

export const SPINNER_VARIANTS = {
  OVERLAY: 'overlay',
  IN_PAGE: 'in-page',
} as const;
