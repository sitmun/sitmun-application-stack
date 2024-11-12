--liquibase formatted sql
--changeset sitmun:1 dbms:postgresql

CREATE TABLE STM_APP
(
  APP_ID       INT4 NOT NULL,
  APP_ENTRYM   BOOLEAN,
  APP_ENTRYS   BOOLEAN,
  APP_CREATED  TIMESTAMP,
  APP_TEMPLATE VARCHAR(250),
  APP_NAME     VARCHAR(50),
  APP_SCALES   VARCHAR(250),
  APP_PROJECT  VARCHAR(50),
  APP_THEME    VARCHAR(30),
  APP_LOGO     VARCHAR(4000),
  APP_DESCRIPTION VARCHAR(4000),
  APP_TITLE    VARCHAR(250),
  APP_REFRESH  BOOLEAN,
  APP_TYPE     VARCHAR(50),
  APP_GGIID    INT4,
  PRIMARY KEY (APP_ID)
);

CREATE TABLE STM_APP_BCKG
(
  ABC_ID     INT4 NOT NULL,
  ABC_ORDER  INT4,
  ABC_APPID  INT4,
  ABC_BACKID INT4,
  PRIMARY KEY (ABC_ID)
);

CREATE TABLE STM_APP_TER
(
  ATE_ID     INT4 NOT NULL,
  ATE_APPID  INT4,
  ATE_TERID  INT4,
  ATE_INIEXT VARCHAR(250),
  PRIMARY KEY (ATE_ID)
);

CREATE TABLE STM_APP_ROL
(
  ARO_ROLEID INT4 NOT NULL,
  ARO_APPID  INT4 NOT NULL,
  PRIMARY KEY (ARO_APPID, ARO_ROLEID)
);

CREATE TABLE STM_APP_TREE
(
  ATR_TREEID INT4 NOT NULL,
  ATR_APPID  INT4 NOT NULL,
  PRIMARY KEY (ATR_APPID, ATR_TREEID)
);

CREATE TABLE STM_AVAIL_GI
(
  AGI_ID      INT4 NOT NULL,
  AGI_CREATED TIMESTAMP,
  AGI_OWNER   VARCHAR(50),
  AGI_GIID    INT4,
  AGI_TERID   INT4,
  PRIMARY KEY (AGI_ID)
);

CREATE TABLE STM_AVAIL_TSK
(
  ATS_ID      INT4 NOT NULL,
  ATS_CREATED TIMESTAMP,
  ATS_TASKID  INT4,
  ATS_TERID   INT4,
  PRIMARY KEY (ATS_ID)
);

CREATE TABLE STM_BACKGRD
(
  BAC_ID      INT4 NOT NULL,
  BAC_ACTIVE  BOOLEAN,
  BAC_CREATED TIMESTAMP,
  BAC_DESC    VARCHAR(250),
  BAC_IMAGE   VARCHAR(4000),
  BAC_NAME    VARCHAR(50),
  BAC_GGIID   INT4,
  PRIMARY KEY (BAC_ID)
);

CREATE TABLE STM_CODELIST
(
  COD_ID          INT4 NOT NULL,
  COD_LIST        VARCHAR(50),
  COD_DESCRIPTION VARCHAR(250),
  COD_SYSTEM      BOOLEAN,
  COD_DEFAULT     BOOLEAN,
  COD_VALUE       VARCHAR(50),
  PRIMARY KEY (COD_ID)
);

CREATE TABLE STM_COMMENT
(
  COM_ID      INT4 NOT NULL,
  COM_COORD_X FLOAT8,
  COM_COORD_Y FLOAT8,
  COM_CREATED TIMESTAMP,
  COM_DESC    VARCHAR(1000),
  COM_EMAIL   VARCHAR(250),
  COM_NAME    VARCHAR(250),
  COM_TITLE   VARCHAR(500),
  COM_APPID   INT4 NOT NULL,
  COM_USERID  INT4 NOT NULL,
  PRIMARY KEY (COM_ID)
);

CREATE TABLE STM_CONF
(
  CNF_ID    INT4 NOT NULL,
  CNF_NAME  VARCHAR(50),
  CNF_VALUE VARCHAR(250),
  PRIMARY KEY (CNF_ID)
);

