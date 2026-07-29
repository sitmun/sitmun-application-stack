-- Grafo FK vivo del esquema destino (tablas que migra este ejemplo).
-- Por qué: contrastar DEPS de 06_topo_order.py con USER_CONSTRAINTS tras Liquibase.
-- No ordena la migración; solo audita aristas child → parent.

COLUMN child_table FORMAT A20
COLUMN child_col FORMAT A20
COLUMN parent_table FORMAT A20
COLUMN parent_col FORMAT A20
COLUMN constraint_name FORMAT A28

SELECT c.table_name AS child_table,
       cc.column_name AS child_col,
       r.table_name AS parent_table,
       rc.column_name AS parent_col,
       c.constraint_name
  FROM user_constraints c
  JOIN user_cons_columns cc
    ON cc.constraint_name = c.constraint_name
   AND cc.owner = c.owner
  JOIN user_constraints r
    ON r.constraint_name = c.r_constraint_name
   AND r.owner = c.r_owner
  JOIN user_cons_columns rc
    ON rc.constraint_name = r.constraint_name
   AND rc.owner = r.owner
   AND rc.position = cc.position
 WHERE c.constraint_type = 'R'
   AND c.table_name IN (
         'STM_APP','STM_APP_BCKG','STM_APP_ROL','STM_APP_TREE',
         'STM_AVAIL_GI','STM_AVAIL_TSK','STM_BACKGRD','STM_CONNECT',
         'STM_GEOINFO','STM_GGI_GI','STM_GRP_GI','STM_GRP_TER','STM_GRP_TSK',
         'STM_GTER_TYP','STM_PAR_APP','STM_PAR_GI','STM_PAR_SER','STM_POST',
         'STM_ROLE','STM_ROL_GGI','STM_ROL_TSK',
         'STM_SERVICE','STM_TASK','STM_TERRITORY','STM_TREE','STM_TREE_NOD',
         'STM_TSK_TYP','STM_TSK_UI','STM_USER','STM_USR_CONF'
       )
 ORDER BY c.table_name, cc.position, c.constraint_name;
