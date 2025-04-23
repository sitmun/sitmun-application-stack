-- Set up roles and permissions
CREATE ROLE example_reader WITH LOGIN PASSWORD 'example_reader';

GRANT USAGE ON SCHEMA dbo TO example_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA dbo TO example_reader;

GRANT USAGE ON SCHEMA silme TO example_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA silme TO example_reader;