CREATE TABLE STM_CONNECT
(
  CON_ID         INT4 NOT NULL,
  CON_DRIVER     VARCHAR(50),
  CON_NAME       VARCHAR(50),
  CON_PWD        VARCHAR(50),
  CON_CONNECTION VARCHAR(250),
  CON_USER       VARCHAR(50),
  PRIMARY KEY (CON_ID)
);

CREATE TABLE STM_FIL_GI
(
  FGI_ID        INT4 NOT NULL,
  FGI_COLUMN    VARCHAR(50),
  FGI_NAME      VARCHAR(50),
  FGI_REQUIRED  BOOLEAN,
  FGI_TYPE      VARCHAR(50),
  FGI_VALUETYPE VARCHAR(50),
  FGI_VALUE     VARCHAR(4000),
  FGI_GIID      INT4,
  FGI_TYPID     INT4,
  PRIMARY KEY (FGI_ID)
);

CREATE TABLE STM_GEOINFO
(
  GEO_ID         INT4    NOT NULL,
  GEO_FILTER_GFI BOOLEAN,
  GEO_FILTER_GM  BOOLEAN,
  GEO_FILTER_SS  BOOLEAN,
  GEO_BLOCKED    BOOLEAN,
  GEO_CREATED    TIMESTAMP,
  GEO_DATAURL    VARCHAR(4000),
  GEO_ABSTRACT   VARCHAR(4000),
  GEO_GEOMTYPE   VARCHAR(50),
  GEO_LAYERS     VARCHAR(800),
  GEO_LEGENDTIP  VARCHAR(50),
  GEO_LEGENDURL  VARCHAR(4000),
  GEO_MAXSCALE   INT4,
  GEO_METAURL    VARCHAR(4000),
  GEO_MINSCALE   INT4,
  GEO_NAME       VARCHAR(100),
  GEO_ORDER      INT4,
  GEO_QUERYABL   BOOLEAN,
  GEO_QUERYACT   BOOLEAN,
  GEO_QUERYLAY   VARCHAR(500),
  GEO_SELECTABL  BOOLEAN,
  GEO_SELECTLAY  VARCHAR(500),
  GEO_SOURCE     VARCHAR(50),
  GEO_THEMATIC   BOOLEAN,
  GEO_TRANSP     INT4,
  GEO_TYPE       VARCHAR(50),
  GEO_STYID      INT4,
  GEO_SERID      INT4,
  GEO_STYUSEALL  BOOLEAN NOT NULL DEFAULT FALSE,
  GEO_CONNID     INT4,
  GEO_SERSELID   INT4,
  PRIMARY KEY (GEO_ID)
);

CREATE TABLE STM_GGI_GI
(
  GGG_GGIID INT4 NOT NULL,
  GGG_GIID  INT4 NOT NULL,
  PRIMARY KEY (GGG_GIID, GGG_GGIID)
);

CREATE TABLE STM_GRP_GI
(
  GGI_ID   INT4 NOT NULL,
  GGI_NAME VARCHAR(50),
  GGI_TYPE VARCHAR(50),
  PRIMARY KEY (GGI_ID)
);

CREATE TABLE STM_GRP_TER
(
  GTE_TERID  INT4 NOT NULL,
  GTE_TERMID INT4 NOT NULL,
  PRIMARY KEY (GTE_TERMID, GTE_TERID)
);

CREATE TABLE STM_GRP_TSK
(
  GTS_ID   INT4 NOT NULL,
  GTS_NAME VARCHAR(50),
  PRIMARY KEY (GTS_ID)
);

CREATE TABLE STM_GTER_TYP
(
  GTT_ID   INT4 NOT NULL,
  GTT_NAME VARCHAR(250),
  PRIMARY KEY (GTT_ID)
);

CREATE TABLE STM_LANGUAGE
(
  LAN_ID        INT4 NOT NULL,
  LAN_NAME      VARCHAR(50),
  LAN_SHORTNAME VARCHAR(20),
  PRIMARY KEY (LAN_ID)
);

