/** Datos completamente ficticios para la demostración pública. */
export const PROJECTS = [
  { id: 'demo-01', name: 'Residencial Horizonte · Demo', type: 'Residencial', location: 'Ubicación de demostración', areas: ['Ascensores y equipos', 'Piscina y zonas húmedas', 'Portería', 'Fachadas', 'Áreas comunes'] },
  { id: 'demo-02', name: 'Centro de Salud · Demo', type: 'Consultorios', location: 'Ubicación de demostración', areas: ['Climatización', 'Aseo y bioseguridad', 'Planta eléctrica', 'Control de acceso'] },
  { id: 'demo-03', name: 'Centro Comercial · Demo', type: 'Comercial', location: 'Ubicación de demostración', areas: ['Climatización', 'Redes eléctricas', 'Seguridad', 'Parqueaderos'] },
  { id: 'demo-04', name: 'Club Residencial · Demo', type: 'Condominio', location: 'Ubicación de demostración', areas: ['Jardinería', 'Canchas y gimnasio', 'Bombeo de agua', 'Seguridad perimetral'] },
  { id: 'demo-05', name: 'Conjunto Patrimonial · Demo', type: 'Residencial', location: 'Ubicación de demostración', areas: ['Conservación de fachadas', 'Prevención de incendios', 'Conserjería', 'Zonas comunes'] },
  { id: 'demo-06', name: 'Torre Residencial · Demo', type: 'Residencial', location: 'Ubicación de demostración', areas: ['Acabados', 'Conserjería', 'Equipos electromecánicos', 'Seguridad'] },
  { id: 'demo-07', name: 'Condominio Costero · Demo', type: 'Condominio', location: 'Ubicación de demostración', areas: ['Piscinas', 'Protección de estructuras', 'Control de visitantes', 'Jardines'] },
  { id: 'demo-08', name: 'Centro Empresarial · Demo', type: 'Oficinas', location: 'Ubicación de demostración', areas: ['Aire acondicionado', 'Control de acceso', 'Elevadores', 'Fachadas'] },
];
export const SEED_MINUTAS = {
  'demo-01': [
    { id: 'DEMO-001', fecha: '2026-10-15T09:15:00-05:00', area: 'Ascensores y equipos', descripcion: 'Ejemplo: inspección del ascensor terminada, pendiente de verificación.', colaborador: 'Equipo de demostración', estado: 'Resuelta' },
    { id: 'DEMO-002', fecha: '2026-10-14T16:30:00-05:00', area: 'Fachadas', descripcion: 'Ejemplo: revisión de filtraciones en el muro de una zona común.', colaborador: 'Equipo de demostración', estado: 'En Proceso' },
  ],
  'demo-02': [
    { id: 'DEMO-003', fecha: '2026-10-15T08:00:00-05:00', area: 'Planta eléctrica', descripcion: 'Ejemplo: prueba de la planta de emergencia lista para verificar.', colaborador: 'Equipo de demostración', estado: 'Resuelta' },
  ],
};
