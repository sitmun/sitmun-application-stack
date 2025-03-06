--liquibase formatted sql
--changeset sitmun:1 dbms:oracle

CREATE TABLE STM_APP
(
  APP_ID          NUMBER(10, 0) NOT NULL,
  APP_ENTRYM      NUMBER(1, 0),
  APP_ENTRYS      NUMBER(1, 0),
  APP_CREATED     TIMESTAMP,
  APP_TEMPLATE    VARCHAR2(250 CHAR),
  APP_NAME        VARCHAR2(50 CHAR),
  APP_SCALES      VARCHAR2(250 CHAR),
  APP_PROJECT     VARCHAR2(50 CHAR),
  APP_THEME       VARCHAR2(30 CHAR),
  APP_LOGO        VARCHAR2(4000 CHAR),
  APP_DESCRIPTION VARCHAR2(4000 CHAR),
  APP_TITLE       VARCHAR2(250 CHAR),
  APP_REFRESH     NUMBER(1, 0),
  APP_TYPE        VARCHAR2(50 CHAR),
  APP_GGIID       NUMBER(10, 0),
  PRIMARY KEY (APP_ID)
);

CREATE TABLE STM_APP_BCKG
(
  ABC_ID     NUMBER(10, 0) NOT NULL,
  ABC_ORDER  NUMBER(10, 0),
  ABC_APPID  NUMBER(10, 0),
  ABC_BACKID NUMBER(10, 0),
  PRIMARY KEY (ABC_ID)
);

CREATE TABLE STM_APP_TER
(
  ATE_ID     NUMBER(10, 0) NOT NULL,
  ATE_APPID  NUMBER(10, 0),
  ATE_TERID  NUMBER(10, 0),
  ATE_INIEXT VARCHAR2(250 CHAR),
  PRIMARY KEY (ATE_ID)
);

CREATE TABLE STM_APP_ROL
(
  ARO_ROLEID NUMBER(10, 0) NOT NULL,
  ARO_APPID  NUMBER(10, 0) NOT NULL,
  PRIMARY KEY (ARO_APPID, ARO_ROLEID)
);

CREATE TABLE STM_APP_TREE
(
  ATR_TREEID NUMBER(10, 0) NOT NULL,
  ATR_APPID  NUMBER(10, 0) NOT NULL,
  PRIMARY KEY (ATR_APPID, ATR_TREEID)
);

CREATE TABLE STM_AVAIL_GI
(
  AGI_ID      NUMBER(10, 0) NOT NULL,
  AGI_CREATED TIMESTAMP,
  AGI_OWNER   VARCHAR2(50 CHAR),
  AGI_GIID    NUMBER(10, 0),
  AGI_TERID   NUMBER(10, 0),
  PRIMARY KEY (AGI_ID)
);

CREATE TABLE STM_AVAIL_TSK
(
  ATS_ID      NUMBER(10, 0) NOT NULL,
  ATS_CREATED TIMESTAMP,
  ATS_TASKID  NUMBER(10, 0),
  ATS_TERID   NUMBER(10, 0),
  PRIMARY KEY (ATS_ID)
);

CREATE TABLE STM_BACKGRD
(
  BAC_ID      NUMBER(10, 0) NOT NULL,
  BAC_ACTIVE  NUMBER(1, 0),
  BAC_CREATED TIMESTAMP,
  BAC_DESC    VARCHAR2(250 CHAR),
  BAC_IMAGE   VARCHAR2(4000 CHAR),
  BAC_NAME    VARCHAR2(50 CHAR),
  BAC_GGIID   NUMBER(10, 0),
  PRIMARY KEY (BAC_ID)
);

CREATE TABLE STM_CODELIST
(
  COD_ID          NUMBER(10, 0) NOT NULL,
  COD_LIST        VARCHAR2(50 CHAR),
  COD_DESCRIPTION VARCHAR2(250 CHAR),
  COD_SYSTEM      NUMBER(1, 0),
  COD_DEFAULT     NUMBER(1, 0),
  COD_VALUE       VARCHAR2(50 CHAR),
  PRIMARY KEY (COD_ID)
);

CREATE TABLE STM_COMMENT
(
  COM_ID      NUMBER(10, 0) NOT NULL,
  COM_COORD_X DOUBLE PRECISION,
  COM_COORD_Y DOUBLE PRECISION,
  COM_CREATED TIMESTAMP,
  COM_DESC    VARCHAR2(1000 CHAR),
  COM_EMAIL   VARCHAR2(250 CHAR),
  COM_NAME    VARCHAR2(250 CHAR),
  COM_TITLE   VARCHAR2(500 CHAR),
  COM_APPID   NUMBER(10, 0) NOT NULL,
  COM_USERID  NUMBER(10, 0) NOT NULL,
  PRIMARY KEY (COM_ID)
);

CREATE TABLE STM_CONF
(
  CNF_ID    NUMBER(10, 0) NOT NULL,
  CNF_NAME  VARCHAR2(50 CHAR),
  CNF_VALUE VARCHAR2(250 CHAR),
  PRIMARY KEY (CNF_ID)
);