CREATE TABLE STM_LOG
(
  LOG_ID     INT4 NOT NULL,
  LOG_BUFFER BOOLEAN,
  LOG_COUNT  INT4,
  LOG_DATA   VARCHAR(250),
  LOG_DATE   TIMESTAMP,
  LOG_EMAIL  VARCHAR(250),
  LOG_FORMAT VARCHAR(50),
  LOG_OTHER  VARCHAR(4000),
  LOG_SRS    VARCHAR(50),
  LOG_TEREXT VARCHAR(250),
  LOG_TER    VARCHAR(50),
  LOG_TYPE   VARCHAR(50),
  LOG_APPID  INT4,
  LOG_GIID   INT4,
  LOG_TASKID INT4,
  LOG_TERID  INT4,
  LOG_USERID INT4,
  PRIMARY KEY (LOG_ID)
);

CREATE TABLE STM_PAR_APP
(
  PAP_ID    INT4 NOT NULL,
  PAP_NAME  VARCHAR(50),
  PAP_TYPE  VARCHAR(50),
  PAP_VALUE VARCHAR(250),
  PAP_APPID INT4,
  PRIMARY KEY (PAP_ID)
);

CREATE TABLE STM_PAR_GI
(
  PGI_ID     INT4 NOT NULL,
  PGI_FORMAT VARCHAR(50),
  PGI_NAME   VARCHAR(50),
  PGI_ORDER  INT4,
  PGI_TYPE   VARCHAR(50),
  PGI_VALUE  VARCHAR(250),
  PGI_GIID   INT4,
  PRIMARY KEY (PGI_ID)
);

CREATE TABLE STM_PAR_SGI
(
  PSG_ID     INT4 NOT NULL,
  PSG_FORMAT VARCHAR(50),
  PSG_NAME   VARCHAR(50),
  PSG_ORDER  INT4,
  PSG_TYPE   VARCHAR(50),
  PSG_VALUE  VARCHAR(250),
  PSG_GIID   INT4,
  PRIMARY KEY (PSG_ID)
);

CREATE TABLE STM_PAR_SER
(
  PSE_ID    INT4 NOT NULL,
  PSE_NAME  VARCHAR(50),
  PSE_TYPE  VARCHAR(50),
  PSE_VALUE VARCHAR(250),
  PSE_SERID INT4,
  PRIMARY KEY (PSE_ID)
);

CREATE TABLE STM_POST
(
  POS_ID         INT4 NOT NULL,
  POS_CREATED    TIMESTAMP,
  POS_UPDATED    TIMESTAMP,
  POS_EMAIL      VARCHAR(250),
  POS_EXPIRATION TIMESTAMP,
  POS_POST       VARCHAR(250),
  POS_ORG        VARCHAR(250),
  POS_TYPE       VARCHAR(50),
  POS_TERID      INT4,
  POS_USERID     INT4,
  PRIMARY KEY (POS_ID)
);

CREATE TABLE STM_ROL_GGI
(
  RGG_ROLEID INT4 NOT NULL,
  RGG_GGIID  INT4 NOT NULL,
  PRIMARY KEY (RGG_GGIID, RGG_ROLEID)
);

CREATE TABLE STM_ROL_TSK
(
  RTS_TASKID INT4 NOT NULL,
  RTS_ROLEID INT4 NOT NULL,
  PRIMARY KEY (RTS_ROLEID, RTS_TASKID)
);

CREATE TABLE STM_ROLE
(
  ROL_ID   INT4 NOT NULL,
  ROL_NOTE VARCHAR(500),
  ROL_NAME VARCHAR(50),
  PRIMARY KEY (ROL_ID)
);

CREATE TABLE STM_SEQUENCE
(
  SEQ_NAME  VARCHAR(255) NOT NULL,
  SEQ_COUNT INT8,
  PRIMARY KEY (SEQ_NAME)
);

CREATE TABLE STM_SERVICE
(
  SER_ID       INT4                  NOT NULL,
  SER_BLOCKED  BOOLEAN,
  SER_PROXIED  BOOLEAN DEFAULT FALSE NOT NULL,
  SER_CREATED  TIMESTAMP,
  SER_ABSTRACT VARCHAR(4000),
  SER_INFOURL  VARCHAR(4000),
  SER_LEGEND   VARCHAR(4000),
  SER_NAME     VARCHAR(60),
  SER_NAT_PROT VARCHAR(50),
  SER_URL      VARCHAR(4000),
  SER_PROJECTS VARCHAR(1000),
  SER_PROTOCOL VARCHAR(50),
  SER_AUTH_MOD VARCHAR(50),
  SER_USER     VARCHAR(50),
  SER_PWD      VARCHAR(50),
  PRIMARY KEY (SER_ID)
);

