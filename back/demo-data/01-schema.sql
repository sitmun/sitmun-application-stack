-- Database schema definition
CREATE SCHEMA IF NOT EXISTS dbo;
CREATE SCHEMA IF NOT EXISTS silme;

-- Create tables
CREATE TABLE dbo.pa007his_unesco (
	gid int4 NOT NULL,
	idbic int8 NULL,
	nom text NULL,
	dstipus text NULL,
	dsmun text NULL,
	url text NULL,
	nom_cast text NULL,
	nom_angl text NULL,
	descrip text NULL,
	descrip_cast text NULL,
	descrip_angl text NULL,
	imprescindible text NULL,
	horari text NULL,
	horari_cast text NULL,
	horari_angl text NULL,
	preu text NULL,
	preu_cast text NULL,
	preu_angl text NULL,
	visitable text NULL,
	visitable_cast text NULL,
	visitable_angl text NULL,
	acces text NULL,
	acces_cast text NULL,
	acces_angl text NULL,
	aparcament text NULL,
	aparcament_cast text NULL,
	aparcament_angl text NULL,
	visites_guiades text NULL,
	visites_guiades_cast text NULL,
	visites_guiades_angl text NULL,
	contacte text NULL,
	contacte_cast text NULL,
	contacte_angl text NULL,
	serveis text NULL,
	serveis_cast text NULL,
	serveis_angl text NULL,
	acces_mobred text NULL,
	acces_mobred_cast text NULL,
	acces_mobred_angl text NULL,
	etrs89x text NULL,
	etrs89y text NULL
);
-- Add primary key to pa007his_unesco
ALTER TABLE dbo.pa007his_unesco ADD CONSTRAINT pa007his_unesco_pk PRIMARY KEY (gid);
-- Add index for idbic as it's likely used for lookups
CREATE INDEX idx_pa007his_unesco_idbic ON dbo.pa007his_unesco(idbic);
-- Add spatial index for coordinates if used for geo queries
CREATE INDEX idx_pa007his_unesco_coords ON dbo.pa007his_unesco(etrs89x, etrs89y);

CREATE TABLE dbo.pa007his_unesco_img (
	identif int8 NOT NULL,
	desc1 varchar(70) NULL,
	desc2 varchar(70) NULL,
	desc3 varchar(70) NULL,
	desc4 varchar(70) NULL,
	img varchar(200) NULL,
	orden int8 NULL,
	idpublicacio int8 NULL,
	desc5 varchar(70) NULL,
	desc6 varchar(70) NULL,
	idcomercio int8 NULL,
	destacada bit(1) NULL
);
-- Add primary key to pa007his_unesco_img
ALTER TABLE dbo.pa007his_unesco_img ADD CONSTRAINT pa007his_unesco_img_pk PRIMARY KEY (identif);
-- Add index for foreign keys and commonly queried fields
CREATE INDEX idx_pa007his_unesco_img_idpublicacio ON dbo.pa007his_unesco_img(idpublicacio);
CREATE INDEX idx_pa007his_unesco_img_idcomercio ON dbo.pa007his_unesco_img(idcomercio);
CREATE INDEX idx_pa007his_unesco_img_orden ON dbo.pa007his_unesco_img(orden);

CREATE TABLE silme.webloc (
	id int4 NOT NULL,
	idtipo int4 NULL,
	descrip1 text NULL,
	descrip2 text NULL,
	descrip3 text NULL,
	descrip4 text NULL,
	lat float8 NULL,
	lon float8 NULL,
	link varchar(100) NULL,
	zoom float4 NULL,
	destino varchar(100) NULL,
	nopintar varchar(10) NULL,
	descrip5 text NULL,
	descrip6 text NULL,
	CONSTRAINT webloc_pk PRIMARY KEY (id)
);
-- Add indexes for webloc
CREATE INDEX idx_webloc_idtipo ON silme.webloc(idtipo);
CREATE INDEX idx_webloc_link ON silme.webloc(link);
-- Add spatial index for coordinates
CREATE INDEX idx_webloc_coords ON silme.webloc(lat, lon);

