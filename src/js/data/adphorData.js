export const STATUS = Object.freeze({
  OPEN: 'Abierta',
  IN_PROGRESS: 'En Proceso',
  RESOLVED: 'Resuelta',
});

/** Base histórica de resueltas del mes (valor que tenía el original). */
export const RESOLVED_MONTH_BASELINE = 18;

export const PROJECTS = Object.freeze([
  {
    id: 'palmetto-beach',
    name: 'Edificio Palmetto Beach',
    type: 'Residencial & Turístico (Playa)',
    location: 'Bocagrande, Cartagena',
    areas: [
      'Mantenimiento Electromecánico (Ascensores / Plantas)',
      'Zonas Húmedas, Piscinas & Spa',
      'Portería & Control Arrendamientos Cortos',
      'Fachadas & Protección Corrosión Salina',
      'Finanzas & Control de Cartera',
      'Gestión Legal & Convivencia',
    ],
  },
  {
    id: 'centro-medico-bocagrande',
    name: 'Centro Médico Bocagrande',
    type: 'Complejo de Salud & Consultorios',
    location: 'Bocagrande, Cartagena',
    areas: [
      'Mantenimiento Equipos Biomédicos / Climatización',
      'Bioseguridad & Aseo Especializado',
      'Plantas de Suplencia Eléctrica Crítica',
      'Portería & Control Flujo Pacientes',
      'Auditoría Financiera & Presupuesto',
    ],
  },
  {
    id: 'cc-centro-uno',
    name: 'C.C. Centro Uno (Centro U)',
    type: 'Centro Comercial & Oficinas',
    location: 'Centro Histórico / Calle Santa Teresa',
    areas: [
      'Climatización Central & Chilleries',
      'Subestación Eléctrica & Redes',
      'Seguridad Privada & Tráfico Comercial',
      'Locales & Coeficientes Comerciales',
      'Parqueaderos & Áreas Comunes',
    ],
  },
  {
    id: 'zinnia-club-house',
    name: 'Zinnia Club House',
    type: 'Condominio / Club House',
    location: 'Zona Norte / Serperez',
    areas: [
      'Paisajismo, Jardinería & Zonas Verdes',
      'Mantenimiento Canchas & Gimnasio',
      'Redes Hidráulicas & Bombeo de Agua',
      'Seguridad Perimetral & Control Accesos',
      'Administración & Asambleas',
    ],
  },
  {
    id: 'virrey-eslava',
    name: 'Casa del Virrey Eslava',
    type: 'Residencial Histórico de Lujo',
    location: 'Centro Histórico, Cartagena',
    areas: [
      'Conservación Arquitectónica & Restauro',
      'Red de Prevención de Incendios',
      'Portería & Conserjería Bilingüe',
      'Mantenimiento de Zonas Comunes & Espejos de Agua',
      'Gestión Normativa & Reglamento PH',
    ],
  },
  {
    id: 'portomarine',
    name: 'Edificio Portomarine Luxury Residences',
    type: 'Residencial de Alta Gama',
    location: 'Castillogrande, Cartagena',
    areas: [
      'Marinas & Acabados de Lujo',
      'Conserjería & Atenciones Bilingües',
      'Mantenimiento Predictivo Electromecánico',
      'Seguridad Privada Especializada',
      'Control Presupuestal & Expensas',
    ],
  },
  {
    id: 'morros-vitri',
    name: 'Edificio Morros Vitri',
    type: 'Residencial / Condominio Costero',
    location: 'La Boquilla / Zona Norte',
    areas: [
      'Tratamiento de Agua de Piscinas & Salida a Playa',
      'Protección Anticorrosiva de Estructuras',
      'Seguridad & Control de Visitantes',
      'Mantenimiento Jardines Costeros',
      'Administración General ADPHOR',
    ],
  },
  {
    id: 'laguna-46',
    name: 'Edificio Laguna 46 Centro de Negocios',
    type: 'Empresarial & Corporativo',
    location: 'Pie de la Popa, Cartagena',
    areas: [
      'Aire Acondicionado Central & Torres de Enfriamiento',
      'Control de Accesos Biométrico / Oficinas',
      'Mantenimiento Subestaciones & Elevadores',
      'Mantenimiento de Fachadas en Cristal',
      'Contabilidad Comercial & Cartera',
    ],
  },
]);

/** Datos semilla. Las fechas van en ISO local (sin zona horaria). */
export const SEED_MINUTAS = Object.freeze({
  'palmetto-beach': [
    {
      id: 'MIN-801',
      fecha: '2026-10-15T09:15:00',
      area: 'Mantenimiento Electromecánico (Ascensores / Plantas)',
      descripcion: 'Inspección mensual del ascensor 2 completada por la firma contratista.',
      colaborador: 'Carlos Restrepo',
      estado: STATUS.RESOLVED,
    },
    {
      id: 'MIN-802',
      fecha: '2026-10-14T16:30:00',
      area: 'Fachadas & Protección Corrosión Salina',
      descripcion: 'Aplicación de lavado químico anticorrosivo en estructuras metálicas de la bahía.',
      colaborador: 'Carlos Restrepo',
      estado: STATUS.IN_PROGRESS,
    },
  ],
  'centro-medico-bocagrande': [
    {
      id: 'MIN-701',
      fecha: '2026-10-15T08:00:00',
      area: 'Plantas de Suplencia Eléctrica Crítica',
      descripcion: 'Prueba de transferencia de la planta eléctrica de emergencia sin novedades.',
      colaborador: 'Ing. Jorge M.',
      estado: STATUS.RESOLVED,
    },
  ],
});