CREATE TABLE STM_STY_GI
(
  SGI_ID          INT4    NOT NULL,
  SGI_ABSTRACT    VARCHAR(250),
  SGI_LURL_FORMAT VARCHAR(255),
  SGI_LURL_HEIGHT INT4,
  SGI_LURL_URL    VARCHAR(255),
  SGI_LURL_WIDTH  INT4,
  SGI_NAME        VARCHAR(50),
  SGI_TITLE       VARCHAR(50),
  SGI_DEFAULT     BOOLEAN NOT NULL DEFAULT FALSE,
  SGI_GIID        INT4,
  PRIMARY KEY (SGI_ID)
);

CREATE TABLE STM_TASK
(
  TAS_ID      INT4 NOT NULL,
  TAS_NAME    VARCHAR(512),
  TAS_CREATED TIMESTAMP,
  TAS_ORDER   INT4,
  TAS_GIID    INT4,
  TAS_SERID   INT4,
  TAS_GTASKID INT4,
  TAS_TTASKID INT4,
  TAS_TUIID   INT4,
  TAS_CONNID  INT4,
  TAS_PARAMS  TEXT,
  PRIMARY KEY (TAS_ID)
);

CREATE TABLE STM_TASKREL
(
  TAR_ID        INT4 NOT NULL,
  TAR_TYPE      VARCHAR(50),
  TAR_TASKID    INT4,
  TAR_TASKRELID INT4,
  PRIMARY KEY (TAR_ID)
);

CREATE TABLE STM_TER_TYP
(
  TET_ID       INT4    NOT NULL,
  TET_NAME     VARCHAR(50),
  TET_OFFICIAL BOOLEAN NOT NULL,
  TET_TOP      BOOLEAN NOT NULL,
  TET_BOTTOM   BOOLEAN NOT NULL,
  PRIMARY KEY (TET_ID)
);

CREATE TABLE STM_TERRITORY
(
  TER_ID      INT4 NOT NULL,
  TER_BLOCKED BOOLEAN,
  TER_CODTER  VARCHAR(50),
  TER_CREATED TIMESTAMP,
  TER_EXTENT  VARCHAR(250),
  TER_CENTER  VARCHAR(250),
  TER_LEGAL   VARCHAR(50),
  TER_ZOOM    INT4,
  TER_NAME    VARCHAR(250),
  TER_NOTE    VARCHAR(250),
  TER_SCOPE   VARCHAR(50),
  TER_ADDRESS VARCHAR(250),
  TER_EMAIL   VARCHAR(50),
  TER_LOGO    VARCHAR(4000),
  TER_ADMNAME VARCHAR(250),
  TER_GTYPID  INT4,
  TER_TYPID   INT4,
  PRIMARY KEY (TER_ID)
);

CREATE TABLE STM_TRANSLATION
(
  TRA_ID     INT4 NOT NULL,
  TRA_COLUMN VARCHAR(50),
  TRA_ELEID  INT4,
  TRA_NAME   VARCHAR(250),
  TRA_LANID  INT4,
  PRIMARY KEY (TRA_ID)
);

CREATE TABLE STM_TREE
(
  TRE_ID       INT4 NOT NULL,
  TRE_ABSTRACT VARCHAR(250),
  TRE_IMAGE    VARCHAR(4000),
  TRE_NAME     VARCHAR(50),
  TRE_USERID   INT4,
  PRIMARY KEY (TRE_ID)
);

CREATE TABLE STM_TREE_NOD
(
  TNO_ID         INT4 NOT NULL,
  TNO_ACTIVE     BOOLEAN,
  TNO_DATAURL    VARCHAR(4000),
  TNO_ABSTRACT   VARCHAR(250),
  TNO_FILTER_GFI BOOLEAN,
  TNO_FILTER_GM  BOOLEAN,
  TNO_FILTER_SE  BOOLEAN,
  TNO_METAURL    VARCHAR(4000),
  TNO_NAME       VARCHAR(80),
  TNO_ORDER      INT4,
  TNO_QUERYACT   BOOLEAN,
  TNO_RADIO      BOOLEAN,
  TNO_LOADDATA   BOOLEAN NOT NULL DEFAULT FALSE,
  TNO_TOOLTIP    VARCHAR(100),
  TNO_GIID       INT4,
  TNO_PARENTID   INT4,
  TNO_TREEID     INT4,
  TNO_STYLE      VARCHAR(50),
  PRIMARY KEY (TNO_ID)
);