CREATE TABLE silme.webpublicacions (
	id int4 NOT NULL,
	titulo1 varchar(100) NULL,
	titulo2 varchar(100) NULL,
	titulo3 varchar(100) NULL,
	titulo4 varchar(100) NULL,
	html1 text NULL,
	html2 text NULL,
	html3 text NULL,
	html4 text NULL,
	tipo varchar(50) NULL,
	desde timestamp NULL,
	hasta timestamp NULL,
	nocad bool NULL,
	idplantilla int4 NULL,
	texte1 text NULL,
	texte2 text NULL,
	texte3 text NULL,
	texte4 text NULL,
	resumen1 text NULL,
	resumen2 text NULL,
	resumen3 text NULL,
	resumen4 varchar NULL,
	falta timestamp NULL,
	fmod timestamp NULL,
	titulo5 varchar(100) NULL,
	titulo6 varchar(100) NULL,
	html5 text NULL,
	html6 text NULL,
	texte5 text NULL,
	texte6 text NULL,
	resumen5 text NULL,
	resumen6 text NULL,
	CONSTRAINT webpublicacions_pk PRIMARY KEY (id)
);
-- Add indexes for webpublicacions for common query patterns
CREATE INDEX idx_webpublicacions_tipo ON silme.webpublicacions(tipo);
CREATE INDEX idx_webpublicacions_idplantilla ON silme.webpublicacions(idplantilla);
CREATE INDEX idx_webpublicacions_dates ON silme.webpublicacions(desde, hasta);
CREATE INDEX idx_webpublicacions_fmod ON silme.webpublicacions(fmod);

CREATE TABLE silme.webpubvalors (
	id int4 NOT NULL,
	idpublicacio int4 NULL,
	nparam int4 NULL,
	valort1 text NULL,
	valorf1 text NULL,
	valort2 text NULL,
	valorf2 text NULL,
	valort3 text NULL,
	valorf3 text NULL,
	valort4 text NULL,
	valorf4 text NULL,
	valort5 text NULL,
	valorf5 text NULL,
	valort6 text NULL,
	valorf6 text NULL,
	CONSTRAINT webpubvalors_pk PRIMARY KEY (id)
);
-- Add indexes for webpubvalors
CREATE INDEX idx_webpubvalors_idpublicacio ON silme.webpubvalors(idpublicacio);
CREATE INDEX idx_webpubvalors_nparam ON silme.webpubvalors(nparam);
-- Combined index for common query pattern seen in the materialized view
CREATE INDEX idx_webpubvalors_pub_param ON silme.webpubvalors(idpublicacio, nparam);

-- GESMATERIAS table for categorizing content
CREATE TABLE dbo.GESMATERIAS (
    ID int4 NOT NULL,
    NOMBRE1 varchar(255) NULL,
    NOMBRE2 varchar(255) NULL,
    NOMBRE3 varchar(255) NULL,
    NOMBRE4 varchar(255) NULL,
    DESCRIP1 varchar(500) NULL,
    DESCRIP2 varchar(500) NULL,
    DESCRIP3 varchar(500) NULL,
    DESCRIP4 varchar(500) NULL,
    TIPO varchar(10) NULL,
    ORDEN int4 NULL,
    CODESTANDARD varchar(10) NULL,
    NOMBRE5 varchar(255) NULL,
    NOMBRE6 varchar(255) NULL,
    DESCRIP5 varchar(500) NULL,
    DESCRIP6 varchar(500) NULL,
    CONSTRAINT gesmaterias_pk PRIMARY KEY (ID)
);
-- Add indexes for GESMATERIAS
CREATE INDEX idx_gesmaterias_tipo ON dbo.GESMATERIAS(TIPO);
CREATE INDEX idx_gesmaterias_codestandard ON dbo.GESMATERIAS(CODESTANDARD);
CREATE INDEX idx_gesmaterias_orden ON dbo.GESMATERIAS(ORDEN);