CREATE TABLE STM_CONNECT
(
  CON_ID         NUMBER(10, 0) NOT NULL,
  CON_DRIVER     VARCHAR2(50 CHAR),
  CON_NAME       VARCHAR2(50 CHAR),
  CON_PWD        VARCHAR2(50 CHAR),
  CON_CONNECTION VARCHAR2(250 CHAR),
  CON_USER       VARCHAR2(50 CHAR),
  PRIMARY KEY (CON_ID)
);

CREATE TABLE STM_FIL_GI
(
  FGI_ID        NUMBER(10, 0) NOT NULL,
  FGI_COLUMN    VARCHAR2(50 CHAR),
  FGI_NAME      VARCHAR2(50 CHAR),
  FGI_REQUIRED  NUMBER(1, 0),
  FGI_TYPE      VARCHAR2(50 CHAR),
  FGI_VALUETYPE VARCHAR2(50 CHAR),
  FGI_VALUE     VARCHAR2(4000 CHAR),
  FGI_GIID      NUMBER(10, 0),
  FGI_TYPID     NUMBER(10, 0),
  PRIMARY KEY (FGI_ID)
);

CREATE TABLE STM_GEOINFO
(
  GEO_ID         NUMBER(10, 0)          NOT NULL,
  GEO_FILTER_GFI NUMBER(1, 0),
  GEO_FILTER_GM  NUMBER(1, 0),
  GEO_FILTER_SS  NUMBER(1, 0),
  GEO_BLOCKED    NUMBER(1, 0),
  GEO_CREATED    TIMESTAMP,
  GEO_DATAURL    VARCHAR2(4000 CHAR),
  GEO_ABSTRACT   VARCHAR2(4000 CHAR),
  GEO_GEOMTYPE   VARCHAR2(50 CHAR),
  GEO_LAYERS     VARCHAR2(800 CHAR),
  GEO_LEGENDTIP  VARCHAR2(50 CHAR),
  GEO_LEGENDURL  VARCHAR2(4000 CHAR),
  GEO_MAXSCALE   NUMBER(10, 0),
  GEO_METAURL    VARCHAR2(4000 CHAR),
  GEO_MINSCALE   NUMBER(10, 0),
  GEO_NAME       VARCHAR2(100 CHAR),
  GEO_ORDER      NUMBER(10, 0),
  GEO_QUERYABL   NUMBER(1, 0),
  GEO_QUERYACT   NUMBER(1, 0),
  GEO_QUERYLAY   VARCHAR2(500 CHAR),
  GEO_SELECTABL  NUMBER(1, 0),
  GEO_SELECTLAY  VARCHAR2(500 CHAR),
  GEO_SOURCE     VARCHAR2(50 CHAR),
  GEO_THEMATIC   NUMBER(1, 0),
  GEO_TRANSP     NUMBER(10, 0),
  GEO_TYPE       VARCHAR2(50 CHAR),
  GEO_STYID      NUMBER(10, 0),
  GEO_STYUSEALL  NUMBER(1, 0) DEFAULT 0 NOT NULL,
  GEO_SERID      NUMBER(10, 0),
  GEO_CONNID     NUMBER(10, 0),
  GEO_SERSELID   NUMBER(10, 0),
  PRIMARY KEY (GEO_ID)
);

CREATE TABLE STM_GGI_GI
(
  GGG_GGIID NUMBER(10, 0) NOT NULL,
  GGG_GIID  NUMBER(10, 0) NOT NULL,
  PRIMARY KEY (GGG_GIID, GGG_GGIID)
);

CREATE TABLE STM_GRP_GI
(
  GGI_ID   NUMBER(10, 0) NOT NULL,
  GGI_NAME VARCHAR2(50 CHAR),
  GGI_TYPE VARCHAR2(50 CHAR),
  PRIMARY KEY (GGI_ID)
);

CREATE TABLE STM_GRP_TER
(
  GTE_TERID  NUMBER(10, 0) NOT NULL,
  GTE_TERMID NUMBER(10, 0) NOT NULL,
  PRIMARY KEY (GTE_TERMID, GTE_TERID)
);

CREATE TABLE STM_GRP_TSK
(
  GTS_ID   NUMBER(10, 0) NOT NULL,
  GTS_NAME VARCHAR2(50 CHAR),
  PRIMARY KEY (GTS_ID)
);

CREATE TABLE STM_GTER_TYP
(
  GTT_ID   NUMBER(10, 0) NOT NULL,
  GTT_NAME VARCHAR2(250 CHAR),
  PRIMARY KEY (GTT_ID)
);

CREATE TABLE STM_LANGUAGE
(
  LAN_ID        NUMBER(10, 0) NOT NULL,
  LAN_NAME      VARCHAR2(50 CHAR),
  LAN_SHORTNAME VARCHAR2(20 CHAR),
  PRIMARY KEY (LAN_ID)
);