CREATE TABLE STM_TREE_ROL
(
  TRO_TREEID INT4 NOT NULL,
  TRO_ROLEID INT4 NOT NULL,
  PRIMARY KEY (TRO_ROLEID, TRO_TREEID)
);

CREATE TABLE STM_TSK_TYP
(
  TTY_ID       INT4 NOT NULL,
  TTY_ENABLED  BOOLEAN,
  TTY_NAME     VARCHAR(50),
  TTY_ORDER    INT4,
  TTY_SPEC     TEXT,
  TTY_TITLE    VARCHAR(50),
  TTY_PARENTID INT4,
  PRIMARY KEY (TTY_ID)
);

CREATE TABLE STM_TSK_UI
(
  TUI_ID      INT4 NOT NULL,
  TUI_NAME    VARCHAR(50),
  TUI_ORDER   INT4,
  TUI_TOOLTIP VARCHAR(100),
  TUI_TYPE    VARCHAR(30),
  PRIMARY KEY (TUI_ID)
);

CREATE TABLE STM_USER
(
  USE_ID        INT4 NOT NULL,
  USE_ADM       BOOLEAN,
  USE_BLOCKED   BOOLEAN,
  USE_CREATED   TIMESTAMP,
  USE_UPDATED   TIMESTAMP,
  USE_NAME      VARCHAR(30),
  USE_GENERIC   BOOLEAN,
  USE_IDENT     VARCHAR(50),
  USE_IDENTTYPE VARCHAR(50),
  USE_SURNAME   VARCHAR(40),
  USE_PWD       VARCHAR(128),
  USE_USER      VARCHAR(50),
  PRIMARY KEY (USE_ID)
);

CREATE TABLE STM_USR_CONF
(
  UCO_ID      INT4 NOT NULL,
  UCO_ROLEM   BOOLEAN,
  UCO_CREATED TIMESTAMP,
  UCO_ROLEID  INT4,
  UCO_TERID   INT4,
  UCO_USERID  INT4,
  PRIMARY KEY (UCO_ID)
);

ALTER TABLE IF EXISTS STM_APP_BCKG ADD CONSTRAINT STM_APF_UK UNIQUE (ABC_APPID, ABC_BACKID);

ALTER TABLE IF EXISTS STM_APP_TER ADD CONSTRAINT STM_APT_UK UNIQUE (ATE_APPID, ATE_TERID);

ALTER TABLE IF EXISTS STM_AVAIL_GI ADD CONSTRAINT STM_DCA_UK UNIQUE (AGI_TERID, AGI_GIID);

ALTER TABLE IF EXISTS STM_AVAIL_TSK ADD CONSTRAINT STM_DTA_UK UNIQUE (ATS_TERID, ATS_TASKID);

ALTER TABLE IF EXISTS STM_CODELIST ADD CONSTRAINT UKH4JN7SFGMUDOC896BLVFQBV3B UNIQUE (COD_LIST, COD_VALUE);

ALTER TABLE IF EXISTS STM_CONF ADD CONSTRAINT STM_CONF_NAME_UK UNIQUE (CNF_NAME);

ALTER TABLE IF EXISTS STM_GTER_TYP ADD CONSTRAINT STM_GTT_NOM_UK UNIQUE (GTT_NAME);

ALTER TABLE IF EXISTS STM_LANGUAGE ADD CONSTRAINT UKPIA9A18THHKA1NCR9CNYJL0J8 UNIQUE (LAN_SHORTNAME);

ALTER TABLE IF EXISTS STM_POST ADD CONSTRAINT UKT67T88DOKIXQN9VEHTT1AEJ1X UNIQUE (POS_USERID, POS_TERID);

ALTER TABLE IF EXISTS STM_ROLE ADD CONSTRAINT STM_ROL_NOM_UK UNIQUE (ROL_NAME);

