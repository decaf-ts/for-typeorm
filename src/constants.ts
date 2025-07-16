/**
 * @description Regular expression to identify reserved attributes in PostgreSQL
 * @summary Matches any attribute that is a PostgreSQL reserved keyword
 * @const reservedAttributes
 * @memberOf module:for-postgres
 */
export const reservedAttributes =
  /^(select|from|where|and|or|insert|update|delete|drop|create|table|index|primary|key|foreign|references|constraint|unique|check|default|null|not|as|order|by|group|having|limit|offset|join|inner|outer|left|right|full|on|using|values|returning|set|into|case|when|then|else|end|cast|coalesce|exists|any|all|some|in|between|like|ilike|similar|to|is|true|false|asc|desc|distinct|union|intersect|except|natural|lateral|window|over|partition|range|rows|unbounded|preceding|following|current|row|with|recursive|materialized|view|function|trigger|procedure|language|returns|return|declare|begin|commit|rollback|savepoint|transaction|temporary|temp|if|loop|while|for|continue|exit|raise|exception|notice|info|log|debug|assert|execute|perform|get|diagnostics|call|do|alias|comment|vacuum|analyze|explain|copy|grant|revoke|privileges|public|usage|schema|sequence|owned|owner|tablespace|storage|inherits|type|operator|collate|collation|cascade|restrict|add|alter|column|rename|to|enable|disable|force|no|instead|of|before|after|each|statement|row|execute|also|only|exclude|nulls|others|ordinality|ties|nothing|cache|cycle|increment|minvalue|maxvalue|start|restart|by|called|returns|language|immutable|stable|volatile|strict|security|definer|invoker|cost|rows|support|handler|inline|validator|options|storage|inheritance|oids|without|data|dictionary|encoding|lc_collate|lc_ctype|connection|limit|password|valid|until|superuser|nosuperuser|createdb|nocreatedb|createrole|nocreaterole|inherit|noinherit|login|nologin|replication|noreplication|bypassrls|nobypassrls|encrypted|unencrypted|new|old|session_user|current_user|current_role|current_schema|current_catalog|current_date|current_time|current_timestamp|localtime|localtimestamp|current_database|inet|cidr|macaddr|macaddr8|bit|varbit|tsvector|tsquery|uuid|xml|json|jsonb|int|integer|smallint|bigint|decimal|numeric|real|double|precision|float|boolean|bool|char|character|varchar|text|bytea|date|time|timestamp|interval|point|line|lseg|box|path|polygon|circle|money|void)$/i;

export const PostgresFlavour = "postgres";

/**
 * @description Key constants used in PostgreSQL operations
 * @summary Collection of string constants for PostgreSQL database properties and operations
 * @const PostgresKeys
 * @type {PostgrsKeysType}
 * @memberOf module:for-postgres
 */
export const PostgresKeys = {
  SEPARATOR: ".",
  ID: "id",
  VERSION: "version",
  DELETED: "deleted_at",
  TABLE: "table_name",
  SCHEMA: "schema_name",
  SEQUENCE: "sequence_name",
  INDEX: "index",
};