CREATE TABLE STM_LOG
(
  LOG_ID     NUMBER(10, 0) NOT NULL,
  LOG_BUFFER NUMBER(1, 0),
  LOG_COUNT  NUMBER(10, 0),
  LOG_DATA   VARCHAR2(250 CHAR),
  LOG_DATE   TIMESTAMP,
  LOG_EMAIL  VARCHAR2(250 CHAR),
  LOG_FORMAT VARCHAR2(50 CHAR),
  LOG_OTHER  VARCHAR2(4000 CHAR),
  LOG_SRS    VARCHAR2(50 CHAR),
  LOG_TEREXT VARCHAR2(250 CHAR),
  LOG_TER    VARCHAR2(50 CHAR),
  LOG_TYPE   VARCHAR2(50 CHAR),
  LOG_APPID  NUMBER(10, 0),
  LOG_GIID   NUMBER(10, 0),
  LOG_TASKID NUMBER(10, 0),
  LOG_TERID  NUMBER(10, 0),
  LOG_USERID NUMBER(10, 0),
  PRIMARY KEY (LOG_ID)
);

CREATE TABLE STM_PAR_APP
(
  PAP_ID    NUMBER(10, 0) NOT NULL,
  PAP_NAME  VARCHAR2(50 CHAR),
  PAP_TYPE  VARCHAR2(50 CHAR),
  PAP_VALUE VARCHAR2(250 CHAR),
  PAP_APPID NUMBER(10, 0),
  PRIMARY KEY (PAP_ID)
);

CREATE TABLE STM_PAR_GI
(
  PGI_ID     NUMBER(10, 0) NOT NULL,
  PGI_FORMAT VARCHAR2(50 CHAR),
  PGI_NAME   VARCHAR2(50 CHAR),
  PGI_ORDER  NUMBER(10, 0),
  PGI_TYPE   VARCHAR2(50 CHAR),
  PGI_VALUE  VARCHAR2(250 CHAR),
  PGI_GIID   NUMBER(10, 0),
  PRIMARY KEY (PGI_ID)
);

CREATE TABLE STM_PAR_SGI
(
  PSG_ID     NUMBER(10, 0) NOT NULL,
  PSG_FORMAT VARCHAR2(50 CHAR),
  PSG_NAME   VARCHAR2(50 CHAR),
  PSG_ORDER  NUMBER(10, 0),
  PSG_TYPE   VARCHAR2(50 CHAR),
  PSG_VALUE  VARCHAR2(250 CHAR),
  PSG_GIID   NUMBER(10, 0),
  PRIMARY KEY (PSG_ID)
);

CREATE TABLE STM_PAR_SER
(
  PSE_ID    NUMBER(10, 0) NOT NULL,
  PSE_NAME  VARCHAR2(50 CHAR),
  PSE_TYPE  VARCHAR2(50 CHAR),
  PSE_VALUE VARCHAR2(250 CHAR),
  PSE_SERID NUMBER(10, 0),
  PRIMARY KEY (PSE_ID)
);

CREATE TABLE STM_POST
(
  POS_ID         NUMBER(10, 0) NOT NULL,
  POS_CREATED    TIMESTAMP,
  POS_UPDATED    TIMESTAMP,
  POS_EMAIL      VARCHAR2(250 CHAR),
  POS_EXPIRATION TIMESTAMP,
  POS_POST       VARCHAR2(250 CHAR),
  POS_ORG        VARCHAR2(250 CHAR),
  POS_TYPE       VARCHAR2(50 CHAR),
  POS_TERID      NUMBER(10, 0),
  POS_USERID     NUMBER(10, 0),
  PRIMARY KEY (POS_ID)
);

CREATE TABLE STM_ROL_GGI
(
  RGG_ROLEID NUMBER(10, 0) NOT NULL,
  RGG_GGIID  NUMBER(10, 0) NOT NULL,
  PRIMARY KEY (RGG_GGIID, RGG_ROLEID)
);

CREATE TABLE STM_ROL_TSK
(
  RTS_TASKID NUMBER(10, 0) NOT NULL,
  RTS_ROLEID NUMBER(10, 0) NOT NULL,
  PRIMARY KEY (RTS_ROLEID, RTS_TASKID)
);

CREATE TABLE STM_ROLE
(
  ROL_ID   NUMBER(10, 0) NOT NULL,
  ROL_NOTE VARCHAR2(500 CHAR),
  ROL_NAME VARCHAR2(50 CHAR),
  PRIMARY KEY (ROL_ID)
);

CREATE TABLE STM_SEQUENCE
(
  SEQ_NAME  VARCHAR2(255 CHAR) NOT NULL,
  SEQ_COUNT NUMBER(19, 0),
  PRIMARY KEY (SEQ_NAME)
);