ALTER TABLE IF EXISTS STM_TER_TYP ADD CONSTRAINT STM_TET_NOM_UK UNIQUE (TET_NAME);

ALTER TABLE IF EXISTS STM_TERRITORY ADD CONSTRAINT STM_TER_NOM_UK UNIQUE (TER_NAME);

ALTER TABLE IF EXISTS STM_TRANSLATION ADD CONSTRAINT UK2K84KV6JXBMSDVWEW4LJ4RO0G UNIQUE (TRA_ELEID, TRA_COLUMN, TRA_LANID);

ALTER TABLE IF EXISTS STM_USER ADD CONSTRAINT STM_USU_USU_UK UNIQUE (USE_USER);

ALTER TABLE IF EXISTS STM_USR_CONF ADD CONSTRAINT STM_UCF_UK UNIQUE (UCO_USERID, UCO_TERID, UCO_ROLEID, UCO_ROLEM);

ALTER TABLE IF EXISTS STM_APP ADD CONSTRAINT STM_APP_FK_GGI FOREIGN KEY (APP_GGIID) REFERENCES STM_GRP_GI;

ALTER TABLE IF EXISTS STM_APP_TER ADD CONSTRAINT STM_ATE_FK_APP FOREIGN KEY (ATE_APPID) REFERENCES STM_APP ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_APP_TER ADD CONSTRAINT STM_ATE_FK_TER FOREIGN KEY (ATE_TERID) REFERENCES STM_TERRITORY ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_APP_ROL ADD CONSTRAINT STM_ARO_FK_APP FOREIGN KEY (ARO_APPID) REFERENCES STM_APP;

ALTER TABLE IF EXISTS STM_APP_ROL ADD CONSTRAINT STM_ARO_FK_ROL FOREIGN KEY (ARO_ROLEID) REFERENCES STM_ROLE;

ALTER TABLE IF EXISTS STM_APP_TREE ADD CONSTRAINT STM_ATR_FK_APP FOREIGN KEY (ATR_APPID) REFERENCES STM_APP;

ALTER TABLE IF EXISTS STM_APP_TREE ADD CONSTRAINT STM_ATR_FK_TRE FOREIGN KEY (ATR_TREEID) REFERENCES STM_TREE;

ALTER TABLE IF EXISTS STM_AVAIL_GI ADD CONSTRAINT STM_AGI_FK_GEO FOREIGN KEY (AGI_GIID) REFERENCES STM_GEOINFO ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_AVAIL_GI ADD CONSTRAINT STM_AGI_FK_TER FOREIGN KEY (AGI_TERID) REFERENCES STM_TERRITORY ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_AVAIL_TSK ADD CONSTRAINT STM_ATS_FK_TAS FOREIGN KEY (ATS_TASKID) REFERENCES STM_TASK ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_AVAIL_TSK ADD CONSTRAINT STM_ATS_FK_TER FOREIGN KEY (ATS_TERID) REFERENCES STM_TERRITORY ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_BACKGRD ADD CONSTRAINT STM_BAC_FK_GGI FOREIGN KEY (BAC_GGIID) REFERENCES STM_GRP_GI;

ALTER TABLE IF EXISTS STM_COMMENT ADD CONSTRAINT STM_COM_FK_APP FOREIGN KEY (COM_APPID) REFERENCES STM_APP ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_COMMENT ADD CONSTRAINT STM_COM_FK_USE FOREIGN KEY (COM_USERID) REFERENCES STM_USER ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_FIL_GI ADD CONSTRAINT STM_FGI_FK_GEO FOREIGN KEY (FGI_GIID) REFERENCES STM_GEOINFO ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_FIL_GI ADD CONSTRAINT STM_FGI_FK_TET FOREIGN KEY (FGI_TYPID) REFERENCES STM_TER_TYP;

ALTER TABLE IF EXISTS STM_GEOINFO ADD CONSTRAINT STM_GEO_FK_SGI FOREIGN KEY (GEO_STYID) REFERENCES STM_STY_GI;

ALTER TABLE IF EXISTS STM_GEOINFO ADD CONSTRAINT STM_GEO_FK_SER FOREIGN KEY (GEO_SERID) REFERENCES STM_SERVICE;

