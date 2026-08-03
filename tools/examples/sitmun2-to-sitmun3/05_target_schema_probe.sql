-- Sondeo de columnas vivas del destino tras el master Liquibase oracle completo.
-- Por qué: el 01_schema.oracle.sql no es la versión final; cambios posteriores añaden
-- columnas. Hay que alinear 10_migrate_core.sql con la BD real antes de insertar.
-- Volved a ejecutarlo después de cada upgrade Liquibase.

COLUMN table_name FORMAT A20
COLUMN column_name FORMAT A32
COLUMN data_type FORMAT A20
COLUMN nullable FORMAT A8
COLUMN data_length FORMAT 99999

-- Lista de tablas del núcleo que este ejemplo migra (más STM_TSK_TYP / STM_SEQUENCE
-- que ya vienen del seed Liquibase y hacen falta como referencia).
SELECT table_name,
       column_name,
       data_type,
       data_length,
       data_precision,
       data_scale,
       nullable,
       column_id
  FROM user_tab_columns
 WHERE table_name IN (
         'STM_APP',
         'STM_APP_BCKG',
         'STM_APP_ROL',
         'STM_APP_TREE',
         'STM_AVAIL_GI',
         'STM_AVAIL_TSK',
         'STM_BACKGRD',
         'STM_CONNECT',
         'STM_GEOINFO',
         'STM_GGI_GI',
         'STM_GRP_GI',
         'STM_GRP_TER',
         'STM_GRP_TSK',
         'STM_GTER_TYP',
         'STM_PAR_APP',
         'STM_PAR_GI',
         'STM_PAR_SER',
         'STM_POST',
         'STM_ROLE',
         'STM_ROL_GGI',
         'STM_ROL_TSK',
         'STM_SEQUENCE',
         'STM_SERVICE',
         'STM_TASK',
         'STM_TERRITORY',
         'STM_TREE',
         'STM_TREE_NOD',
         'STM_TSK_TYP',
         'STM_TSK_UI',
         'STM_USER',
         'STM_USR_CONF'
       )
 ORDER BY table_name, column_id;

-- Por qué este segundo SELECT: columnas de STM_APP añadidas o exigidas después del
-- bootstrap inicial; si falta alguna, Liquibase no se ha aplicado completo.
SELECT column_name, data_type, nullable
  FROM user_tab_columns
 WHERE table_name = 'STM_APP'
   AND column_name IN (
         'APP_RESPONSIBLE_INSTITUTION',
         'APP_HEADERPARAMS',
         'APP_PRIVATE',
         'APP_UNAVAILABLE',
         'APP_LAST_UPDATE',
         'APP_MAINTENANCE_INFORMATION',
         'APP_CREATORID'
       )
 ORDER BY column_name;

-- Opcional: sondeo contra otro esquema
-- SELECT * FROM all_tab_columns
--  WHERE owner = 'SITMUN3' AND table_name = 'STM_APP'
--  ORDER BY column_id;