CREATE TABLE STM_SERVICE
(
  SER_ID       NUMBER(10, 0)       NOT NULL,
  SER_BLOCKED  NUMBER(1, 0),
  SER_PROXIED  NUMBER(1) DEFAULT 0 NOT NULL,
  SER_CREATED  TIMESTAMP,
  SER_ABSTRACT VARCHAR2(250 CHAR),
  SER_INFOURL  VARCHAR2(4000 CHAR),
  SER_LEGEND   VARCHAR2(4000 CHAR),
  SER_NAME     VARCHAR2(60 CHAR),
  SER_NAT_PROT VARCHAR2(50 CHAR),
  SER_URL      VARCHAR2(4000 CHAR),
  SER_PROJECTS VARCHAR2(1000 CHAR),
  SER_PROTOCOL VARCHAR2(50 CHAR),
  SER_AUTH_MOD VARCHAR2(50 CHAR),
  SER_USER     VARCHAR2(50 CHAR),
  SER_PWD      VARCHAR2(50 CHAR),
  PRIMARY KEY (SER_ID)
);

CREATE TABLE STM_STY_GI
(
  SGI_ID          NUMBER(10, 0)          NOT NULL,
  SGI_ABSTRACT    VARCHAR2(250 CHAR),
  SGI_LURL_FORMAT VARCHAR2(255 CHAR),
  SGI_LURL_HEIGHT NUMBER(10, 0),
  SGI_LURL_URL    VARCHAR2(255 CHAR),
  SGI_LURL_WIDTH  NUMBER(10, 0),
  SGI_NAME        VARCHAR2(50 CHAR),
  SGI_TITLE       VARCHAR2(50 CHAR),
  SGI_GIID        NUMBER(10, 0),
  SGI_DEFAULT     NUMBER(1, 0) DEFAULT 0 NOT NULL,
  PRIMARY KEY (SGI_ID)
);

CREATE TABLE STM_TASK
(
  TAS_ID      NUMBER(10, 0) NOT NULL,
  TAS_NAME    VARCHAR2(512 CHAR),
  TAS_CREATED TIMESTAMP,
  TAS_ORDER   NUMBER(10, 0),
  TAS_GIID    NUMBER(10, 0),
  TAS_SERID   NUMBER(10, 0),
  TAS_GTASKID NUMBER(10, 0),
  TAS_TTASKID NUMBER(10, 0),
  TAS_TUIID   NUMBER(10, 0),
  TAS_CONNID  NUMBER(10, 0),
  TAS_PARAMS  CLOB,
  PRIMARY KEY (TAS_ID)
);

CREATE TABLE STM_TASKREL
(
  TAR_ID        NUMBER(10, 0) NOT NULL,
  TAR_TYPE      VARCHAR2(50 CHAR),
  TAR_TASKID    NUMBER(10, 0),
  TAR_TASKRELID NUMBER(10, 0),
  PRIMARY KEY (TAR_ID)
);

CREATE TABLE STM_TER_TYP
(
  TET_ID       NUMBER(10, 0) NOT NULL,
  TET_NAME     VARCHAR2(50 CHAR),
  TET_OFFICIAL NUMBER(1, 0)  NOT NULL,
  TET_TOP      NUMBER(1, 0)  NOT NULL,
  TET_BOTTOM   NUMBER(1, 0)  NOT NULL,
  PRIMARY KEY (TET_ID)
);

CREATE TABLE STM_TERRITORY
(
  TER_ID      NUMBER(10, 0) NOT NULL,
  TER_BLOCKED NUMBER(1, 0),
  TER_CODTER  VARCHAR2(50 CHAR),
  TER_CREATED TIMESTAMP,
  TER_EXTENT  VARCHAR2(250 CHAR),
  TER_CENTER  VARCHAR2(250 CHAR),
  TER_LEGAL   VARCHAR2(50 CHAR),
  TER_ZOOM    NUMBER(10, 0),
  TER_NAME    VARCHAR2(250 CHAR),
  TER_NOTE    VARCHAR2(250 CHAR),
  TER_SCOPE   VARCHAR2(50 CHAR),
  TER_ADDRESS VARCHAR2(250 CHAR),
  TER_EMAIL   VARCHAR2(50 CHAR),
  TER_LOGO    VARCHAR2(4000 CHAR),
  TER_ADMNAME VARCHAR2(250 CHAR),
  TER_GTYPID  NUMBER(10, 0),
  TER_TYPID   NUMBER(10, 0),
  TER_PROJECT VARCHAR2(250 CHAR),
  PRIMARY KEY (TER_ID)
);

CREATE TABLE STM_TRANSLATION
(
  TRA_ID     NUMBER(10, 0) NOT NULL,
  TRA_COLUMN VARCHAR2(100 CHAR),
  TRA_ELEID  NUMBER(10, 0),
  TRA_NAME   VARCHAR2(250 CHAR),
  TRA_LANID  NUMBER(10, 0),
  PRIMARY KEY (TRA_ID)
);

