-- Datos ficticios de demostración. Sustituir por copropiedades reales solo en la base privada.
insert into public.projects(id,name,type,location,areas) values
('demo-01','Residencial Horizonte · Demo','Residencial','Ubicación de demostración',array['Ascensores y equipos','Piscina y zonas húmedas','Portería','Fachadas','Áreas comunes']),
('demo-02','Centro de Salud · Demo','Consultorios','Ubicación de demostración',array['Climatización','Aseo y bioseguridad','Planta eléctrica','Control de acceso']),
('demo-03','Centro Comercial · Demo','Comercial','Ubicación de demostración',array['Climatización','Redes eléctricas','Seguridad','Parqueaderos']),
('demo-04','Club Residencial · Demo','Condominio','Ubicación de demostración',array['Jardinería','Canchas y gimnasio','Bombeo de agua','Seguridad perimetral']),
('demo-05','Conjunto Patrimonial · Demo','Residencial','Ubicación de demostración',array['Conservación de fachadas','Prevención de incendios','Conserjería','Zonas comunes']),
('demo-06','Torre Residencial · Demo','Residencial','Ubicación de demostración',array['Acabados','Conserjería','Equipos electromecánicos','Seguridad']),
('demo-07','Condominio Costero · Demo','Condominio','Ubicación de demostración',array['Piscinas','Protección de estructuras','Control de visitantes','Jardines']),
('demo-08','Centro Empresarial · Demo','Oficinas','Ubicación de demostración',array['Aire acondicionado','Control de acceso','Elevadores','Fachadas'])
on conflict(id) do nothing;
