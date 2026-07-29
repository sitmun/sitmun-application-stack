-- Ejemplo SITMUN 2 → 3: exponer las tablas v2 como SITMUN2.<tabla> para el usuario destino.
-- Por qué: 10_migrate_core.sql lee siempre el prefijo SITMUN2; este fichero documenta
-- cómo hacerlo accesible sin cambiar el SQL de migración.
-- Preferid doble esquema en la misma instancia (opción A). Usad DB link (opción B) si v2 es remoto.
-- Editad nombres de usuario / credenciales antes de ejecutar.

-- ---------------------------------------------------------------------------
-- Opción A (preferida): misma instancia Oracle, esquemas distintos
--   SITMUN2 = propietario del catálogo legado
--   SITMUN3 = destino evolucionado con Liquibase (usuario de sesión actual)
-- Por qué: SELECT entre esquemas locales es más simple y fiable que un DB link.
-- ---------------------------------------------------------------------------
-- Como SYS / DBA (ilustrativo):
--   CREATE USER SITMUN2 IDENTIFIED BY ...;
--   GRANT CONNECT, RESOURCE TO SITMUN2;
--   -- cargar / restaurar tablas SITMUN 2 en SITMUN2
--   GRANT SELECT ON SITMUN2.STM_APPFON TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_APPS TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_ARBOL TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_ARBOLNOD TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_CARGO TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_CARTO TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_CONEXION TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_CONSULTA TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_DISPCARTO TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_DISPTAREA TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_ETERRIT TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_FONDO TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_GCACAR TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_GRPCARTO TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_GRPTER TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_GRPTAR TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_PARAMAPP TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_PARAMCAR TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_PARAMSER TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_PARAMTTA TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_ROLES TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_ROLGCA TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_ROLTAR TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_SERVICIO TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_TAREA TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_TAREA_UI TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_TIPOGRP TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_TIPOTAREA TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_USUARIO TO SITMUN3;
--   GRANT SELECT ON SITMUN2.STM_USUCONF TO SITMUN3;
-- Por qué GRANT SELECT: el usuario destino solo debe leer v2, no modificarla.

-- Si el propietario ya se llama SITMUN2, los nombres cualificados funcionan sin sinónimos.
-- Sinónimos locales (opcional) si el owner legado tiene otro nombre:
--
-- CREATE OR REPLACE SYNONYM SITMUN2_STM_APPS FOR PROPIETARIO_LEGADO.STM_APPS;
-- ... y entonces adaptad 10_migrate_core.sql a esos nombres.

PROMPT Opción A: comprobad que existen GRANT SELECT desde SITMUN2 hacia el usuario actual.
SELECT table_name
  FROM all_tables
 WHERE owner = 'SITMUN2'
   AND table_name LIKE 'STM_%'
 ORDER BY table_name;
-- Por qué esta consulta: valida que el origen es visible antes de migrar.

-- ---------------------------------------------------------------------------
-- Opción B: v2 remoto vía database link
-- Por qué: cuando el catálogo SITMUN 2 no está en la misma instancia que SITMUN 3.
-- ---------------------------------------------------------------------------
-- CREATE DATABASE LINK sitmun2_link
--   CONNECT TO sitmun2_user IDENTIFIED BY "secret"
--   USING 'sitmun2_tns';
--
-- Cread el usuario SITMUN2 con sinónimos hacia objetos@sitmun2_link y
-- GRANT SELECT a SITMUN3. Oracle no permite un esquema solo con sinónimos
-- sin usuario propio.

PROMPT Configuración completa cuando ALL_TABLES (o sinónimos) listen las fuentes STM_* de v2.