CREATE TABLE STM_TREE
(
  TRE_ID         NUMBER(10, 0) NOT NULL,
  TRE_NAME       VARCHAR2(50 CHAR),
  TRE_TYPE       VARCHAR2(50 CHAR),
  TRE_ABSTRACT   VARCHAR2(250 CHAR),
  TRE_IMAGE      CLOB,
  TRE_IMAGE_NAME VARCHAR2(250 CHAR),
  TRE_USERID     NUMBER(10, 0),
  PRIMARY KEY (TRE_ID)
);

CREATE TABLE STM_TREE_NOD
(
  TNO_ID         NUMBER(10, 0) NOT NULL,
  TNO_ACTIVE     NUMBER(1, 0),
  TNO_DATAURL    VARCHAR2(4000 CHAR),
  TNO_ABSTRACT   VARCHAR2(250 CHAR),
  TNO_FILTER_GFI NUMBER(1, 0),
  TNO_FILTER_GM  NUMBER(1, 0),
  TNO_FILTER_SE  NUMBER(1, 0),
  TNO_METAURL    VARCHAR2(4000 CHAR),
  TNO_NAME       VARCHAR2(80 CHAR),
  TNO_ORDER      NUMBER(10, 0),
  TNO_QUERYACT   NUMBER(1, 0),
  TNO_RADIO      NUMBER(1, 0),
  TNO_TOOLTIP    VARCHAR2(100 CHAR),
  TNO_GIID       NUMBER(10, 0),
  TNO_PARENTID   NUMBER(10, 0),
  TNO_STYLE      VARCHAR2(50 CHAR),
  TNO_TREEID     NUMBER(10, 0),
  TNO_TYPE       VARCHAR2(50 CHAR),
  TNO_IMAGE      CLOB,
  TNO_IMAGE_NAME VARCHAR2(4000 CHAR),
  TNO_VIEW_MODE  VARCHAR2(50 CHAR),
  TNO_TASKID     INTEGER,
  TNO_LOAD_DATA  NUMBER(1, 0) DEFAULT FALSE,
  TNO_FILTERABLE NUMBER(1, 0) DEFAULT FALSE,
  PRIMARY KEY (TNO_ID)
);

CREATE TABLE STM_TREE_ROL
(
  TRO_TREEID NUMBER(10, 0) NOT NULL,
  TRO_ROLEID NUMBER(10, 0) NOT NULL,
  PRIMARY KEY (TRO_ROLEID, TRO_TREEID)
);

CREATE TABLE STM_TSK_TYP
(
  TTY_ID       NUMBER(10, 0) NOT NULL,
  TTY_ENABLED  NUMBER(1, 0),
  TTY_NAME     VARCHAR2(50 CHAR),
  TTY_ORDER    NUMBER(10, 0),
  TTY_SPEC     CLOB,
  TTY_TITLE    VARCHAR2(50 CHAR),
  TTY_PARENTID NUMBER(10, 0),
  PRIMARY KEY (TTY_ID)
);

CREATE TABLE STM_TSK_UI
(
  TUI_ID      NUMBER(10, 0) NOT NULL,
  TUI_NAME    VARCHAR2(50 CHAR),
  TUI_ORDER   NUMBER(10, 0),
  TUI_TOOLTIP VARCHAR2(100 CHAR),
  TUI_TYPE    VARCHAR2(30),
  PRIMARY KEY (TUI_ID)
);

CREATE TABLE STM_USER
(
  USE_ID        NUMBER(10, 0) NOT NULL,
  USE_ADM       NUMBER(1, 0),
  USE_BLOCKED   NUMBER(1, 0),
  USE_CREATED   TIMESTAMP,
  USE_UPDATED   TIMESTAMP,
  USE_NAME      VARCHAR2(30 CHAR),
  USE_IDENT     VARCHAR2(50 CHAR),
  USE_IDENTTYPE VARCHAR2(50 CHAR),
  USE_SURNAME   VARCHAR2(40 CHAR),
  USE_PWD       VARCHAR2(128 CHAR),
  USE_USER      VARCHAR2(50 CHAR),
  PRIMARY KEY (USE_ID)
);

CREATE TABLE STM_USR_CONF
(
  UCO_ID      NUMBER(10, 0) NOT NULL,
  UCO_ROLEM   NUMBER(1, 0),
  UCO_CREATED TIMESTAMP,
  UCO_ROLEID  NUMBER(10, 0),
  UCO_TERID   NUMBER(10, 0),
  UCO_USERID  NUMBER(10, 0),
  PRIMARY KEY (UCO_ID)
);

ALTER TABLE STM_APP_BCKG
  ADD CONSTRAINT STM_APF_UK UNIQUE (ABC_APPID, ABC_BACKID);

ALTER TABLE STM_APP_TER
  ADD CONSTRAINT STM_APT_UK UNIQUE (ATE_APPID, ATE_TERID);

ALTER TABLE STM_AVAIL_GI
  ADD CONSTRAINT STM_DCA_UK UNIQUE (AGI_TERID, AGI_GIID);

ALTER TABLE STM_AVAIL_TSK
  ADD CONSTRAINT STM_DTA_UK UNIQUE (ATS_TERID, ATS_TASKID);

