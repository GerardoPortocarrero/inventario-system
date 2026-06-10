// src/constants.ts

export const UI_TEXTS = {
  // Generic
  LOADING: 'Cargando...',
  NO_RECORDS_FOUND: 'No se encontraron registros.',
  ERROR_GENERIC_LOAD: 'Error al cargar los datos. Verifique los permisos de Firestore.',
  ERROR_GENERIC_CREATE: 'Error al crear. Verifique los permisos de Firestore.',

  // Form Labels
  FULL_NAME: 'Nombre Completo',
  EMAIL: 'Correo Electrónico',
  PASSWORD: 'Contraseña',
  ROLE: 'Rol',
  SEDE: 'Sede',
  SEDE_NAME: 'Nombre de la Sede',
  SEDE_LOCATION: 'Locación',
  SEDE_CODE: 'Código',
  BEVERAGE_TYPE_NAME: 'Tipo de Bebida',
  BRAND_NAME: 'Marca',
  PRODUCT_NAME: 'Nombre del Producto',
  SAP: 'SAP',
  BASIS: 'Basis',
  COMERCIAL: 'Comercial',
  CONTAAYA: 'Contaaya',
  MILILITROS: 'Mililitros (ml)',
  UNIDADES: 'Unidades',
  PRICE: 'Precio',

  // Placeholders
  PLACEHOLDER_PASSWORD: 'Mínimo 6 caracteres',
  PLACEHOLDER_SEARCH_USERS: 'Buscar por nombre o email o sede...',
  PLACEHOLDER_SEARCH_SEDES: 'Buscar por nombre de sede...',
  PLACEHOLDER_SEARCH_BEVERAGE_TYPES: 'Buscar por tipo de bebida...',
  PLACEHOLDER_SEDE_NAME: 'Ej. Sede Principal',
  PLACEHOLDER_SEDE_LOCATION: 'Ej. Av. Central 123',
  PLACEHOLDER_SEDE_CODE: 'Ej. SED-001',
  PLACEHOLDER_BEVERAGE_TYPE_NAME: 'Ej. Gaseosas',
  PLACEHOLDER_BRAND_NAME: 'Ej. Coca Cola',
  PLACEHOLDER_SEARCH_PRODUCTS: 'Buscar por nombre, SAP o sede...',
  PLACEHOLDER_SEARCH_BRANDS: 'Buscar por nombre o tipo de bebida...',

  // Buttons
  CREATE_USER: 'Crear Usuario',
  CREATE_SEDE: 'Crear Sede',
  CREATE_ROLE: 'Crear Rol',
  CREATE_BEVERAGE_TYPE: 'Crear Tipo de Bebida',
  CREATE_BRAND: 'Crear Marca',
  CREATE_PRODUCT: 'Crear Producto',
  CLOSE: 'Cerrar',
  UPDATE_ROLE: 'Guardar Cambios',
  UPDATE_BEVERAGE_TYPE: 'Guardar Cambios',
  UPDATE_BRAND: 'Guardar Cambios',
  UPDATE_SEDE: 'Guardar Cambios',
  UPDATE_USER: 'Guardar Cambios',
  UPDATE_PRODUCT: 'Guardar Cambios',
  DELETE: 'Eliminar',

  // Alerts / Validation
  REQUIRED_FIELDS: 'Todos los campos son obligatorios.',
  PASSWORD_MIN_LENGTH: 'La contraseña debe tener al menos 6 caracteres.',
  BEVERAGE_TYPE_NAME_EMPTY: 'El nombre del tipo de bebida no puede estar vacío.',
  BRAND_NAME_EMPTY: 'El nombre de la marca no puede estar vacío.',

  // Table Headers
  TABLE_HEADER_NAME: 'Nombre',
  TABLE_HEADER_EMAIL: 'Email',
  TABLE_HEADER_ROLE: 'Rol',
  TABLE_HEADER_SEDE: 'Sede',
  TABLE_HEADER_ACTIONS: 'Acciones',

  // Profile
  PERSONAL_DATA: 'Datos Personales',
  ACCOUNT_SETTINGS: 'Configuración de Cuenta',
  NEW_PASSWORD: 'Nueva Contraseña',
  CONFIRM_PASSWORD: 'Confirmar Nueva Contraseña',
  UPDATE_PASSWORD: 'Actualizar Contraseña',
  PASSWORD_UPDATED_SUCCESS: 'Contraseña actualizada exitosamente.',
};

export const SPINNER_VARIANTS = {
  OVERLAY: 'overlay',
  IN_PAGE: 'in-page',
} as const;