-- Add comments for GESMATERIAS table and columns
COMMENT ON TABLE dbo.GESMATERIAS IS 'Categories and materials for classifying content';
COMMENT ON COLUMN dbo.GESMATERIAS.ID IS 'Primary key identifier';
COMMENT ON COLUMN dbo.GESMATERIAS.NOMBRE1 IS 'Catalan name';
COMMENT ON COLUMN dbo.GESMATERIAS.NOMBRE2 IS 'Spanish name';
COMMENT ON COLUMN dbo.GESMATERIAS.NOMBRE3 IS 'English name';
COMMENT ON COLUMN dbo.GESMATERIAS.NOMBRE4 IS 'Fourth language name';
COMMENT ON COLUMN dbo.GESMATERIAS.DESCRIP1 IS 'Catalan description';
COMMENT ON COLUMN dbo.GESMATERIAS.DESCRIP2 IS 'Spanish description';
COMMENT ON COLUMN dbo.GESMATERIAS.DESCRIP3 IS 'English description';
COMMENT ON COLUMN dbo.GESMATERIAS.DESCRIP4 IS 'Fourth language description';
COMMENT ON COLUMN dbo.GESMATERIAS.TIPO IS 'Category type (1=Theme, 2=Format, 3=Space, 4=Location)';
COMMENT ON COLUMN dbo.GESMATERIAS.ORDEN IS 'Sort order';
COMMENT ON COLUMN dbo.GESMATERIAS.CODESTANDARD IS 'Standardized code';
COMMENT ON COLUMN dbo.GESMATERIAS.NOMBRE5 IS 'Fifth language name';
COMMENT ON COLUMN dbo.GESMATERIAS.NOMBRE6 IS 'Sixth language name';
COMMENT ON COLUMN dbo.GESMATERIAS.DESCRIP5 IS 'Fifth language description';
COMMENT ON COLUMN dbo.GESMATERIAS.DESCRIP6 IS 'Sixth language description';

-- WEBRELPUBMAT table for relating publications to categories/materials
CREATE TABLE dbo.WEBRELPUBMAT (
    ID int4 NOT NULL,
    IDPUBLICACIO int4 NULL,
    NPUBLICACIO varchar(255) NULL,
    IDMATERIA int4 NULL,
    NMATERIA varchar(255) NULL,
    CONSTRAINT webrelpubmat_pk PRIMARY KEY (ID)
);
-- Add indexes for WEBRELPUBMAT
CREATE INDEX idx_webrelpubmat_idpublicacio ON dbo.WEBRELPUBMAT(IDPUBLICACIO);
CREATE INDEX idx_webrelpubmat_idmateria ON dbo.WEBRELPUBMAT(IDMATERIA);
CREATE INDEX idx_webrelpubmat_pub_mat ON dbo.WEBRELPUBMAT(IDPUBLICACIO, IDMATERIA);

-- Add comments for WEBRELPUBMAT table and columns
COMMENT ON TABLE dbo.WEBRELPUBMAT IS 'Relationship table connecting publications with materials/categories';
COMMENT ON COLUMN dbo.WEBRELPUBMAT.ID IS 'Primary key identifier';
COMMENT ON COLUMN dbo.WEBRELPUBMAT.IDPUBLICACIO IS 'Publication ID from webpublicacions';
COMMENT ON COLUMN dbo.WEBRELPUBMAT.NPUBLICACIO IS 'Publication name for convenience';
COMMENT ON COLUMN dbo.WEBRELPUBMAT.IDMATERIA IS 'Material/category ID from GESMATERIAS';
COMMENT ON COLUMN dbo.WEBRELPUBMAT.NMATERIA IS 'Material/category name for convenience';