ALTER TABLE STM_CODELIST
  ADD CONSTRAINT UKH4JN7SFGMUDOC896BLVFQBV3B UNIQUE (COD_LIST, COD_VALUE);

ALTER TABLE STM_CONF
  ADD CONSTRAINT STM_CONF_NAME_UK UNIQUE (CNF_NAME);

ALTER TABLE STM_GTER_TYP
  ADD CONSTRAINT STM_GTT_NOM_UK UNIQUE (GTT_NAME);

ALTER TABLE STM_LANGUAGE
  ADD CONSTRAINT UKPIA9A18THHKA1NCR9CNYJL0J8 UNIQUE (LAN_SHORTNAME);

ALTER TABLE STM_POST
  ADD CONSTRAINT UKT67T88DOKIXQN9VEHTT1AEJ1X UNIQUE (POS_USERID, POS_TERID);

ALTER TABLE STM_ROLE
  ADD CONSTRAINT STM_ROL_NOM_UK UNIQUE (ROL_NAME);

ALTER TABLE STM_TER_TYP
  ADD CONSTRAINT STM_TET_NOM_UK UNIQUE (TET_NAME);

ALTER TABLE STM_TERRITORY
  ADD CONSTRAINT STM_TER_NOM_UK UNIQUE (TER_NAME);

ALTER TABLE STM_TRANSLATION
  ADD CONSTRAINT STM_TRA_UK UNIQUE (TRA_ELEID, TRA_COLUMN, TRA_LANID);

ALTER TABLE STM_USER
  ADD CONSTRAINT STM_USU_USU_UK UNIQUE (USE_USER);

ALTER TABLE STM_USR_CONF
  ADD CONSTRAINT STM_UCF_UK UNIQUE (UCO_USERID, UCO_TERID, UCO_ROLEID, UCO_ROLEM);

ALTER TABLE STM_APP
  ADD CONSTRAINT STM_APP_FK_GGI FOREIGN KEY (APP_GGIID) REFERENCES STM_GRP_GI;

ALTER TABLE STM_APP_BCKG
  ADD CONSTRAINT STM_ABC_FK_APP FOREIGN KEY (ABC_APPID) REFERENCES STM_APP ON DELETE CASCADE;

ALTER TABLE STM_APP_BCKG
  ADD CONSTRAINT STM_ABC_FK_FON FOREIGN KEY (ABC_BACKID) REFERENCES STM_BACKGRD ON DELETE CASCADE;

ALTER TABLE STM_APP_TER
  ADD CONSTRAINT STM_ATE_FK_APP FOREIGN KEY (ATE_APPID) REFERENCES STM_APP ON DELETE CASCADE;

ALTER TABLE STM_APP_TER
  ADD CONSTRAINT STM_ATE_FK_FON FOREIGN KEY (ATE_TERID) REFERENCES STM_TERRITORY ON DELETE CASCADE;

ALTER TABLE STM_APP_ROL
  ADD CONSTRAINT STM_ARO_FK_APP FOREIGN KEY (ARO_APPID) REFERENCES STM_APP;

ALTER TABLE STM_APP_ROL
  ADD CONSTRAINT STM_ARO_FK_ROL FOREIGN KEY (ARO_ROLEID) REFERENCES STM_ROLE;

ALTER TABLE STM_APP_TREE
  ADD CONSTRAINT STM_ATR_FK_APP FOREIGN KEY (ATR_APPID) REFERENCES STM_APP;

ALTER TABLE STM_APP_TREE
  ADD CONSTRAINT STM_ATR_FK_TRE FOREIGN KEY (ATR_TREEID) REFERENCES STM_TREE;

ALTER TABLE STM_AVAIL_GI
  ADD CONSTRAINT STM_AGI_FK_GEO FOREIGN KEY (AGI_GIID) REFERENCES STM_GEOINFO ON DELETE CASCADE;

ALTER TABLE STM_AVAIL_GI
  ADD CONSTRAINT STM_AGI_FK_TER FOREIGN KEY (AGI_TERID) REFERENCES STM_TERRITORY ON DELETE CASCADE;

ALTER TABLE STM_AVAIL_TSK
  ADD CONSTRAINT STM_ATS_FK_TAS FOREIGN KEY (ATS_TASKID) REFERENCES STM_TASK ON DELETE CASCADE;

ALTER TABLE STM_AVAIL_TSK
  ADD CONSTRAINT STM_ATS_FK_TER FOREIGN KEY (ATS_TERID) REFERENCES STM_TERRITORY ON DELETE CASCADE;

ALTER TABLE STM_BACKGRD
  ADD CONSTRAINT STM_BAC_FK_GGI FOREIGN KEY (BAC_GGIID) REFERENCES STM_GRP_GI;

ALTER TABLE STM_COMMENT
  ADD CONSTRAINT STM_COM_FK_APP FOREIGN KEY (COM_APPID) REFERENCES STM_APP ON DELETE CASCADE;