ALTER TABLE IF EXISTS STM_GEOINFO ADD CONSTRAINT STM_GEO_FK_CON FOREIGN KEY (GEO_CONNID) REFERENCES STM_CONNECT;

ALTER TABLE IF EXISTS STM_GEOINFO ADD CONSTRAINT STM_GEO_FK_SERSEL FOREIGN KEY (GEO_SERSELID) REFERENCES STM_SERVICE;

ALTER TABLE IF EXISTS STM_GGI_GI ADD CONSTRAINT STM_GGG_FK_GEO FOREIGN KEY (GGG_GIID) REFERENCES STM_GEOINFO;

ALTER TABLE IF EXISTS STM_GGI_GI ADD CONSTRAINT STM_GGG_FK_GGI FOREIGN KEY (GGG_GGIID) REFERENCES STM_GRP_GI;

ALTER TABLE IF EXISTS STM_GRP_TER ADD CONSTRAINT STM_GTE_FK_TERM FOREIGN KEY (GTE_TERMID) REFERENCES STM_TERRITORY;

ALTER TABLE IF EXISTS STM_GRP_TER ADD CONSTRAINT STM_GTE_FK_TER FOREIGN KEY (GTE_TERID) REFERENCES STM_TERRITORY;

ALTER TABLE IF EXISTS STM_LOG ADD CONSTRAINT FKKEVXKUE4E8UA7NQISDF9QTT9U FOREIGN KEY (LOG_APPID) REFERENCES STM_APP;

ALTER TABLE IF EXISTS STM_LOG ADD CONSTRAINT FKD40R7BQKXMOSOKQR544ELCYRT FOREIGN KEY (LOG_GIID) REFERENCES STM_GEOINFO;

ALTER TABLE IF EXISTS STM_LOG ADD CONSTRAINT FKCW6U4JP3WVNKH7YPDL81UYFWC FOREIGN KEY (LOG_TASKID) REFERENCES STM_TASK;

ALTER TABLE IF EXISTS STM_LOG ADD CONSTRAINT FKM77T0WVSOV0PQY99PFBYEDIP7 FOREIGN KEY (LOG_TERID) REFERENCES STM_TERRITORY;

ALTER TABLE IF EXISTS STM_LOG ADD CONSTRAINT FK2P47BCWKDBN91H2OXUF5CSIR8 FOREIGN KEY (LOG_USERID) REFERENCES STM_USER;

ALTER TABLE IF EXISTS STM_PAR_APP ADD CONSTRAINT STM_PAP_FK_APP FOREIGN KEY (PAP_APPID) REFERENCES STM_APP ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_PAR_GI ADD CONSTRAINT STM_PGI_FK_GEO FOREIGN KEY (PGI_GIID) REFERENCES STM_GEOINFO ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_PAR_SGI ADD CONSTRAINT STM_PSG_FK_GEO FOREIGN KEY (PSG_GIID) REFERENCES STM_GEOINFO ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_PAR_SER ADD CONSTRAINT STM_PSE_FK_SER FOREIGN KEY (PSE_SERID) REFERENCES STM_SERVICE ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_POST ADD CONSTRAINT STM_POS_FK_TER FOREIGN KEY (POS_TERID) REFERENCES STM_TERRITORY ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_POST ADD CONSTRAINT STM_POS_FK_USE FOREIGN KEY (POS_USERID) REFERENCES STM_USER ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_ROL_GGI ADD CONSTRAINT STM_RGG_FK_GGI FOREIGN KEY (RGG_GGIID) REFERENCES STM_GRP_GI;

ALTER TABLE IF EXISTS STM_ROL_GGI ADD CONSTRAINT STM_RGG_FK_ROL FOREIGN KEY (RGG_ROLEID) REFERENCES STM_ROLE;

ALTER TABLE IF EXISTS STM_ROL_TSK ADD CONSTRAINT STM_RTS_FK_ROL FOREIGN KEY (RTS_ROLEID) REFERENCES STM_ROLE;

ALTER TABLE IF EXISTS STM_ROL_TSK ADD CONSTRAINT STM_RTS_FK_TAS FOREIGN KEY (RTS_TASKID) REFERENCES STM_TASK;

ALTER TABLE IF EXISTS STM_STY_GI ADD CONSTRAINT STM_SGI_FK_GEO FOREIGN KEY (SGI_GIID) REFERENCES STM_GEOINFO;