CREATE MATERIALIZED VIEW silme.agenda_cultural_mat
TABLESPACE pg_default
AS SELECT w.id,
    'http://agenda.menorca.es/Contingut.aspx?IdPub='::text || w.id AS agenda_cultural,
    ( SELECT webpubvalors.valort1
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 1) AS titol,
    ( SELECT webpubvalors.valort1
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 2) AS tipus,
    ( SELECT webpubvalors.valort1
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 3) AS descripcio,
    ( SELECT 'https://agenda.menorca.es/documents/documents/'::text || replace(replace(webpubvalors.valort1::character varying(1000)::text, '\'::text, '/'::text), '//10.15.1.37/Web/AgendaMenorca/Documents/'::text, ''::text)
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 4) AS imatge_ruta,
    ( SELECT webpubvalors.valort1
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 4) AS imatge_ruta_local,
    ( SELECT webpubvalors.valort1
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = ((( SELECT webpubvalors_1.valort1
                   FROM silme.webpubvalors webpubvalors_1
                  WHERE webpubvalors_1.idpublicacio = w.id AND webpubvalors_1.nparam = 5)))::character varying(10)::integer AND webpubvalors.nparam = 1) AS localitzacio,
    ( SELECT webpubvalors.valort1
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 6) AS quan,
    w.desde AS des_de,
    w.hasta AS fins_a,
    ( SELECT webpubvalors.valort1
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 7) AS telefon,
    ( SELECT webpubvalors.valort1
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 8) AS pagina_web,
    ( SELECT webpubvalors.valort1
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 9) AS pagina_web_entrades,
    ( SELECT webpubvalors.valort1
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 10) AS info_organitzador,
    ( SELECT webpubvalors.valort1
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 11) AS observacions,
    ( SELECT webpubvalors.valort1
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 12) AS destacat_portada,
    ( SELECT webpubvalors.valort1
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 13) AS ordre,
    ( SELECT webpubvalors.valort1
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 14) AS format_imatge,
    wl.lon AS etrs89x,
    wl.lat AS etrs89y
   FROM silme.webpublicacions w
     JOIN silme.webloc wl ON "substring"(wl.link::text, length('/Contingut.aspx?IdPub='::text) + 1, length(wl.link::text))::integer = (( SELECT webpubvalors.idpublicacio
           FROM silme.webpubvalors
          WHERE webpubvalors.idpublicacio = w.id AND webpubvalors.nparam = 5))
  WHERE w.tipo::text = '01'::text AND w.idplantilla = 60
  ORDER BY w.desde DESC
WITH DATA;

-- Add index on materialized view for faster queries
CREATE INDEX idx_agenda_cultural_mat_id ON silme.agenda_cultural_mat(id);
CREATE INDEX idx_agenda_cultural_mat_dates ON silme.agenda_cultural_mat(des_de, fins_a);

-- Add unique index to enable REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_agenda_cultural_mat_unique ON silme.agenda_cultural_mat(id);

-- Materialized view for publications with location categories
CREATE MATERIALIZED VIEW dbo.publications_by_location
TABLESPACE pg_default
AS SELECT DISTINCT
    w.IDPUBLICACIO, 
    g.ID AS location_id  -- Added to ensure uniqueness
    g.NOMBRE1 AS location_name,
FROM 
    dbo.WEBRELPUBMAT w
    INNER JOIN dbo.GESMATERIAS g ON g.ID = w.IDMATERIA 
WHERE 
    g.TIPO = '4'
WITH DATA;

-- Add indexes for faster queries
CREATE INDEX idx_publications_by_location_idpub ON dbo.publications_by_location(IDPUBLICACIO);

-- Add unique index to enable REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_publications_by_location_unique ON dbo.publications_by_location(IDPUBLICACIO, location_id);

-- Add comments
COMMENT ON MATERIALIZED VIEW dbo.publications_by_location IS 'Publications linked to location categories (TIPO=4)';
COMMENT ON COLUMN dbo.publications_by_location.IDPUBLICACIO IS 'Publication ID reference';
COMMENT ON COLUMN dbo.publications_by_location.location_name IS 'Name of the location in the official language';