ALTER TABLE STM_COMMENT
  ADD CONSTRAINT STM_COM_FK_USE FOREIGN KEY (COM_USERID) REFERENCES STM_USER ON DELETE CASCADE;

ALTER TABLE STM_FIL_GI
  ADD CONSTRAINT STM_FGI_FK_GEO FOREIGN KEY (FGI_GIID) REFERENCES STM_GEOINFO ON DELETE CASCADE;

ALTER TABLE STM_FIL_GI
  ADD CONSTRAINT STM_FGI_FK_TET FOREIGN KEY (FGI_TYPID) REFERENCES STM_TER_TYP;

ALTER TABLE STM_GEOINFO
  ADD CONSTRAINT STM_GEO_FK_SGI FOREIGN KEY (GEO_STYID) REFERENCES STM_STY_GI;

ALTER TABLE STM_GEOINFO
  ADD CONSTRAINT STM_GEO_FK_SER FOREIGN KEY (GEO_SERID) REFERENCES STM_SERVICE;

ALTER TABLE STM_GEOINFO
  ADD CONSTRAINT STM_GEO_FK_CON FOREIGN KEY (GEO_CONNID) REFERENCES STM_CONNECT;

ALTER TABLE STM_GEOINFO
  ADD CONSTRAINT STM_GEO_FK_SERSEL FOREIGN KEY (GEO_SERSELID) REFERENCES STM_SERVICE;

ALTER TABLE STM_GGI_GI
  ADD CONSTRAINT STM_GGG_FK_GEO FOREIGN KEY (GGG_GIID) REFERENCES STM_GEOINFO;

ALTER TABLE STM_GGI_GI
  ADD CONSTRAINT STM_GGG_FK_GGI FOREIGN KEY (GGG_GGIID) REFERENCES STM_GRP_GI;

ALTER TABLE STM_GRP_TER
  ADD CONSTRAINT STM_GTE_FK_TERM FOREIGN KEY (GTE_TERMID) REFERENCES STM_TERRITORY;

ALTER TABLE STM_GRP_TER
  ADD CONSTRAINT STM_GTE_FK_TER FOREIGN KEY (GTE_TERID) REFERENCES STM_TERRITORY;

ALTER TABLE STM_LOG
  ADD CONSTRAINT FKKEVXKUE4E8UA7NQISDF9QTT9U FOREIGN KEY (LOG_APPID) REFERENCES STM_APP;

ALTER TABLE STM_LOG
  ADD CONSTRAINT FKD40R7BQKXMOSOKQR544ELCYRT FOREIGN KEY (LOG_GIID) REFERENCES STM_GEOINFO;

ALTER TABLE STM_LOG
  ADD CONSTRAINT FKCW6U4JP3WVNKH7YPDL81UYFWC FOREIGN KEY (LOG_TASKID) REFERENCES STM_TASK;

ALTER TABLE STM_LOG
  ADD CONSTRAINT FKM77T0WVSOV0PQY99PFBYEDIP7 FOREIGN KEY (LOG_TERID) REFERENCES STM_TERRITORY;

ALTER TABLE STM_LOG
  ADD CONSTRAINT FK2P47BCWKDBN91H2OXUF5CSIR8 FOREIGN KEY (LOG_USERID) REFERENCES STM_USER;

ALTER TABLE STM_PAR_APP
  ADD CONSTRAINT STM_PAP_FK_APP FOREIGN KEY (PAP_APPID) REFERENCES STM_APP ON DELETE CASCADE;

ALTER TABLE STM_PAR_GI
  ADD CONSTRAINT STM_PGI_FK_GEO FOREIGN KEY (PGI_GIID) REFERENCES STM_GEOINFO ON DELETE CASCADE;

ALTER TABLE STM_PAR_SGI
  ADD CONSTRAINT STM_PSG_FK_GEO FOREIGN KEY (PSG_GIID) REFERENCES STM_GEOINFO ON DELETE CASCADE;

ALTER TABLE STM_PAR_SER
  ADD CONSTRAINT STM_PSE_FK_SER FOREIGN KEY (PSE_SERID) REFERENCES STM_SERVICE ON DELETE CASCADE;

ALTER TABLE STM_POST
  ADD CONSTRAINT STM_POS_FK_TER FOREIGN KEY (POS_TERID) REFERENCES STM_TERRITORY ON DELETE CASCADE;

ALTER TABLE STM_POST
  ADD CONSTRAINT STM_POS_FK_USE FOREIGN KEY (POS_USERID) REFERENCES STM_USER ON DELETE CASCADE;

ALTER TABLE STM_ROL_GGI
  ADD CONSTRAINT STM_RGG_FK_GGI FOREIGN KEY (RGG_GGIID) REFERENCES STM_GRP_GI;

ALTER TABLE STM_ROL_GGI
  ADD CONSTRAINT STM_RGG_FK_ROL FOREIGN KEY (RGG_ROLEID) REFERENCES STM_ROLE;