ALTER TABLE IF EXISTS STM_TASK ADD CONSTRAINT STM_TAS_FK_GEO FOREIGN KEY (TAS_GIID) REFERENCES STM_GEOINFO;

ALTER TABLE IF EXISTS STM_TASK ADD CONSTRAINT STM_TAS_FK_SER FOREIGN KEY (TAS_SERID) REFERENCES STM_SERVICE;

ALTER TABLE IF EXISTS STM_TASK ADD CONSTRAINT STM_TAS_FK_GTS FOREIGN KEY (TAS_GTASKID) REFERENCES STM_GRP_TSK;

ALTER TABLE IF EXISTS STM_TASK ADD CONSTRAINT STM_TAS_FK_TTY FOREIGN KEY (TAS_TTASKID) REFERENCES STM_TSK_TYP;

ALTER TABLE IF EXISTS STM_TASK ADD CONSTRAINT STM_TAS_FK_TUI FOREIGN KEY (TAS_TUIID) REFERENCES STM_TSK_UI;

ALTER TABLE IF EXISTS STM_TASK ADD CONSTRAINT STM_TAS_FK_CON FOREIGN KEY (TAS_CONNID) REFERENCES STM_CONNECT;

ALTER TABLE IF EXISTS STM_TASKREL ADD CONSTRAINT STM_TAR_FK_TAS FOREIGN KEY (TAR_TASKID) REFERENCES STM_TASK ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_TASKREL ADD CONSTRAINT STM_TAR_FK_TAS_REL FOREIGN KEY (TAR_TASKRELID) REFERENCES STM_TASK;

ALTER TABLE IF EXISTS STM_TERRITORY ADD CONSTRAINT STM_TER_FK_TET FOREIGN KEY (TER_GTYPID) REFERENCES STM_GTER_TYP;

ALTER TABLE IF EXISTS STM_TERRITORY ADD CONSTRAINT STM_TER_FK_TGR FOREIGN KEY (TER_TYPID) REFERENCES STM_TER_TYP;

ALTER TABLE IF EXISTS STM_TRANSLATION ADD CONSTRAINT STM_TRA_FK_LAN FOREIGN KEY (TRA_LANID) REFERENCES STM_LANGUAGE;

ALTER TABLE IF EXISTS STM_TREE ADD CONSTRAINT STM_TRE_FK_USE FOREIGN KEY (TRE_USERID) REFERENCES STM_USER;

ALTER TABLE IF EXISTS STM_TREE_NOD ADD CONSTRAINT STM_TNO_FK_GEO FOREIGN KEY (TNO_GIID) REFERENCES STM_GEOINFO;

ALTER TABLE IF EXISTS STM_TREE_NOD ADD CONSTRAINT STM_TNO_FK_TNO FOREIGN KEY (TNO_PARENTID) REFERENCES STM_TREE_NOD;

ALTER TABLE IF EXISTS STM_TREE_NOD ADD CONSTRAINT STM_TNO_FK_TRE FOREIGN KEY (TNO_TREEID) REFERENCES STM_TREE ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_TREE_ROL ADD CONSTRAINT STM_TRO_FK_ROL FOREIGN KEY (TRO_ROLEID) REFERENCES STM_ROLE;

ALTER TABLE IF EXISTS STM_TREE_ROL ADD CONSTRAINT STM_TRO_FK_TRE FOREIGN KEY (TRO_TREEID) REFERENCES STM_TREE;

ALTER TABLE IF EXISTS STM_TSK_TYP ADD CONSTRAINT STM_TSK_TYP_TTY FOREIGN KEY (TTY_PARENTID) REFERENCES STM_TSK_TYP ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_USR_CONF ADD CONSTRAINT STM_UCF_FK_ROL FOREIGN KEY (UCO_ROLEID) REFERENCES STM_ROLE ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_USR_CONF ADD CONSTRAINT STM_UCF_FK_TER FOREIGN KEY (UCO_TERID) REFERENCES STM_TERRITORY ON DELETE CASCADE;

ALTER TABLE IF EXISTS STM_USR_CONF ADD CONSTRAINT STM_UCF_FK_USU FOREIGN KEY (UCO_USERID) REFERENCES STM_USER ON DELETE CASCADE