ALTER TABLE STM_ROL_TSK
  ADD CONSTRAINT STM_RTS_FK_ROL FOREIGN KEY (RTS_ROLEID) REFERENCES STM_ROLE;

ALTER TABLE STM_ROL_TSK
  ADD CONSTRAINT STM_RTS_FK_TAS FOREIGN KEY (RTS_TASKID) REFERENCES STM_TASK;

ALTER TABLE STM_STY_GI
  ADD CONSTRAINT STM_SGI_FK_GEO FOREIGN KEY (SGI_GIID) REFERENCES STM_GEOINFO;

ALTER TABLE STM_TASK
  ADD CONSTRAINT STM_TAS_FK_GEO FOREIGN KEY (TAS_GIID) REFERENCES STM_GEOINFO;

ALTER TABLE STM_TASK
  ADD CONSTRAINT STM_TAS_FK_SER FOREIGN KEY (TAS_SERID) REFERENCES STM_SERVICE;

ALTER TABLE STM_TASK
  ADD CONSTRAINT STM_TAS_FK_GTS FOREIGN KEY (TAS_GTASKID) REFERENCES STM_GRP_TSK;

ALTER TABLE STM_TASK
  ADD CONSTRAINT STM_TAS_FK_TTY FOREIGN KEY (TAS_TTASKID) REFERENCES STM_TSK_TYP;

ALTER TABLE STM_TASK
  ADD CONSTRAINT STM_TAS_FK_TUI FOREIGN KEY (TAS_TUIID) REFERENCES STM_TSK_UI;

ALTER TABLE STM_TASK
  ADD CONSTRAINT STM_TAS_FK_CON FOREIGN KEY (TAS_CONNID) REFERENCES STM_CONNECT;

ALTER TABLE STM_TASKREL
  ADD CONSTRAINT STM_TAR_FK_TAS FOREIGN KEY (TAR_TASKID) REFERENCES STM_TASK (TAS_ID) ON DELETE CASCADE;

ALTER TABLE STM_TASKREL
  ADD CONSTRAINT STM_TAR_FK_TAS_REL FOREIGN KEY (TAR_TASKRELID) REFERENCES STM_TASK (TAS_ID);

ALTER TABLE STM_TERRITORY
  ADD CONSTRAINT STM_TER_FK_TET FOREIGN KEY (TER_GTYPID) REFERENCES STM_GTER_TYP;

ALTER TABLE STM_TERRITORY
  ADD CONSTRAINT STM_TER_FK_TGR FOREIGN KEY (TER_TYPID) REFERENCES STM_TER_TYP;

ALTER TABLE STM_TRANSLATION
  ADD CONSTRAINT STM_TRA_FK_LAN FOREIGN KEY (TRA_LANID) REFERENCES STM_LANGUAGE;

ALTER TABLE STM_TREE
  ADD CONSTRAINT STM_TRE_FK_USE FOREIGN KEY (TRE_USERID) REFERENCES STM_USER;

ALTER TABLE STM_TREE_NOD
  ADD CONSTRAINT STM_TNO_FK_GEO FOREIGN KEY (TNO_GIID) REFERENCES STM_GEOINFO;

ALTER TABLE STM_TREE_NOD
  ADD CONSTRAINT STM_TNO_FK_TAS FOREIGN KEY (TNO_TASKID) REFERENCES STM_TASK;

ALTER TABLE STM_TREE_NOD
  ADD CONSTRAINT STM_TNO_FK_TNO FOREIGN KEY (TNO_PARENTID) REFERENCES STM_TREE_NOD;

ALTER TABLE STM_TREE_NOD
  ADD CONSTRAINT STM_TNO_FK_TRE FOREIGN KEY (TNO_TREEID) REFERENCES STM_TREE ON DELETE CASCADE;

ALTER TABLE STM_TREE_ROL
  ADD CONSTRAINT STM_TRO_FK_ROL FOREIGN KEY (TRO_ROLEID) REFERENCES STM_ROLE;

ALTER TABLE STM_TREE_ROL
  ADD CONSTRAINT STM_TRO_FK_TRE FOREIGN KEY (TRO_TREEID) REFERENCES STM_TREE;

ALTER TABLE STM_TSK_TYP
  ADD CONSTRAINT STM_TSK_TYP_TTY FOREIGN KEY (TTY_PARENTID) REFERENCES STM_TSK_TYP ON DELETE CASCADE;

ALTER TABLE STM_USR_CONF
  ADD CONSTRAINT STM_UCF_FK_ROL FOREIGN KEY (UCO_ROLEID) REFERENCES STM_ROLE ON DELETE CASCADE;

ALTER TABLE STM_USR_CONF
  ADD CONSTRAINT STM_UCF_FK_TER FOREIGN KEY (UCO_TERID) REFERENCES STM_TERRITORY ON DELETE CASCADE;

ALTER TABLE STM_USR_CONF
  ADD CONSTRAINT STM_UCF_FK_USU FOREIGN KEY (UCO_USERID) REFERENCES STM_USER ON DELETE CASCADE;
